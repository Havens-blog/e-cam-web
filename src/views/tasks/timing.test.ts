import { describe, expect, it } from 'vitest'
import { formatDurationMs, pendingWaitDurationText, shouldUseExecutionTiming } from './timing'

describe('shouldUseExecutionTiming', () => {
    it('等待中不使用执行耗时口径', () => {
        expect(shouldUseExecutionTiming('pending')).toBe(false)
    })

    it('运行中/已完成/失败/取消均使用执行耗时口径', () => {
        expect(shouldUseExecutionTiming('running')).toBe(true)
        expect(shouldUseExecutionTiming('completed')).toBe(true)
        expect(shouldUseExecutionTiming('failed')).toBe(true)
        expect(shouldUseExecutionTiming('cancelled')).toBe(true)
        expect(shouldUseExecutionTiming(undefined)).toBe(true)
    })
})

describe('formatDurationMs', () => {
    it('按天/小时/分/秒分档', () => {
        expect(formatDurationMs(30_000)).toBe('30秒')
        expect(formatDurationMs(90_000)).toBe('1分30秒')
        expect(formatDurationMs(3_600_000 + 5 * 60_000)).toBe('1小时5分')
        expect(formatDurationMs(2 * 86_400_000 + 3 * 3_600_000)).toBe('2天3小时')
    })

    it('非法与负值回退 0 秒', () => {
        expect(formatDurationMs(Number.NaN)).toBe('0秒')
        expect(formatDurationMs(-1000)).toBe('0秒')
    })
})

describe('pendingWaitDurationText', () => {
    const now = Date.parse('2026-10-27T12:00:00Z')

    it('按创建时间计算已等待', () => {
        expect(pendingWaitDurationText('2026-10-27T10:00:00Z', now)).toBe('2小时0分')
        expect(pendingWaitDurationText('2026-10-25T12:00:00Z', now)).toBe('2天0小时')
    })

    it('缺失或非法 created_at 返回 null', () => {
        expect(pendingWaitDurationText(undefined, now)).toBeNull()
        expect(pendingWaitDurationText('not-a-date', now)).toBeNull()
    })
})
