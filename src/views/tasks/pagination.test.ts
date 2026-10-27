import { describe, expect, it } from 'vitest'
import {
    COMPACT_PAGINATION_LAYOUT,
    DESKTOP_PAGINATION_LAYOUT,
    paginationUiForWidth,
} from './pagination'

describe('paginationUiForWidth', () => {
    it('<=768 使用紧凑布局', () => {
        expect(paginationUiForWidth(390)).toEqual({
            small: true,
            pagerCount: 5,
            layout: COMPACT_PAGINATION_LAYOUT,
        })
        expect(paginationUiForWidth(768).small).toBe(true)
    })

    it('>768 使用桌面完整布局', () => {
        expect(paginationUiForWidth(769)).toEqual({
            small: false,
            pagerCount: 7,
            layout: DESKTOP_PAGINATION_LAYOUT,
        })
        expect(paginationUiForWidth(1440).layout).toBe(DESKTOP_PAGINATION_LAYOUT)
    })

    it('异常宽度按桌面处理', () => {
        expect(paginationUiForWidth(Number.NaN).small).toBe(false)
        expect(paginationUiForWidth(Number.POSITIVE_INFINITY).small).toBe(false)
    })
})
