/**
 * 主题作用域守卫（iter391 / S228）
 *
 * ── 缺陷 ──
 * CAM 的浅色主题是**在深色上叠加**做到的：深色根元素 `class="dark"`，
 * 浅色是 `class="dark light"` —— **两个类同时存在**。
 *
 * 于是 `html.dark ...` 这类「深色专属」选择器在**浅色主题下依然命中**。
 *
 * 实测后果（iter390）：`compute/template/index.vue` 把页面的深藏青渐变写在
 * `html.dark .template-manage-page` 下，导致**整个模板管理页在浅色主题里是深底配深字**，
 * 正文实测 **1.18:1**（WCAG AA 需 4.5）。而旧版普查工具因为只读 `backgroundColor`、
 * 不读 `backgroundImage`，把它误报成 4.47 —— **一个几乎不可读的页面被记成了「差 0.03」**。
 *
 * 全仓当时共 25 处 `html.dark`、2 个文件，**没有一处带 `:not(.light)`**。
 *
 * ── 修法 ──
 * `html.dark` → `html.dark:not(.light)`。深色下 `:not(.light)` 恒真（class 只有 `dark`），
 * 行为完全不变；浅色下（`dark light`）不再命中。
 *
 * ── 为什么需要这条守卫 ──
 * 修完 25 处只说明「今天的存量干净」，不说明「明天新增的也干净」。
 * 只要有人再写一次 `html.dark`，同一个页面级故障就会重现，
 * 而且**它不会被任何对比度检查发现**（检查跑的是当前主题，通常只跑默认的深色）。
 *
 * ── 扫描边界（诚实声明）──
 * ① 只扫 `src/` 下的 `.vue` 与 `.scss`；
 * ② 只看「选择器行」（含 `{`，或以 `,` 结尾），跳过高亮的注释行 ——
 *    注释里提到 `html.dark` 是允许的（本文件与 cert-theme.scss 都在注释里写过）；
 * ③ 不解析嵌套 / `@media` 内部结构，纯文本行级匹配；
 * ④ `:root.dark` 与本仓未使用的 `[data-theme='dark']` 一视同仁 —— 只查前者。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')

/** 递归收集 .vue / .scss 文件（绝对路径） */
function collect(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue
      collect(p, out)
    } else if (ent.name.endsWith('.vue') || ent.name.endsWith('.scss')) {
      out.push(p)
    }
  }
  return out
}

interface Violation {
  file: string
  line: number
  text: string
}

/** 未带 :not(.light) 的 html.dark / :root.dark */
const UNSCOPED = /(?:html|:root)\.dark(?!:not\()/

/** 注释行（css 块注释续行、scss 行注释） */
function isCommentLine(t: string): boolean {
  const s = t.trim()
  return s.startsWith('//') || s.startsWith('/*') || s.startsWith('*')
}

function findViolations(files: string[]): { violations: Violation[]; scoped: number } {
  const violations: Violation[] = []
  let scoped = 0
  for (const abs of files) {
    const rel = relative(process.cwd(), abs).replace(/\\/g, '/')
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!UNSCOPED.test(line)) return
      if (isCommentLine(line)) return
      // 只认「选择器行」：含 { 或以 , 结尾
      const isSelector = line.includes('{') || line.trimEnd().endsWith(',')
      if (!isSelector) return
      violations.push({ file: rel, line: i + 1, text: line.trim().slice(0, 100) })
    })
    scoped += (readFileSync(abs, 'utf8').match(/html\.dark:not\(\.light\)|:root\.dark:not\(\.light\)/g) || []).length
  }
  return { violations, scoped }
}

describe('主题作用域守卫（S228：浅色是「叠加」在深色上，html.dark 必须补 :not(.light)）', () => {
  it('不存在未限定浅色的 html.dark / :root.dark 选择器', () => {
    const { violations } = findViolations(collect(SRC))
    const detail = violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join('\n')
    expect(
      violations,
      violations.length
        ? `发现 ${violations.length} 处「深色专属」选择器未排除浅色主题。\n` +
            `请改成 html.dark:not(.light)（深色行为不变，浅色不再误命中）：\n${detail}`
        : '',
    ).toEqual([])
  })

  it('修正后的写法确实存在于代码中（防止有人靠「删规则」让上一条通过）', () => {
    const { scoped } = findViolations(collect(SRC))
    // iter390 修复时实际写了 25 处。留一个下界而非精确值，避免正常增删导致误报。
    expect(scoped, '未找到任何 html.dark:not(.light) —— 上一条可能是因为规则被整段删除而通过').toBeGreaterThanOrEqual(20)
  })
})
