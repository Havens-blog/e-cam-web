/**
 * 分页控件的响应式形态（纯函数）
 *
 * 完整 layout（total+sizes+pager+jumper）在窄屏即使换行也占 2~3 行（72~112px）；
 * ≤768（与应用窄屏断点一致）改用 small + 5 个页码 + 精简 layout，保持单行可操作。
 */
export interface PaginationUi {
    small: boolean
    pagerCount: number
    layout: string
}

export const DESKTOP_PAGINATION_LAYOUT = 'total, sizes, prev, pager, next, jumper'
export const COMPACT_PAGINATION_LAYOUT = 'total, prev, pager, next'

export const COMPACT_PAGINATION_MAX_WIDTH = 768

export function paginationUiForWidth(width: number): PaginationUi {
    const narrow =
        typeof width === 'number' &&
        Number.isFinite(width) &&
        width <= COMPACT_PAGINATION_MAX_WIDTH
    if (narrow) {
        return { small: true, pagerCount: 5, layout: COMPACT_PAGINATION_LAYOUT }
    }
    return { small: false, pagerCount: 7, layout: DESKTOP_PAGINATION_LAYOUT }
}
