/**
 * NAS 经营洞察纯逻辑(运营卡聚合/空态判定/格式化)。
 * 数据来源统一为 ecam_nas_metric 指标表(经 /assets/nas/top、/assets/nas/metrics);
 * 资产表 ecam_instance 的 capacity/used_capacity 不再在 NAS 界面展示(Hard Rule)。
 */
import type { NASTopItem, NASMetricPoint } from '@/api/asset'

/** nas:collect_metrics 执行器任务类型(空态判定以任务 Result 失败计数为准) */
export const NAS_COLLECT_TASK_TYPE = 'nas:collect_metrics'

/** 执行器任务 Result.failures 单项(厂商/账号维度失败汇总,规格「失败可观测性」) */
export interface NASCollectFailure {
    provider: string
    account_id: number
    error_count: number
    last_error?: string
}

/** 运营卡聚合结果(后端已按 fs_id 去重,前端对全量 Top 项求和) */
export interface NasCardSummary {
    totalCapacity: number
    totalUsed: number
    /** 平均使用率:无数据/capacity=0 异常实例跳过不参与(不记 0 拉低均值) */
    avgUtilization: number | null
    /** 参与聚合的物理文件系统数 */
    fsCount: number
}

/**
 * 汇总运营卡三项值:总容量/已用容量(latest 代表行求和)与平均使用率
 * (utilization 为 null 的 capacity=0 异常实例/无数据实例跳过,不参与均值)。
 */
export function summarizeNasTop(items: NASTopItem[]): NasCardSummary {
    let totalCapacity = 0
    let totalUsed = 0
    let utilSum = 0
    let utilN = 0
    for (const it of items) {
        const cap = it.latest?.capacity
        if (typeof cap === 'number' && Number.isFinite(cap)) totalCapacity += cap
        const used = it.latest?.used
        if (typeof used === 'number' && Number.isFinite(used)) totalUsed += used
        const util = it.latest?.utilization
        if (typeof util === 'number' && Number.isFinite(util) && util >= 0) {
            utilSum += util
            utilN++
        }
    }
    return {
        totalCapacity,
        totalUsed,
        avgUtilization: utilN > 0 ? utilSum / utilN : null,
        fsCount: items.length,
    }
}

/**
 * 从最近一次 nas:collect_metrics 任务中提取厂商/账号维度失败明细。
 * 任务缺失/Result 形态不符/无失败时返回空数组(防御式,不抛错)。
 */
export function extractNasCollectFailures(task: unknown): NASCollectFailure[] {
    if (!task || typeof task !== 'object') return []
    const result = (task as { result?: unknown }).result
    if (!result || typeof result !== 'object') return []
    const failures = (result as { failures?: unknown }).failures
    if (!Array.isArray(failures)) return []
    return failures.filter((f): f is NASCollectFailure => {
        if (!f || typeof f !== 'object') return false
        const cand = f as Partial<NASCollectFailure>
        return typeof cand.provider === 'string' && cand.provider !== ''
            && typeof cand.error_count === 'number' && cand.error_count > 0
    })
}

/** 运营卡状态:warn=采集失败警示 / empty=无数据 / data=正常展示 */
export type NasCardState = 'warn' | 'empty' | 'data'

/**
 * 运营卡判定顺序:「采集失败→警示」优先于「无数据→0 占位」
 * (规格「失败可观测性」:避免把未知伪装成真零容量;失败计数以执行器任务 Result 为准)。
 */
export function deriveNasCardState(input: { topFailed: boolean; itemCount: number; failures: NASCollectFailure[] }): NasCardState {
    if (input.failures.length > 0 || input.topFailed) return 'warn'
    if (input.itemCount <= 0) return 'empty'
    return 'data'
}

/**
 * 趋势窗口内是否存在 capacity=0 异常日(qc_status=zero_exception)。
 * 异常日渲染警示标记,不当正常零容量(规格 qc_status 读取侧闭环)。
 */
export function hasZeroException(points: NASMetricPoint[]): boolean {
    return points.some(p => p?.data_status === 'zero_exception' || p?.qc_status === 'zero_exception')
}

/** GB(二进制 GiB)→ 展示文案;null/undefined/非法 → '-' */
export function formatCapacityGB(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '-'
    if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(2)} PB`
    if (v >= 1024) return `${(v / 1024).toFixed(1)} TB`
    if (v >= 1) return `${Math.round(v * 10) / 10} GB`
    return `${Math.round(v * 1024)} MB`
}

/** 0-1 使用率 → 百分比文案;null/undefined/负值 → '—'(当日无数据) */
export function formatUtilization(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v) || v < 0) return '—'
    return `${Math.round(v * 1000) / 10}%`
}
