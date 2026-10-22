// gzip-budget.mjs — e-cam-web 性能预算闸门（对齐 haven-console/scripts/gzip-budget.mjs 口径）
//
// 汇总 dist/**/*.gz 体积，按桶分类，超预算即 fail（exit 1）。
// 桶与限值依据 2026-02 实测（iconfont 精简+异步分包、echarts 按需注册后）：
//   entry          ≤ 40 KB   （dist/index.html <script src> 直连 js——唯一可靠判据）
//   element-plus   ≤ 200 KB  （js/element-plus-*.js）
//   echarts        ≤ 220 KB  （js/echarts-*.js，按需注册后实测 181）
//   vue-ecosystem  ≤ 50 KB   （js/vue-vendor-*.js）
//   iconfont-sprite ≤ 170 KB （js/iconfont-*.js，异步分包精简 sprite 实测 140）
//   routes         ≤ 640 KB  （其余懒加载视图 chunk，111 个实测 544.7）
//   remainder      ≤ 1080 KB （css/字体/图标等非 js；字体占大头且 gzip 近原样）
//   grandTotal     ≤ 2300 KB （全量静态 gzip 总预算）
//
// Hard Rule：超限必须 fail，不得放宽后放行。
// 失效保护（同 haven-console 修复口径）：
//   - dist 无任何 .gz → fail（防误用 vite build 而非 build:gz 时 0 KB 误判通过）
//   - dist/index.html 缺失/无 <script src> → fail（无法可靠识别 entry，宁红勿漏）
//
// ⚠ 与 haven-console 的关键差异：本仓懒加载路由 chunk 同名 index-*.js（每个
//   views/**/index.vue 各产一个），不能按 `js/index-*` 前缀识别入口——必须解析
//   dist/index.html 的 script src（vite base '/cam/'，产物形如 /cam/js/index-X.js）。
//
// 用法: node scripts/gzip-budget.mjs [dist-dir]   （默认 dist）

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KB = 1024

export const BUDGETS = Object.freeze({
  entry: { limit: 40, label: 'entry 自研（index.html 直连）' },
  'element-plus': { limit: 200, label: 'element-plus' },
  echarts: { limit: 220, label: 'echarts（按需注册）' },
  'vue-ecosystem': { limit: 50, label: 'vue/router/pinia' },
  'iconfont-sprite': { limit: 170, label: 'iconfont 精简 sprite（异步 chunk）' },
  routes: { limit: 640, label: 'routes 懒加载视图' },
  remainder: { limit: 1080, label: '其余（css/字体/图标）' },
})
export const TOTAL_LIMIT_KB = 2300

/**
 * 解析 dist/index.html 直接引用的 js 产物叶子文件名（entry chunk 判据）。
 * @param {string} distDir
 * @returns {string[] | null} 叶子名数组（如 ['index-X.js','vue-vendor-Y.js']）；index.html 缺失返回 null
 */
export function parseEntryScripts(distDir) {
  const htmlPath = join(distDir, 'index.html')
  if (!existsSync(htmlPath)) return null
  const html = readFileSync(htmlPath, 'utf8')
  const names = []
  const re = /src="[^"]*\/js\/([^"/]+\.js)"/g
  let m
  while ((m = re.exec(html)) !== null) names.push(m[1])
  return names
}

/**
 * 递归收集目录下所有 .gz 文件（相对路径，POSIX 斜杠，已排序）。
 * @param {string} root
 * @returns {string[]}
 */
export function collectGzFiles(root) {
  const out = []
  const walk = (dir, rel = '') => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const abs = join(dir, ent.name)
      const relPath = rel ? `${rel}/${ent.name}` : ent.name
      if (ent.isDirectory()) walk(abs, relPath)
      else if (ent.isFile() && ent.name.endsWith('.gz')) out.push(relPath)
    }
  }
  walk(root)
  return out.sort()
}

/**
 * 将一个 .gz 文件归类到预算桶。
 * @param {string} gzPath 相对 dist 根的 .gz 路径（POSIX 斜杠）
 * @param {string[] | null} entryScripts parseEntryScripts 的结果
 * @returns {'entry'|'element-plus'|'echarts'|'vue-ecosystem'|'iconfont-sprite'|'routes'|'remainder'}
 */
export function classifyBucket(gzPath, entryScripts) {
  const base = gzPath.endsWith('.gz') ? gzPath.slice(0, -3) : gzPath
  const leaf = base.split('/').pop() ?? base
  if (entryScripts && entryScripts.includes(leaf)) return 'entry'
  if (base.startsWith('js/')) {
    if (leaf.startsWith('element-plus-')) return 'element-plus'
    if (leaf.startsWith('echarts-')) return 'echarts'
    if (leaf.startsWith('vue-vendor-')) return 'vue-ecosystem'
    if (leaf.startsWith('iconfont-')) return 'iconfont-sprite'
    return 'routes'
  }
  return 'remainder'
}

/**
 * 汇总 dist 下所有 .gz 体积到各桶 + 总计。
 * @param {string} root dist 根目录
 */
export function summarizeGz(root) {
  const entryScripts = parseEntryScripts(root)
  const gzFiles = collectGzFiles(root)
  const bucketKeys = ['entry', 'element-plus', 'echarts', 'vue-ecosystem', 'iconfont-sprite', 'routes', 'remainder']
  const buckets = Object.fromEntries(bucketKeys.map((k) => [k, { files: [], bytes: 0 }]))
  for (const rel of gzFiles) {
    const abs = join(root, ...rel.split('/'))
    const bytes = statSync(abs).size
    const bucket = classifyBucket(rel, entryScripts)
    buckets[bucket].files.push({ path: rel, bytes })
    buckets[bucket].bytes += bytes
  }
  for (const b of Object.values(buckets)) {
    b.kb = Math.round((b.bytes / KB) * 10) / 10
  }
  const totalBytes = Object.values(buckets).reduce((s, b) => s + b.bytes, 0)
  return {
    buckets,
    totalBytes,
    totalKb: Math.round((totalBytes / KB) * 10) / 10,
    files: gzFiles,
    entryScripts,
  }
}

/**
 * 检查预算：逐桶 + 总计，任一超限即 fail；含两级失效保护。
 * @param {ReturnType<typeof summarizeGz>} summary
 */
export function checkBudget(summary) {
  const failures = []
  if (summary.files.length === 0) {
    failures.push({
      scope: 'no-gz-files',
      limitKb: null,
      actualKb: null,
      reason: 'dist 下未找到任何 .gz 产物（构建未预压缩，误用 vite build 而非 build:gz？）',
    })
    return { passed: false, failures }
  }
  if (summary.entryScripts === null) {
    failures.push({
      scope: 'no-entry-html',
      limitKb: null,
      actualKb: null,
      reason: 'dist/index.html 缺失，无法可靠识别 entry chunk（构建产物不完整？）',
    })
    return { passed: false, failures }
  }
  if (summary.entryScripts.length === 0) {
    failures.push({
      scope: 'no-entry-html',
      limitKb: null,
      actualKb: null,
      reason: 'dist/index.html 中未发现 <script src="…/js/…">，entry 判据失效',
    })
    return { passed: false, failures }
  }
  for (const [key, b] of Object.entries(summary.buckets)) {
    const limit = BUDGETS[key].limit
    if (b.kb > limit) {
      failures.push({ scope: key, limitKb: limit, actualKb: b.kb })
    }
  }
  if (summary.totalKb > TOTAL_LIMIT_KB) {
    failures.push({ scope: 'total', limitKb: TOTAL_LIMIT_KB, actualKb: summary.totalKb })
  }
  return { passed: failures.length === 0, failures }
}

/** 格式化为人类可读报告字符串。 */
export function formatReport(summary) {
  const lines = []
  const entryNote = summary.entryScripts ? `entry: ${summary.entryScripts.join(', ')}` : 'entry: (index.html 缺失)'
  lines.push(`gzip 预算报告（dist/**/*.gz｜${entryNote}）`)
  lines.push('─'.repeat(56))
  for (const [key, b] of Object.entries(summary.buckets)) {
    const limit = BUDGETS[key]
    const status = b.kb <= limit.limit ? 'OK' : 'OVER'
    lines.push(
      `${limit.label.padEnd(30)} ${String(b.kb).padStart(8)} KB / ${String(limit.limit).padStart(5)} KB  [${status}]`,
    )
    if (b.kb > limit.limit) {
      for (const f of b.files) lines.push(`    ${(f.bytes / KB).toFixed(2)} KB  ${f.path}`)
    }
  }
  lines.push('─'.repeat(56))
  const totalStatus = summary.totalKb <= TOTAL_LIMIT_KB ? 'OK' : 'OVER'
  lines.push(
    `${'全量 gzip 总计'.padEnd(30)} ${String(summary.totalKb).padStart(8)} KB / ${String(TOTAL_LIMIT_KB).padStart(5)} KB  [${totalStatus}]`,
  )
  return lines.join('\n')
}

// ── CLI 入口 ──────────────────────────────────────────────
export function main(argv = process.argv) {
  const distDir = argv[2] || 'dist'
  const summary = summarizeGz(distDir)
  const { passed, failures } = checkBudget(summary)

  if (summary.files.length === 0) {
    console.error(`\n❌ gzip 预算闸门失败：${distDir} 下未找到任何 .gz 文件。`)
    console.error('   构建未生成预压缩产物（可能误用 `vite build` 而非 `build:gz`）。')
    console.error('   修复：先执行 `build:gz`（= vite build && node scripts/generate-gz.mjs）再跑 ci:gzip-budget。')
    process.exit(1)
  }
  if (summary.entryScripts === null || summary.entryScripts.length === 0) {
    console.error('\n❌ gzip 预算闸门失败：无法从 dist/index.html 识别 entry chunk。')
    console.error('   entry 判据是 index.html 的 <script src="…/js/…">，缺失说明产物不完整或结构变更。')
    process.exit(1)
  }

  console.log(formatReport(summary))
  if (!passed) {
    console.error('\n❌ gzip 预算超限（Hard Rule：不得放宽后放行）:')
    for (const f of failures) {
      if (f.scope === 'no-gz-files' || f.scope === 'no-entry-html') {
        console.error(`  - ${f.scope}: ${f.reason}`)
      } else {
        console.error(`  - ${f.scope}: ${f.actualKb} KB > ${f.limitKb} KB`)
      }
    }
    process.exit(1)
  }
  console.log('\n✅ gzip 预算通过（全量 ≤ 2300 KB，各桶均在限内）')
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirect) main()
