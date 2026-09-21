/**
 * Disk 经营洞察纯逻辑(运营卡聚合/IO 繁忙判定/空态判定/口径标注/格式化)。
 * 数据来源统一为 ecam_disk_metric 指标表(经 /assets/disk/top、/assets/disk/metrics);
 * 资产表 ecam_instance 的 size/iops/throughput 快照不在 Disk 界面展示(Hard Rule)。
 * 口径事实(T1 探测定案):五厂商均无云盘级容量指标,指标表无容量字段——
 * 运营卡以「磁盘总数」替代 proposal 中的「总容量」,不回退资产表快照。
 */
import type { DiskMetricPoint, DiskTopItem } from '@/api/asset'

/** disk:collect_metrics 执行器任务类型(空态判定以任务 Result 失败计数为准) */
export const DISK_COLLECT_TASK_TYPE = 'disk:collect_metrics'

/** 执行器任务 Result.failures 单项(厂商/账号维度失败汇总,规格「失败可观测性」) */
export interface DiskCollectFailure {
    provider: string
    account_id: number
    error_count: number
    last_error?: string
}

/** IO 繁忙判定阈值:使用率百分比(0~100,严格大于计繁忙) */
export const DISK_USAGE_BUSY_PERCENT = 80
/** IO 繁忙判定阈值:IOPS(次/秒)。运营经验阈值(暂无厂商配额口径),与运营卡文案一致,后续可按厂商配额细化 */
export const DISK_IOPS_BUSY_THRESHOLD = 1000

/** 运营卡聚合结果(后端已按 disk_id 去重,前端对全量 Top 项聚合) */
export interface DiskCardSummary {
    /** 参与聚合的磁盘数(去重后) */
    diskCount: number
    /** 平均使用率(百分比):无数据/zero_exception 口径缺失 0 异常行跳过,不记 0 拉低均值 */
    avgUsagePercent: number | null
    /** IO 繁忙盘数:usage_percent > 80 或 IOPS 超阈值(与运营卡文案一致) */
    ioBusyCount: number
}

/**
 * 汇总运营卡三项值:磁盘数/平均使用率/IO 繁忙盘数(latest 代表行口径,不跨账号双计)。
 * latest 缺失/字段非法时防御式跳过;zero_exception 行(口径缺失 0)不参与均值与繁忙判定
 * (与后端 Top 均值口径一致:busy_share 合法闲盘 0 参与,口径缺失 0 不参与)。
 */
export function summarizeDiskTop(items: DiskTopItem[]): DiskCardSummary {
    let usageSum = 0
    let usageN = 0
    let ioBusyCount = 0
    for (const it of items) {
        const usage = it?.latest?.usage_percent
        const isZeroException = it?.data_status === 'zero_exception' || it?.qc_status === 'zero_exception'
        const iops = it?.latest?.iops
        if (!isZeroException && typeof iops === 'number' && Number.isFinite(iops) && iops >= DISK_IOPS_BUSY_THRESHOLD) {
            ioBusyCount++
        }
        if (!isZeroException && typeof usage === 'number' && Number.isFinite(usage) && usage >= 0) {
            usageSum += usage
            usageN++
            if (usage > DISK_USAGE_BUSY_PERCENT) ioBusyCount++
        }
    }
    return {
        diskCount: items.length,
        avgUsagePercent: usageN > 0 ? usageSum / usageN : null,
        ioBusyCount,
    }
}

/** IO 繁忙判定(单项):usage_percent > 80 或 IOPS 超阈值;zero_exception 行/latest 缺失不算繁忙 */
export function isIoBusyDisk(item: DiskTopItem): boolean {
    if (!item || item.data_status === 'zero_exception' || item.qc_status === 'zero_exception') return false
    const usage = item.latest?.usage_percent
    if (typeof usage === 'number' && Number.isFinite(usage) && usage > DISK_USAGE_BUSY_PERCENT) return true
    const iops = item.latest?.iops
    return typeof iops === 'number' && Number.isFinite(iops) && iops >= DISK_IOPS_BUSY_THRESHOLD
}

/**
 * 从最近一次 disk:collect_metrics 任务中提取厂商/账号维度失败明细。
 * 任务缺失/Result 形态不符/无失败时返回空数组(防御式,不抛错)。
 */
export function extractDiskCollectFailures(task: unknown): DiskCollectFailure[] {
    if (!task || typeof task !== 'object') return []
    const result = (task as { result?: unknown }).result
    if (!result || typeof result !== 'object') return []
    const failures = (result as { failures?: unknown }).failures
    if (!Array.isArray(failures)) return []
    return failures.filter((f): f is DiskCollectFailure => {
        if (!f || typeof f !== 'object') return false
        const cand = f as Partial<DiskCollectFailure>
        return typeof cand.provider === 'string' && cand.provider !== ''
            && typeof cand.error_count === 'number' && cand.error_count > 0
    })
}

/** 运营卡状态:warn=采集失败警示 / empty=无数据 / data=正常展示 */
export type DiskCardState = 'warn' | 'empty' | 'data'

/**
 * 运营卡判定顺序:「采集失败→警示」优先于「无数据→0 占位」
 * (规格「失败可观测性」:避免把未知伪装成真零值;失败计数以执行器任务 Result 为准)。
 */
export function deriveDiskCardState(input: { topFailed: boolean; itemCount: number; failures: DiskCollectFailure[] }): DiskCardState {
    if (input.failures.length > 0 || input.topFailed) return 'warn'
    if (input.itemCount <= 0) return 'empty'
    return 'data'
}

/**
 * 趋势窗口内是否存在口径缺失 0 异常日(data_status/qc_status=zero_exception)。
 * 异常日渲染警示标记,不当正常空盘(规格 qc_status 读取侧闭环;
 * busy_share 合法闲盘 0 已由后端映射 ok,不会进入此判定)。
 */
export function hasZeroException(points: DiskMetricPoint[]): boolean {
    return points.some(p => p?.data_status === 'zero_exception' || p?.qc_status === 'zero_exception')
}

/** 使用率口径 → 中文标注(前端区分「容量水位」vs「IO 忙闲占比」,T1 探测定案);空回退 '-' */
export function usageScopeLabel(scope: string | null | undefined): string {
    if (!scope) return '-'
    const map: Record<string, string> = {
        instance_level: '实例级',
        busy_share: 'IO 繁忙占比',
        cloud_disk_level: '云盘级',
    }
    return map[scope] || scope
}

/** 是否 IO 繁忙占比口径(AWS 派生):该口径语义是忙闲占比而非容量水位,展示须区分 */
export function isBusyShareScope(scope: string | null | undefined): boolean {
    return scope === 'busy_share'
}

/** 0~100 使用率(百分比)→ 文案;null/undefined/非法/负值 → '—'(当日无数据,不填假值) */
export function formatUsagePercent(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v) || v < 0) return '—'
    return `${Math.round(v * 10) / 10}%`
}

/** IOPS(次/秒)→ 千分位文案;null/undefined/非法 → '-' */
export function formatIOPS(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '-'
    return Math.round(v).toLocaleString()
}

/** 吞吐(MB/s)→ 一位小数文案;null/undefined/非法 → '-' */
export function formatThroughputMBps(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '-'
    return `${Math.round(v * 10) / 10} MB/s`
}
