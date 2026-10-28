// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useMediaQuery } from './useMediaQuery'

function mountWithMedia(query: string, initialMatches: boolean) {
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    const mql = {
        matches: initialMatches,
        media: query,
        addEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb)),
        removeEventListener: vi.fn((_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb)),
        dispatch(matches: boolean) {
            listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent))
        },
    }
    vi.stubGlobal('matchMedia', vi.fn(() => mql))

    let value: boolean | undefined
    const Comp = defineComponent({
        setup() {
            const matches = useMediaQuery(query)
            return () => {
                value = matches.value
                return h('div')
            }
        },
    })
    const wrapper = mount(Comp)
    return { wrapper, mql, get value() { return value } }
}

describe('useMediaQuery', () => {
    it('挂载时读取初始 matches 并响应 change', async () => {
        const ctx = mountWithMedia('(max-width: 1023px)', true)
        await nextTick()
        expect(ctx.value).toBe(true)
        ctx.mql.dispatch(false)
        await ctx.wrapper.vm.$nextTick()
        expect(ctx.value).toBe(false)
        ctx.wrapper.unmount()
        expect(ctx.mql.removeEventListener).toHaveBeenCalled()
    })

    it('初始不匹配时为 false', () => {
        const ctx = mountWithMedia('(max-width: 1023px)', false)
        expect(ctx.value).toBe(false)
        ctx.wrapper.unmount()
    })
})
