// @vitest-environment happy-dom
/**
 * PageContainer 2.0 页面骨架单测（ui-unify-phase2-components 任务 4）：
 * 覆盖标准骨架区块渲染（header 的 title prop 快捷方式 + actions 操作区 / filters
 * 筛选区 / body 内容区 / footer 底部分页位）、#header 整体覆盖插槽、
 * 以及 v1 向后兼容（仅默认插槽时默认 slot 直出、DOM 与 v1 空壳完全一致、
 * attrs 透传保���、title 属性透传语义转为组件 prop 的兼容性增强）。
 */
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import PageContainer from '../PageContainer/index.vue'

interface MountOptions {
    props?: Record<string, unknown>
    /** 追加透传插槽（default 按用例显式传入） */
    slots?: Record<string, string>
    /** 模拟模板上的原生属性透传（如 title="..."） */
    attrs?: Record<string, string>
}

/** 挂载辅助：统一收敛 props/slots/attrs 透传 */
async function mountContainer(options: MountOptions = {}) {
    const { props = {}, slots = {}, attrs = {} } = options
    const wrapper = mount(PageContainer, { props, slots, attrs })
    await nextTick()
    return wrapper
}

describe('PageContainer 2.0 骨架渲染', () => {
    it('title prop 快捷方式：渲染页头 h2 标题并进入骨架模式', async () => {
        const wrapper = await mountContainer({ props: { title: '资产管理' } })
        const header = wrapper.find('header.page-container__header')
        expect(header.exists()).toBe(true)
        expect(wrapper.find('h2.page-container__title').text()).toBe('资产管理')
        // 进入骨架模式后默认插槽内容由 body 内容区承载
        expect(wrapper.find('.page-container__body').exists()).toBe(true)
    })

    it('actions 插槽：渲染于页头操作区，与 title 快捷方式共存', async () => {
        const wrapper = await mountContainer({
            props: { title: '资产管理' },
            slots: { actions: '<button class="header-act">新增</button>' },
        })
        expect(wrapper.find('.page-container__actions .header-act').exists()).toBe(true)
        expect(wrapper.find('h2.page-container__title').exists()).toBe(true)
    })

    it('仅 actions 插槽（无 title）：页头仍渲染且不输出空标题', async () => {
        const wrapper = await mountContainer({
            slots: { actions: '<button class="header-act">刷新</button>' },
        })
        expect(wrapper.find('header.page-container__header').exists()).toBe(true)
        expect(wrapper.find('.page-container__actions .header-act').exists()).toBe(true)
        expect(wrapper.find('h2.page-container__title').exists()).toBe(false)
    })

    it('filters 插槽：渲染筛选区并承载插槽内容', async () => {
        const wrapper = await mountContainer({
            slots: { filters: '<div class="filter-bar">筛选条件</div>' },
        })
        expect(wrapper.find('.page-container__filters').exists()).toBe(true)
        expect(wrapper.find('.page-container__filters .filter-bar').exists()).toBe(true)
    })

    it('footer 插槽：渲染底部分页区（footer 语义标签）', async () => {
        const wrapper = await mountContainer({
            slots: { footer: '<div class="pagination">分页</div>' },
        })
        const footer = wrapper.find('footer.page-container__footer')
        expect(footer.exists()).toBe(true)
        expect(footer.find('.pagination').exists()).toBe(true)
    })

    it('完整骨架：header → filters → body（默认插槽）→ footer 按序渲染', async () => {
        const wrapper = await mountContainer({
            props: { title: '任务列表' },
            slots: {
                filters: '<div class="filter-bar">筛选</div>',
                default: '<p class="page-content">表格内容</p>',
                footer: '<div class="pagination">分页</div>',
            },
        })
        const children = Array.from(wrapper.element.children) as HTMLElement[]
        expect(children.map((c) => c.className)).toEqual([
            'page-container__header',
            'page-container__filters',
            'page-container__body',
            'page-container__footer',
        ])
        expect(wrapper.find('.page-container__body .page-content').exists()).toBe(true)
    })

    it('header 覆盖插槽：整体替换默认的 title + actions 结构', async () => {
        const wrapper = await mountContainer({
            props: { title: '不应渲染的标题' },
            slots: {
                header: '<div class="custom-header">自定义页头</div>',
                actions: '<button class="header-act">不应渲染</button>',
            },
        })
        expect(wrapper.find('.page-container__header .custom-header').exists()).toBe(true)
        expect(wrapper.find('h2.page-container__title').exists()).toBe(false)
        expect(wrapper.find('.page-container__actions').exists()).toBe(false)
    })
})

describe('PageContainer v1 向后兼容', () => {
    it('仅默认插槽：默认 slot 直出，不渲染任何骨架区块', async () => {
        const wrapper = await mountContainer({
            slots: { default: '<div class="legacy-content">旧页面内容</div>' },
        })
        expect(wrapper.find('header.page-container__header').exists()).toBe(false)
        expect(wrapper.find('.page-container__filters').exists()).toBe(false)
        expect(wrapper.find('.page-container__body').exists()).toBe(false)
        expect(wrapper.find('footer.page-container__footer').exists()).toBe(false)
        // 直出：内容是容器根的直接子节点，未被包裹
        expect(wrapper.find('.page-container > .legacy-content').exists()).toBe(true)
    })

    it('仅默认插槽：元素结构与 v1 空壳完全一致（29 个存量使用方零改动）', async () => {
        const wrapper = await mountContainer({
            slots: { default: '<div class="legacy-content">旧页面内容</div>' },
        })
        // v-if 占位注释节点与空白文本为 Vue 渲染产物（不可见、不参与布局，
        // 不影响 CSS 元素选择器匹配）；元素级 DOM 结构与 v1 完全一致
        const root = wrapper.element as HTMLElement
        expect(root.className).toBe('page-container')
        const elementChildren = Array.from(root.children) as HTMLElement[]
        expect(elementChildren).toHaveLength(1)
        expect(elementChildren[0]?.outerHTML).toBe('<div class="legacy-content">旧页面内容</div>')
        expect(elementChildren[0]?.parentElement).toBe(root)
    })

    it('仅默认插槽：多个子节点均直出为容器根的直接子节点', async () => {
        const wrapper = await mountContainer({
            slots: {
                default:
                    '<div class="legacy-a">A</div><div class="legacy-b">B</div>',
            },
        })
        expect(wrapper.find('.page-container > .legacy-a').exists()).toBe(true)
        expect(wrapper.find('.page-container > .legacy-b').exists()).toBe(true)
    })

    it('attrs 透传：class/data-* 等原生属性仍落在容器根（v1 行为）', async () => {
        const wrapper = await mountContainer({
            attrs: { class: 'extra-class', 'data-page': 'assets' },
            slots: { default: '<div class="legacy-content">内容</div>' },
        })
        const root = wrapper.find('.page-container')
        expect(root.classes()).toContain('extra-class')
        expect(root.attributes('data-page')).toBe('assets')
    })

    it('title 作为原生属性传入时转为组件 prop 渲染页头（兼容性增强而非破坏）', async () => {
        const wrapper = await mountContainer({
            attrs: { title: '属性标题' },
            slots: { default: '<div class="legacy-content">内容</div>' },
        })
        expect(wrapper.find('h2.page-container__title').text()).toBe('属性标题')
    })
})

describe('PageContainer 骨架模式动态切换', () => {
    it('title 动态增删：v1 模式与骨架模式可互切', async () => {
        const wrapper = await mountContainer({ props: { title: '初始标题' } })
        expect(wrapper.find('header.page-container__header').exists()).toBe(true)

        await wrapper.setProps({ title: '' })
        expect(wrapper.find('header.page-container__header').exists()).toBe(false)
        expect(wrapper.find('.page-container__body').exists()).toBe(false)

        await wrapper.setProps({ title: '新标题' })
        expect(wrapper.find('h2.page-container__title').text()).toBe('新标题')
    })

    it('骨架模式下默认插槽内容渲染于 body 内容区内', async () => {
        const wrapper = await mountContainer({
            props: { title: '标题' },
            slots: { default: '<p class="page-content">内容</p>' },
        })
        expect(wrapper.find('.page-container__body .page-content').exists()).toBe(true)
        expect(wrapper.find('.page-container > .page-content').exists()).toBe(false)
    })
})
