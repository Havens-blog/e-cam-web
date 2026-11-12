/**
 * 图标按钮可访问名守卫（iter374）
 *
 * 背景：只含图标、没有文字的按钮，读屏软件只能念出「按钮」两个字 —— 用户不知道它会做什么。
 * 这类按钮在本仓 CAM 有 **14 个**：分页前后翻页（`ArrowLeft`/`ArrowRight`）、
 * 更多操作（`MoreFilled`）、行内编辑/删除（`Edit`/`Delete`）、弹窗关闭（`<svg>`）。
 *
 * **真实浏览器实测（iter374，`/cam/accounts`）**：
 *   修复前 `card-action-btn` → `aria=null title=null` → **可访问名是空字符串**
 *   对照（本仓既有的正确写法）`vt-btn` → `title="卡片视图"` → 可访问名正常
 *
 * ── 判据 ──
 * `<button>` 内**只有图标标签**（`<el-icon>` / `<svg>` / `<i class="icon*">`）、
 * 去掉标签后没有可见文字、且缺少可访问名来源（`aria-label` / `aria-labelledby` / `title` /
 * 内含 `sr-only` 文本）→ 报警。
 *
 * ── 阳性对照（S210）──
 * 本仓已有正确写法：`audit/logs/index.vue` 的
 *   `<el-tooltip content="导出 CSV"><el-button :icon="Download" circle title="..." /></el-tooltip>`
 * 它带 `title`，**扫描器必须不报它** —— 若把它报出来，说明判据过宽（会把正常按钮也列进缺陷）。
 *
 * ── 同时记录一个「查过但不是缺陷」的维度 ──
 * 本轮还普查了「只有 placeholder、无标签的输入框」，console 22 / CAM 150 / cmdb 0。
 * **实测误报率 100%**：抽查 `ChannelFormDialog`（7 个）与 `cam/allocation`（6 个），
 * **全部包在 `<el-form-item label="...">` 里** —— Element Plus 会渲染真实 `<label>`。
 * 所以那不是缺陷，**没有按那个数字去改**（见 S210：答不出「用什么样本证明它非空」的 0 不能信，
 * 同理，**没验证过误报率的大数字也不能信**）。
 */
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * 已知待补清单（当前为空）。
 *
 * 保留空数组的理由同 iter373：**登记机制必须比清单本身活得更久** ——
 * 第二条用例会拦「清单条目已修好却没删」，防止清单只增不减。
 */
const KNOWN_GAPS: readonly string[] = [
  // iter374：accounts/index.vue 有 3 个纯图标按钮（ArrowLeft / ArrowRight / 关闭 svg）未修 ——
  // **该文件在「他人改动，绝不 stage」清单里**，同一条约束也让它那条 Esc 丢数据的缺陷长期 BLOCKED。
  // 我一度把它的改动纳入了本 PR，随即撤回（见本次 revert 提交）。
  // 归属确认后再处理，届时从本清单删除。
  'views/accounts/index.vue',
]

/** 提取模板并剥离注释 */
function templateOf(src: string): string {
  const t0 = src.indexOf('<template>')
  const t1 = src.lastIndexOf('</template>')
  if (t0 < 0 || t1 <= t0) return ''
  return src.slice(t0, t1).replace(/<!--[\s\S]*?-->/g, '')
}

/** glob key → `views/...`（key 前缀不统一，见 iter372 的教训） */
function normalizeKey(p: string): string | null {
  const idx = p.indexOf('views/')
  if (idx >= 0) return p.slice(idx)
  let rest = p
  let depth = 0
  while (rest.startsWith('../')) {
    rest = rest.slice(3)
    depth++
  }
  // 本文件在 src/views/__tests__/ → 一层 ../ 即到 views/
  if (depth === 1) return 'views/' + rest
  return null
}

/** 找出「纯图标且无可访问名」的按钮，返回其图标名或片段（便于定位） */
/**
 * 找出所有「纯图标且无可访问名」的按钮。
 *
 * **iter376 扩展：必须覆盖 Element Plus 的三种写法**（S213 —— 只查一种会系统性漏报）：
 *   ① `<el-button :icon="X" circle />`（属性式，自闭合）
 *   ② `<el-button ...><el-icon><X /></el-icon></el-button>`（子标签式）
 *   ③ `<button ...><el-icon><X /></el-icon></button>`（原生 button）
 *
 * iter374 只查了 ③，结论是「CAM 14 个」；本轮补扫 ①② 后又发现 14 个 ——
 * **上一轮那个数字只覆盖了三分之一的情况。**
 *
 * ⚠️ 一个已修的误报：`<el-button ...><el-icon><Delete /></el-icon>批量删除</el-button>`
 * 有可见文字「批量删除」，**不是**纯图标按钮。判据里「去标签后无可见文字」这一条挡住了它 ——
 * 之前手工写的扫描脚本因非贪婪匹配跨行出错，把它误报了一次（已在最终判据里修正）。
 */
function findUnnamedIconButtons(tpl: string): string[] {
  const out: string[] = []

  // ---- ① ② el-button（属性式 + 子标签式）----
  const reEl = /<el-button\b([^>]*?)(\/>|>([\s\S]*?)<\/el-button>)/g
  let m: RegExpExecArray | null
  while ((m = reEl.exec(tpl))) {
    const attrs = m[1] ?? ''
    const inner = m[2] === '/>' ? '' : (m[3] ?? '')
    const hasIconAttr = /(:icon=|icon=")/.test(attrs)
    const hasIconChild = /<el-icon|<svg/.test(inner)
    if (!hasIconAttr && !hasIconChild) continue

    // 有可见文字 → 不是纯图标（例如「<el-icon/>批量删除」）
    if (inner.replace(/<[^>]+>/g, '').replace(/\s/g, '').length > 0) continue

    // 可访问名来源。注意：外层 <el-tooltip content="..."> **不算** ——
    // 实测（iter376）tooltip 的 content 只渲染成浮层，不会成为按钮的可访问名
    // （它既不设 aria-label 也不设 aria-describedby）。
    if (/aria-label|aria-labelledby|title=/.test(attrs)) continue
    if (/sr-only|visually-hidden/.test(inner)) continue

    const icon =
      (attrs.match(/:icon="([^"]+)"/) ?? attrs.match(/icon="([^"]+)"/) ?? [])[1] ??
      (inner.match(/<([A-Z]\w+)\s*\/>/) ?? [])[1] ??
      'svg'
    out.push('el-button:' + icon)
  }

  // ---- ③ 原生 button ----
  const btnRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/g
  while ((m = btnRe.exec(tpl))) {
    const attrs = m[1] ?? ''
    const inner = (m[2] ?? '').trim()
    if (!inner) continue

    const hasIcon = /<el-icon|<svg|<i\s+class="[^"]*icon|<ElIcon/.test(inner)
    if (!hasIcon) continue

    const textOnly = inner.replace(/<[^>]+>/g, '').replace(/\s/g, '')
    if (textOnly.length > 0) continue

    if (/aria-label|aria-labelledby|title=/.test(attrs)) continue
    if (/sr-only|visually-hidden/.test(inner)) continue

    const iconName =
      (inner.match(/<([A-Z]\w+)\s*\/>/) ?? [])[1] ??
      (inner.match(/class="([^"]*icon[^"]*)"/) ?? [])[1] ??
      'svg'
    out.push('button:' + iconName)
  }

  return out
}

describe('图标按钮可访问名守卫（iter374）', () => {
  it('纯图标按钮必须有可访问名（aria-label / aria-labelledby / title / 内含 sr-only）', () => {
    const offenders: string[] = []

    for (const [path, src] of Object.entries(sources)) {
      if (/\.(test|spec)\./.test(path)) continue
      const rel = normalizeKey(path)
      if (!rel) continue
      if (KNOWN_GAPS.includes(rel)) continue
      const tpl = templateOf(src)
      if (!tpl) continue

      const missing = findUnnamedIconButtons(tpl)
      if (missing.length) offenders.push(`${rel}  →  ${missing.join(', ')}`)
    }

    expect(
      offenders,
      '以下纯图标按钮没有可访问名 —— 读屏只会念「按钮」，用户不知道它会做什么。\n' +
        '修法：加 `aria-label="动作名"`（如 上一页 / 下一页 / 更多操作 / 关闭）：\n  ' +
        offenders.join('\n  '),
    ).toEqual([])
  })

  it('KNOWN_GAPS 里的条目必须仍然存在（防止清单过期后掩盖新问题）', () => {
    const stale: string[] = []

    for (const gap of KNOWN_GAPS) {
      const hit = Object.entries(sources).some(([path, src]) => {
        if (/\.(test|spec)\./.test(path)) return false
        if (normalizeKey(path) !== gap) return false
        const tpl = templateOf(src)
        return tpl ? findUnnamedIconButtons(tpl).length > 0 : false
      })
      if (!hit) stale.push(gap)
    }

    expect(
      stale,
      '这些条目已经没有「无名的纯图标按钮」了，请从 KNOWN_GAPS 删掉（清单只应变短）：\n  ' +
        stale.join('\n  '),
    ).toEqual([])
  })
})
