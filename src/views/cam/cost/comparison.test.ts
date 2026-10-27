import { describe, expect, it } from 'vitest'
import {
    comparisonHint,
    formatChangePercent,
    formatPreviousAmount,
    hasComparisonBaseline,
} from './comparison'

describe('hasComparisonBaseline', () => {
    it('只有去年同期金额大于 0 才有基线', () => {
        expect(hasComparisonBaseline(0)).toBe(false)
        expect(hasComparisonBaseline(undefined)).toBe(false)
        expect(hasComparisonBaseline(Number.NaN)).toBe(false)
        expect(hasComparisonBaseline(0.01)).toBe(true)
        expect(hasComparisonBaseline(1234.5)).toBe(true)
    })
})

describe('formatPreviousAmount', () => {
    it('无基线显示 — 而非 ¥0.00', () => {
        expect(formatPreviousAmount(0)).toBe('—')
        expect(formatPreviousAmount(undefined)).toBe('—')
    })

    it('有基线保留两位小数', () => {
        expect(formatPreviousAmount(1234.5)).toBe('¥1234.50')
    })
})

describe('formatChangePercent', () => {
    it('无基线显示 — 而非 0.0%', () => {
        expect(formatChangePercent(0, 0)).toBe('—')
        expect(formatChangePercent(undefined, 0)).toBe('—')
    })

    it('有基线时带正负号与一位小数', () => {
        expect(formatChangePercent(12.34, 100)).toBe('+12.3%')
        expect(formatChangePercent(-5.6, 100)).toBe('-5.6%')
        expect(formatChangePercent(0, 100)).toBe('0.0%')
    })
})

describe('comparisonHint', () => {
    it('无基线给出明确提示', () => {
        expect(
            comparisonHint({
                current_amount: 100,
                previous_amount: 0,
                change_percent: 0,
                current_period: 'a',
                previous_period: 'b',
            })
        ).toContain('去年同期无数据')
    })

    it('有基线不提示', () => {
        expect(
            comparisonHint({
                current_amount: 100,
                previous_amount: 50,
                change_percent: 100,
                current_period: 'a',
                previous_period: 'b',
            })
        ).toBe('')
    })
})
