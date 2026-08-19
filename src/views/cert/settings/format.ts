/**
 * 全局配置页纯展示逻辑（任务 6.6，UF-5）。
 *
 * 无 Vue / DOM 运行时依赖，可被 node 环境单测直接导入
 * （同 src/views/cert/{ledger,detail,dashboard,changes}/format.ts 约定）。
 *
 * 依据：docs/features/ssl-cert-management/ui/ui-design.md
 * 「Component: 全局配置页（主管）」、prd/prd-ui-functions.md UF-5、
 * design/tech-design.md「自定义 CRD 登记管理」「到期分级告警（去重状态机）thresholds」、
 * design/schema.sql cert_alert_config.thresholds 界值、ui/prototype/settings.html。
 *
 * Hard Rules（任务 6.6）：
 * - 阈值界值前端校验仅为体验，保存前服务端仍校验（PUT 越界 400 由页面行内呈现，
 *   本模块只产出前端界值常量与校验，不替代服务端）。
 * - 页面对非主管/审计角色的隐藏与拦截由 6.1 路由守卫（certManageOnly）完成，
 *   本模块不含任何角色判定（不重复实现）。
 *
 * 界值口径：THRESHOLD_FIELDS 与 design/schema.sql cert_alert_config.thresholds
 * 的 minimum/maximum/DEFAULT 逐字段 1:1（单一常量文件供卡片渲染与校验共用）。
 * 注意：prototype settings.html 扫描新鲜度写作 1~168，与 schema.sql（1~72）冲突，
 * 以 schema.sql 为准（见任务 AC「界值与后端一致」）。
 *
 * 交叉约束说明：ui-design 提示「回滚保护期 ≥ 验证窗口」，但 schema.sql 界值结构
 * （verifyWindowHours 上限 24h < rollbackProtectDays 下限 7d）已结构性保证该约束
 * 恒成立，故前端不做交叉校验，仅保留提示文案（见 THRESHOLD_FIELDS hint）。
 */

import type { CertExemption, CertSettings, CertThresholds, UpdateCertSettingsPayload } from '@/api/cert'

// ==================== 阈值界值常量（schema.sql 1:1） ====================

/** 数值型阈值键（expiryLevels 为数组，单独处理） */
export type NumericThresholdKey =
    | 'scanFreshnessHours'
    | 'verifyWindowHours'
    | 'rollbackProtectDays'
    | 'verifyConfirmProbes'
    | 'verifyProbeIntervalMinutes'
    | 'pauseTimeoutHours'
    | 'recheckDelayMinutes'
    | 'itemHeartbeatTimeoutMinutes'
    | 'scanTimeoutHours'

/** 数值型阈值字段定义（min/max/default 与 schema.sql 一致） */
export interface ThresholdFieldDef {
    key: NumericThresholdKey
    label: string
    min: number
    max: number
    default: number
    /** 数值单位（错误提示与 hint 用） */
    unit: string
    /** 输入框下方的补充说明 */
    hint: string
}

/** 全部数值型阈值界值表（渲染与校验共用；顺序即卡片渲染顺序） */
export const THRESHOLD_FIELDS: readonly ThresholdFieldDef[] = [
    {
        key: 'scanFreshnessHours',
        label: '扫描新鲜度',
        min: 1,
        max: 72,
        default: 24,
        unit: '小时',
        hint: '默认 24h，超期快照阻断变更清单生成',
    },
    {
        key: 'verifyWindowHours',
        label: '验证窗口',
        min: 2,
        max: 24,
        default: 24,
        unit: '小时',
        hint: '默认 24h，变更后验证观察时长',
    },
    {
        key: 'rollbackProtectDays',
        label: '回滚保护期',
        min: 7,
        max: 14,
        default: 7,
        unit: '天',
        hint: '默认 7 天；区间结构保证恒 ≥ 验证窗口（24h 上限 < 7 天下限）',
    },
    {
        key: 'verifyConfirmProbes',
        label: '窗口达标连续探测次数',
        min: 1,
        max: 10,
        default: 2,
        unit: '次',
        hint: '默认 2 次，窗口内提频探测连续一致即达标',
    },
    {
        key: 'verifyProbeIntervalMinutes',
        label: '窗口内探测提频周期',
        min: 5,
        max: 60,
        default: 10,
        unit: '分钟',
        hint: '默认 10 分钟，窗口关闭/达标后回落天级',
    },
    {
        key: 'pauseTimeoutHours',
        label: '批间暂停超时',
        min: 24,
        max: 168,
        default: 72,
        unit: '小时',
        hint: '默认 72 小时，超时自动取消并通知（互斥活性保障）',
    },
    {
        key: 'recheckDelayMinutes',
        label: 'CRD 复检延迟',
        min: 1,
        max: 60,
        default: 5,
        unit: '分钟',
        hint: '默认 5 分钟，K8s patch 后单轮复检的延迟',
    },
    {
        key: 'itemHeartbeatTimeoutMinutes',
        label: '执行项心跳超时',
        min: 5,
        max: 180,
        default: 30,
        unit: '分钟',
        hint: '默认 30 分钟，超时项标失败并告警',
    },
    {
        key: 'scanTimeoutHours',
        label: '扫描快照超时',
        min: 1,
        max: 12,
        default: 2,
        unit: '小时',
        hint: '默认 2 小时，running 快照超时转 failed 释放防重锁',
    },
]

/** 到期分级天数（数组型阈值）界值（schema.sql expiryLevels） */
export const EXPIRY_LEVELS_LIMITS = {
    /** 分级档数下限 */
    minItems: 1,
    /** 分级档数上限 */
    maxItems: 5,
    /** 单档天数下限 */
    min: 1,
    /** 单档天数上限 */
    max: 90,
    /** 默认分级（schema.sql DEFAULT=[30,14,7]） */
    defaults: [30, 14, 7],
} as const

/** 阈值草稿（编辑中形态：数值字段允许 null=已清空，等待校验拦下） */
export interface ThresholdsDraft {
    numeric: Record<NumericThresholdKey, number | null>
    expiryLevels: number[]
}

/** 阈值逐字段错误信息（值为空串表示该字段无错误） */
export type ThresholdsErrors = {
    numeric: Partial<Record<NumericThresholdKey, string>>
    expiryLevels: string
}

/** 从服务端阈值构造编辑草稿 */
export function draftFromThresholds(t: CertThresholds): ThresholdsDraft {
    return {
        numeric: {
            scanFreshnessHours: t.scanFreshnessHours,
            verifyWindowHours: t.verifyWindowHours,
            rollbackProtectDays: t.rollbackProtectDays,
            verifyConfirmProbes: t.verifyConfirmProbes,
            verifyProbeIntervalMinutes: t.verifyProbeIntervalMinutes,
            pauseTimeoutHours: t.pauseTimeoutHours,
            recheckDelayMinutes: t.recheckDelayMinutes,
            itemHeartbeatTimeoutMinutes: t.itemHeartbeatTimeoutMinutes,
            scanTimeoutHours: t.scanTimeoutHours,
        },
        expiryLevels: [...t.expiryLevels],
    }
}

/** 校验后的草稿回填为提交载荷（仅在无错误时调用） */
export function thresholdsFromDraft(d: ThresholdsDraft): CertThresholds {
    return {
        scanFreshnessHours: d.numeric.scanFreshnessHours ?? 0,
        verifyWindowHours: d.numeric.verifyWindowHours ?? 0,
        rollbackProtectDays: d.numeric.rollbackProtectDays ?? 0,
        verifyConfirmProbes: d.numeric.verifyConfirmProbes ?? 0,
        verifyProbeIntervalMinutes: d.numeric.verifyProbeIntervalMinutes ?? 0,
        pauseTimeoutHours: d.numeric.pauseTimeoutHours ?? 0,
        recheckDelayMinutes: d.numeric.recheckDelayMinutes ?? 0,
        itemHeartbeatTimeoutMinutes: d.numeric.itemHeartbeatTimeoutMinutes ?? 0,
        scanTimeoutHours: d.numeric.scanTimeoutHours ?? 0,
        expiryLevels: [...d.expiryLevels],
    }
}

/** 单个数值字段校验：空串=通过，否则为错误文案 */
export function validateThresholdField(def: ThresholdFieldDef, value: number | null): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return `${def.label}不能为空（合法区间 ${def.min}~${def.max} ${def.unit}）`
    }
    if (!Number.isInteger(value)) {
        return `${def.label}需为整数（合法区间 ${def.min}~${def.max} ${def.unit}）`
    }
    if (value < def.min || value > def.max) {
        return `合法区间 ${def.min}~${def.max} ${def.unit}`
    }
    return ''
}

/** 到期分级数组校验：空串=通过 */
export function validateExpiryLevels(levels: number[]): string {
    if (levels.length < EXPIRY_LEVELS_LIMITS.minItems || levels.length > EXPIRY_LEVELS_LIMITS.maxItems) {
        return `需 ${EXPIRY_LEVELS_LIMITS.minItems}~${EXPIRY_LEVELS_LIMITS.maxItems} 个分级档`
    }
    for (const lv of levels) {
        if (!Number.isInteger(lv) || lv < EXPIRY_LEVELS_LIMITS.min || lv > EXPIRY_LEVELS_LIMITS.max) {
            return `每档需为 ${EXPIRY_LEVELS_LIMITS.min}~${EXPIRY_LEVELS_LIMITS.max} 的整数天数`
        }
    }
    if (new Set(levels).size !== levels.length) {
        return '分级天数不得重复'
    }
    return ''
}

/** 全量阈值校验（卡片保存禁用与行内 Error 边框的依据） */
export function validateThresholdsDraft(d: ThresholdsDraft): ThresholdsErrors {
    const numeric: ThresholdsErrors['numeric'] = {}
    for (const def of THRESHOLD_FIELDS) {
        const err = validateThresholdField(def, d.numeric[def.key])
        if (err) numeric[def.key] = err
    }
    return { numeric, expiryLevels: validateExpiryLevels(d.expiryLevels) }
}

/** 是否存在任一阈值���误（true → 保存按钮禁用） */
export function hasThresholdErrors(errs: ThresholdsErrors): boolean {
    return errs.expiryLevels !== '' || Object.keys(errs.numeric).length > 0
}

// ==================== 告警接收校验 ====================

/** Webhook URL 格式（prototype：^https?:\/\/.+） */
const WEBHOOK_URL_PATTERN = /^https?:\/\/.+/

/** 单个 Webhook URL 校验：空串=通过 */
export function validateWebhookUrl(url: string): string {
    if (!WEBHOOK_URL_PATTERN.test(url)) {
        return 'Webhook URL 需以 http:// 或 https:// 开头'
    }
    return ''
}

/** 邮箱格式（prototype：^[^@\s]+@[^@\s]+\.[^@\s]+$） */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** 单个邮箱校验 */
export function isValidEmail(email: string): boolean {
    return EMAIL_PATTERN.test(email)
}

/** 标记输入中的非法邮箱（行内提示用） */
export function invalidEmails(emails: readonly string[]): string[] {
    return emails.filter((e) => !isValidEmail(e))
}

/** 邮件 tag 输入解析：英文/全角逗号与空白分隔，去空项 */
export function parseEmailTags(input: string): string[] {
    return input
        .split(/[,，\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
}

// ==================== 页面状态推导 ====================

/** 是否「尚未配置接收人」（页面 Empty 态判据：webhook 与邮件组均为空） */
export function isReceiversEmpty(settings: CertSettings): boolean {
    return settings.webhookUrls.length === 0 && settings.emailGroup.length === 0
}

// ==================== 保存载荷组装 ====================

/**
 * 组装 PUT /certs/settings 载荷：patch 仅覆盖告警接收或阈值之一
 * （两张卡各自保存，其余字段自最近一次服务端配置原样透传，不丢配置）。
 */
export function buildUpdatePayload(
    settings: CertSettings,
    patch: { webhookUrls?: string[]; emailGroup?: string[]; thresholds?: CertThresholds },
): UpdateCertSettingsPayload {
    return {
        webhookUrls: patch.webhookUrls ?? settings.webhookUrls,
        emailGroup: patch.emailGroup ?? settings.emailGroup,
        verifyWindowRoute: settings.verifyWindowRoute,
        wildcardProbeOverrides: settings.wildcardProbeOverrides,
        thresholds: patch.thresholds ?? settings.thresholds,
    }
}

// ==================== 豁免清单 ====================

/** 豁免域名格式：非空、无空白、域名符号集且含点（支持通配符前缀） */
const EXEMPTION_DOMAIN_PATTERN = /^\*?[a-z0-9*.-]+$/i

/** 豁免域名校验：空串=通过 */
export function validateExemptionDomain(domain: string): string {
    const v = domain.trim()
    if (!v) return '子域名不能为空'
    if (/\s/.test(v)) return '子域名不能包含空白字符'
    if (!v.includes('.')) return '子域名需包含域分隔点（如 intranet.example.com）'
    if (!EXEMPTION_DOMAIN_PATTERN.test(v)) return '子域名仅可包含字母、数字、点、连字符（可含 * 前缀）'
    return ''
}

/** 拟添加豁免是否与现有清单重复（前端预判，服务端仍兜底） */
export function isDuplicateExemption(domain: string, exemptions: readonly CertExemption[]): boolean {
    const v = domain.trim().toLowerCase()
    return exemptions.some((e) => e.domain.trim().toLowerCase() === v)
}

/** 豁免时间展示（YYYY-MM-DD；无效值回退 — ） */
export function formatExemptionTime(iso: string): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ==================== CRD 登记管理 ====================

/** CRD 登记表单状态 */
export interface CrdFormState {
    clusterId: string
    apiGroup: string
    kind: string
    certFieldPath: string
}

export const EMPTY_CRD_FORM: CrdFormState = { clusterId: '', apiGroup: '', kind: '', certFieldPath: '' }

/**
 * CRD 登记表单校验：空串=通过。
 * certFieldPath 需以 spec. 开头（tech-design「仅接受 spec 中含云托管证书 ID/名称
 * 引用字段的网关类资源」，如 spec.certificates[].certificateId）；服务端仍权威。
 */
export function validateCrdForm(f: CrdFormState): Partial<Record<keyof CrdFormState, string>> {
    const errors: Partial<Record<keyof CrdFormState, string>> = {}
    if (!f.clusterId.trim()) errors.clusterId = '集群 ID 不能为空'
    if (!f.apiGroup.trim()) errors.apiGroup = 'apiGroup 不能为空（如 networking.example.com）'
    if (!f.kind.trim()) {
        errors.kind = 'Kind 不能为空（如 Certificate）'
    } else if (/\s/.test(f.kind)) {
        errors.kind = 'Kind 不能包含空白字符'
    }
    const path = f.certFieldPath.trim()
    if (!path) {
        errors.certFieldPath = '证书引用字段路径不能为空'
    } else if (/\s/.test(path)) {
        errors.certFieldPath = '字段路径不能包含空白字符'
    } else if (!path.startsWith('spec.')) {
        errors.certFieldPath = '字段路径需以 spec. 开头（如 spec.certificates[].certificateId）'
    }
    return errors
}

/** CRD 登记错误归类：duplicate=true 时按「重复登记 409」行内呈现 */
export function mapCrdCreateError(err: { code?: string; message?: string }): { duplicate: boolean; message: string } {
    const code = err.code ?? ''
    const message = err.message || '登记失败，请重试'
    const duplicate = /duplicate/i.test(code) || /重复|已登记|已存在/.test(message)
    return { duplicate, message: duplicate ? `该 CRD 已登记（clusterId+apiGroup+kind 唯一）：${message}` : message }
}
