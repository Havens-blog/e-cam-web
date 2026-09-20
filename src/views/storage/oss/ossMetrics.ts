/**
 * OSS 经营洞察纯逻辑(运营卡聚合/近 7 天增速/空态判定/格式化)。
 * 数据来源统一为 ecam_oss_metric 指标表(经 /assets/oss/top、/assets/oss/metrics);
 * 资产表 ecam_instance 的 storage_size/object_count 快照不在 OSS 界面展示(Hard Rule)。
 */
import type { OSSTopItem, OSSMetricPoint } from '@/api/asset'
// 容量单位格式化与 NAS 同口径(GB 二进制 GiB → MB/TB/PB),单一实现避免漂移
import { formatCapacityGB } from '../nas/nasMetrics'

export { formatCapacityGB }

/** oss:collect_metrics 执行器任务类型(空态判定以任务 Result 失败计数为准) */
export const OSS_COLLECT_TASK_TYPE = 'oss:collect_metrics'

/** 执行器任务 Result.failures 单项(厂商/账号维度失败汇总,规格「失败可观测性」) */
export interface OSSCollectFailure {
    provider: string
    account_id: number
    error_count: number
    last_error?: string
}

/** 运营卡聚合结果(后端已按 bucket_name 去重,前端对全量 Top 项求和) */
export interface OssCardSummary {
    /** 总存储量(GB,latest 代表行求和) */
    totalStorageSize: number
    /** 总对象数(latest 代表行求和) */
    totalObjectCount: number
    /** 参与聚合的去重 bucket 数 */
    bucketCount: number
}

/**
 * 汇总运营卡值:总存储量/总对象数(latest 代表行求和,不跨账号双计)。
 * latest 缺失/字段非 null 数值时防御式跳过。
 */
export function summarizeOssTop(items: OSSTopItem[]): OssCardSummary {
    let totalStorageSize = 0
    let totalObjectCount = 0
    for (const it of items) {
        const size = it?.latest?.storage_size
        if (typeof size === 'number' && Number.isFinite(size)) totalStorageSize += size
        const count = it?.latest?.object_count
        if (typeof count === 'number' && Number.isFinite(count)) totalObjectCount += count
    }
    return { totalStorageSize, totalObjectCount, bucketCount: items.length }
}

/**
 * 近 7 天增速(%):=(最新 − 近 N 天均值) / 均值 × 100。
 * 均值缺失/非正数或最新值缺失 → null(不算增速,不伪装);保留一位小数。
 */
export function computeStorageGrowth(
    latest: number | null | undefined,
    average: number | null | undefined
): number | null {
    if (latest === null || latest === undefined || !Number.isFinite(latest)) return null
    if (average === null || average === undefined || !Number.isFinite(average) || average <= 0) return null
    return Math.round(((latest - average) / average) * 1000) / 10
}

/**
 * 从最近一次 oss:collect_metrics 任务中提取厂商/账号维度失败明细。
 * 任务缺失/Result 形态不符/无失败时返回空数组(防御式,不抛错)。
 */
export function extractOssCollectFailures(task: unknown): OSSCollectFailure[] {
    if (!task || typeof task !== 'object') return []
    const result = (task as { result?: unknown }).result
    if (!result || typeof result !== 'object') return []
    const failures = (result as { failures?: unknown }).failures
    if (!Array.isArray(failures)) return []
    return failures.filter((f): f is OSSCollectFailure => {
        if (!f || typeof f !== 'object') return false
        const cand = f as Partial<OSSCollectFailure>
        return typeof cand.provider === 'string' && cand.provider !== ''
            && typeof cand.error_count === 'number' && cand.error_count > 0
    })
}

/** 运营卡状态:warn=采集失败警示 / empty=无数据 / data=正常展示 */
export type OssCardState = 'warn' | 'empty' | 'data'

/**
 * 运营卡判定顺序:「采集失败→警示」优先于「无数据→0 占位」
 * (规格「失败可观测性」:避免把未知伪装成真零容量;失败计数以执行器任务 Result 为准)。
 */
export function deriveOssCardState(input: { topFailed: boolean; itemCount: number; failures: OSSCollectFailure[] }): OssCardState {
    if (input.failures.length > 0 || input.topFailed) return 'warn'
    if (input.itemCount <= 0) return 'empty'
    return 'data'
}

/**
 * 趋势窗口内是否存在 storage_size=0 异常日(qc_status=zero_exception)。
 * 异常日渲染警示标记,不当正常空桶(规格 qc_status 读取侧闭环)。
 */
export function hasZeroException(points: OSSMetricPoint[]): boolean {
    return points.some(p => p?.data_status === 'zero_exception' || p?.qc_status === 'zero_exception')
}

/** 对象数 → 千分位文案;null/undefined/非法 → '-'(当日无数据,不填假值) */
export function formatObjectCount(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '-'
    return Math.round(v).toLocaleString()
}
