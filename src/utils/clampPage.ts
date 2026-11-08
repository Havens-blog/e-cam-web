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
 *
 * iter283：与 `views/tasks/pagination.ts` 里重复的 `clampPageToTotal` 合并 ——
 * 原来两处实现各有缺陷，取并集的正确行为：
 *   · 本函数此前对 `total = NaN` 会算出 `NaN`（`Math.max(0, NaN)` → NaN），
 *     调用方会把 `offset=NaN` 发到后端；
 *   · `clampPageToTotal` 此前对 `page <= 0` 不修正（会返回 0 或负数）。
 * 现行为：**页码下限恒为 1**；`total` 非有限数时只做下限修正、不产生 NaN；
 * `pageSize` 非法（<=0）时按 20 兜底。
 */
export function clampPageAfterTotalChange(
  currentPage: number,
  total: number,
  pageSize: number,
): number {
  // 页码下限：0 / 负数 / NaN 一律落到第 1 页（不存在「第 0 页」）
  const page = Number.isFinite(currentPage) ? Math.max(1, Math.trunc(currentPage)) : 1
  // total 不可用（NaN / Infinity）时算不出总页数：只保证页码合法，不臆测上限
  if (!Number.isFinite(total)) return page
  const size = pageSize > 0 ? pageSize : 20
  const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / size))
  return Math.min(page, lastPage)
}
