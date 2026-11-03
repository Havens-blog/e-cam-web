/**
 * 列表失败态守卫（grep 型源码断言，与 stat-badge-failure-guard.test.ts 同风格）
 *
 * 背景（本迭代反复修修的同一类缺陷，跨 4 轮、共 10 个页面）：
 *   列表请求失败时，若页面只弹一次 toast 然后清空数据，表格会渲染「暂无数据」——
 *   用户以为「资源真的不存在」，而真相是「查询失败」。这两者含义相反：
 *   前者可以不管，后者必须立刻处理。
 *
 * 已确立的模式是：失败 → 持久错误态（<ErrorDisplay>）+ 重试；成功 → 清空错误态。
 * 本项目另有 <DataTable> 组件自带同一能力（errorText prop + retry 事件），
 * 因此「用 DataTable」也算达标 —— 这一点曾让我误判过一次：
 * 用 grep 只找 useListError/ErrorDisplay，把用 DataTable 的页面全算成了「待修」。
 *
 * 本用例把「页面级列表页必须有失败态」固化成守卫，防止新增页面再次踩坑。
 *
 * 判定规则（刻意保守，避免误报）：
 *   只看 src/views 下的 index.vue（页面级，不含子组件/详情页）；
 *   必须同时满足「有表格」+「有列表请求调用」；
 *   视为达标的两种实现：使用 <DataTable> 组件，或接入 useListError/ErrorDisplay。
 *
 * 豁免名单：以下页面当前确有缺口，且无法在本环境验证修复
 * （无数据 → 失败态与空态不可区分），先显式豁免，等有数据环境再补。
 */
import { describe, expect, it } from 'vitest'

/** 收集所有 .vue 源码（?raw，不做编译） */
const sources = import.meta.glob('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * 已知缺口的页面（显式豁免）。
 * 注意：这是"待修清单"，不是"允许清单" —— 修好一个就从这里删掉一个，
 * 用例会在这些页面补上失败态后变绿（因为不再命中 offenders），
 * 但如果删了豁免却修得不对，用例会重新报错。
 */
const KNOWN_GAPS: string[] = [
  // 本轮已清空：原先豁免的 6 页经实测分别属于
  //   - 已自带手写错误态（IAM 模板 / IAM 对比 / 采集管理 / 变更历史 summaryLoadError）；
  //   - 本轮补齐标准错误态（IAM 同步、DDoS）。
  // 保留空数组而不是删掉常量：下次真有无法验证的页面时，往这里加并写明原因。
]

function isKnownGap(path: string): boolean {
  return KNOWN_GAPS.some((suffix) => path.endsWith(suffix))
}

/** 页面级 index.vue（排除 components 下的子组件与详情页） */
function isPageLevel(path: string): boolean {
  return path.includes('/views/') && path.endsWith('/index.vue') && !path.includes('/components/')
}

/** 有表格渲染（Element 表格或项目封装的 DataTable） */
function rendersTable(code: string): boolean {
  return code.includes('<el-table') || code.includes('<DataTable') || code.includes('data-table')
}

/** 有列表拉取调用（各页命名不完全统一，列出已出现的写法） */
function fetchesList(code: string): boolean {
  return (
    /list\w*Api\s*\(/.test(code) ||
    /fetchInstances\s*\(/.test(code) ||
    /fetchData\s*\(/.test(code) ||
    /fetchList\s*\(/.test(code) ||
    /loadList\s*\(/.test(code) ||
    /loadTags\s*\(/.test(code)
  )
}

/**
 * 已接入失败态。认可的三种实现：
 *   1) <DataTable> 组件（自带 errorText prop + retry 事件）；
 *   2) useListError + <ErrorDisplay>（本迭代确立的标准模式）；
 *   3) 手写错误态：el-alert 绑错误变量，或错误变量 + 重试按钮。
 *
 * 第 3 种是实测确认过可用的（IAM 模板 / 采集管理 / 变更历史的 summaryLoadError），
 * 只是写法与标准模式不同 —— 判据必须认它，否则会重演上次「用 DataTable 被误判成待修」的错误。
 * 变量名匹配用大小写不敏感（summaryLoadError 里是 LoadError）。
 */
function hasFailureState(code: string): boolean {
  if (code.includes('<DataTable')) return true
  if (code.includes('useListError') || code.includes('<ErrorDisplay')) return true
  const hasErrorVar = /(load|fetch|query)?error\w*/i.test(code) || /summaryLoadError/i.test(code)
  const hasAlert = /el-alert/i.test(code)
  const hasRetry = /重试/.test(code)
  if (hasAlert && hasErrorVar && hasRetry) return true
  if (hasErrorVar && hasRetry) return true
  return false
}

describe('列表失败态守卫', () => {
  it('待扫描的 .vue 源码不为空（防止 glob 失效导致空断言通过）', () => {
    const keys = Object.keys(sources)
    expect(keys.length, 'glob 没有匹配到任何 .vue 源码').toBeGreaterThan(50)
    // 抽样确认内容真的读到了
    const anyWithTable = keys.some((k) => sources[k]?.includes('<el-table') || sources[k]?.includes('<DataTable'))
    expect(anyWithTable, '读到的源码里没有任何表格，疑似 ?raw 读取失败').toBe(true)
  })

  it('页面级列表页必须有持久失败态（DataTable 或 useListError/ErrorDisplay）', () => {
    const offenders: string[] = []

    for (const [path, code] of Object.entries(sources)) {
      if (!isPageLevel(path)) continue
      if (isKnownGap(path)) continue
      if (!rendersTable(code)) continue
      if (!fetchesList(code)) continue
      if (hasFailureState(code)) continue
      offenders.push(path)
    }

    expect(
      offenders,
      '以下页面级列表页缺少持久失败态（请求失败会被渲染成「暂无数据」，' +
        '用户无法区分"没有资源"与"查询失败"）。请接入 useListError + <ErrorDisplay>，' +
        `或改用 <DataTable>；若确实无法修复，请加入 KNOWN_GAPS 并写明原因：\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('豁免名单里的页面若已接入失败态，应同时从名单移除（防止名单腐化）', () => {
    const stale: string[] = []

    for (const [path, code] of Object.entries(sources)) {
      if (!isKnownGap(path)) continue
      if (hasFailureState(code)) stale.push(path)
    }

    expect(
      stale,
      '以下页面已接入失败态，但仍留在 KNOWN_GAPS 里（名单腐化，会掩盖未来回归）。' +
        `请把它们从 KNOWN_GAPS 删除：\n${stale.join('\n')}`,
    ).toEqual([])
  })
})
