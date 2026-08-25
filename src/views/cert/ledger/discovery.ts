/**
 * 云端发现导入纯视图逻辑（cert-cloud-discovery-import 任务 6）。
 *
 * 与 format.ts 同一模式的纯函数层：分组/灰选判定/默认勾选/快照过期计算等
 * 无 DOM 依赖逻辑集中于此，供 DiscoveryImportModal 消费并被 vitest 直接覆盖
 * （组件测试仅验证装配与交互分支）。
 * 契约对齐后端 internal/cert/web/discovery_handler.go 的 VO json tag。
 */

import { CertRequestError, type DiscoveryPreviewEntry } from '@/api/cert'

/** 未登记条目 notAfter 占位显示（与后端 DiscoveryNotAfterPending 文案一致；空值兜底同文案） */
export const DISCOVERY_NOT_AFTER_PENDING = '—（导入后补全）'

/** 快照新鲜度阈值（天）：snapshotStartedAt 距今超此值显著提示建议重扫（提案 Constraints） */
export const DISCOVERY_SNAPSHOT_STALE_DAYS = 7

/** 无 done 快照错误码（预览 409 → 前端引导入口触发点，任务 8 接管引导流程） */
export const DISCOVERY_ERR_NO_SNAPSHOT = 'NO_SNAPSHOT'

/** 已知云展示顺序（后端 domain.Cloud 值）；未知云按字典序垫底不丢弃 */
const CLOUD_ORDER: readonly string[] = ['aliyun', 'tencent', 'azure', 'aws', 'huawei']

/** 云展示名（分组标题；未知云回退原值） */
const CLOUD_LABELS: Readonly<Record<string, string>> = {
    aliyun: '阿里云',
    tencent: '腾讯云',
    azure: 'Azure',
    aws: 'AWS',
    huawei: '华为云',
}

export function cloudDisplayName(cloud: string): string {
    return CLOUD_LABELS[cloud] ?? cloud
}

/** 条目唯一键：cloud|accountKey|cloudCertId 三元组（与后端映射定位/导入请求条目一致） */
export function discoveryEntryKey(
    e: Pick<DiscoveryPreviewEntry, 'cloud' | 'accountKey' | 'cloudCertId'>,
): string {
    return `${e.cloud}|${e.accountKey}|${e.cloudCertId}`
}

/** 可勾选判定：可解析（parseable）且未在台账（inLedger 灰选不可勾；不可解析组整组不可选） */
export function isEntrySelectable(e: Pick<DiscoveryPreviewEntry, 'parseable' | 'inLedger'>): boolean {
    return e.parseable && !e.inLedger
}

/** 默认勾选键集：全部未登记且可解析条目（华为云/AWS IAM-hosted 组与已在台账项不含） */
export function defaultSelection(items: readonly DiscoveryPreviewEntry[]): Set<string> {
    return new Set(items.filter(isEntrySelectable).map(discoveryEntryKey))
}

/** 发现预览分组（按云；组级不可选标记承载华为云/AWS IAM-hosted 降级语义） */
export interface DiscoveryGroup {
    cloud: string
    /** 展示名（阿里云/腾讯云/Azure/AWS/华为云；未知云原值） */
    label: string
    entries: DiscoveryPreviewEntry[]
    /** 不可选组：组内条目 parseable 全为 false */
    unsupported: boolean
    /** 组级降级提示（unsupported=false 时为空串） */
    unsupportedHint: string
}

/** 按云分组：已知云按固定顺序、未知云字典序垫底；每组聚合不可选标记与提示 */
export function groupPreviewEntries(items: readonly DiscoveryPreviewEntry[]): DiscoveryGroup[] {
    const byCloud = new Map<string, DiscoveryPreviewEntry[]>()
    for (const it of items) {
        const list = byCloud.get(it.cloud)
        if (list) {
            list.push(it)
        } else {
            byCloud.set(it.cloud, [it])
        }
    }
    const clouds = [...byCloud.keys()].sort((a, b) => {
        const ia = CLOUD_ORDER.indexOf(a)
        const ib = CLOUD_ORDER.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
    })
    return clouds.map((cloud) => {
        const entries = byCloud.get(cloud) ?? []
        const unsupported = entries.length > 0 && entries.every((e) => !e.parseable)
        return {
            cloud,
            label: cloudDisplayName(cloud),
            entries,
            unsupported,
            unsupportedHint: unsupported ? unsupportedGroupHint(cloud, entries) : '',
        }
    })
}

/** 组级不可选提示文案（华为云 SHA-1 口径 / AWS IAM-hosted 非 ARN 形态） */
function unsupportedGroupHint(cloud: string, entries: readonly DiscoveryPreviewEntry[]): string {
    const reasons = new Set(entries.map((e) => e.parseReason).filter((r) => r !== undefined))
    if (reasons.has('iam_hosted')) {
        return 'AWS IAM-hosted（非 ARN）证书暂不支持自动解析，整组不可选择'
    }
    if (cloud === 'huawei' || reasons.has('unsupported_cloud')) {
        return '该云暂不支持自动解析（SHA-1 指纹口径），整组不可选择'
    }
    return '该组条目暂不支持自动解析，不可选择'
}

/** 条目级提示：deferred_parse 仍可选（导入时解析）；不可解析类仅作补充说明 */
export function parseReasonHint(reason: string | undefined): string {
    switch (reason) {
        case 'deferred_parse':
            return '导入时解析'
        case 'iam_hosted':
            return 'IAM-hosted 暂不支持自动解析'
        case 'unsupported_cloud':
            return '该云暂不支持自动解析'
        default:
            return ''
    }
}

/** notAfter 展示值：未登记占位/空值 → 占位文案；台账值 → UTC 日期（YYYY-MM-DD） */
export function formatNotAfter(notAfter: string): string {
    if (!notAfter || notAfter === DISCOVERY_NOT_AFTER_PENDING) return DISCOVERY_NOT_AFTER_PENDING
    const d = new Date(notAfter)
    if (Number.isNaN(d.getTime())) return notAfter
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** 快照过期判定：snapshotStartedAt 距 now 超 7 天（空值/解析失败按未过期处理，不误报） */
export function isSnapshotStale(snapshotStartedAt: string | undefined, now: Date = new Date()): boolean {
    if (!snapshotStartedAt) return false
    const t = new Date(snapshotStartedAt).getTime()
    if (Number.isNaN(t)) return false
    return now.getTime() - t > DISCOVERY_SNAPSHOT_STALE_DAYS * 24 * 60 * 60 * 1000
}

/** 快照时间展示文案：RFC3339 → YYYY-MM-DD HH:mm UTC（空值返回空串） */
export function formatSnapshotTime(startedAt: string | undefined): string {
    if (!startedAt) return ''
    const d = new Date(startedAt)
    if (Number.isNaN(d.getTime())) return startedAt
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(
        d.getUTCHours(),
    )}:${pad2(d.getUTCMinutes())} UTC`
}

/** 预览汇总计数（Modal 顶部摘要行） */
export interface DiscoverySummary {
    total: number
    inLedger: number
    selectable: number
    unsupported: number
}

export function summarizePreview(items: readonly DiscoveryPreviewEntry[]): DiscoverySummary {
    return {
        total: items.length,
        inLedger: items.filter((e) => e.inLedger).length,
        selectable: items.filter(isEntrySelectable).length,
        unsupported: items.filter((e) => !e.parseable).length,
    }
}

/** 组内可选项键集（组头复选框三态与批量勾选范围计算） */
export function groupSelectableKeys(group: Pick<DiscoveryGroup, 'entries'>): string[] {
    return group.entries.filter(isEntrySelectable).map(discoveryEntryKey)
}

/** NO_SNAPSHOT 错误判定（预览 409 → 引导入口触发点） */
export function isNoSnapshotError(err: unknown): boolean {
    return err instanceof CertRequestError && err.code === DISCOVERY_ERR_NO_SNAPSHOT
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n)
}
