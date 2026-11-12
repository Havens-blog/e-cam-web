/**
 * 品牌色 vs 白字的对比度守卫（iter378 / WCAG AA 4.5）
 *
 * 缺陷：`compute/provision/index.vue` 的 `.account-icon` / `.account-card-icon`
 * 文字是**固定 `#fff`**，背景取 `getProviderColor()` 的品牌色。
 *
 * 修改前实测（真实浏览器 `/cam/compute/template/create`，读 computed style 后按 WCAG 公式算）：
 *   AWS     #ff9900 → **2.14** ❌ 最差
 *   tencent #00a3ff → **2.73** ❌
 *   aliyun  #ff6a00 → **2.87** ❌
 *   volcano #f53f3f → **3.71** ❌（13px 粗体不适用 3.0 门槛）
 *   huawei  #c7000b → 6.12 ✅
 *   azure   #0078d4 → 4.53 ✅
 *
 * **4/6 不达 AA。** 旧记录只写了「3.78」，实际是 6 个色里 4 个不合格、最低 2.14 ——
 * **单点采样的数字会低估系统性缺陷**（这里 3.78 只是 volcano 一个值）。
 *
 * 修法：保持色相（RGB 相对大小关系不变）压暗到刚过 4.5 —— 品牌识别度尽量保留，
 * 同时满足可读性。每个新值都是「满足 AA 前提下的最亮结果」。
 *
 * ── 为什么不改文字为黑色 ──
 * 黑字也能达标，但品牌色块上的白字是该类图标的通用做法（对比强烈、识别度高）。
 * 压暗背景是更小的视觉改动。
 *
 * ── 守卫边界 ──
 * 本守卫只校验**这个文件里这一张表**。其他地方的品牌色（如 `getProviderColor` 的兄弟实现、
 * 或组件库内置色）不在检查范围 —— 若别处也有同样模式，需要各自加断言。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = 'src/views/compute/provision/index.vue'

/** WCAG 2.x 相对亮度 */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 对比度 */
function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

const WHITE: [number, number, number] = [255, 255, 255]
/** AA 正文门槛（13px 粗体仍属正文，不适用 3.0 的大字例外） */
const AA_NORMAL = 4.5

describe('品牌色 vs 白字对比度守卫（iter378）', () => {
  it('getProviderColor 里每个品牌色 vs #fff 都必须 ≥ 4.5（AA 正文）', () => {
    const src = readFileSync(resolve(process.cwd(), SOURCE), 'utf8')

    // 截取 getProviderColor 函数体里的 colors 表
    const fnIdx = src.indexOf('function getProviderColor')
    expect(fnIdx, '找不到 getProviderColor，判据需要更新').toBeGreaterThanOrEqual(0)
    const tail = src.slice(fnIdx)
    const tableMatch = tail.match(/const colors: Record<string, string> = \{([\s\S]*?)\}/)
    expect(tableMatch, 'getProviderColor 里找不到 colors 表，判据需要更新').toBeTruthy()

    // 取出所有 'key': '#rrggbb'
    const entries = [...(tableMatch![1] ?? '').matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)]
    expect(entries.length, 'colors 表里没有解析出任何条目').toBeGreaterThan(0)

    const failures: string[] = []
    for (const m of entries) {
      const provider = m[1] ?? ''
      const hex = m[2] ?? ''
      const ratio = contrastRatio(hexToRgb(hex), WHITE)
      if (ratio < AA_NORMAL) {
        failures.push(`${provider} ${hex} vs #fff = ${ratio.toFixed(2)}（需 ≥ ${AA_NORMAL}）`)
      }
    }

    expect(
      failures,
      '这些品牌色与图标里的白色文字对比度不足，小字读不清（WCAG AA 4.5）：\n  ' +
        failures.join('\n  ') +
        '\n修法：保持色相压暗到刚过 4.5（可用脚本枚举压暗系数），不要把文字改成其他颜色。',
    ).toEqual([])
  })

  it('图标容器的文字颜色仍是白色（若改成深色，上面的断言就不再适用，必须同步调整）', () => {
    const src = readFileSync(resolve(process.cwd(), SOURCE), 'utf8')

    // .account-icon 与 .account-card-icon 的 color 声明
    const iconRule = src.match(/\.account-icon\s*\{([^}]*)\}/)
    const cardIconRule = src.match(/\.account-card-icon\s*\{([^}]*)\}/)

    const check = (name: string, rule: RegExpMatchArray | null) => {
      expect(rule, `找不到 ${name} 的样式规则，判据需要更新`).toBeTruthy()
      const colorDecl = (rule![1] ?? '').match(/color:\s*([^;]+);/)
      expect(colorDecl, `${name} 里没有 color 声明`).toBeTruthy()
      return (colorDecl![1] ?? '').trim()
    }

    const iconColor = check('.account-icon', iconRule)
    const cardIconColor = check('.account-card-icon', cardIconRule)
    expect(
      /^#fff(fff)?$/i.test(iconColor),
      `.account-icon 的文字色不再是白色（当前 "${iconColor}"）—— 请同步修改上一条对比度断言的基准色`,
    ).toBe(true)
    expect(
      /^#fff(fff)?$/i.test(cardIconColor),
      `.account-card-icon 的文字色不再是白色（当前 "${cardIconColor}"）—— 它和 .account-icon 用的是同一张颜色表`,
    ).toBe(true)
  })
})
