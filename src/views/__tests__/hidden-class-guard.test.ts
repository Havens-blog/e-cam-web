/**
 * 隐藏类去重守卫（iter363）
 *
 * 与 console 仓的 `src/views/__tests__/sr-only-guard.test.ts`（iter362）对齐。
 *
 * 背景：`.sr-only` 这段标准隐藏样式在 CAM 被复制了 **8 份**，并且**已经分化成 4 种形态**：
 *
 * | 形态 | 处数 | 差异 |
 * | --- | --- | --- |
 * | 1 | 5 | `clip: rect(0, 0, 0, 0)`（带逗号）|
 * | 2 | 1 | `clip: rect(0 0 0 0)`（不带逗号）|
 * | 3 | 1 | `padding` / `margin` 顺序颠倒 |
 * | 4 | 1 | **只有 5 个属性**，缺 `padding` / `margin` / `white-space` / `border` |
 *
 * 而且 `ImportCertModal.vue` 那份连**类名**都不一样（`.visually-hidden`），
 * 且**从未被使用**（死代码）。
 *
 * 现在统一定义在 `src/assets/styles/utilities.scss`，由 `index.scss` `@import`。
 *
 * 本守卫锁三件事：
 *   ① 页面/组件里不得再出现 `.sr-only { ... }` 或 `.visually-hidden { ... }` 定义；
 *   ② 全局定义**必须存在且关键属性齐全**；
 *   ③ 页面里在用的隐藏类，全局必须有兜底（用法与定义对得上）。
 *
 * ②③ 是防「守卫被绕过」：若只断言「页面里没有定义」，把定义连同全局一起删掉也能全绿 ——
 * 但那时这些「仅供读屏」的文本会**直接显示在界面上**。（同 S198：守卫只保证「没有违规」，
 * 自我对照才保证「守卫还在工作」。）
 *
 * 注：全局样式**必须用 `fs.readFileSync` 读**，不能用 `import.meta.glob(..., { query: '?raw' })`
 * —— iter362 在 console 实测：vitest 把 `.scss` 交给 CSS 插件处理，`?raw` 读出来**全是空字符串**
 * （连既有的 `variables.scss` 都是 0 长度）。这个坑**双向**：既能造假红也能造假绿。见 S201。
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/** 所有 .vue 源码（?raw，不做编译）—— .vue 的 ?raw 是可靠的 */
const sources = import.meta.glob('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** 隐藏类名（穷举别名，见 S200） */
const HIDDEN_CLASSES = ['sr-only', 'visually-hidden', 'visuallyhidden', 'a11y-hidden'] as const

/** 全局样式：用 fs 读（不能用 ?raw，见文件头注释） */
function readGlobalStyles(): Record<string, string> {
  const dir = path.resolve(process.cwd(), 'src/assets/styles')
  const out: Record<string, string> = {}
  if (!fs.existsSync(dir)) return out
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.scss')) out[name] = fs.readFileSync(path.join(dir, name), 'utf8')
  }
  return out
}

const globalStyles = readGlobalStyles()
const allGlobal = Object.values(globalStyles).join('\n')

describe('隐藏类去重守卫（iter363）', () => {
  it('页面/组件里不得再定义 .sr-only / .visually-hidden', () => {
    const offenders: string[] = []

    for (const [p, src] of Object.entries(sources)) {
      if (/\.(test|spec)\./.test(p)) continue
      src.split('\n').forEach((line, i) => {
        for (const cls of HIDDEN_CLASSES) {
          if (new RegExp(`^\\s*\\.${cls}\\s*\\{`).test(line)) {
            const rel = p.replace(/^.*?\.\.\/\.\.\//, '')
            offenders.push(`${rel}:${i + 1}  (.${cls})`)
          }
        }
      })
    }

    expect(
      offenders,
      '页面/组件里出现了隐藏类定义。\n' +
        '请删掉局部定义，改用全局 `src/assets/styles/utilities.scss`：\n  ' +
        offenders.join('\n  '),
    ).toEqual([])
  })

  it('全局定义必须存在且关键属性齐全（防止「定义与用法的副本一起被删」）', () => {
    // ① 定义存在
    expect(
      /\.sr-only\s*\{/.test(allGlobal),
      '全局样式里找不到 .sr-only 定义 —— 页面仍在使用 class="sr-only"，' +
        '若定义缺失，这些「仅供读屏」的文本会直接显示在界面上。',
    ).toBe(true)

    // ② 关键属性齐全（缺一个就会出现「视觉可见」或「读屏读不到」）
    const block = allGlobal.match(/\.sr-only\s*\{([^}]*)\}/)?.[1] ?? ''
    const required = ['position', 'width', 'height', 'overflow', 'clip', 'white-space', 'border']
    const missing = required.filter((prop) => !new RegExp(`(^|[\\s;])${prop}\\s*:`).test(block))
    expect(
      missing,
      '.sr-only 定义缺少关键属性（少一个就会出现「视觉可见」或「读屏读不到」）：' + missing.join(', '),
    ).toEqual([])
  })

  it('页面里在用的隐藏类，全局都有兜底（用法与定义对得上）', () => {
    const usedClasses = new Set<string>()
    for (const [p, src] of Object.entries(sources)) {
      if (/\.(test|spec)\./.test(p)) continue
      for (const cls of HIDDEN_CLASSES) {
        if (new RegExp(`class="[^"]*\\b${cls}\\b`).test(src)) usedClasses.add(cls)
      }
    }

    const missing: string[] = []
    for (const cls of usedClasses) {
      if (!new RegExp(`\\.${cls}\\s*\\{`).test(allGlobal)) missing.push(cls)
    }

    expect(
      missing,
      '以下隐藏类在页面里被使用，但全局没有定义（这些文本会直接显示出来）：' + missing.join(', '),
    ).toEqual([])
  })
})
