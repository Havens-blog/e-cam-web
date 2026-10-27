import { describe, expect, it } from 'vitest'
import {
    COMPACT_PAGINATION_LAYOUT,
    COMPACT_PAGINATION_MAX_CONTENT_WIDTH,
    DESKTOP_PAGINATION_LAYOUT,
    paginationUiForContentWidth,
} from './pagination'

describe('paginationUiForContentWidth', () => {
    it('容器宽度不足时使用紧凑布局', () => {
        expect(paginationUiForContentWidth(390)).toEqual({
            small: true,
            pagerCount: 5,
            layout: COMPACT_PAGINATION_LAYOUT,
        })
        expect(paginationUiForContentWidth(COMPACT_PAGINATION_MAX_CONTENT_WIDTH - 1).small).toBe(true)
    })

    it('容器宽度足够时使用桌面完整布局', () => {
        expect(paginationUiForContentWidth(COMPACT_PAGINATION_MAX_CONTENT_WIDTH)).toEqual({
            small: false,
            pagerCount: 7,
            layout: DESKTOP_PAGINATION_LAYOUT,
        })
        expect(paginationUiForContentWidth(1146).layout).toBe(DESKTOP_PAGINATION_LAYOUT)
    })

    it('异常宽度（0/负数/NaN/Infinity）按桌面处理', () => {
        expect(paginationUiForContentWidth(0).small).toBe(false)
        expect(paginationUiForContentWidth(-1).small).toBe(false)
        expect(paginationUiForContentWidth(Number.NaN).small).toBe(false)
        expect(paginationUiForContentWidth(Number.POSITIVE_INFINITY).small).toBe(false)
    })
})
