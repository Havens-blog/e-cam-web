import { describe, expect, it } from 'vitest'
import { CertRequestError } from '@/api/cert'
import type { DiscoveryPreviewEntry } from '@/api/cert'
import {
    DISCOVERY_ERR_NO_SNAPSHOT,
    DISCOVERY_NOT_AFTER_PENDING,
    DISCOVERY_SNAPSHOT_STALE_DAYS,
    cloudDisplayName,
    defaultSelection,
    discoveryEntryKey,
    formatNotAfter,
    formatSnapshotTime,
    groupPreviewEntries,
    groupSelectableKeys,
    isEntrySelectable,
    isNoSnapshotError,
    isSnapshotStale,
    parseReasonHint,
    summarizePreview,
    type DiscoveryGroup,
} from './discovery'

/** 分组断言辅助：安全取首组（noUncheckedIndexedAccess 下索引访问守卫） */
function firstGroup(items: DiscoveryPreviewEntry[]): DiscoveryGroup {
    const [g] = groupPreviewEntries(items)
    if (!g) throw new Error('expected at least one group')
    return g
}

/** 构造预览条目（缺省为未登记可解析常态） */
function entry(partial: Partial<DiscoveryPreviewEntry> & { cloud: string; cloudCertId: string }): DiscoveryPreviewEntry {
    return {
        accountKey: 'acc-1',
        refCount: 1,
        inLedger: false,
        notAfter: DISCOVERY_NOT_AFTER_PENDING,
        parseable: true,
        ...partial,
    }
}

// ==================== AC2：可勾选判定（灰选/不可选组语义） ====================

describe('isEntrySelectable（parseable 且未在台账才可勾选，AC2）', () => {
    it('未登记可解析条目可选', () => {
        expect(isEntrySelectable(entry({ cloud: 'aliyun', cloudCertId: 'c1' }))).toBe(true)
    })

    it('已在台账条目不可勾（灰选展示）', () => {
        expect(isEntrySelectable(entry({ cloud: 'aliyun', cloudCertId: 'c1', inLedger: true }))).toBe(false)
    })

    it('不可解析条目（华为云/AWS IAM-hosted）不可勾', () => {
        expect(
            isEntrySelectable(entry({ cloud: 'huawei', cloudCertId: 'c1', parseable: false, parseReason: 'unsupported_cloud' })),
        ).toBe(false)
    })

    it('deferred_parse 保持可选（导入时解析，不归入不可选组）', () => {
        expect(
            isEntrySelectable(entry({ cloud: 'tencent', cloudCertId: 'c1', parseReason: 'deferred_parse' })),
        ).toBe(true)
    })
})

// ==================== AC2：默认勾选全部未登记可选项 ====================

describe('defaultSelection（默认全选未登记可选项，AC2）', () => {
    const items = [
        entry({ cloud: 'aliyun', cloudCertId: 'a-new', accountKey: 'acc-1' }),
        entry({ cloud: 'aliyun', cloudCertId: 'a-in', accountKey: 'acc-1', inLedger: true, notAfter: '2027-01-01T00:00:00Z' }),
        entry({ cloud: 'huawei', cloudCertId: 'h-1', parseable: false, parseReason: 'unsupported_cloud' }),
        entry({ cloud: 'tencent', cloudCertId: 't-defer', accountKey: 'acc-2', parseReason: 'deferred_parse' }),
    ]

    it('仅含未登记且可解析条目（已在台账与不可解析组不含）', () => {
        const sel = defaultSelection(items)
        expect([...sel].sort()).toEqual(['aliyun|acc-1|a-new', 'tencent|acc-2|t-defer'].sort())
    })

    it('空清单 → 空集', () => {
        expect(defaultSelection([]).size).toBe(0)
    })
})

// ==================== AC2：按云分组与不可选组提示 ====================

describe('groupPreviewEntries（按云分组 + 不可选组标记提示，AC2）', () => {
    it('已知云按固定顺序分组，未知云字典序垫底', () => {
        const groups = groupPreviewEntries([
            entry({ cloud: 'huawei', cloudCertId: 'h1' }),
            entry({ cloud: 'aliyun', cloudCertId: 'a1' }),
            entry({ cloud: 'zzz-cloud', cloudCertId: 'z1' }),
            entry({ cloud: 'tencent', cloudCertId: 't1' }),
        ])
        expect(groups.map((g) => g.cloud)).toEqual(['aliyun', 'tencent', 'huawei', 'zzz-cloud'])
        expect(groups.map((g) => g.label)).toEqual(['阿里云', '腾讯云', '华为云', 'zzz-cloud'])
    })

    it('华为云整组不可选且带「暂不支持自动解析」提示', () => {
        const g = firstGroup([
            entry({ cloud: 'huawei', cloudCertId: 'h1', parseable: false, parseReason: 'unsupported_cloud' }),
            entry({ cloud: 'huawei', cloudCertId: 'h2', parseable: false, parseReason: 'unsupported_cloud' }),
        ])
        expect(g.unsupported).toBe(true)
        expect(g.unsupportedHint).toContain('暂不支持自动解析')
        expect(g.unsupportedHint).toContain('整组不可选择')
    })

    it('AWS IAM-hosted（非 ARN）条目整组不可选且提示 IAM-hosted', () => {
        const g = firstGroup([
            entry({ cloud: 'aws', cloudCertId: 'cert-123', parseable: false, parseReason: 'iam_hosted' }),
        ])
        expect(g.unsupported).toBe(true)
        expect(g.unsupportedHint).toContain('IAM-hosted')
    })

    it('混合组（存在可解析条目）不标记不可选——降级提示只针对整组不可解析', () => {
        const g = firstGroup([
            entry({ cloud: 'aws', cloudCertId: 'arn:aws:acm:...', parseable: true }),
            entry({ cloud: 'aws', cloudCertId: 'cert-123', parseable: false, parseReason: 'iam_hosted' }),
        ])
        expect(g.unsupported).toBe(false)
        expect(g.unsupportedHint).toBe('')
    })

    it('组内条目保持原始顺序（预览返回序）', () => {
        const g = firstGroup([
            entry({ cloud: 'aliyun', cloudCertId: 'a2', accountKey: 'acc-2' }),
            entry({ cloud: 'aliyun', cloudCertId: 'a1', accountKey: 'acc-1' }),
        ])
        expect(g.entries.map((e) => e.cloudCertId)).toEqual(['a2', 'a1'])
    })

    it('空清单 → 空分组数组', () => {
        expect(groupPreviewEntries([])).toEqual([])
    })
})

describe('groupSelectableKeys（组内可选项键集，AC2 交互）', () => {
    it('仅返回组内可勾选条目键（已在台账/不可解析排除）', () => {
        const g = firstGroup([
            entry({ cloud: 'aliyun', cloudCertId: 'a1', accountKey: 'acc-1' }),
            entry({ cloud: 'aliyun', cloudCertId: 'a2', accountKey: 'acc-1', inLedger: true, notAfter: '2027-01-01T00:00:00Z' }),
        ])
        expect(groupSelectableKeys(g)).toEqual(['aliyun|acc-1|a1'])
    })
})

// ==================== AC2/AC3：条目级提示与 notAfter 占位 ====================

describe('parseReasonHint（条目级降级提示，AC2）', () => {
    it('deferred_parse → 导入时解析', () => {
        expect(parseReasonHint('deferred_parse')).toBe('导入时解析')
    })
    it('unsupported_cloud / iam_hosted → 暂不支持文案', () => {
        expect(parseReasonHint('unsupported_cloud')).toContain('暂不支持自动解析')
        expect(parseReasonHint('iam_hosted')).toContain('IAM-hosted')
    })
    it('未知/缺省 → 空串', () => {
        expect(parseReasonHint(undefined)).toBe('')
        expect(parseReasonHint('other')).toBe('')
    })
})

describe('formatNotAfter（未登记占位显示，AC3）', () => {
    it('未登记占位文案与空串统一为「—（导入后补全）」', () => {
        expect(formatNotAfter(DISCOVERY_NOT_AFTER_PENDING)).toBe(DISCOVERY_NOT_AFTER_PENDING)
        expect(formatNotAfter('')).toBe(DISCOVERY_NOT_AFTER_PENDING)
    })
    it('台账 RFC3339 值 → UTC 日期展示', () => {
        expect(formatNotAfter('2027-03-05T08:09:10Z')).toBe('2027-03-05')
    })
    it('非时间字符串原样返回（不抛错）', () => {
        expect(formatNotAfter('not-a-date')).toBe('not-a-date')
    })
})

// ==================== AC3：快照超 7 天判定 ====================

describe('isSnapshotStale（snapshotStartedAt 超 7 天，AC3）', () => {
    const now = new Date('2026-08-25T12:00:00Z')

    it('恰 7 天（168h）不提示——超时才提示', () => {
        expect(isSnapshotStale('2026-08-18T12:00:00Z', now)).toBe(false)
    })
    it('超 7 天 → 过期提示', () => {
        expect(isSnapshotStale('2026-08-18T11:59:59Z', now)).toBe(true)
        expect(isSnapshotStale('2026-08-01T00:00:00Z', now)).toBe(true)
    })
    it('新鲜快照不提示', () => {
        expect(isSnapshotStale('2026-08-25T00:00:00Z', now)).toBe(false)
    })
    it('空值/非法值不误报', () => {
        expect(isSnapshotStale(undefined, now)).toBe(false)
        expect(isSnapshotStale('', now)).toBe(false)
        expect(isSnapshotStale('not-a-date', now)).toBe(false)
    })
    it('阈值为 7 天', () => {
        expect(DISCOVERY_SNAPSHOT_STALE_DAYS).toBe(7)
    })
})

describe('formatSnapshotTime（快照时间展示）', () => {
    it('RFC3339 → UTC 分钟粒度展示', () => {
        expect(formatSnapshotTime('2026-08-25T08:05:07Z')).toBe('2026-08-25 08:05 UTC')
    })
    it('空值 → 空串', () => {
        expect(formatSnapshotTime(undefined)).toBe('')
        expect(formatSnapshotTime('')).toBe('')
    })
})

// ==================== 汇总与工具 ====================

describe('summarizePreview（顶部摘要计数）', () => {
    it('四计数互斥聚合', () => {
        const s = summarizePreview([
            entry({ cloud: 'aliyun', cloudCertId: 'a1' }),
            entry({ cloud: 'aliyun', cloudCertId: 'a2', inLedger: true, notAfter: '2027-01-01T00:00:00Z' }),
            entry({ cloud: 'huawei', cloudCertId: 'h1', parseable: false, parseReason: 'unsupported_cloud' }),
        ])
        expect(s).toEqual({ total: 3, inLedger: 1, selectable: 1, unsupported: 1 })
    })
})

describe('discoveryEntryKey（三元组唯一键）', () => {
    it('cloud|accountKey|cloudCertId 拼接', () => {
        expect(discoveryEntryKey({ cloud: 'aws', accountKey: 'acc|x', cloudCertId: 'arn:1' })).toBe('aws|acc|x|arn:1')
    })
})

describe('cloudDisplayName（云展示名）', () => {
    it('已知云映射中文/品牌名，未知云原值', () => {
        expect(cloudDisplayName('aliyun')).toBe('阿里云')
        expect(cloudDisplayName('tencent')).toBe('腾讯云')
        expect(cloudDisplayName('azure')).toBe('Azure')
        expect(cloudDisplayName('aws')).toBe('AWS')
        expect(cloudDisplayName('huawei')).toBe('华为云')
        expect(cloudDisplayName('gcp')).toBe('gcp')
    })
})

// ==================== AC4：NO_SNAPSHOT 错误判定（引导触发点） ====================

describe('isNoSnapshotError（NO_SNAPSHOT 错误码分支，AC4）', () => {
    it('CertRequestError code=NO_SNAPSHOT → true', () => {
        expect(isNoSnapshotError(new CertRequestError(DISCOVERY_ERR_NO_SNAPSHOT, 'no done snapshot'))).toBe(true)
    })
    it('其他错误码 / 网络错误 / 非错误值 → false', () => {
        expect(isNoSnapshotError(new CertRequestError('CERT_HAS_REFS', 'x'))).toBe(false)
        expect(isNoSnapshotError(new Error('Network Error'))).toBe(false)
        expect(isNoSnapshotError(undefined)).toBe(false)
    })
})
