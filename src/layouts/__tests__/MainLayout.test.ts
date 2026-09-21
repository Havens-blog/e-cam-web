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
// 源码原文（AC2 grep 断言用；vite/client 提供的 ?raw 模块声明）
import mainLayoutSource from '../MainLayout.vue?raw'

vi.mock('@/api/asset', () => ({
    searchAssetsApi: vi.fn()
}))

/** 测试用最小路由表：dashboard（默认落点）+ assets/:id（资产详情回归路径） */
function createTestRouter(): Router {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' }, children: [
                { path: 'dashboard', component: { template: '<div />' } },
                { path: 'assets/:id', component: { template: '<div />' } }
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
        const hits = mainLayoutSource.match(new RegExp(LEGACY_SEARCH_PATTERN.source, 'g')) ?? []
        expect(hits, `MainLayout.vue 仍残留旧搜索标识: ${[...new Set(hits)].join(', ')}`).toEqual([])
    })

    it('palette 资产搜索直达 /assets/:id 详情（AC3 回归路径）', async () => {
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
        expect(router.currentRoute.value.path).toBe('/assets/42')
    })
})
