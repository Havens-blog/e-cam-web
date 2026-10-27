/**
 * 成本同比的展示语义（纯函数）
 *
 * 后端 `/cost/comparison` 在「去年同期无账单」时返回 `previous_amount=0, change_percent=0`，
 * 前端直接渲染会得到「¥0.00 / 0.0%」，让人误以为同比持平。这里把「无基线」与「持平」区分开。
 */
import type { ComparisonResult } from '@/api/types/finops'

/** 是否有可比较的去年同期基线（previous_amount > 0） */
export function hasComparisonBaseline(previousAmount: number | null | undefined): boolean {
    return (
        typeof previousAmount === 'number' &&
        Number.isFinite(previousAmount) &&
        previousAmount > 0
    )
}

/** 去年同期金额：无基线显示 —，避免 ¥0.00 被误读 */
export function formatPreviousAmount(previousAmount: number | null | undefined): string {
    if (
        typeof previousAmount !== 'number' ||
        !Number.isFinite(previousAmount) ||
        previousAmount <= 0
    ) {
        return '—'
    }
    return `¥${previousAmount.toFixed(2)}`
}

/** 同比百分比：无基线显示 —，有基线保留 1 位小数并带正号 */
export function formatChangePercent(
    changePercent: number | null | undefined,
    previousAmount: number | null | undefined
): string {
    if (!hasComparisonBaseline(previousAmount)) return '—'
    if (typeof changePercent !== 'number' || !Number.isFinite(changePercent)) return '—'
    const sign = changePercent > 0 ? '+' : ''
    return `${sign}${changePercent.toFixed(1)}%`
}

/** 无基线提示文案（有基线返回空串） */
export function comparisonHint(result: ComparisonResult | null | undefined): string {
    if (hasComparisonBaseline(result?.previous_amount)) return ''
    return '去年同期无数据或消耗为 0，无法计算同比'
}
