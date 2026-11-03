/**
 * 排序守卫：有分页的列表页不得使用「客户端排序」
 *
 * 背景（真实缺陷，2026-11-03 实测）：
 *   审计日志列表的「时间 / 耗时」两列表头可排序，点击后表格确实会重排 ——
 *   但**一个 API 请求都没发**。因为 el-table 的 `sortable` 默认是客户端排序，
 *   只重排当前页的 20 行；而该页共有 7411 条。
 *
 *   用户点「耗时降序」，以为看到全局最慢的请求，实际只是当前 20 行里最慢的 ——
 *   这会让人误判"系统没有慢请求"。界面在说谎。
 *
 * 已确立的修法（e-cam-web#223 + e-cam-service#332）：
 *   有分页的表列改用 `sortable="custom"`，由 `@sort-change` 转发到后端白名单排序，
 *   并且排序后回到第 1 页（否则从旧 offset 开始会错位）。
 *
 * 本用例守住这一点，防止新增页面再次把「客户端排序」用在分页列表上。
 *
 * 判定规则（刻意保守，避免误报）：
 *   同一个 .vue 里同时出现「分页组件」与「普通 sortable 列」→ 违规。
 *   豁免：
 *     1) 该文件使用了 sortable="custom"（即全部列都走了服务端排序）；
 *     2) 显式列入 KNOWN_OK（例如表格是树形/全量渲染，或提供了自定义 sort-method
 *        且数据量本身不分页 —— 这类场景客户端排序是正确语义）。
 */
import { describe, expect, it } from 'vitest'

/** 收集所有 .vue 源码（?raw，不做编译） */
const sources = import.meta.glob('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * 允许「分页 + 客户端排序」的文件（逐条注明为什么是安全的）。
 * 加进来之前请先确认：该表格确实不是"分页展示全量数据"的语义。
 */
const KNOWN_OK: Record<string, string> = {
  // 以下如需新增，请写清原因；当前审计结果为空
}

/** 分页组件存在（说明表格展示的是一页数据，而非全量） */
function hasPagination(code: string): boolean {
  return code.includes('el-pagination') || code.includes('<Pagination')
}

/**
 * 普通 sortable 列的数量。
 *
 * 只统计**字面量**写法（裸 sortable / sortable="true"）：
 *   - sortable="custom" 是服务端排序，排除；
 *   - :sortable="..."   是动态透传（如 DataTable 把 column.sortable 交给 el-table），
 *     责任在配置了该列的具体页面，不能在组件层判定 —— 否则会误报基础组件。
 */
function plainSortableCount(code: string): number {
  const tags = code.match(/<el-table-column[^>]*>/g) ?? []
  let count = 0
  for (const tag of tags) {
    if (!/sortable/.test(tag)) continue
    if (/sortable\s*=\s*["']custom["']/.test(tag)) continue
    if (/\s:sortable\s*=/.test(tag)) continue // 动态绑定，不在组件层判定
    count++
  }
  return count
}

/** 基础组件（列配置由页面传入），不在本守卫判定范围 */
function isBaseComponent(path: string): boolean {
  return path.includes('/components/')
}

describe('排序守卫：分页列表不得客户端排序', () => {
  it('待扫描的 .vue 源码不为空（防止 glob 失效导致空断言通过）', () => {
    const keys = Object.keys(sources)
    expect(keys.length, 'glob 没有匹配到任何 .vue 源码').toBeGreaterThan(50)
    const anyTable = keys.some((k) => sources[k]?.includes('<el-table'))
    expect(anyTable, '读到的源码里没有 el-table，疑似 ?raw 读取失败').toBe(true)
  })

  it('同时有分页和普通 sortable 列的页面应当为零', () => {
    const offenders: string[] = []

    for (const [path, code] of Object.entries(sources)) {
      if (isBaseComponent(path)) continue
      if (!hasPagination(code)) continue
      if (Object.prototype.hasOwnProperty.call(KNOWN_OK, path)) continue
      const plain = plainSortableCount(code)
      if (plain > 0) offenders.push(`${path}（${plain} 个普通 sortable 列）`)
    }

    expect(
      offenders,
      '以下页面同时有分页与「客户端排序」列：点击表头只会重排当前页，' +
        '用户会误以为看到全量排序结果（审计日志曾因此把 7411 条里当前 20 行当成了全局）。' +
        '请改用 sortable="custom" + @sort-change 转发到后端，并在排序后回到第 1 页；' +
        `若该表格分页语义确实安全，请加入 KNOWN_OK 并写明原因：\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('KNOWN_OK 里的文件若已不再违规，应移出名单（防止名单腐化）', () => {
    const stale: string[] = []
    for (const path of Object.keys(KNOWN_OK)) {
      const code = sources[path]
      if (!code) {
        stale.push(`${path}（文件已不存在）`)
        continue
      }
      if (!hasPagination(code) || plainSortableCount(code) === 0) {
        stale.push(`${path}（已不违规）`)
      }
    }
    expect(stale, `以下条目可以移出 KNOWN_OK：\n${stale.join('\n')}`).toEqual([])
  })
})
