/**
 * 分页控件的响应式形态（纯函数）
 *
 * 判定依据是**容器实际可用宽度**，不是视口宽度：769 起侧栏由 64 展开到 220，
 * 视口变宽但内容区反而变窄（-155px），用视口判断会出现「窗口变大反而折行」。
 *
 * 完整 layout（total+sizes+pager+jumper）约需 646px；容器不足时降级为
 * small + 5 页码 + total/prev/pager/next，保持单行。
 */
import type { LocationQueryRaw } from 'vue-router'
import { clampPageAfterTotalChange } from '@/utils/clampPage'

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

const MAX_PAGE_QUERY = 1_000_000

/** 从路由 query 读取页码：仅接受纯数字且 <= 1e6，其余回退 1 */
export function readPageQuery(value: unknown): number {
    const raw = String(Array.isArray(value) ? value[0] : value ?? '')
    if (!/^\d+$/.test(raw)) return 1
    const parsed = Number(raw)
    return parsed > 0 && parsed <= MAX_PAGE_QUERY ? parsed : 1
}

/** 从路由 query 读取每页条数：不在允许列表内回退默认值 */
export function readPageSizeQuery(value: unknown): number {
    const parsed = Number(Array.isArray(value) ? value[0] : value)
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

/** 读取筛选 query：不在可选项内则视为未筛选 */
export function readFilterQuery<T extends string>(
    value: unknown,
    options: readonly { value: T }[]
): T | undefined {
    const raw = String(Array.isArray(value) ? value[0] : value ?? '')
    return options.some((option) => option.value === raw) ? (raw as T) : undefined
}

export interface PageQueryFilters {
    type?: string
    status?: string
}

/** 构造新的 query：默认值不写入 URL；其它参数（含数组）原样保留 */
export function buildPageQuery(
    page: number,
    size: number,
    currentQuery: LocationQueryRaw = {},
    filters?: PageQueryFilters
): LocationQueryRaw {
    const next: LocationQueryRaw = { ...currentQuery }
    delete next.page
    delete next.size
    if (filters) {
        delete next.type
        delete next.status
        if (filters.type) next.type = filters.type
        if (filters.status) next.status = filters.status
    }
    if (page > 1) next.page = String(page)
    if (size !== DEFAULT_PAGE_SIZE) next.size = String(size)
    return next
}

/**
 * 页码超出总页数时收敛到最后一页。
 *
 * iter283：改为**转发**到 `@/utils/clampPage` 的共享实现 —— 此前本文件与
 * `utils/clampPage.ts` 各有一份同逻辑实现，且**两份各有缺陷**：
 *   · 本文件对 `page <= 0` 不修正（会返回 0 或负数）；
 *   · `clampPageAfterTotalChange` 对 `total = NaN` 会算出 NaN。
 * 合并后统一到共享实现（页码下限恒为 1、`total` 非有限数不产生 NaN）。
 * 保留本函数名与签名，避免改动 `tasks/index.vue` 的 import 与既有单测。
 */
export function clampPageToTotal(page: number, total: number, size: number): number {
    return clampPageAfterTotalChange(page, total, size)
}
