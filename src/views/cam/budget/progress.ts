/**
 * 预算消耗进度的展示辅助（纯函数，便于单测）
 *
 * 后端 `GET /budget/{id}/progress` 返回字段：amount_limit / current_spend /
 * usage_percent / remaining_amount。历史前端按 progress_percent / remaining 读取，
 * 导致抽屉渲染时 `undefined.toFixed` 直接报错。
 */
import type { BudgetProgress } from '@/api/types/finops'

/** 进度条百分比收敛到 0~100（Infinity 视为 100；超支时条满格，文字仍显示真实百分比） */
export function clampPercent(percent: number | null | undefined): number {
    if (typeof percent !== 'number' || Number.isNaN(percent)) return 0
    if (percent === Number.POSITIVE_INFINITY) return 100
    return Math.max(0, Math.min(100, percent))
}

/** 严格超支（超过 100%）；恰好 100% 用 isAtLimit 区分 */
export function isOverBudget(percent: number | null | undefined): boolean {
    return typeof percent === 'number' && Number.isFinite(percent) && percent > 100
}

/** 恰好达到上限（100%） */
export function isAtLimit(percent: number | null | undefined): boolean {
    return percent === 100
}

/** 百分比文案：保留 1 位小数并归一 -0，异常值回退 0.0% */
export function formatUsagePercent(percent: number | null | undefined): string {
    if (typeof percent !== 'number' || !Number.isFinite(percent)) return '0.0%'
    const fixed = percent.toFixed(1)
    return fixed === '-0.0' ? '0.0%' : `${fixed}%`
}

/** 超支金额（未超支返回 0） */
export function overBudgetAmount(
    spend: number | null | undefined,
    limit: number | null | undefined
): number {
    if (typeof spend !== 'number' || typeof limit !== 'number') return 0
    if (!Number.isFinite(spend) || !Number.isFinite(limit)) return 0
    return Math.max(0, spend - limit)
}

/** 进度条颜色：>100% 红、>=80% 橙、其余绿 */
export function progressColor(percent: number | null | undefined): string {
    if (typeof percent !== 'number' || !Number.isFinite(percent)) return '#10B981'
    if (percent > 100) return '#EF4444'
    if (percent >= 80) return '#F59E0B'
    return '#10B981'
}

/** 取已消耗（缺字段回退 0，避免 formatCost 崩溃） */
export function currentSpend(progress: BudgetProgress | null | undefined): number {
    return typeof progress?.current_spend === 'number' ? progress.current_spend : 0
}

/** 取预算上限（缺字段回退 0） */
export function amountLimit(progress: BudgetProgress | null | undefined): number {
    return typeof progress?.amount_limit === 'number' ? progress.amount_limit : 0
}

/** 取剩余额度（缺字段回退 0） */
export function remainingAmount(progress: BudgetProgress | null | undefined): number {
    return typeof progress?.remaining_amount === 'number' ? progress.remaining_amount : 0
}

/**
 * 校验并归一进度响应：缺关键数值字段（或旧版 progress_percent/remaining 结构）
 * 返回 null，由调用方标记「获取失败」，避免把无字段对象塞进 map 后渲染崩溃。
 */
export function normalizeProgress(raw: unknown): BudgetProgress | null {
    if (!raw || typeof raw !== 'object') return null
    const p = raw as Partial<BudgetProgress>
    if (
        typeof p.amount_limit !== 'number' ||
        typeof p.current_spend !== 'number' ||
        typeof p.usage_percent !== 'number'
    ) {
        return null
    }
    return {
        budget_id: typeof p.budget_id === 'number' ? p.budget_id : 0,
        name: typeof p.name === 'string' ? p.name : '',
        amount_limit: p.amount_limit,
        current_spend: p.current_spend,
        usage_percent: p.usage_percent,
        remaining_amount:
            typeof p.remaining_amount === 'number' ? p.remaining_amount : 0,
        status: typeof p.status === 'string' ? p.status : undefined,
    }
}
