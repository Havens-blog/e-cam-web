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
})
