/**
 * RDS 经营洞察纯逻辑(趋势图空态判定/格式化)。
 * 数据来源统一为 ecam_rds_metric 指标表(经 /assets/rds/metrics);
 * 与 storage/nas/nasMetrics.ts 同构(蓝本迁移,口径对齐 spec rds-ops-insight)。
 */
import type { RDSMetricPoint } from '@/api/asset'

/** rds:collect_metrics 执行器任务类型(空态判定/失败可观测性以任务 Result 为准) */
export const RDS_COLLECT_TASK_TYPE = 'rds:collect_metrics'

/**
 * 趋势窗口内是否存在四指标全 0 异常日(qc_status=zero_exception)。
 * 异常日渲染警示标记,不当正常零负载(四指标全 0 双关:停用态由读取侧
 * 结合实例 Status 打 data_status=ok,落库 qc_status 仍为 zero_exception 的
 * 才是采集异常行;渲染警示以 qc_status/data_status 双重判定)。
 */
export function hasZeroException(points: RDSMetricPoint[]): boolean {
    return points.some(p => p?.data_status === 'zero_exception' || p?.qc_status === 'zero_exception')
}

/** 百分比(0~100)→ 展示文案;null/undefined/非法 → '—'(当日无数据) */
export function formatPercent(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—'
    return `${Math.round(v * 10) / 10}%`
}

/** 连接数(绝对值)→ 展示文案;null/undefined/非法 → '—'(当日无数据) */
export function formatConnections(v: number | null | undefined): string {
    if (v === null || v === undefined || !Number.isFinite(v)) return '—'
    return `${Math.round(v)}`
}