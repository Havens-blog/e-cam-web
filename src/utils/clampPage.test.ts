import { describe, expect, it } from 'vitest'
import { clampPageAfterTotalChange } from './clampPage'

/**
 * iter166：删除当前页最后一条 / 筛选后结果变少 → 页码应收敛，不停在空页。
 * 本租户只有 1 条渠道数据，无法端到端构造「删掉第 3 页最后一条」，故用单测覆盖边界。
 */
describe('clampPageAfterTotalChange', () => {
  it('删掉最后一页的唯一一条：页码退回上一页', () => {
    // 41 条 3 页，停在第 3 页；删 1 条 → 40 条正好 2 页
    expect(clampPageAfterTotalChange(3, 40, 20)).toBe(2)
  })

  it('页码仍合法时不动', () => {
    expect(clampPageAfterTotalChange(2, 40, 20)).toBe(2)
    expect(clampPageAfterTotalChange(1, 41, 20)).toBe(1)
  })

  it('全部删空时回到第 1 页（不是第 0 页）', () => {
    expect(clampPageAfterTotalChange(3, 0, 20)).toBe(1)
  })

  it('筛选后只剩少量结果：一次收敛到最后一页', () => {
    // 停在第 5 页，筛选后只剩 3 条（1 页）
    expect(clampPageAfterTotalChange(5, 3, 20)).toBe(1)
  })

  it('pageSize 非法（0/负数）时按 20 兜底，不产生 NaN', () => {
    expect(clampPageAfterTotalChange(3, 100, 0)).toBe(3)
    expect(Number.isNaN(clampPageAfterTotalChange(1, 100, 0))).toBe(false)
  })

  it('总数为负（异常数据）时不崩，返回 1', () => {
    expect(clampPageAfterTotalChange(2, -5, 20)).toBe(1)
  })

  // ── iter283：与 views/tasks/pagination.ts 的重复实现合并后新增的边界 ──

  it('页码小于 1（0 / 负数）一律落到第 1 页', () => {
    // 合并前两侧行为不一：clampPageToTotal 会原样返回 0 / -2
    expect(clampPageAfterTotalChange(0, 100, 20)).toBe(1)
    expect(clampPageAfterTotalChange(-2, 100, 20)).toBe(1)
  })

  it('total 为 NaN 时不产生 NaN（合并前会算出 NaN，导致 offset=NaN 发给后端）', () => {
    const r = clampPageAfterTotalChange(3, Number.NaN, 20)
    expect(Number.isNaN(r)).toBe(false)
    expect(r).toBe(3) // 算不出总页数时不臆测上限，只保证页码合法
  })

  it('total 为 NaN 且页码非法时，仍落到第 1 页', () => {
    expect(clampPageAfterTotalChange(0, Number.NaN, 20)).toBe(1)
    expect(clampPageAfterTotalChange(-5, Number.NaN, 20)).toBe(1)
  })

  it('total 为 Infinity 时不臆测上限，保留合法页码', () => {
    expect(clampPageAfterTotalChange(99, Number.POSITIVE_INFINITY, 20)).toBe(99)
  })

  it('页码为非整数时向下取整（避免 offset = 小数）', () => {
    expect(clampPageAfterTotalChange(2.7, 100, 20)).toBe(2)
  })

  it('页码为 NaN 时落到第 1 页', () => {
    expect(clampPageAfterTotalChange(Number.NaN, 100, 20)).toBe(1)
  })
})
