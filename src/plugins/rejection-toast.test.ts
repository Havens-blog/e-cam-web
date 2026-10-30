import { describe, expect, it } from 'vitest'
import { REJECTION_TOAST_INTERVAL_MS, shouldToastRejection } from './rejection-toast'

describe('shouldToastRejection（未捕获 rejection 的提示节流）', () => {
    it('首次（从未弹过）应弹', () => {
        expect(shouldToastRejection(1_000, 0)).toBe(true)
    })

    it('窗口内连发只弹第一条（实测 5 个 rejection 曾弹 5 条）', () => {
        const t0 = 1_000_000
        const decisions = [0, 1, 10, 500, 999].map((dt) => shouldToastRejection(t0 + dt, t0))
        expect(decisions).toEqual([false, false, false, false, false])
    })

    it('超过窗口后允许再弹', () => {
        const t0 = 1_000_000
        expect(shouldToastRejection(t0 + REJECTION_TOAST_INTERVAL_MS, t0)).toBe(true)
        expect(shouldToastRejection(t0 + REJECTION_TOAST_INTERVAL_MS - 1, t0)).toBe(false)
    })

    it('时钟回拨时不永久静默', () => {
        expect(shouldToastRejection(500, 1_000)).toBe(true)
    })

    it('非法时间戳不弹（避免 NaN 比较导致刷屏）', () => {
        expect(shouldToastRejection(Number.NaN, 0)).toBe(false)
    })
})
