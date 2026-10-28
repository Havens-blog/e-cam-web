import { describe, expect, it } from 'vitest'
import { formatAuditTime, normalizeEpochMs } from './format'

describe('normalizeEpochMs', () => {
    it('毫秒不被放大', () => {
        expect(normalizeEpochMs(1793216245878)).toBe(1793216245878)
    })

    it('秒级时间戳换算成毫秒', () => {
        expect(normalizeEpochMs(1793216245)).toBe(1793216245000)
    })

    it('空值/非法值返回 null', () => {
        expect(normalizeEpochMs(0)).toBeNull()
        expect(normalizeEpochMs(null)).toBeNull()
        expect(normalizeEpochMs(undefined)).toBeNull()
        expect(normalizeEpochMs(Number.NaN)).toBeNull()
    })

    it('字符串数字可解析', () => {
        expect(normalizeEpochMs('1793216245878')).toBe(1793216245878)
        expect(normalizeEpochMs('abc')).toBeNull()
    })

    it('阈值两侧：>=1e11 视为毫秒，<1e11 视为秒', () => {
        expect(normalizeEpochMs(1e11)).toBe(1e11)
        expect(normalizeEpochMs(1e11 - 1)).toBe((1e11 - 1) * 1000)
        expect(normalizeEpochMs(1e11 + 1)).toBe(1e11 + 1)
    })

    it('负数/超大值/微秒误传', () => {
        expect(normalizeEpochMs(-1)).toBeNull()
        expect(formatAuditTime(1793216245878000)).toBe('-') // μs 误传：超出 9999 年
    })
})

describe('formatLogTime', () => {
    it('毫秒级时间戳渲染为正常年份（回归：曾渲染 58794 年）', () => {
        const out = formatAuditTime(1793216245878)
        expect(out).toMatch(/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        expect(out.startsWith('2026') || out.startsWith('2027')).toBe(true)
    })

    it('秒级时间戳与等价毫秒结果一致', () => {
        expect(formatAuditTime(1793216245)).toBe(formatAuditTime(1793216245000))
    })

    it('空值与非法值返回占位符', () => {
        expect(formatAuditTime(0)).toBe('-')
        expect(formatAuditTime(null)).toBe('-')
        expect(formatAuditTime(undefined)).toBe('-')
    })
})
