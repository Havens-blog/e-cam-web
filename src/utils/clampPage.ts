/**
 * 删除/筛选后把页码收敛到合法范围（iter166）。
 *
 * 场景：一页 20 条、共 41 条（3 页），用户停在第 3 页（只有 1 条）。
 * 删掉那 1 条后总数变 40（正好 2 页），但 `page` 仍是 3 →
 * 请求 offset=40 返回空数组 → 用户看到**空列表 + 页码 3**，
 * 以为「数据都没了」，得手动点回第 2 页。
 *
 * 本函数给出「应该停在哪一页」：
 *   lastPage = max(1, ceil(total / pageSize))
 *   return    min(currentPage, lastPage)
 */
export function clampPageAfterTotalChange(
  currentPage: number,
  total: number,
  pageSize: number,
): number {
  const size = pageSize > 0 ? pageSize : 20
  const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / size))
  return Math.min(Math.max(1, currentPage), lastPage)
}
