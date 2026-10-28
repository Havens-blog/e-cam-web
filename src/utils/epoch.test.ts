import { describe, expect, it } from 'vitest'
import { EPOCH_MS_THRESHOLD, formatEpochDateTime, normalizeEpochMs } from './epoch'

describe('normalizeEpochMs', () => {
    it('毫秒不被放大（回归：曾把 2026 放大成 58794 年）', () => {
        expect(normalizeEpochMs(1793216245878)).toBe(1793216245878)
    })

    it('秒级换算为毫秒', () => {
        expect(normalizeEpochMs(1793216245)).toBe(1793216245000)
    })

    it('阈值两侧', () => {
        expect(normalizeEpochMs(EPOCH_MS_THRESHOLD)).toBe(EPOCH_MS_THRESHOLD)
        expect(normalizeEpochMs(EPOCH_MS_THRESHOLD - 1)).toBe((EPOCH_MS_THRESHOLD - 1) * 1000)
        expect(normalizeEpochMs(EPOCH_MS_THRESHOLD + 1)).toBe(EPOCH_MS_THRESHOLD + 1)
    })

    it('空值/非正/非法返回 null', () => {
        expect(normalizeEpochMs(0)).toBeNull()
        expect(normalizeEpochMs(-1)).toBeNull()
        expect(normalizeEpochMs(null)).toBeNull()
        expect(normalizeEpochMs(undefined)).toBeNull()
        expect(normalizeEpochMs(Number.NaN)).toBeNull()
        expect(normalizeEpochMs('abc')).toBeNull()
    })
})

describe('formatEpochDateTime', () => {
    it('毫秒时间戳渲染为正常年份', () => {
        const out = formatEpochDateTime(1793216245878)
        expect(out).toMatch(/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })

    it('秒与等价毫秒结果一致', () => {
        expect(formatEpochDateTime(1793216245)).toBe(formatEpochDateTime(1793216245000))
    })

    it('超出 9999 年返回占位符', () => {
        expect(formatEpochDateTime(1e15)).toBe('-')
    })

    it('非法值返回占位符', () => {
        expect(formatEpochDateTime(0)).toBe('-')
        expect(formatEpochDateTime(null)).toBe('-')
        expect(formatEpochDateTime(undefined)).toBe('-')
    })
})
