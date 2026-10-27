import { describe, expect, it } from 'vitest'
import { oldestPendingWaitText } from './queue'

describe('oldestPendingWaitText', () => {
    const now = Date.parse('2026-10-28T01:30:00Z')

    it('取最早 pending 的等待时长', () => {
        const tasks = [
            { status: 'pending', created_at: '2026-10-27T23:00:00Z' },
            { status: 'pending', created_at: '2026-10-27T00:32:41Z' },
            { status: 'running', created_at: '2026-10-20T00:00:00Z' }
        ]
        expect(oldestPendingWaitText(tasks, now)).toBe('1天0小时')
    })

    it('无 pending 或时间非法返回 null', () => {
        expect(oldestPendingWaitText([], now)).toBeNull()
        expect(oldestPendingWaitText([{ status: 'running', created_at: '2026-10-27T00:00:00Z' }], now)).toBeNull()
        expect(oldestPendingWaitText([{ status: 'pending', created_at: 'bad' }], now)).toBeNull()
        expect(oldestPendingWaitText(null, now)).toBeNull()
    })

    it('未来时间 clamp 为 0 秒', () => {
        expect(oldestPendingWaitText([{ status: 'pending', created_at: '2026-10-29T00:00:00Z' }], now)).toBe('0秒')
    })
})
