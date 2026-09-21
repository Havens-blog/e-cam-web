// @vitest-environment happy-dom
/**
 * CommandPalette 组件单测（ui-unify-phase2-components 任务 6）：
 * 覆盖 ⌘K/Ctrl+K 唤起与 Esc 关闭、焦点管理（开时捕获输入框、关时归还）、
 * 路由页面条目渲染与关键词过滤、内置「切换主题」动作与 registerActions 注册 API、
 * searchAssetsApi 复用契约（300ms 防抖、{keyword, limit:10} 参数、结果���达资产详情）、
 * 最近访问记录，以及空态与遮罩关闭。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { searchAssetsApi } from '@/api/asset'
import { useAppStore } from '@/stores/app'
import { useRecentVisitsStore } from '@/stores/recentVisits'
import CommandPalette from '../CommandPalette/index.vue'

/** searchAssetsApi 调用契约先于面板实现锁定（提案 Key Risks 缓解项） */
vi.mock('@/api/asset', () => ({
    searchAssetsApi: vi.fn()
}))

/** 测试用最小路由表：与真实 router 配置同构（组件数据源即来自 @/router/routes） */
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

/** 本文件所有挂载实例（afterEach 统一卸载，清理 attachTo 挂点与全局监听） */
const wrappers: ReturnType<typeof mount>[] = []

/** 挂载辅助：独立 pinia（含持久化插件）+ memory 路由；附着到 document 使焦点断言可用 */
async function mountPalette(props: Record<string, unknown> = {}) {
    const router = createTestRouter()
    await router.push('/')
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    const wrapper = mount(CommandPalette, {
        props,
        attachTo: document.body,
        global: {
            plugins: [pinia, router],
            // Teleport 渲染到 body 之外，stub 后随 wrapper 内联渲染便于断言
            stubs: { teleport: true }
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

describe('CommandPalette 唤起与关闭', () => {
    it('Ctrl+K 打开、Esc 关闭（内部状态模式，无需外部 v-model）', async () => {
        const { wrapper } = await mountPalette()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(false)

        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)

        await wrapper.find('input.command-palette__input').trigger('keydown', { key: 'Escape' })
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(false)
    })

    it('Meta+K（macOS）同样唤起', async () => {
        const { wrapper } = await mountPalette()
        dispatchGlobalKey('k', { metaKey: true })
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)
    })

    it('v-model:visible 受控：⌘K 不直接改内部状态而是 emit update:visible', async () => {
        const { wrapper } = await mountPalette({ visible: false })
        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        expect(wrapper.emitted('update:visible')).toEqual([[true]])
    })

    it('遮罩点击关闭（点击结果项不关闭以外的冒泡场景由 self 修饰符保证）', async () => {
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)
        await wrapper.find('.command-palette__overlay').trigger('mousedown')
        expect(wrapper.emitted('update:visible')).toEqual([[false]])
    })
})

describe('CommandPalette 焦点管理', () => {
    it('打开时焦点捕获到输入框，关闭后归还先前焦点元素', async () => {
        const { wrapper } = await mountPalette()
        const outside = document.createElement('button')
        document.body.appendChild(outside)
        outside.focus()
        expect(document.activeElement).toBe(outside)

        dispatchGlobalKey('k', { ctrlKey: true })
        await wrapper.vm.$nextTick()
        await wrapper.vm.$nextTick()
        expect(document.activeElement).toBe(wrapper.find('input.command-palette__input').element)

        await wrapper.find('input.command-palette__input').trigger('keydown', { key: 'Escape' })
        await wrapper.vm.$nextTick()
        expect(document.activeElement).toBe(outside)
        outside.remove()
    })
})

describe('CommandPalette 页面与动作条目', () => {
    it('渲染路由配置派生的页面条目与内置「切换主题」动作', async () => {
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        const text = wrapper.find('.command-palette__results').text()
        // 数据源来自 @/router/routes（/dashboard 的 meta.title）
        expect(text).toContain('多云概览')
        expect(text).toContain('切换主题')
        expect(wrapper.find('.command-palette__group-label').text()).toBe('页面')
    })

    it('输入关键词过滤页面条目（命中 /dashboard 的标题）', async () => {
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        vi.useFakeTimers()
        await wrapper.find('input.command-palette__input').setValue('多云')
        await wrapper.vm.$nextTick()
        const titles = wrapper.findAll('.command-palette__item').map((w) => w.text())
        expect(titles.some((t) => t.includes('多云概览'))).toBe(true)
        expect(titles.some((t) => t.includes('资源拓扑'))).toBe(false)
    })

    it('Enter 执行高亮项：路由跳转并记录最近访问', async () => {
        const { wrapper, router } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        await wrapper.find('input.command-palette__input').trigger('keydown', { key: 'Enter' })
        await flushPromises()
        expect(router.currentRoute.value.path).toBe('/dashboard')

        const recent = useRecentVisitsStore()
        expect(recent.entries.some((e) => e.path === '/dashboard' && e.count === 1)).toBe(true)
    })

    it('点击「切换主题」执行内置动作（appStore.toggleTheme）', async () => {
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        const appStore = useAppStore()
        const spy = vi.spyOn(appStore, 'toggleTheme')
        const themeItem = wrapper.findAll('.command-palette__item').find((w) => w.text().includes('切换主题'))
        expect(themeItem).toBeTruthy()
        await themeItem!.trigger('click')
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('registerActions 注册自定义动作并出现在动作组中', async () => {
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        const run = vi.fn()
        const unregister = (wrapper.vm as unknown as { registerActions: (a: unknown) => () => void })
            .registerActions([{ id: 'custom', title: '自定义动作', run }])
        await wrapper.vm.$nextTick()
        const item = wrapper.findAll('.command-palette__item').find((w) => w.text().includes('自定义动作'))
        expect(item).toBeTruthy()
        await item!.trigger('click')
        expect(run).toHaveBeenCalledTimes(1)

        unregister()
        await wrapper.vm.$nextTick()
        expect(wrapper.text()).not.toContain('自定义动作')
    })

    it('无匹配时展示空态提示', async () => {
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        vi.useFakeTimers()
        await wrapper.find('input.command-palette__input').setValue('zzz不存在的词')
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.command-palette__empty').exists()).toBe(true)
    })
})

describe('CommandPalette 资产快捷搜索（searchAssetsApi 契约）', () => {
    it('输入防抖 300ms 后以 {keyword, limit:10} 调用 searchAssetsApi，结果渲染于资产组', async () => {
        vi.useFakeTimers()
        vi.mocked(searchAssetsApi).mockResolvedValue({
            data: { items: [makeSearchItem()], total: 1, keyword: 'web' }
        } as never)
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        await wrapper.find('input.command-palette__input').setValue('web')

        vi.advanceTimersByTime(299)
        expect(searchAssetsApi).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(searchAssetsApi).toHaveBeenCalledWith({ keyword: 'web', limit: 10 })

        await vi.waitFor(() => {})
        await flushPromises()
        const text = wrapper.find('.command-palette__results').text()
        expect(text).toContain('web-1')
        expect(text).toContain('i-abc123')
        wrapper.unmount()
    })

    it('防抖窗口内连续输入只触发一次请求（取最后一次关键词）', async () => {
        vi.useFakeTimers()
        vi.mocked(searchAssetsApi).mockResolvedValue({
            data: { items: [], total: 0, keyword: 'ab' }
        } as never)
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        const input = wrapper.find('input.command-palette__input')
        await input.setValue('a')
        vi.advanceTimersByTime(100)
        await input.setValue('ab')
        vi.advanceTimersByTime(300)
        expect(searchAssetsApi).toHaveBeenCalledTimes(1)
        expect(searchAssetsApi).toHaveBeenCalledWith({ keyword: 'ab', limit: 10 })
        wrapper.unmount()
    })

    it('资产结果 Enter 直达资产详情 /assets/:id 并记录最近访问', async () => {
        vi.useFakeTimers()
        vi.mocked(searchAssetsApi).mockResolvedValue({
            data: { items: [makeSearchItem()], total: 1, keyword: 'web' }
        } as never)
        const { wrapper, router } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        await wrapper.find('input.command-palette__input').setValue('web')
        vi.advanceTimersByTime(300)
        await flushPromises()
        await wrapper.vm.$nextTick()

        // 资产组是最后一个组：下移到资产项后 Enter
        const input = wrapper.find('input.command-palette__input')
        let guard = 0
        while (!wrapper.find('.command-palette__item.is-active').text().includes('web-1') && guard < 20) {
            await input.trigger('keydown', { key: 'ArrowDown' })
            await wrapper.vm.$nextTick()
            guard++
        }
        await input.trigger('keydown', { key: 'Enter' })
        await flushPromises()
        expect(router.currentRoute.value.path).toBe('/assets/42')

        const recent = useRecentVisitsStore()
        expect(recent.entries.some((e) => e.path === '/assets/42')).toBe(true)
        wrapper.unmount()
    })

    it('清空输入后不再展示资产结果，且不发请求', async () => {
        vi.useFakeTimers()
        vi.mocked(searchAssetsApi).mockResolvedValue({
            data: { items: [makeSearchItem()], total: 1, keyword: 'web' }
        } as never)
        const { wrapper } = await mountPalette({ visible: true })
        await wrapper.vm.$nextTick()
        const input = wrapper.find('input.command-palette__input')
        await input.setValue('web')
        vi.advanceTimersByTime(300)
        await flushPromises()
        expect(wrapper.text()).toContain('web-1')

        await input.setValue('')
        vi.advanceTimersByTime(300)
        await flushPromises()
        expect(wrapper.text()).not.toContain('web-1')
        expect(searchAssetsApi).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })
})
