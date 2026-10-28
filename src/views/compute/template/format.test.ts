import { describe, expect, it } from 'vitest'
import { formatTemplateTime } from './format'

const NOW = 1793216245878 // 2026-10-29 03:37:25 +08

describe('formatTemplateTime', () => {
    it('30 秒内显示「刚刚」', () => {
        expect(formatTemplateTime(NOW - 30_000, NOW)).toBe('刚刚')
    })

    it('分钟/小时/天分支', () => {
        expect(formatTemplateTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
        expect(formatTemplateTime(NOW - 90 * 60_000, NOW)).toBe('1 小时前')
        expect(formatTemplateTime(NOW - 3 * 86_400_000, NOW)).toBe('3 天前')
    })

    it('超过 30 天走本地日期', () => {
        const out = formatTemplateTime(NOW - 31 * 86_400_000, NOW)
        expect(out).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2}$/)
    })

    it('未来时间戳（时钟偏移）不为负', () => {
        expect(formatTemplateTime(NOW + 5 * 60_000, NOW)).toBe('刚刚')
        expect(formatTemplateTime(NOW + 86_400_000, NOW)).toBe('刚刚')
    })

    it('毫秒与秒两种量级都能识别', () => {
        expect(formatTemplateTime(Math.floor(NOW / 1000) - 120, NOW)).toBe('2 分钟前')
    })

    it('空值返回空串', () => {
        expect(formatTemplateTime(0, NOW)).toBe('')
        expect(formatTemplateTime(null, NOW)).toBe('')
        expect(formatTemplateTime(undefined, NOW)).toBe('')
    })
})
