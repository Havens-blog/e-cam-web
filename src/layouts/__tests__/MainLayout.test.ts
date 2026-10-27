// @vitest-environment happy-dom
/**
 * MainLayout × CommandPalette 集成用例（ui-unify-phase2-components 任务 7）：
 * - ⌘K（macOS）/Ctrl+K（Win）经 MainLayout 挂载的 CommandPalette 全局唤起/关闭；
 * - 旧 header 简易搜索（searchKeyword/searchResults/showSearchResults 等逻辑与
 *   .search-box 模板节点）源码级 grep 断言无残留（AC2），挂载 DOM 亦无搜索框；
 * - palette 资产搜索直达 /assets/:id 详情（AC3 回归：与提案「输入资产 ID 直达详情」一致）。
 * 侧栏/用户菜单/租户选择器不在本任务范围（stub 化，零断言，AC4 以 git diff 为证）。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import {
    ElBreadcrumb,
    ElBreadcrumbItem,
    ElDropdown,
    ElDropdownItem,
    ElDropdownMenu,
    ElIcon,
    ElTooltip
} from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { searchAssetsApi } from '@/api/asset'
import MainLayout from '../MainLayout.vue'
import AppSidebar from '../components/AppSidebar.vue'
// 源码原文（grep 断言用；vite/client 提供的 ?raw 模块声明）。
// 大文件拆分后，布局由三个 SFC 组成（外壳 + 侧边栏 + 顶部导航栏），
// 三者的源码合集才等价于原「单文件」的断言域。
import mainLayoutSource from '../MainLayout.vue?raw'
import appSidebarSource from '../components/AppSidebar.vue?raw'
import topNavBarSource from '../components/TopNavBar.vue?raw'

/**
 * 布局源码合集（拆分后）。
 *
 * 下列源码级断言原先只针对 MainLayout.vue 这一个文件；该文件已拆为
 * 「MainLayout.vue（外壳）+ components/AppSidebar.vue + components/TopNavBar.vue」，
 * 被断言的内容（Logo SVG、侧边栏与导航栏的令牌化样式、主题按钮内联色）随之分布到
 * 两个新文件里。这里把断言域扩大为三者合集。
 *
 * 【这是扩大而非放宽】：每一条断言的门槛（白名单、≥7 处 color-mix、必含某令牌等）
 * 一个都没有改动，且覆盖面比拆分前更广——原先这些检查根本覆盖不到两个新文件。
 * 唯一改为针对单文件断言的是「Logo 息壤化」用例（Logo 标记现位于 AppSidebar.vue），
 * 理由见该用例内注释。
 */
const layoutSources = [mainLayoutSource, appSidebarSource, topNavBarSource].join('\n')

vi.mock('@/api/asset', () => ({
    searchAssetsApi: vi.fn()
}))

/** 测试用最小路由表：dashboard（默认落点）+ compute/ecs（资产搜索跳转回落到产品页） */
function createTestRouter(): Router {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' }, children: [
                { path: 'dashboard', component: { template: '<div />' } },
                { path: 'compute/ecs', component: { template: '<div />' } }
            ] }
        ]
    })
}

/** 本文件所有挂载实例（afterEach 统一卸载，清理全局监听与 attachTo 挂点） */
const wrappers: VueWrapper[] = []

/**
 * 挂载 MainLayout：独立 pinia（含持久化插件，palette 最近访问依赖）+ memory 路由。
 * TenantSelector/PlatformNav 为任务外区域，stub 化；el-* 显式注册
 * （页面模板依赖 unplugin 自动注册，vitest 无该插件）；teleport 内联便于断言。
 */
async function mountLayout() {
    const router = createTestRouter()
    await router.push('/')
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    const wrapper = mount(MainLayout, {
        attachTo: document.body,
        global: {
            plugins: [pinia, router],
            components: {
                ElTooltip,
                ElIcon,
                ElBreadcrumb,
                ElBreadcrumbItem,
                ElDropdown,
                ElDropdownMenu,
                ElDropdownItem
            },
            stubs: { TenantSelector: true, PlatformNav: true, teleport: true }
        }
    })
    wrappers.push(wrapper)
    return { wrapper, router }
}

/** 派发 document 级全局快捷键 */
function dispatchGlobalKey(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }))
}

/** 构造一条资产搜索结果（SearchResultItem 最小形态） */
function makeSearchItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 42,
        asset_id: 'i-abc123',
        asset_name: 'web-1',
        asset_type: 'ecs',
        provider: 'aliyun',
        region: 'cn-hangzhou',
        matches: [],
        ...overrides
    }
}

/** 旧 header 简易搜索的全部标识：脚本逻辑、API/类型引用、模板节点、样式类（AC2 grep 断言域） */
const LEGACY_SEARCH_PATTERN =
    /searchKeyword|searchResults|showSearchResults|searchLoading|searchTotal|searchInputRef|assetTypeMap|highlightText|handleResultClick|handleSearch|closeSearchResults|searchAssetsApi|SearchResultItem|search-box|search-input|search-results|search-highlight|search-dropdown|search-shortcut|search-icon|search-empty|search-loading/

beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
})

afterEach(() => {
    while (wrappers.length) {
        wrappers.pop()?.unmount()
    }
    vi.useRealTimers()
})

describe('MainLayout 主题适配（ui-unify-phase3-pilot-pages 任务 1）', () => {
    /**
     * 硬编码色清零（AC1）：除 Logo SVG 白名单（息壤 Xirang 品牌色板：
     * #5e6ad2 / #7170ff / #a5b4fc / #8b93ff / #ffffff，Phase 1 等价令牌
     * --accent-primary/--accent-blue 的品牌字面量）外，全文件不得再有 6 位 hex 与
     * 旧蓝 rgba(59,130,246)；且白名单色只允许出现在 Logo SVG 区块内。
     */
    it('硬编码色清零：旧蓝 rgba 与非白名单 hex 无残留，白名单 hex 仅限 Logo SVG', () => {
        const legacyBlueHits = layoutSources.match(/rgba\(59, ?130, ?246[^)]*\)/g) ?? []
        expect(legacyBlueHits, `残留旧蓝 rgba: ${[...new Set(legacyBlueHits)].join(', ')}`).toEqual([])

        const LOGO_WHITELIST = ['#5e6ad2', '#7170ff', '#a5b4fc', '#8b93ff', '#ffffff']
        const allHexHits = (layoutSources.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase())
        const offenders = [...new Set(allHexHits)].filter((h) => !LOGO_WHITELIST.includes(h))
        expect(offenders, `非白名单硬编码色: ${offenders.join(', ')}`).toEqual([])

        // 白名单色仅允许出现在 Logo SVG 内：移除所有 svg 区块后不应再有任何 hex
        // （侧边栏 logo 折叠/展开态各一个 svg，共两个 svg 区块；拆分后随 Logo 位于 AppSidebar.vue）
        const sourceWithoutSvg = layoutSources.replace(/<svg[\s\S]*?<\/svg>/g, '')
        const hexOutsideSvg = sourceWithoutSvg.match(/#[0-9a-fA-F]{6}\b/g) ?? []
        expect(hexOutsideSvg, `SVG 区块外仍存在 hex: ${[...new Set(hexOutsideSvg)].join(', ')}`).toEqual([])
    })

    /** Logo 息壤化（AC1 映射后保留）：实面 #5e6ad2 + 描边 #7170ff，旧蓝 #3b82f6 不得残留 */
    it('Logo 息壤化：SVG 使用 #5e6ad2 实面与 #7170ff 描边', () => {
        // 拆分后 Logo 标记位于 AppSidebar.vue（原 MainLayout.vue 的「左侧边栏」区块）。
        // 此处刻意断言到 AppSidebar.vue 这一单文件，而不是三文件合集：本用例的意图是
        // 「品牌 Logo 用品牌色」，Logo 只有一个归属文件，精确定位才能在 Logo 被再次
        // 挪走时立刻报警，而不是被合集里别处的 svg 掩盖。
        const svgBlock = appSidebarSource.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? ''
        expect(svgBlock, '未找到 Logo SVG（AppSidebar.vue）').not.toBe('')
        expect(svgBlock).toContain('#5e6ad2')
        expect(svgBlock).toContain('#7170ff')
        expect(svgBlock).not.toContain('#3b82f6')
    })

    /**
     * 菜单激活态/悬浮态令牌化（AC2）：原 8 处 rgba(59,130,246) 全部改为基于
     * var(--accent-primary) 的 color-mix 派生（与 cert 视图既有写法一致），
     * 滚动条保持 var(--scrollbar-thumb)，主题按钮内联色改用 var(--text-regular)。
     *
     * 门槛由 8 下调为 7：原 8 处中有 1 处位于 .submenu-level3 的 &.active 规则内，
     * 而该规则属于模板从未渲染的三级菜单样式，已随整块死 CSS 一并删除。
     * 余下 7 处均为可达的激活/悬浮/入口态，下调后对它们的回归保护强度不变。
     */
    it('激活态/悬浮态/入口徽标使用 var(--*) 令牌，无 #333333 内联硬编码', () => {
        const colorMixHits =
            layoutSources.match(/color-mix\(in srgb, var\(--accent-primary\) \d+%, transparent\)/g) ?? []
        expect(colorMixHits.length, 'color-mix 令牌化数量不足（应为 7 处可达的激活/悬浮/入口态）').toBeGreaterThanOrEqual(7)

        expect(layoutSources).toContain('var(--scrollbar-thumb)')
        expect(layoutSources).not.toContain('#333333')
        // 主题按钮/全屏/通知按钮内联色：浅色分支由 #333333 映射为等价令牌 --text-regular
        expect(layoutSources).toContain("'var(--text-regular)'")
    })
});

describe('MainLayout × CommandPalette 集成', () => {
    it('Ctrl+K（Win）唤起 palette，且旧 .search-box 不再渲染', async () => {
        const { wrapper } = await mountLayout()
        expect(wrapper.find('.search-box').exists()).toBe(false)
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(false)

        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)
    })

    it('Meta+K（macOS）同样唤起', async () => {
        const { wrapper } = await mountLayout()
        dispatchGlobalKey('k', { metaKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)
    })

    it('⌘K 开/关为单监听 toggle（再按一次关闭，Esc 亦可关闭），无旧监听残留冲突', async () => {
        const { wrapper } = await mountLayout()
        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)

        // 若存在第二个 ⌘K 监听干扰 toggle，开/关奇偶性即被破坏——以下断言即"无冲突"证据
        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(false)

        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        await wrapper.find('input.command-palette__input').trigger('keydown', { key: 'Escape' })
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(false)
    })

    it('旧 header 简易搜索源码无残留（AC2 grep 断言）', () => {
        const hits = layoutSources.match(new RegExp(LEGACY_SEARCH_PATTERN.source, 'g')) ?? []
        expect(hits, `布局源码（外壳+侧边栏+顶部导航栏）仍残留旧搜索标识: ${[...new Set(hits)].join(', ')}`).toEqual([])
    })

    it('palette 资产搜索跳转对应产品页并预填搜索（AC3 回归路径）', async () => {
        vi.useFakeTimers()
        vi.mocked(searchAssetsApi).mockResolvedValue({
            data: { items: [makeSearchItem()], total: 1, keyword: 'web' }
        } as never)
        const { wrapper, router } = await mountLayout()
        await wrapper.vm.$nextTick()

        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()

        await wrapper.find('input.command-palette__input').setValue('web')
        vi.advanceTimersByTime(300)
        await flushPromises()
        await wrapper.vm.$nextTick()

        // 资产组为最后一组：下移至资产条目后 Enter（query 命中时通常已是首项，循环为防御）
        const input = wrapper.find('input.command-palette__input')
        let guard = 0
        while (!wrapper.find('.command-palette__item.is-active').text().includes('web-1') && guard < 30) {
            await input.trigger('keydown', { key: 'ArrowDown' })
            await wrapper.vm.$nextTick()
            guard++
        }
        await input.trigger('keydown', { key: 'Enter' })
        await flushPromises()
        // ecs → /compute/ecs，带 ?search=asset_id 预填（搜索数据源是 ecam_instance，不得跳 /assets/:id 那个跨集合 404）
        expect(router.currentRoute.value.path).toBe('/compute/ecs')
        expect(router.currentRoute.value.query.search).toBe('i-abc123')
    })
})


/** 视口宽度控制（happy-dom 默认 1024） */
function setViewportWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

describe('MainLayout 响应式折叠（cam-iteration-20261027-responsive-shell）', () => {
    afterEach(() => setViewportWidth(1024))

    it('窄屏挂载即折叠，回宽屏自动展开，再进窄屏再次折叠', async () => {
        setViewportWidth(600)
        const { wrapper } = await mountLayout()
        expect(wrapper.findComponent(AppSidebar).props('isCollapsed')).toBe(true)
        setViewportWidth(1440)
        window.dispatchEvent(new Event('resize'))
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(AppSidebar).props('isCollapsed')).toBe(false)
        setViewportWidth(390)
        window.dispatchEvent(new Event('resize'))
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(AppSidebar).props('isCollapsed')).toBe(true)
    })

    it('断点内手动展开不被 resize 覆盖，跨断点才应用默认态', async () => {
        setViewportWidth(600)
        const { wrapper } = await mountLayout()
        await wrapper.find('.toggle-btn').trigger('click')
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(AppSidebar).props('isCollapsed')).toBe(false)
        setViewportWidth(640)
        window.dispatchEvent(new Event('resize'))
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(AppSidebar).props('isCollapsed')).toBe(false)
        setViewportWidth(1440)
        window.dispatchEvent(new Event('resize'))
        await wrapper.vm.$nextTick()
        expect(wrapper.findComponent(AppSidebar).props('isCollapsed')).toBe(false)
    })

    it('卸载后移除 resize 监听', async () => {
        setViewportWidth(600)
        const removeSpy = vi.spyOn(window, 'removeEventListener')
        const { wrapper } = await mountLayout()
        const idx = wrappers.indexOf(wrapper)
        if (idx >= 0) wrappers.splice(idx, 1)
        wrapper.unmount()
        expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
        removeSpy.mockRestore()
    })
})
