/**
 * DNS 权重展示口径回归：可支持云显示数值、其余显示 `-`。
 * 关键点：**绝不能把"无值"显示成 0**（否则把"该云不支持权重"误报为"权重为 0"）。
 */
import { describe, expect, it } from 'vitest'
import { formatWeight } from './format'

describe('formatWeight', () => {
    it('有值时显示数值（含边界 0 与 100）', () => {
        expect(formatWeight(70)).toBe('70')
        expect(formatWeight(0)).toBe('0')
        expect(formatWeight(100)).toBe('100')
    })

    it('null / undefined → "-"（无权重概念或云端未返回）', () => {
        expect(formatWeight(null)).toBe('-')
        expect(formatWeight(undefined)).toBe('-')
    })

    it('非有限数值 → "-"（脏数据不展示为 NaN）', () => {
        expect(formatWeight(Number.NaN)).toBe('-')
        expect(formatWeight(Number.POSITIVE_INFINITY)).toBe('-')
    })

    it('绝不把无值渲染成 0', () => {
        expect(formatWeight(null)).not.toBe('0')
        expect(formatWeight(undefined)).not.toBe('0')
    })
})
