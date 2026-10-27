import { describe, expect, it } from 'vitest'
import {
    amountLimit,
    clampPercent,
    currentSpend,
    formatUsagePercent,
    isAtLimit,
    isOverBudget,
    normalizeProgress,
    overBudgetAmount,
    progressColor,
    remainingAmount,
} from './progress'

describe('clampPercent', () => {
    it('进度条百分比收敛到 0~100', () => {
        expect(clampPercent(0)).toBe(0)
        expect(clampPercent(42.5)).toBe(42.5)
        expect(clampPercent(100)).toBe(100)
        expect(clampPercent(3169)).toBe(100)
        expect(clampPercent(-5)).toBe(0)
    })

    it('异常值处理', () => {
        expect(clampPercent(undefined)).toBe(0)
        expect(clampPercent(null)).toBe(0)
        expect(clampPercent(Number.NaN)).toBe(0)
        expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(100)
    })
})

describe('isOverBudget / isAtLimit', () => {
    it('恰好 100% 为「已达上限」，超过 100% 才是超支', () => {
        expect(isOverBudget(99.9)).toBe(false)
        expect(isOverBudget(100)).toBe(false)
        expect(isOverBudget(100.1)).toBe(true)
        expect(isAtLimit(100)).toBe(true)
        expect(isAtLimit(99.9)).toBe(false)
        expect(isAtLimit(undefined)).toBe(false)
    })
})

describe('formatUsagePercent', () => {
    it('保留一位小数并归一 -0', () => {
        expect(formatUsagePercent(3169.089)).toBe('3169.1%')
        expect(formatUsagePercent(0)).toBe('0.0%')
        expect(formatUsagePercent(-0.04)).toBe('0.0%')
        expect(formatUsagePercent(undefined)).toBe('0.0%')
        expect(formatUsagePercent(Number.NaN)).toBe('0.0%')
    })
})

describe('overBudgetAmount', () => {
    it('只计算超出部分', () => {
        expect(overBudgetAmount(3_169_088.99, 100_000)).toBeCloseTo(3_069_088.99, 2)
        expect(overBudgetAmount(50_000, 100_000)).toBe(0)
        expect(overBudgetAmount(100_000, 100_000)).toBe(0)
        expect(overBudgetAmount(undefined, 100_000)).toBe(0)
    })
})

describe('progressColor', () => {
    it('按阈值分档', () => {
        expect(progressColor(10)).toBe('#10B981')
        expect(progressColor(80)).toBe('#F59E0B')
        expect(progressColor(100)).toBe('#F59E0B')
        expect(progressColor(100.1)).toBe('#EF4444')
        expect(progressColor(undefined)).toBe('#10B981')
    })
})

describe('字段回退', () => {
    it('缺字段时返回 0 而不是 undefined', () => {
        expect(currentSpend(null)).toBe(0)
        expect(amountLimit(null)).toBe(0)
        expect(remainingAmount(null)).toBe(0)
        expect(currentSpend({ current_spend: 12 } as any)).toBe(12)
        expect(amountLimit({ amount_limit: 100 } as any)).toBe(100)
        expect(remainingAmount({ remaining_amount: 8 } as any)).toBe(8)
    })
})

describe('normalizeProgress', () => {
    it('接受后端真实字段', () => {
        const p = normalizeProgress({
            budget_id: 1,
            name: '成本控制',
            amount_limit: 100000,
            current_spend: 3_169_088.99,
            usage_percent: 3169.09,
            remaining_amount: 0,
            status: 'active',
        })
        expect(p).not.toBeNull()
        expect(p?.usage_percent).toBeCloseTo(3169.09, 2)
        expect(p?.remaining_amount).toBe(0)
    })

    it('旧版字段（progress_percent/remaining）不再被误当有效数据', () => {
        const p = normalizeProgress({ amount_limit: 100, current_spend: 50, progress_percent: 50, remaining: 50 })
        expect(p).toBeNull()
        expect(normalizeProgress({ amount_limit: 100, current_spend: 50 })).toBeNull()
        expect(normalizeProgress(null)).toBeNull()
        expect(normalizeProgress('oops')).toBeNull()
    })

    it('缺 remaining_amount 时回退 0，但关键字段缺失则拒绝', () => {
        const p = normalizeProgress({ amount_limit: 100, current_spend: 50, usage_percent: 50 })
        expect(p).not.toBeNull()
        expect(p?.remaining_amount).toBe(0)
    })
})
