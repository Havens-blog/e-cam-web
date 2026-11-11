/**
 * 列表读屏播报守卫（grep 型源码断言，与 list-failure-state-guard.test.ts 同风格）
 *
 * 背景（本迭代反复踩的同一个坑，跨 3 轮、共 3 个页面）：
 *   给列表页加读屏播报时，我三次写下 `loading ? '正在加载…' : ''` ——
 *   只播「正在加载」，加载**完成**后返回空字符串。而 live region 为空字符串
 *   等于不存在：读屏用户等完加载，什么也听不到，既不知道有几条、也不知道是不是空的。
 *   踩到的地方：iter345 organizations、iter346 impact、iter349 budget。
 *
 *   「下次注意」没有用（第三次照样踩）。所以把规则固化成守卫：
 *   **页面级列表页必须有一个 live region**（LiveStatus / role="status" /
 *   aria-live / StateBlock / DataTable 任一即可），新增页面漏写会在此变红。
 *
 * 为什么只查「有没有」，不查「写没写对三态」：
 *   三态是否正确（加载中 → 失败优先 → 空 → 条数）是语义问题，grep 判不了。
 *   本轮先用守卫解决「完全没有」，三态正确性靠 code review 与 LiveStatus
 *   组件头注释里的三条约束。
 *
 * 一个踩过的坑（写本文件时）：import.meta.glob 的 key **不是统一前缀** ——
 * 本文件在 src/views/__tests__/，同层目录下的文件是 `../audit/…`，
 * 而 src/App.vue 是 `../../App.vue`。若用固定前缀正则解析，会漏掉一半文件、
 * 导致豁免清单全部报「路径写错」。现在改为**按 views/ 锚点切分**，与相对层级无关。
 */
import { describe, expect, it } from 'vitest'

/** 收集所有 .vue 源码（?raw，不做编译） */
const sources = import.meta.glob('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * 把 glob key 归一成以 views/ 开头的稳定路径（如 views/audit/changes/index.vue）。
 * 不属于 views/ 的文件返回 null。
 */
function toViewsRelative(globKey: string): string | null {
  // 本文件位于 src/views/__tests__/，故 glob key 形如：
  //   '../audit/changes/index.vue'      （views 下的子目录）
  //   '../../App.vue'                   （src 根）
  //   '../../components/LiveStatus.vue' （src/components）
  // 统一解析成 './x/y.vue' 形式再判断是否在 views 下。
  const segments = globKey.split('/')
  const up = []
  let i = 0
  for (; i < segments.length; i++) {
    if (segments[i] === '..') up.push('..')
    else if (segments[i] === '.') continue
    else break
  }
  // 起点是 src/views/__tests__/，每 '..' 上跳一层
  const base = ['src', 'views', '__tests__']
  // 每上跳一层就弹掉一个基准段（不需要循环变量，避免 no-unused-vars）
  base.length = Math.max(0, base.length - up.length)
  const resolved = base.concat(segments.slice(i)).join('/')
  const idx = resolved.indexOf('views/')
  if (idx < 0) return null
  return resolved.slice(idx)
}

/** rel → 源码 的索引（视图内的文件） */
const byRel = new Map<string, string>()
for (const [key, src] of Object.entries(sources)) {
  const rel = toViewsRelative(key)
  if (rel) byRel.set(rel, src)
}

/**
 * 已知缺口的页面（显式豁免）。
 *
 * 这是「待修清单」，不是「允许清单」—— 修好一个就从这里删掉一个。
 * 第二条用例会检查清单是否过期（批次修完后忘删会变红）。
 *
 * 规模说明（iter350 普查，读 origin/main）：CAM 共 76 个非组件 .vue，其中
 *   用 DataTable（自动覆盖）3 页 / 自绘表格且有播报 10 页 /
 *   **自绘表格且无播报 31 页** / 无表格（详情表单页，不需播报）32 页。
 *
 * 修正记录：iter349 我在 PR 里写「CAM 主要列表页至此全部覆盖」——
 * **那是错的**。实际只覆盖了我恰好测过的 7 页。本轮普查才看到全貌，
 * 本条用例的存在就是为了让这个数字无法再被「凭印象」低估。
 */
const KNOWN_GAPS: string[] = [
  // ── audit（3）──
  'views/audit/changes/index.vue',
  'views/audit/events/index.vue',
  'views/audit/logs/index.vue',
  // ── cam / finops（2）──
  'views/cam/allocation/index.vue',
  'views/cam/cost/anomaly.vue',
  // ── cert 流程内页（1，非独立列表页，由向导整体播报）──
  'views/cert/changes/new/steps/Step3List.vue',
  // ── compute（4）──
  // ── databases（3）──
  // ── iam（6）──
  'views/iam/audit/index.vue',
  'views/iam/compare/index.vue',
  'views/iam/groups/detail.vue',
  'views/iam/sync/index.vue',
  'views/iam/templates/detail.vue',
  'views/iam/templates/index.vue',
  // ── middleware（2）──
  // ── resource / storage（2）──
  'views/resource/tag/index.vue',
  'views/storage/oss/index.vue',
]

/** 判定一个页面源码是否已具备列表播报能力 */
function hasListAnnouncement(src: string): boolean {
  // DataTable 内部已含 LiveStatus（empty/success），用它即算达标
  if (/<DataTable\b/.test(src)) return true
  if (/<LiveStatus\b/.test(src)) return true
  if (/role="status"/.test(src)) return true
  if (/aria-live=/.test(src)) return true
  if (/<StateBlock\b/.test(src)) return true
  return false
}

/** 判定一个页面源码是不是「页面级列表页」（有表格、非 components 子目录） */
function isPageLevelListPage(rel: string, src: string): boolean {
  if (!rel.startsWith('views/')) return false
  if (/(^|\/)components\//.test(rel)) return false
  if (/\.(test|spec)\./.test(rel)) return false
  return /<el-table\b|<table\b/.test(src)
}

describe('列表读屏播报守卫（iter350）', () => {
  it('每个页面级列表页都必须有 live region（或使用 DataTable）', () => {
    const offenders: string[] = []

    for (const [rel, src] of byRel) {
      if (!isPageLevelListPage(rel, src)) continue
      if (hasListAnnouncement(src)) continue
      if (KNOWN_GAPS.includes(rel)) continue
      offenders.push(rel)
    }

    expect(
      offenders,
      '以下页面级列表页既没有 LiveStatus / role="status" / aria-live，也没用 DataTable ——\n' +
        '新增页面请放 <LiveStatus :text="…" />（口径：加载中 → 失败优先 → 空 → 条数），\n' +
        '若暂时无法补齐，请加入本文件的 KNOWN_GAPS 并写明原因：\n  ' +
        offenders.join('\n  '),
    ).toEqual([])
  })

  it('KNOWN_GAPS 里的每一条都仍然真实存在（修好后必须从清单删掉）', () => {
    // 防止「修好了但忘了删豁免」导致清单长期腐烂
    const stale: string[] = []
    for (const gap of KNOWN_GAPS) {
      const src = byRel.get(gap)
      if (src === undefined) {
        stale.push(gap + '  ← 文件不存在或路径写错')
        continue
      }
      if (hasListAnnouncement(src)) {
        stale.push(gap + '  ← 已有播报，请从 KNOWN_GAPS 删除这一条')
      }
    }
    expect(stale, 'KNOWN_GAPS 已过期，请清理：\n  ' + stale.join('\n  ')).toEqual([])
  })

  it('LiveStatus 组件存在且自带视觉隐藏（不依赖全局 .sr-only）', () => {
    const entry = Object.entries(sources).find(([k]) => k.endsWith('components/LiveStatus.vue'))
    expect(entry, 'components/LiveStatus.vue 应存在').toBeDefined()
    const src = entry![1]

    // 自带 visual-hidden 规则：position:absolute + clip（本仓无全局 .sr-only）
    expect(src).toMatch(/position:\s*absolute/)
    expect(src).toMatch(/clip:\s*rect\(0/)
    // 真正生效的 class 必须是 live-status（注释里提到 .sr-only 不算，那是解释为什么不用它）
    expect(src).toMatch(/class="live-status"/)
  })
})
