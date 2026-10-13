// trim-iconfont.mjs — 精简 iconfont SVG symbol sprite
//
// 背景：iconfont.cn 导出的 iconfont.js 把 1052 个 SVG <symbol> 全部塞进一个 ~2MB 的
// 字符串（window._iconfont_svg_string_3857903='<svg>…</svg>' + DOM-ready 注入 IIFE）。
// src/main.ts 直接 import 这个文件 → 整个 ~2MB 进了首屏 index-*.js 主包。
//
// 实际只有「彩色图标」走 SVG <use> 路径（见 src/components/IconFont/index.vue：
// useColorIcon = type 以 'caise-' 开头 || type ∈ colorIcons 白名单）。其余图标走
// 字体（<i class="iconfont X">）路径，不需要 SVG symbol。因此可只保留 caise-* 与
// colorIcons 对应的 symbol，其余剔除，主包降一个数量级。
//
// 安全性：全仓 <use xlink:href> 仅出现在 IconFont 组件内（已 grep 核实），故 SVG
// symbol 的引用集合 = {caise-*} ∪ colorIcons，不会漏删运行时引用的 symbol。
//
// 用法: node scripts/trim-iconfont.mjs
//   源（iconfont.cn 原始产物，不随构建发布）: scripts/iconfont-source/iconfont.js
//   产物（被 main.ts import，进打包）:        src/assets/iconfont/iconfont.js
//
// 重新下载 iconfont.cn 资源后，覆盖 scripts/iconfont-source/ 下文件再重跑本脚本即可。

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const SRC_JS = join(root, 'scripts/iconfont-source/iconfont.js')
const COMPONENT = join(root, 'src/components/IconFont/index.vue')
const OUT_JS = join(root, 'src/assets/iconfont/iconfont.js')

// ── 1. 从 IconFont 组件解析 colorIcons 白名单（保持与组件同步，避免硬编码漂移）──
function parseColorIcons(componentSrc) {
  // 匹配 const colorIcons = [ 'a', 'b', ... ]（单引号或双引号，跨行）
  const m = componentSrc.match(/colorIcons\s*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('未能从 IconFont 组件解析 colorIcons 数组')
  const arr = m[1]
  const ids = [...arr.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
  return new Set(ids)
}

// ── 2. 解析 iconfont.js：拆出赋值头部 / SVG 字符串体 / 注入尾部 ──
//   形如：window._iconfont_svg_string_3857903='<svg>…</svg>';!(function(t){…})(window)
function parseIconfontJs(src) {
  const assignMatch = src.match(/(window\._iconfont_svg_string_\d+\s*=\s*')/)
  if (!assignMatch) throw new Error('未找到 window._iconfont_svg_string_ 赋值，文件格式不符')
  const head = assignMatch[1] // 含开头的 '
  const stringStart = assignMatch.index + head.length
  // SVG 体不含单引号（属性用双引号），故下一个 ' 即字符串结束
  const stringEnd = src.indexOf("'", stringStart)
  if (stringEnd < 0) throw new Error('未找到 SVG 字符串结束单引号')
  const svgBody = src.slice(stringStart, stringEnd) // '<svg>…</svg>'
  const tail = src.slice(stringEnd) // 以 ' 开头，含后续 ';!(function…)(window);'
  return { head, svgBody, tail }
}

// ── 3. 拆分 <symbol id="X" …>…</symbol>，过滤，重组 ──
const SYMBOL_RE = /<symbol\s+id="([^"]+)"[^>]*>[\s\S]*?<\/symbol>/g

function splitSymbols(svgBody) {
  const symbols = []
  let m
  const re = new RegExp(SYMBOL_RE)
  while ((m = re.exec(svgBody)) !== null) {
    symbols.push({ id: m[1], markup: m[0] })
  }
  return symbols
}

function rebuildSvgBody(svgBody, keepIds, colorIcons) {
  const symbols = splitSymbols(svgBody)
  const kept = []
  const dropped = []
  for (const s of symbols) {
    const keep = s.id.startsWith('caise-') || colorIcons.has(s.id)
    if (keep) kept.push(s)
    else dropped.push(s.id)
  }
  // 保留 <svg> 与首个 <symbol> 之间的任何内容（一般无），以及末尾 </svg>
  const svgOpenMatch = svgBody.match(/^<svg[^>]*>/)
  const svgOpen = svgOpenMatch ? svgOpenMatch[0] : '<svg>'
  const svgClose = '</svg>'
  const rebuilt = svgOpen + kept.map((s) => s.markup).join('') + svgClose
  return { rebuilt, total: symbols.length, keptCount: kept.length, dropped }
}

// ── CLI ──
function main() {
  if (!existsSync(SRC_JS)) {
    throw new Error(`源文件不存在: ${SRC_JS}（iconfont.cn 原始产物应置于 scripts/iconfont-source/）`)
  }
  const src = readFileSync(SRC_JS, 'utf8')
  const componentSrc = readFileSync(COMPONENT, 'utf8')
  const colorIcons = parseColorIcons(componentSrc)
  const { head, svgBody, tail } = parseIconfontJs(src)
  const { rebuilt, total, keptCount, dropped } = rebuildSvgBody(svgBody, null, colorIcons)

  const out = head + rebuilt + tail
  writeFileSync(OUT_JS, out, 'utf8')

  const srcKb = (src.length / 1024).toFixed(1)
  const outKb = (out.length / 1024).toFixed(1)
  const ratio = ((1 - out.length / src.length) * 100).toFixed(1)
  console.log('iconfont sprite 精简报告')
  console.log('─'.repeat(52))
  console.log(`  源文件:      ${srcKb} KB  (${total} symbols)  ${SRC_JS}`)
  console.log(`  产物:        ${outKb} KB  (${keptCount} symbols)  ${OUT_JS}`)
  console.log(`  剔除:        ${dropped.length} symbols  (-${ratio}%)`)
  console.log(`  保留规则:    id 以 'caise-' 开头 ∪ colorIcons 白名单(${colorIcons.size} 个)`)
  if (dropped.length) {
    console.log(`  剔除示例(前 10): ${dropped.slice(0, 10).join(', ')}${dropped.length > 10 ? ' …' : ''}`)
  }
}

main()
