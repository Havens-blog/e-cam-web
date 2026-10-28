import { describe, expect, it } from 'vitest'
import {
    buildPageQuery,
    clampPageToTotal,
    COMPACT_PAGINATION_LAYOUT,
    COMPACT_PAGINATION_MAX_CONTENT_WIDTH,
    DESKTOP_PAGINATION_LAYOUT,
    TINY_PAGINATION_LAYOUT,
    paginationUiForContentWidth,
    readFilterQuery,
    readPageQuery,
    readPageSizeQuery,
} from './pagination'

describe('paginationUiForContentWidth', () => {
    it('容器宽度不足时使用紧凑布局', () => {
        expect(paginationUiForContentWidth(276)).toEqual({
            small: true,
            pagerCount: 5,
            layout: TINY_PAGINATION_LAYOUT,
        })
        expect(paginationUiForContentWidth(390)).toEqual({
            small: true,
            pagerCount: 5,
            layout: COMPACT_PAGINATION_LAYOUT,
        })
        expect(paginationUiForContentWidth(600).layout).toBe(COMPACT_PAGINATION_LAYOUT)
        expect(paginationUiForContentWidth(COMPACT_PAGINATION_MAX_CONTENT_WIDTH - 1).small).toBe(true)
    })

    it('容器宽度足够时使用桌面完整布局', () => {
        expect(paginationUiForContentWidth(1024).small).toBe(false)
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


describe('分页 URL 参数', () => {
    it('读取页码：仅纯数字且 <= 1e6', () => {
        expect(readPageQuery(undefined)).toBe(1)
        expect(readPageQuery('3')).toBe(3)
        expect(readPageQuery('0')).toBe(1)
        expect(readPageQuery('-2')).toBe(1)
        expect(readPageQuery('abc')).toBe(1)
        expect(readPageQuery('1e3')).toBe(1)
        expect(readPageQuery('0x10')).toBe(1)
        expect(readPageQuery('3.0')).toBe(1)
        expect(readPageQuery('1000001')).toBe(1)
        expect(readPageQuery(['4'])).toBe(4)
    })

    it('读取每页条数：仅允许列表内取值', () => {
        expect(readPageSizeQuery('50')).toBe(50)
        expect(readPageSizeQuery('7')).toBe(20)
        expect(readPageSizeQuery(undefined)).toBe(20)
    })

    it('默认值不写入 query，保留其它参数与数组', () => {
        expect(buildPageQuery(1, 20, { type: 'cam:sync_assets' })).toEqual({ type: 'cam:sync_assets' })
        expect(buildPageQuery(2, 50, { type: 'old', status: 'failed', page: '1' }, { type: 'cam:sync_assets', status: 'pending' })).toEqual({
            type: 'cam:sync_assets',
            status: 'pending',
            page: '2',
            size: '50',
        })
        expect(buildPageQuery(1, 20, { tag: ['a', 'b'] })).toEqual({ tag: ['a', 'b'] })
    })

    it('筛选值走允许列表', () => {
        const options = [{ value: 'cam:sync_assets' }, { value: 'cam:discover_assets' }] as const
        expect(readFilterQuery('cam:sync_assets', options)).toBe('cam:sync_assets')
        expect(readFilterQuery('bogus', options)).toBeUndefined()
        expect(readFilterQuery(undefined, options)).toBeUndefined()
        expect(readFilterQuery(['cam:discover_assets'], options)).toBe('cam:discover_assets')
    })

    it('传入空 filters 时移除 URL 旧筛选', () => {
        expect(buildPageQuery(1, 20, { type: 'old', status: 'failed' }, {})).toEqual({})
        expect(buildPageQuery(2, 20, { tag: ['a', 'b'], type: 'old' }, { type: 'new' })).toEqual({
            tag: ['a', 'b'],
            type: 'new',
            page: '2',
        })
    })

    it('页码超出总页数/空结果时收敛', () => {
        expect(clampPageToTotal(9999, 7053, 20)).toBe(353)
        expect(clampPageToTotal(2, 7053, 20)).toBe(2)
        expect(clampPageToTotal(5, 0, 20)).toBe(1)
        expect(clampPageToTotal(1, 0, 20)).toBe(1)
    })
})
