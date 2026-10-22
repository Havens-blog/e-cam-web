// gzip-budget.test.mjs — e-cam-web 预算闸门单测（对齐 haven-console 测试口径）
//
// 重点覆盖：
//   1. classifyBucket 各桶归类（含本仓特例：路由 chunk 与 entry 同名 index-*.js，
//      必须靠 index.html 引用判别，而非文件名前缀）
//   2. 失效保护：无 .gz / index.html 缺失 / index.html 无 js 引用 → 一律 fail

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  classifyBucket,
  collectGzFiles,
  parseEntryScripts,
  summarizeGz,
  checkBudget,
  formatReport,
  BUDGETS,
  TOTAL_LIMIT_KB,
} from '../gzip-budget.mjs'

const ENTRY_HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="/cam/css/index-ABC.css"></head>
<body><div id="app"></div>
<script type="module" src="/cam/js/index-ABC.js"></script>
<script type="module" src="/cam/js/vue-vendor-ABC.js"></script>
</body></html>`

function makeDist(root, { withHtml = true } = {}) {
  if (withHtml) writeFileSync(join(root, 'index.html'), ENTRY_HTML)
  mkdirSync(join(root, 'js'), { recursive: true })
  // entry：index.html 直连（index 20K + vue-vendor 18K = 38K ≤ 40K 限值）
  writeFileSync(join(root, 'js', 'index-ABC.js.gz'), Buffer.alloc(20 * 1024))
  writeFileSync(join(root, 'js', 'vue-vendor-ABC.js.gz'), Buffer.alloc(18 * 1024))
  // 非直连的同名前缀 chunk——必须是 routes，不是 entry（本仓特例）
  writeFileSync(join(root, 'js', 'index-XYZ.js.gz'), Buffer.alloc(10 * 1024))
  writeFileSync(join(root, 'js', 'echarts-DEF.js.gz'), Buffer.alloc(15 * 1024))
  writeFileSync(join(root, 'js', 'element-plus-GHI.js.gz'), Buffer.alloc(5 * 1024))
  writeFileSync(join(root, 'js', 'iconfont-JKL.js.gz'), Buffer.alloc(2 * 1024))
  // 非 js → remainder
  mkdirSync(join(root, 'woff2'), { recursive: true })
  writeFileSync(join(root, 'woff2', 'iconfont-MNO.woff2.gz'), Buffer.alloc(1024))
}

describe('parseEntryScripts', () => {
  it('提取 index.html 直连的 js 叶子名（含 vite base 前缀）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gz-eb-'))
    try {
      writeFileSync(join(dir, 'index.html'), ENTRY_HTML)
      expect(parseEntryScripts(dir)).toEqual(['index-ABC.js', 'vue-vendor-ABC.js'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('index.html 缺失返回 null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gz-eb-'))
    try {
      expect(parseEntryScripts(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('classifyBucket（entry 依赖 index.html 判据）', () => {
  const entry = ['index-ABC.js', 'vue-vendor-ABC.js']
  it('index.html 直连 chunk → entry', () => {
    expect(classifyBucket('js/index-ABC.js.gz', entry)).toBe('entry')
    expect(classifyBucket('js/vue-vendor-ABC.js.gz', entry)).toBe('entry')
  })
  it('同名 index-* 但非直连 → routes（本仓特例，不能用前缀猜）', () => {
    expect(classifyBucket('js/index-XYZ.js.gz', entry)).toBe('routes')
  })
  it('echarts / element-plus / iconfont sprite / 其余 js / 非 js', () => {
    expect(classifyBucket('js/echarts-DEF.js.gz', entry)).toBe('echarts')
    expect(classifyBucket('js/element-plus-GHI.js.gz', entry)).toBe('element-plus')
    expect(classifyBucket('js/iconfont-JKL.js.gz', entry)).toBe('iconfont-sprite')
    expect(classifyBucket('js/MainLayout-AAA.js.gz', entry)).toBe('routes')
    expect(classifyBucket('woff2/iconfont-MNO.woff2.gz', entry)).toBe('remainder')
  })
  it('entryScripts 为 null 时不误判 entry', () => {
    expect(classifyBucket('js/index-ABC.js.gz', null)).toBe('routes')
  })
})

describe('summarizeGz + checkBudget', () => {
  let dir
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gz-eb-sum-'))
    makeDist(dir)
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('分桶求和正确', () => {
    const s = summarizeGz(dir)
    expect(s.buckets.entry.bytes).toBe(20 * 1024 + 18 * 1024)
    expect(s.buckets.echarts.bytes).toBe(15 * 1024)
    expect(s.buckets.routes.bytes).toBe(10 * 1024)
    expect(s.buckets.remainder.bytes).toBe(1024)
    expect(s.totalBytes).toBe(20 * 1024 + 18 * 1024 + 10 * 1024 + 15 * 1024 + 5 * 1024 + 2 * 1024 + 1024)
  })

  it('各桶限内时通过', () => {
    const r = checkBudget(summarizeGz(dir))
    expect(r.passed).toBe(true)
    expect(r.failures).toEqual([])
  })

  it('echarts 桶超限 → fail', () => {
    writeFileSync(join(dir, 'js', 'echarts-HUGE.js.gz'), Buffer.alloc(230 * 1024))
    const r = checkBudget(summarizeGz(dir))
    expect(r.passed).toBe(false)
    expect(r.failures.some((f) => f.scope === 'echarts')).toBe(true)
  })

  it('失效保护：dist 无 .gz → no-gz-files fail（0 KB 不得误判通过）', () => {
    const empty = mkdtempSync(join(tmpdir(), 'gz-eb-empty-'))
    try {
      writeFileSync(join(empty, 'index.html'), ENTRY_HTML)
      const r = checkBudget(summarizeGz(empty))
      expect(r.passed).toBe(false)
      expect(r.failures[0].scope).toBe('no-gz-files')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('失效保护：index.html 缺失 → no-entry-html fail', () => {
    const noHtml = mkdtempSync(join(tmpdir(), 'gz-eb-nohtml-'))
    try {
      mkdirSync(join(noHtml, 'js'), { recursive: true })
      writeFileSync(join(noHtml, 'js', 'index-A.js.gz'), Buffer.alloc(10))
      const r = checkBudget(summarizeGz(noHtml))
      expect(r.passed).toBe(false)
      expect(r.failures[0].scope).toBe('no-entry-html')
    } finally {
      rmSync(noHtml, { recursive: true, force: true })
    }
  })

  it('失效保护：index.html 存在但无 js 引用 → no-entry-html fail', () => {
    writeFileSync(join(dir, 'index.html'), '<html><body>x</body></html>')
    const r = checkBudget(summarizeGz(dir))
    expect(r.passed).toBe(false)
    expect(r.failures[0].scope).toBe('no-entry-html')
  })

  it('formatReport 正常渲染 + Hard Rule 限值固化', () => {
    expect(formatReport(summarizeGz(dir))).toContain('gzip 预算报告')
    expect(TOTAL_LIMIT_KB).toBe(2300)
    expect(BUDGETS.entry.limit).toBe(40)
    expect(BUDGETS.echarts.limit).toBe(220)
    expect(BUDGETS['iconfont-sprite'].limit).toBe(170)
  })

  it('collectGzFiles 排序输出', () => {
    const files = collectGzFiles(dir)
    expect(files).toEqual([...files].sort())
  })
})
