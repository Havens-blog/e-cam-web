/**
 * 分页控件的响应式形态（纯函数）
 *
 * 判定依据是**容器实际可用宽度**，不是视口宽度：769 起侧栏由 64 展开到 220，
 * 视口变宽但内容区反而变窄（-155px），用视口判断会出现「窗口变大反而折行」。
 *
 * 完整 layout（total+sizes+pager+jumper）约需 646px；容器不足时降级为
 * small + 5 页码 + total/prev/pager/next，保持单行。
 */
export interface PaginationUi {
    small: boolean
    pagerCount: number
    layout: string
}

export const DESKTOP_PAGINATION_LAYOUT = 'total, sizes, prev, pager, next, jumper'
export const COMPACT_PAGINATION_LAYOUT = 'total, prev, pager, next'

/** 完整 layout 在深页（两处省略号 + 三位页码）约需 740px，低于该值降级 */
export const COMPACT_PAGINATION_MAX_CONTENT_WIDTH = 740
/** 极窄容器再用 3 页码，避免两处省略号把「下一页」挤到第二行 */
export const COMPACT_TINY_MAX_CONTENT_WIDTH = 300

export function paginationUiForContentWidth(availableWidth: number): PaginationUi {
    const compact =
        typeof availableWidth === 'number' &&
        Number.isFinite(availableWidth) &&
        availableWidth > 0 &&
        availableWidth < COMPACT_PAGINATION_MAX_CONTENT_WIDTH

    if (compact) {
        const tiny = availableWidth < COMPACT_TINY_MAX_CONTENT_WIDTH
        return { small: true, pagerCount: tiny ? 3 : 5, layout: COMPACT_PAGINATION_LAYOUT }
    }
    return { small: false, pagerCount: 7, layout: DESKTOP_PAGINATION_LAYOUT }
}
