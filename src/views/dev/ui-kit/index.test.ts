// @vitest-environment happy-dom
/**
 * /dev/ui-kit 组件 demo 页单测（ui-unify-phase2-components 任务 8）：
 * 路由注册（hideInMenu）、六组件区块齐全（StateBlock 四态 / FilterBar 折叠 /
 * DataTable 三态+批量 / PageContainer 完整骨架 / DetailDrawer 分区块 /
 * CommandPalette 唤起）、源码片段展示与一键复制、深浅主题切换，以及
 * 「demo 页自身零硬编码颜色字面量」Hard Rule 守卫。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import routes from '@/router/routes'
import { useAppStore } from '@/stores/app'
import UiKitPage from './index.vue'
import { UI_KIT_SECTIONS } from './snippets'

vi.mock('@/api/asset', () => ({
    searchAssetsApi: vi.fn(),
}))

// ==================== happy-dom 环境桩 ====================

/** el-table 的 key-render-helper 依赖 MutationObserver（happy-dom 跨 realm 崩溃） */
class NoopMutationObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
        return []
    }
}

/** FilterBar/el-select 的宽度观测（happy-dom 无实现） */
class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

/** el-drawer 替身：规避 overlay/teleport/focus-trap 在 happy-dom 的兼容问题 */
const ElDrawerStub = defineComponent({
    name: 'ElDrawer',
    inheritAttrs: false,
    props: {
        modelValue: { type: Boolean, default: false },
        title: { type: String, default: '' },
    },
    setup(props, { attrs, slots }) {
        return () => {
            if (!props.modelValue) return null
            const restAttrs: Record<string, unknown> = { ...attrs }
            delete restAttrs.class
            return h('div', { class: 'drawer-stub', ...restAttrs }, [
                h('div', { class: 'drawer-stub__header' }, [slots.header?.()]),
                h('div', { class: 'drawer-stub__body' }, [slots.default?.()]),
                slots.footer ? h('div', { class: 'drawer-stub__footer' }, [slots.footer?.()]) : null,
            ])
        }
    },
})

/** 本文件所有挂载实例（afterEach 统一卸载） */
const wrappers: VueWrapper[] = []

async function mountPage(): Promise<VueWrapper> {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    const wrapper = mount(UiKitPage, {
        attachTo: document.body,
        global: {
            plugins: [pinia, router, ElementPlus],
            stubs: { teleport: true, ElDrawer: ElDrawerStub },
        },
    })
    wrappers.push(wrapper)
    // el-table 列注册是异步的：flush 后再断言
    await flushPromises()
    await nextTick()
    return wrapper
}

// ==================== 剪贴板桩 ====================

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>()
beforeEach(() => {
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    clipboardWriteText.mockReset()
    clipboardWriteText.mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
        value: { writeText: clipboardWriteText },
        configurable: true,
    })
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.documentElement.classList.remove('dark', 'light')
    localStorage.clear()
    vi.unstubAllGlobals()
})

// ==================== 测试 ====================

describe('/dev/ui-kit 路由注册（AC1）', () => {
    it('/dev/ui-kit 已注册且 hideInMenu: true，懒加载组件', () => {
        const child = routes[0]?.children?.find((route) => route.path === '/dev/ui-kit')
        expect(child).toBeTruthy()
        expect(child!.meta?.hideInMenu).toBe(true)
        expect(child!.meta?.title).toBeTruthy()
        expect(typeof child!.component).toBe('function')
    })
})

describe('六组件区块（AC2）', () => {
    it('锚点导航与六个 demo 区块一一对应', async () => {
        const wrapper = await mountPage()
        const anchors = wrapper.findAll('a.ui-kit-anchor')
        expect(anchors).toHaveLength(UI_KIT_SECTIONS.length)
        UI_KIT_SECTIONS.forEach((section, index) => {
            expect(anchors[index]!.attributes('href')).toBe(`#${section.id}`)
        })
        const sections = wrapper.findAll('.ui-kit-section')
        expect(sections).toHaveLength(UI_KIT_SECTIONS.length)
        UI_KIT_SECTIONS.forEach((section, index) => {
            expect(sections[index]!.attributes('id')).toBe(section.id)
        })
    })

    it('StateBlock：loading/empty/error/success 四态同屏', async () => {
        const wrapper = await mountPage()
        const section = wrapper.find('#state-block')
        expect(section.find('.el-skeleton').exists()).toBe(true)
        expect(section.find('.el-empty').exists()).toBe(true)
        expect(section.find('[role="alert"]').exists()).toBe(true)
        expect(section.text()).toContain('success')
    })

    it('StateBlock：error 态重试按钮回调可触发', async () => {
        const wrapper = await mountPage()
        const section = wrapper.find('#state-block')
        const retry = section.find('.state-block__retry')
        expect(retry.exists()).toBe(true)
        await retry.trigger('click')
        await retry.trigger('click')
        expect(section.text()).toContain('已重试 2 次')
    })

    it('FilterBar：多字段渲染且窄容器下折叠（展开/收起）', async () => {
        // 折叠测算桩：容器 720px，字段条目各 280px（6 字段必然一行放不下）
        const proto = HTMLElement.prototype as unknown as {
            getBoundingClientRect: () => DOMRect
        }
        const original = proto.getBoundingClientRect
        const rect = (width: number): DOMRect =>
            ({ width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: width, y: 0, toJSON: () => ({}) }) as DOMRect
        proto.getBoundingClientRect = function (this: HTMLElement) {
            if (this.classList.contains('filter-bar')) return rect(720)
            if (this.classList.contains('filter-bar__item--actions')) return rect(160)
            if (this.classList.contains('filter-bar__item')) return rect(280)
            return original.call(this)
        }
        try {
            const wrapper = await mountPage()
            const section = wrapper.find('#filter-bar')
            const items = section.findAll('.filter-bar__item:not(.filter-bar__item--actions)')
            expect(items.length).toBeGreaterThanOrEqual(6)
            const toggle = section.find('.filter-bar__toggle')
            expect(toggle.exists()).toBe(true)
            expect(toggle.text()).toContain('展开')
            await toggle.trigger('click')
            expect(section.find('.filter-bar__toggle').text()).toContain('收起')
        } finally {
            proto.getBoundingClientRect = original
        }
    })

    it('FilterBar：字段 change 事件与 v-model 回写', async () => {
        const wrapper = await mountPage()
        const section = wrapper.find('#filter-bar')
        const firstInput = section.find('.filter-bar .el-input__inner')
        await firstInput.setValue('web-prod-01')
        await nextTick()
        expect(section.text()).toContain('资产名称 → web-prod-01')
        expect(section.text()).toContain('"name":"web-prod-01"')
    })

    it('DataTable：loading/empty/error 三态同屏，error 重试后恢复', async () => {
        const wrapper = await mountPage()
        expect(wrapper.find('.ui-kit-table-loading .el-skeleton').exists()).toBe(true)
        expect(wrapper.find('.ui-kit-table-empty .el-empty').exists()).toBe(true)
        const errorCell = wrapper.find('.ui-kit-table-error')
        expect(errorCell.find('[role="alert"]').exists()).toBe(true)
        expect(errorCell.text()).toContain('503')

        // 模拟接口恢复 → 点重试 → 行数据渲染
        const recover = wrapper.findAll('button').find((b) => b.text().includes('模拟接口恢复'))
        expect(recover).toBeTruthy()
        await recover!.trigger('click')
        const retry = errorCell.find('.state-block__retry')
        await retry.trigger('click')
        await flushPromises()
        await nextTick()
        expect(errorCell.findAll('.el-table__row').length).toBe(3)
    })

    it('DataTable：勾选行出现批量操作条，批量动作透出', async () => {
        const wrapper = await mountPage()
        const main = wrapper.find('.ui-kit-table-main')
        expect(main.find('.data-table__batch-bar').exists()).toBe(false)
        const checkbox = main.find('.el-table__body .el-checkbox input')
        await checkbox.setValue(true)
        await nextTick()
        expect(main.find('.data-table__batch-bar').exists()).toBe(true)
        expect(main.text()).toContain('已选 1 项')
        const sync = main.findAll('button').find((b) => b.text().includes('批量同步'))
        await sync!.trigger('click')
        expect(wrapper.find('.ui-kit-batch-status').text()).toContain('sync × 1')
    })

    it('PageContainer：完整骨架（header/filters/body/footer）渲染', async () => {
        const wrapper = await mountPage()
        const shell = wrapper.find('.ui-kit-page-shell')
        expect(shell.find('.page-container__header').exists()).toBe(true)
        expect(shell.text()).toContain('主机列表（示例页）')
        expect(shell.find('.page-container__filters').exists()).toBe(true)
        expect(shell.find('.page-container__body').exists()).toBe(true)
        expect(shell.find('.page-container__footer .el-pagination').exists()).toBe(true)
    })

    it('DetailDrawer：打开后分区块渲染 label-value 网格', async () => {
        const wrapper = await mountPage()
        expect(wrapper.find('.drawer-stub').exists()).toBe(false)
        const open = wrapper.findAll('button').find((b) => b.text().includes('打开详情抽屉'))
        await open!.trigger('click')
        await nextTick()
        const drawer = wrapper.find('.drawer-stub')
        expect(drawer.exists()).toBe(true)
        expect(drawer.text()).toContain('基础信息')
        expect(drawer.text()).toContain('web-prod-01')
        expect(drawer.text()).toContain('运行状态')
        expect(drawer.text()).toContain('38%')
    })

    it('CommandPalette：页面唤起入口可打开面板', async () => {
        const wrapper = await mountPage()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(false)
        const open = wrapper.findAll('button').find((b) => b.text().includes('打开命令面板'))
        await open!.trigger('click')
        await nextTick()
        expect(wrapper.find('.command-palette__overlay').exists()).toBe(true)
    })
})

describe('源码片段与一键复制（AC3）', () => {
    it('每个区块展示源码片段（与 snippets 常量逐字一致）', async () => {
        const wrapper = await mountPage()
        UI_KIT_SECTIONS.forEach((section) => {
            const pre = wrapper.find(`#${section.id} .ui-kit-code`)
            expect(pre.exists()).toBe(true)
            expect(pre.text()).toBe(section.code)
        })
    })

    it('复制按钮写入剪贴板对应片段', async () => {
        const wrapper = await mountPage()
        for (const section of UI_KIT_SECTIONS) {
            const copy = wrapper.find(`#${section.id} .ui-kit-copy`)
            expect(copy.exists()).toBe(true)
            await copy.trigger('click')
            await flushPromises()
            expect(clipboardWriteText).toHaveBeenCalledWith(section.code)
        }
        expect(clipboardWriteText).toHaveBeenCalledTimes(UI_KIT_SECTIONS.length)
    })
})

describe('深/浅主题切换预览（AC4）', () => {
    it('切换按钮驱动全局主题（documentElement class + store）', async () => {
        const wrapper = await mountPage()
        const appStore = useAppStore()
        const buttons = wrapper.findAll('.ui-kit-theme-toggle button')
        expect(buttons.length).toBe(2)
        const light = buttons.find((b) => b.text().includes('浅色'))!
        const dark = buttons.find((b) => b.text().includes('深色'))!
        await light.trigger('click')
        expect(appStore.theme).toBe('light')
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(document.documentElement.classList.contains('dark')).toBe(false)
        await dark.trigger('click')
        expect(appStore.theme).toBe('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
})

describe('Hard Rule：demo 页自身零硬编码颜色字面量', () => {
    it('新文件不含 hex/rgb/hsl 颜色字面量', async () => {
        const pageRaw = (await import('./index.vue?raw')).default
        const demoSectionRaw = (await import('./DemoSection.vue?raw')).default
        const snippetsRaw = (await import('./snippets.ts?raw')).default
        const colorLiteral = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/
        for (const raw of [pageRaw, demoSectionRaw, snippetsRaw]) {
            expect(raw).not.toMatch(colorLiteral)
        }
    })
})
