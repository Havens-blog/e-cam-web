/**
 * 全局配置页纯展示逻辑单测（任务 6.6，UF-5）。
 *
 * 覆盖任务 AC 的可纯函数化部分：
 * - AC3 阈值界值与 schema.sql 1:1、越界/非整数/清空校验、保存禁用判定、草稿往返；
 * - AC1 webhook/邮箱格式校验与 tag 输入解析；
 * - AC4 CRD 表单校验、certFieldPath spec. 前缀、重复登记 409 归类；
 * - AC6 Empty 判据（尚未配置接收人）、PUT 载荷透传不丢配置；
 * - AC2 豁免域名校验/重复预判/时间展示。
 */
import { describe, expect, it } from 'vitest'
import type { CertSettings, CertThresholds } from '@/api/cert'
import {
    EMPTY_CRD_FORM,
    EXPIRY_LEVELS_LIMITS,
    THRESHOLD_FIELDS,
    buildUpdatePayload,
    draftFromThresholds,
    formatExemptionTime,
    hasThresholdErrors,
    invalidEmails,
    isDuplicateExemption,
    isReceiversEmpty,
    isValidEmail,
    mapCrdCreateError,
    parseEmailTags,
    thresholdsFromDraft,
    validateCrdForm,
    validateExemptionDomain,
    validateExpiryLevels,
    validateThresholdField,
    validateThresholdsDraft,
    validateWebhookUrl,
} from './format'

/** schema.sql DEFAULT 全量（构造合法草稿基准） */
const DEFAULT_THRESHOLDS: CertThresholds = {
    scanFreshnessHours: 24,
    verifyWindowHours: 24,
    rollbackProtectDays: 7,
    verifyConfirmProbes: 2,
    verifyProbeIntervalMinutes: 10,
    pauseTimeoutHours: 72,
    recheckDelayMinutes: 5,
    itemHeartbeatTimeoutMinutes: 30,
    scanTimeoutHours: 2,
    expiryLevels: [30, 14, 7],
}

/** 全字段越界样本（每项覆盖一个字段的非法值） */
const OUT_OF_RANGE_SAMPLES: Partial<Record<keyof CertThresholds, number>> = {
    scanFreshnessHours: 73,
    verifyWindowHours: 25,
    rollbackProtectDays: 15,
    verifyConfirmProbes: 11,
    verifyProbeIntervalMinutes: 61,
    pauseTimeoutHours: 23,
    recheckDelayMinutes: 61,
    itemHeartbeatTimeoutMinutes: 181,
    scanTimeoutHours: 13,
}

function makeSettings(patch: Partial<CertSettings> = {}): CertSettings {
    return {
        webhookUrls: ['https://hooks.example.com/alerts'],
        emailGroup: ['ops@example.com'],
        channelConfirmed: true,
        wildcardProbeOverrides: { '*.example.com': 'api.example.com' },
        thresholds: DEFAULT_THRESHOLDS,
        exemptions: [],
        ...patch,
    }
}

// ==================== AC3：阈值界值与校验 ====================

describe('THRESHOLD_FIELDS 界值表（schema.sql 1:1）', () => {
    it('覆盖全部 9 个数值型阈值字段', () => {
        expect(THRESHOLD_FIELDS).toHaveLength(9)
        expect(THRESHOLD_FIELDS.map((f) => f.key)).toEqual([
            'scanFreshnessHours',
            'verifyWindowHours',
            'rollbackProtectDays',
            'verifyConfirmProbes',
            'verifyProbeIntervalMinutes',
            'pauseTimeoutHours',
            'recheckDelayMinutes',
            'itemHeartbeatTimeoutMinutes',
            'scanTimeoutHours',
        ])
    })

    it.each([
        ['scanFreshnessHours', 1, 72, 24],
        ['verifyWindowHours', 2, 24, 24],
        ['rollbackProtectDays', 7, 14, 7],
        ['verifyConfirmProbes', 1, 10, 2],
        ['verifyProbeIntervalMinutes', 5, 60, 10],
        ['pauseTimeoutHours', 24, 168, 72],
        ['recheckDelayMinutes', 1, 60, 5],
        ['itemHeartbeatTimeoutMinutes', 5, 180, 30],
        ['scanTimeoutHours', 1, 12, 2],
    ] as const)('%s 界值与默认值与 schema.sql 一致', (key, min, max, def) => {
        const f = THRESHOLD_FIELDS.find((x) => x.key === key)
        expect(f).toBeDefined()
        expect(f?.min).toBe(min)
        expect(f?.max).toBe(max)
        expect(f?.default).toBe(def)
        // 默认值本身必须落在界内（界值表自洽）
        expect(validateThresholdField(f!, def)).toBe('')
    })

    it('到期分级界值与 schema.sql 一致（1~5 档、每档 1~90、默认 [30,14,7]）', () => {
        expect(EXPIRY_LEVELS_LIMITS.minItems).toBe(1)
        expect(EXPIRY_LEVELS_LIMITS.maxItems).toBe(5)
        expect(EXPIRY_LEVELS_LIMITS.min).toBe(1)
        expect(EXPIRY_LEVELS_LIMITS.max).toBe(90)
        expect([...EXPIRY_LEVELS_LIMITS.defaults]).toEqual([30, 14, 7])
    })
})

describe('validateThresholdField 单字段校验', () => {
    const scanDef = THRESHOLD_FIELDS.find((f) => f.key === 'scanFreshnessHours')!

    it('界内值通过（含边界值）', () => {
        expect(validateThresholdField(scanDef, 1)).toBe('')
        expect(validateThresholdField(scanDef, 72)).toBe('')
        expect(validateThresholdField(scanDef, 24)).toBe('')
    })

    it('越界值报合法区间', () => {
        expect(validateThresholdField(scanDef, 0)).toContain('1~72')
        expect(validateThresholdField(scanDef, 73)).toContain('1~72')
    })

    it('清空（null）与非整数报错', () => {
        expect(validateThresholdField(scanDef, null)).not.toBe('')
        expect(validateThresholdField(scanDef, Number.NaN)).not.toBe('')
        expect(validateThresholdField(scanDef, 24.5)).toContain('整数')
    })

    it('错误文案含单位', () => {
        expect(validateThresholdField(scanDef, 0)).toContain('小时')
    })
})

describe('validateExpiryLevels 到期分级校验', () => {
    it('默认 [30,14,7] 通过', () => {
        expect(validateExpiryLevels([30, 14, 7])).toBe('')
    })

    it('空数组与超档数报错', () => {
        expect(validateExpiryLevels([])).not.toBe('')
        expect(validateExpiryLevels([30, 14, 7, 60, 45, 10])).not.toBe('')
    })

    it('单档越界与非整数报错', () => {
        expect(validateExpiryLevels([0])).not.toBe('')
        expect(validateExpiryLevels([91])).not.toBe('')
        expect(validateExpiryLevels([30.5])).not.toBe('')
    })

    it('重复天数报错', () => {
        expect(validateExpiryLevels([30, 30, 7])).toContain('重复')
    })
})

describe('validateThresholdsDraft / hasThresholdErrors / 草稿往返', () => {
    it('schema 默认全量校验通过（保存不禁用）', () => {
        const errs = validateThresholdsDraft(draftFromThresholds(DEFAULT_THRESHOLDS))
        expect(errs.numeric).toEqual({})
        expect(errs.expiryLevels).toBe('')
        expect(hasThresholdErrors(errs)).toBe(false)
    })

    it.each(Object.keys(OUT_OF_RANGE_SAMPLES) as (keyof typeof OUT_OF_RANGE_SAMPLES)[])(
        '%s 越界时逐字段报错且保存禁用',
        (key) => {
            const draft = draftFromThresholds(DEFAULT_THRESHOLDS)
            draft.numeric[key as keyof typeof draft.numeric] = OUT_OF_RANGE_SAMPLES[key]!
            const errs = validateThresholdsDraft(draft)
            expect(Object.keys(errs.numeric)).toEqual([key])
            expect(hasThresholdErrors(errs)).toBe(true)
        },
    )

    it('清空任一字段即报错（null 输入拦截）', () => {
        const draft = draftFromThresholds(DEFAULT_THRESHOLDS)
        draft.numeric.verifyWindowHours = null
        const errs = validateThresholdsDraft(draft)
        expect(errs.numeric.verifyWindowHours).not.toBe('')
        expect(hasThresholdErrors(errs)).toBe(true)
    })

    it('expiryLevels 非法时 expiryLevels 通道报错', () => {
        const draft = draftFromThresholds(DEFAULT_THRESHOLDS)
        draft.expiryLevels = []
        const errs = validateThresholdsDraft(draft)
        expect(errs.expiryLevels).not.toBe('')
        expect(hasThresholdErrors(errs)).toBe(true)
    })

    it('draftFromThresholds / thresholdsFromDraft 往返一致（草稿副本不共享引用）', () => {
        const draft = draftFromThresholds(DEFAULT_THRESHOLDS)
        draft.expiryLevels.push(60)
        expect(DEFAULT_THRESHOLDS.expiryLevels).toEqual([30, 14, 7])
        const restored = thresholdsFromDraft(draftFromThresholds(DEFAULT_THRESHOLDS))
        expect(restored).toEqual(DEFAULT_THRESHOLDS)
    })
})

// ==================== AC1：告警接收校验 ====================

describe('validateWebhookUrl', () => {
    it('http/https 通过', () => {
        expect(validateWebhookUrl('https://hooks.example.com/alerts/ssl-cert')).toBe('')
        expect(validateWebhookUrl('http://intranet-hook.local/x')).toBe('')
    })

    it('非 http(s) 与空串报错', () => {
        expect(validateWebhookUrl('ftp://hooks.example.com')).not.toBe('')
        expect(validateWebhookUrl('hooks.example.com')).not.toBe('')
        expect(validateWebhookUrl('')).not.toBe('')
    })
})

describe('邮箱校验与 tag 解析', () => {
    it('isValidEmail 常规样本', () => {
        expect(isValidEmail('ops-team@example.com')).toBe(true)
        expect(isValidEmail('sre-oncall@example.co')).toBe(true)
        expect(isValidEmail('a b@example.com')).toBe(false)
        expect(isValidEmail('no-tld@example')).toBe(false)
        expect(isValidEmail('@example.com')).toBe(false)
    })

    it('invalidEmails 标记非法项', () => {
        expect(invalidEmails(['ops@example.com', 'bad@mail'])).toEqual(['bad@mail'])
        expect(invalidEmails(['ops@example.com'])).toEqual([])
    })

    it('parseEmailTags 兼容英文/全角逗号与空白，去空项', () => {
        expect(parseEmailTags('ops@example.com, sre@example.com')).toEqual([
            'ops@example.com',
            'sre@example.com',
        ])
        expect(parseEmailTags('ops@example.com，sre@example.com')).toHaveLength(2)
        expect(parseEmailTags('a@b.c  d@e.f')).toEqual(['a@b.c', 'd@e.f'])
        expect(parseEmailTags(' , ， ')).toEqual([])
    })
})

// ==================== AC6：Empty 判据与载荷组装 ====================

describe('isReceiversEmpty（尚未配置接收人 Empty 态）', () => {
    it('webhook 与邮件组均为空 → Empty', () => {
        expect(isReceiversEmpty(makeSettings({ webhookUrls: [], emailGroup: [] }))).toBe(true)
    })

    it('任一通道有接收人 → 非 Empty', () => {
        expect(isReceiversEmpty(makeSettings({ emailGroup: [] }))).toBe(false)
        expect(isReceiversEmpty(makeSettings({ webhookUrls: [] }))).toBe(false)
    })
})

describe('buildUpdatePayload（分卡保存不丢配置）', () => {
    it('保存告警接收时透传阈值与通配符替代清单', () => {
        const payload = buildUpdatePayload(makeSettings(), { webhookUrls: ['https://new.example.com/hook'], emailGroup: ['new@example.com'] })
        expect(payload.webhookUrls).toEqual(['https://new.example.com/hook'])
        expect(payload.emailGroup).toEqual(['new@example.com'])
        expect(payload.thresholds).toEqual(DEFAULT_THRESHOLDS)
        expect(payload.wildcardProbeOverrides).toEqual({ '*.example.com': 'api.example.com' })
    })

    it('保存阈值时透传告警接收与验证窗口路由', () => {
        const route = { enabled: true, webhookUrls: ['https://r.example.com'], emailGroup: ['r@example.com'] }
        const s = makeSettings({ verifyWindowRoute: route })
        const newThresholds = { ...DEFAULT_THRESHOLDS, scanFreshnessHours: 48 }
        const payload = buildUpdatePayload(s, { thresholds: newThresholds })
        expect(payload.thresholds).toEqual(newThresholds)
        expect(payload.webhookUrls).toEqual(s.webhookUrls)
        expect(payload.emailGroup).toEqual(s.emailGroup)
        expect(payload.verifyWindowRoute).toEqual(route)
    })
})

// ==================== AC2：豁免清单 ====================

describe('豁免域名校验与重复预判', () => {
    it('常规/通配符子域名通过', () => {
        expect(validateExemptionDomain('intranet.example.com')).toBe('')
        expect(validateExemptionDomain('*.legacy.example.com')).toBe('')
    })

    it('空/含空白/无点/非法字符报错', () => {
        expect(validateExemptionDomain('')).not.toBe('')
        expect(validateExemptionDomain('   ')).not.toBe('')
        expect(validateExemptionDomain('a b.example.com')).not.toBe('')
        expect(validateExemptionDomain('localhost')).not.toBe('')
        expect(validateExemptionDomain('bad_domain!')).not.toBe('')
    })

    it('isDuplicateExemption 大小写不敏感预判', () => {
        const list = [{ domain: 'Intranet.Example.com', createdAt: '2026-07-20T00:00:00Z' }]
        expect(isDuplicateExemption('intranet.example.com', list)).toBe(true)
        expect(isDuplicateExemption('other.example.com', list)).toBe(false)
    })

    it('formatExemptionTime 输出 YYYY-MM-DD，无效值回退 —', () => {
        expect(formatExemptionTime('2026-07-20T10:30:00Z')).toMatch(/^2026-07-(19|20|21)$/)
        expect(formatExemptionTime('')).toBe('—')
        expect(formatExemptionTime('not-a-date')).toBe('—')
    })
})

// ==================== AC4：CRD 登记管理 ====================

describe('validateCrdForm（登记表单）', () => {
    const VALID = {
        clusterId: 'prod-k8s-01',
        apiGroup: 'networking.example.com',
        kind: 'Certificate',
        certFieldPath: 'spec.certificates[].certificateId',
    }

    it('完整合法表单通过', () => {
        expect(validateCrdForm(VALID)).toEqual({})
    })

    it('空表单逐字段报错', () => {
        const errs = validateCrdForm(EMPTY_CRD_FORM)
        expect(Object.keys(errs).sort()).toEqual(['apiGroup', 'certFieldPath', 'clusterId', 'kind'])
    })

    it('certFieldPath 需以 spec. 开头且不含空白', () => {
        expect(validateCrdForm({ ...VALID, certFieldPath: 'metadata.annotations.cert' })?.certFieldPath).toContain('spec.')
        expect(validateCrdForm({ ...VALID, certFieldPath: 'spec.cert id' })?.certFieldPath).toContain('空白')
    })

    it('kind 含空白报错', () => {
        expect(validateCrdForm({ ...VALID, kind: 'Gateway Class' })?.kind).toContain('空白')
    })
})

describe('mapCrdCreateError（重复登记 409 归类）', () => {
    it('CRD_DUPLICATE 错误码归类为重复登记并附提示', () => {
        const r = mapCrdCreateError({ code: 'CRD_DUPLICATE', message: 'duplicate registration' })
        expect(r.duplicate).toBe(true)
        expect(r.message).toContain('已登记')
    })

    it('中文重复语义归类为重复登记', () => {
        expect(mapCrdCreateError({ code: 'UNKNOWN', message: '该组合已存在' }).duplicate).toBe(true)
        expect(mapCrdCreateError({ code: '', message: '重复登记' }).duplicate).toBe(true)
    })

    it('其他错误原样透传服务端信息', () => {
        const r = mapCrdCreateError({ code: 'FORBIDDEN', message: '权限不足' })
        expect(r.duplicate).toBe(false)
        expect(r.message).toBe('权限不足')
    })

    it('无信息时回退通用文案', () => {
        const r = mapCrdCreateError({})
        expect(r.duplicate).toBe(false)
        expect(r.message).not.toBe('')
    })
})
