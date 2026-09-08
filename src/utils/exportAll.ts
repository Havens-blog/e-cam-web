/**
 * 导出「全部数据」的全量分页拉取工具。
 *
 * 背景：导出弹窗家族（docs/features/ecam-web-ui-audit/reports/summary.md §2.2 导出家族
 * 16 项）此前「全部数据」实际只导出当前页的 props.instances。本工具提供与后端无关的
 * 分页循环：由调用方（各列表页）用自己的列表接口 + 当前筛选条件组装一个
 * fetchPage 闭包，这里负责翻页、累计、进度回调与安全上限。
 *
 * 设计约束：
 * - 不感知 offset/limit 还是 page/page_size，翻页参数由 fetchPage 闭包换算
 * - 接口异常原样抛出，由调用方统一 toast（本模块不弹任何 ElMessage）
 * - maxRows 硬上限防失控循环（后端 total 异常 / 翻页参数被忽略时兜底）
 */

/** 单次分页请求的归一结果 */
export interface FetchPageResult<T> {
    /** 本页数据行 */
    list: T[]
    /** 服务端报告的筛选后总数；接口不给时传 NaN/负数，循环按空页终止 */
    total: number
}

export interface FetchAllRowsOptions {
    /** 每页条数，默认 100 */
    pageSize?: number
    /** 累计行数硬上限，达到即停并 console.warn，默认 20000 */
    maxRows?: number
    /** 每页拉取后的进度回调（fetched=已累计行数，total=服务端总数；total 未知时等于 fetched） */
    onProgress?: (fetched: number, total: number) => void
}

/** 默认每页条数 */
export const FETCH_ALL_PAGE_SIZE = 100

/** 默认全量行数硬上限 */
export const FETCH_ALL_MAX_ROWS = 20000

/**
 * 按页循环拉取全量数据。
 *
 * 终止条件（任一满足即停）：累计行数 ≥ 服务端 total；某页返回空；
 * 累计行数达到 maxRows（此时 console.warn 并以已拉取的数据继续）。
 *
 * @param fetchPage 单页请求闭包，page 从 1 开始
 * @param opts pageSize / maxRows / onProgress
 * @returns 全量数据行（顺序即接口返回顺序）
 */
export async function fetchAllRows<T>(
    fetchPage: (page: number, pageSize: number) => Promise<FetchPageResult<T>>,
    opts: FetchAllRowsOptions = {}
): Promise<T[]> {
    const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : FETCH_ALL_PAGE_SIZE
    const maxRows = opts.maxRows && opts.maxRows > 0 ? opts.maxRows : FETCH_ALL_MAX_ROWS

    const rows: T[] = []
    let total = Number.NaN

    for (let page = 1; ; page++) {
        const result = await fetchPage(page, pageSize)
        const list = Array.isArray(result?.list) ? result.list : []
        if (typeof result?.total === 'number' && result.total > 0) total = result.total

        if (list.length > 0) rows.push(...list)

        const knownTotal = Number.isFinite(total) ? total : rows.length
        opts.onProgress?.(rows.length, knownTotal)

        // 空页：无更多数据
        if (list.length === 0) break
        // 已拿满服务端报告的总数
        if (Number.isFinite(total) && rows.length >= total) break
        // 硬上限：防 total 异常或翻页参数被忽略导致的失控循环
        if (rows.length >= maxRows) {
            console.warn(`[exportAll] 已达到全量拉取上限 ${maxRows} 条，导出将以已获取的数据继续`)
            break
        }
    }

    return rows
}
