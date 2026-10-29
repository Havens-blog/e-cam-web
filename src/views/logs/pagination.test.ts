// @vitest-environment happy-dom
/**
 * 时间游标翻页边界纯函数回归:剩余窗口不足一步时判「到底」,不把上界推到窗口起点之前。
 */
import { describe, expect, it } from 'vitest'
import { canLoadEarlierTs, EARLIER_STEP_MS, earlierEndMs } from './pagination'

describe('pagination boundaries', () => {
    it('allows earlier page when a full step remains', () => {
        const start = 1_000_000
        const oldestTs = start + 2 * EARLIER_STEP_MS
        expect(canLoadEarlierTs(oldestTs, start, false)).toBe(true)
        expect(earlierEndMs(oldestTs, start)).toBe(start + EARLIER_STEP_MS)
    })

    it('stops at window start boundary (oldest within one step)', () => {
        const start = 1_000_000
        const oldestTs = start + EARLIER_STEP_MS // end would equal start, not > start
        expect(canLoadEarlierTs(oldestTs, start, false)).toBe(false)
        expect(earlierEndMs(oldestTs, start)).toBeNull()
    })

    it('respects pageBottom flag', () => {
        const start = 1_000_000
        expect(canLoadEarlierTs(start + 5 * EARLIER_STEP_MS, start, true)).toBe(false)
    })

    it('returns null end when oldest already at/before start', () => {
        expect(earlierEndMs(1_000_000, 1_000_000)).toBeNull()
        expect(earlierEndMs(999_000, 1_000_000)).toBeNull()
    })
})
