/**
 * 统计卡失败态守卫（grep 型源码断言，与 MainLayout.test.ts 的 LEGACY_SEARCH_PATTERN 同风格）
 *
 * 背景（本迭代反复修复的同一类缺陷）：
 *   列表页顶部统计卡的数字来自「额外发出的计数请求」。这些请求失败时，
 *   若页面只弹一个 3 秒 toast、状态停留在初始 0，用户会把「取不到」读成
 *   「确实是 0 / 确实没有资源」—— 而同一屏的表格可能还正常显示着 20 行，自相矛盾。
 *
 * 已确定的修法：接入 `useStatText()`（失败时卡片渲染「—」，明确表达"未知"）。
 * 本迭代已按此修复 16 个页面；本用例把「有计数请求就必须接入失败态」固化成守卫，
 * 防止新增页面再次踩坑。
 *
 * 判定规则（刻意保守，避免误报）：
 *   页面源码里出现 `limit: 1`（计数查询的典型写法）**且** 渲染了 `.stat-badge`
 *   → 必须出现 `useStatText`。
 *
 * 不在守卫范围（有各自的数据来源，见各页面注释）：
 *   - 走专用 stats 接口的页面（镜像 /assets/image/stats、快照 /assets/snapshot/stats）；
 *   - 统计卡由父页面传 props 的子组件（如 ECS 的 InstancePageHeader）；
 *   - 卡片值直接来自列表响应 total、不额外发计数请求的页面。
 */
import { describe, expect, it } from 'vitest'

/** 收集所有 .vue 源码（?raw，不做编译） */
const sources = import.meta.glob('../../**/*.vue', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>

/** 需要豁免的文件（子组件：数字由父页面传入，失败态由父页面负责） */
const EXEMPT = ['components/InstancePageHeader.vue']

function isExempt(path: string): boolean {
    return EXEMPT.some((suffix) => path.endsWith(suffix))
}

describe('统计卡失败态守卫', () => {
    it('待扫描的 .vue 源码不为空（防止 glob 失效导致空断言通过）', () => {
        const keys = Object.keys(sources)
        expect(keys.length, 'glob 没有匹配到任何 .vue 源码').toBeGreaterThan(50)
        // 抽样确认内容真的读到了
        const anyWithBadge = keys.some((k) => sources[k]?.includes('stat-badge'))
        expect(anyWithBadge, '读到的源码里没有任何 stat-badge，疑似 ?raw 读取失败').toBe(true)
    })

    it('有计数请求（limit: 1）且渲染统计卡的页面，必须接入 useStatText', () => {
        const offenders: string[] = []

        for (const [path, code] of Object.entries(sources)) {
            if (isExempt(path)) continue
            const rendersStatBadge = code.includes('stat-badge')
            if (!rendersStatBadge) continue
            const issuesCountQuery = /limit:\s*1\b/.test(code)
            if (!issuesCountQuery) continue
            const usesStatText = code.includes('useStatText')
            if (!usesStatText) offenders.push(path)
        }

        expect(
            offenders,
            `以下页面有 limit:1 计数请求但未接入 useStatText（计数失败时卡片会显示 0，` +
            `与同屏表格行数矛盾）：\n${offenders.join('\n')}`
        ).toEqual([])
    })
})
