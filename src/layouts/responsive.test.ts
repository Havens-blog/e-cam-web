import { describe, expect, it } from 'vitest'
import { isNarrowViewport, NARROW_BREAKPOINT } from './responsive'

describe('isNarrowViewport', () => {
    it('手机与窄平板为窄屏', () => {
        expect(isNarrowViewport(390)).toBe(true)
        expect(isNarrowViewport(768)).toBe(true)
        expect(isNarrowViewport(NARROW_BREAKPOINT)).toBe(true)
    })

    it('桌面宽度不是窄屏', () => {
        expect(isNarrowViewport(NARROW_BREAKPOINT + 1)).toBe(false)
        expect(isNarrowViewport(1440)).toBe(false)
    })

    it('异常值按非窄屏处理', () => {
        expect(isNarrowViewport(Number.NaN)).toBe(false)
        expect(isNarrowViewport(Number.POSITIVE_INFINITY)).toBe(false)
    })

    it('可自定义断点', () => {
        expect(isNarrowViewport(500, 480)).toBe(false)
        expect(isNarrowViewport(480, 480)).toBe(true)
    })
})
