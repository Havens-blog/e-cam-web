import { describe, expect, it } from 'vitest'
import {
    clampPercent,
    currentSpend,
    formatUsagePercent,
    isOverBudget,
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

    it('异常值回退 0', () => {
        expect(clampPercent(undefined)).toBe(0)
        expect(clampPercent(null)).toBe(0)
        expect(clampPercent(Number.NaN)).toBe(0)
    })
})

describe('isOverBudget', () => {
    it('达到或超过 100% 视为超支', () => {
        expect(isOverBudget(99.9)).toBe(false)
        expect(isOverBudget(100)).toBe(true)
        expect(isOverBudget(3169)).toBe(true)
        expect(isOverBudget(undefined)).toBe(false)
    })
})

describe('formatUsagePercent', () => {
    it('保留一位小数', () => {
        expect(formatUsagePercent(3169.089)).toBe('3169.1%')
        expect(formatUsagePercent(0)).toBe('0.0%')
        expect(formatUsagePercent(undefined)).toBe('0.0%')
    })
})

describe('overBudgetAmount', () => {
    it('只计算超出部分', () => {
        expect(overBudgetAmount(3_169_088.99, 100_000)).toBeCloseTo(3_069_088.99, 2)
        expect(overBudgetAmount(50_000, 100_000)).toBe(0)
        expect(overBudgetAmount(undefined, 100_000)).toBe(0)
    })
})

describe('progressColor', () => {
    it('按阈值分档', () => {
        expect(progressColor(10)).toBe('#10B981')
        expect(progressColor(80)).toBe('#F59E0B')
        expect(progressColor(100)).toBe('#EF4444')
        expect(progressColor(undefined)).toBe('#10B981')
    })
})

describe('字段回退', () => {
    it('缺字段时返回 0 而不是 undefined', () => {
        expect(currentSpend(null)).toBe(0)
        expect(remainingAmount(null)).toBe(0)
        expect(currentSpend({ current_spend: 12 } as any)).toBe(12)
        expect(remainingAmount({ remaining_amount: 8 } as any)).toBe(8)
    })
})
