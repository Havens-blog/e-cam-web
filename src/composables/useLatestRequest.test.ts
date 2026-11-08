import { describe, expect, it } from 'vitest'
import { useLatestRequest } from './useLatestRequest'

/**
 * iter270：列表请求竞态守卫。
 * 端到端已在 `alert/rules` 上复现（页码 3 却显示第 2 页数据），此处覆盖边界。
 */
describe('useLatestRequest', () => {
  it('只有最后一次领号的是最新', () => {
    const latest = useLatestRequest()
    const a = latest.begin()
    const b = latest.begin()
    expect(latest.isCurrent(a)).toBe(false)
    expect(latest.isCurrent(b)).toBe(true)
  })

  it('单次请求永远是当前（不误伤正常路径）', () => {
    const latest = useLatestRequest()
    const only = latest.begin()
    expect(latest.isCurrent(only)).toBe(true)
  })

  it('慢的旧请求返回时不再是最新 —— 复现「翻页覆盖」场景', async () => {
    const latest = useLatestRequest()
    const results: string[] = []

    // 第 2 页：慢（模拟 3s），最终返回却已被第 3 页抢号
    const slow = (async () => {
      const seq = latest.begin()
      await new Promise((r) => setTimeout(r, 30))
      if (!latest.isCurrent(seq)) return   // ← 守卫：丢弃
      results.push('page2')
    })()

    // 第 3 页：快，先完成
    const fast = (async () => {
      const seq = latest.begin()
      await new Promise((r) => setTimeout(r, 1))
      if (!latest.isCurrent(seq)) return
      results.push('page3')
    })()

    await Promise.all([slow, fast])
    expect(results).toEqual(['page3'])     // 慢的旧响应被丢弃
  })

  it('reset 之后，在途请求全部失效（组件卸载场景）', () => {
    const latest = useLatestRequest()
    const inflight = latest.begin()
    latest.reset()
    expect(latest.isCurrent(inflight)).toBe(false)
  })

  it('reset 后新领的号仍然有效', () => {
    const latest = useLatestRequest()
    latest.begin()
    latest.reset()
    const next = latest.begin()
    expect(latest.isCurrent(next)).toBe(true)
  })

  it('序号严格递增，不会因 reset 或多次调用回绕', () => {
    const latest = useLatestRequest()
    const tokens = [latest.begin(), latest.begin(), latest.begin()]
    latest.reset()
    tokens.push(latest.begin())
    const sorted = [...tokens].sort((a, b) => a - b)
    expect(tokens).toEqual(sorted)
    expect(new Set(tokens).size).toBe(tokens.length)
  })
})
