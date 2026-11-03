import { describe, expect, it } from 'vitest'
import { buildBatchAssignSuccessText } from './batchAssignSuccessText'

/**
 * iter165：批量分配成功提示文案
 *
 * 动机：原为固定「批量分配成功」，看不出影响了多少人/组。
 * 该租户没有用户组数据，无法端到端跑成功路径，故把文案抽成纯函数在此断言。
 */
describe('buildBatchAssignSuccessText', () => {
  it('报出人数与组数', () => {
    expect(buildBatchAssignSuccessText(3, 2)).toBe('已为 3 个用户分配 2 个用户组')
  })

  it('单个用户/单个组也正确', () => {
    expect(buildBatchAssignSuccessText(1, 1)).toBe('已为 1 个用户分配 1 个用户组')
  })

  it('数量为 0 时退回通用文案（不出现「0 个用户」这种无意义提示）', () => {
    expect(buildBatchAssignSuccessText(0, 2)).toBe('批量分配成功')
    expect(buildBatchAssignSuccessText(3, 0)).toBe('批量分配成功')
  })

  it('不编造「成功/失败条数」——接口不返回逐条结果', () => {
    const text = buildBatchAssignSuccessText(5, 2)
    expect(text).not.toMatch(/失败/)
    expect(text).not.toMatch(/成功\s*\d+\s*条/)
  })
})
