import { describe, expect, it } from 'vitest'
import { EPOCH_MS_THRESHOLD, formatEpochDateTime, normalizeEpochMs, toBackendDateTime } from './epoch'

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


describe('toBackendDateTime（后端查询参数）', () => {
    it('输出 UTC 墙钟、秒精度、无 T/Z', () => {
        // 2026-10-29T00:00:00Z
        expect(toBackendDateTime(Date.UTC(2026, 9, 29, 0, 0, 0))).toBe('2026-10-29 00:00:00')
        expect(toBackendDateTime(Date.UTC(2026, 9, 29, 23, 59, 59))).toBe('2026-10-29 23:59:59')
    })

    it('毫秒输入得到固定的 UTC 墙钟（与时区无关的硬编码期望）', () => {
        // 1793262575436 = 2026-10-29T08:29:35.436Z
        expect(toBackendDateTime(1793262575436)).toBe('2026-10-29 08:29:35')
    })

    it('非法值与越界值返回空串（不会抛 RangeError，也不会把 - 发给后端）', () => {
        expect(toBackendDateTime(new Date('invalid'))).toBe('')
        expect(toBackendDateTime(Number.NaN)).toBe('')
        expect(toBackendDateTime(1e17)).toBe('')
        expect(toBackendDateTime(-1e17)).toBe('')
    })
})
