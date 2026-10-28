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
/** 极窄容器进一步隐藏「共 N 条」，给 5 个页码留出空间（pagerCount 不能小于 5） */
export const TINY_PAGINATION_LAYOUT = 'prev, pager, next'

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
        return {
            small: true,
            pagerCount: 5,
            layout: tiny ? TINY_PAGINATION_LAYOUT : COMPACT_PAGINATION_LAYOUT,
        }
    }
    return { small: false, pagerCount: 7, layout: DESKTOP_PAGINATION_LAYOUT }
}


/** 分页每页条数可选项（与 el-pagination page-sizes 一致） */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const DEFAULT_PAGE_SIZE = 20

/** 从路由 query 读取页码：非法/<=0 回退 1 */
export function readPageQuery(value: unknown): number {
    const parsed = Number(Array.isArray(value) ? value[0] : value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

/** 从路由 query 读取每页条数：不在允许列表内回退默认值 */
export function readPageSizeQuery(value: unknown): number {
    const parsed = Number(Array.isArray(value) ? value[0] : value)
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

/** 构造新的 query：默认值不写入 URL，其余参数原样保留 */
export function buildPageQuery(
    page: number,
    size: number,
    currentQuery: Record<string, unknown> = {}
): Record<string, string> {
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(currentQuery)) {
        if (key === 'page' || key === 'size' || value === undefined || value === null) continue
        next[key] = String(value)
    }
    if (page > 1) next.page = String(page)
    if (size !== DEFAULT_PAGE_SIZE) next.size = String(size)
    return next
}

/** 页码超出总页数时收敛到最后一页 */
export function clampPageToTotal(page: number, total: number, size: number): number {
    if (!Number.isFinite(total) || total <= 0 || size <= 0) return page
    const lastPage = Math.max(1, Math.ceil(total / size))
    return page > lastPage ? lastPage : page
}
