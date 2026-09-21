// @vitest-environment happy-dom
/**
 * DetailDrawer 2.0 统一详情抽屉单测（ui-unify-phase2-components 任务 5）：
 * 覆盖 v1 向后兼容契约（visible/title/size/direction/closeOnClickModal 透传、
 * header-actions / tab-* / footer 插槽、close 与 update:visible / update:activeTabName
 * 事件、返回按钮与默认关闭按钮）与 2.0 新增能力（items 描述列表 label-value 网格、
 * formatter/span/columns、sections 分区块、基于 StateBlock 的内置骨架加载态）。
 */
import { mount } from '@vue/test-utils'
import { ElButton, ElIcon, ElSkeleton, ElTabPane, ElTabs } from 'element-plus'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import DetailDrawer from '../DetailDrawer/index.vue'
import type { DetailItem, DetailSection } from '../DetailDrawer/index.vue'

/**
 * el-drawer 替身：modelValue 为真时渲染 header/default/footer 插槽，
 * 规避 overlay/teleport/focus-trap 在 happy-dom 下的兼容问题；
 * size/direction/close-on-click-modal 等未声明 prop 以 attrs 形式落在根节点供断言。
 */
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
            // class 由替身自行管理，从透传 attrs 中剔除避免覆盖根类名
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

interface MountOptions {
    props?: Record<string, unknown>
    /** 追加透传插槽（default 按用例显式传入） */
    slots?: Record<string, string>
}

/** 挂载辅助：vitest 无 unplugin 自动注册，显式注册用到的 Element Plus 组件 */
async function mountDrawer(options: MountOptions = {}) {
    const { props = {}, slots = {} } = options
    const wrapper = mount(DetailDrawer, {
        props: { visible: true, title: '资产详情', ...props },
        slots: {
            default: '<div class="drawer-slot-content">默认内容</div>',
            ...slots,
        },
        global: {
            components: { ElDrawer: ElDrawerStub, ElTabs, ElTabPane, ElButton, ElIcon, ElSkeleton },
        },
    })
    await nextTick()
    return wrapper
}

describe('DetailDrawer v1 向后兼容契约', () => {
    it('visible/title：开启时渲染标题，关闭时不渲染抽屉', async () => {
        const open = await mountDrawer()
        expect(open.find('.drawer-stub').exists()).toBe(true)
        expect(open.find('.drawer-title').text()).toBe('资产详情')

        const closed = await mountDrawer({ props: { visible: false } })
        expect(closed.find('.drawer-stub').exists()).toBe(false)
    })

    it('size/direction/closeOnClickModal：默认值透传 el-drawer（v1 签名不变）', async () => {
        const wrapper = await mountDrawer()
        const stub = wrapper.find('.drawer-stub')
        expect(stub.attributes('size')).toBe('60%')
        expect(stub.attributes('direction')).toBe('rtl')
        expect(stub.attributes('close-on-click-modal')).toBe('false')

        const custom = await mountDrawer({ props: { size: '560px', direction: 'ttb', closeOnClickModal: true } })
        const customStub = custom.find('.drawer-stub')
        expect(customStub.attributes('size')).toBe('560px')
        expect(customStub.attributes('direction')).toBe('ttb')
        expect(customStub.attributes('close-on-click-modal')).toBe('true')
    })

    it('header-actions 插槽：渲染于头部操作区', async () => {
        const wrapper = await mountDrawer({
            slots: { 'header-actions': '<button class="header-act">编辑</button>' },
        })
        expect(wrapper.find('.header-actions .header-act').exists()).toBe(true)
    })

    it('返回按钮：默认显示，点击触发 close + update:visible(false)', async () => {
        const wrapper = await mountDrawer()
        const backBtn = wrapper.findAll('button').find((b) => b.text().includes('返回'))
        expect(backBtn).toBeTruthy()
        await backBtn!.trigger('click')
        expect(wrapper.emitted('close')).toHaveLength(1)
        expect(wrapper.emitted('update:visible')).toEqual([[false]])
    })

    it('showBackButton=false：不渲染返回按钮', async () => {
        const wrapper = await mountDrawer({ props: { showBackButton: false } })
        const backBtn = wrapper.findAll('button').find((b) => b.text().includes('返回'))
        expect(backBtn).toBeUndefined()
    })

    it('tabs 模式：tab-* 插槽内容渲染且默认插槽不渲染', async () => {
        const wrapper = await mountDrawer({
            props: { tabs: [{ name: 'basic', label: '基本信息' }, { name: 'config', label: '配置详情' }] },
            slots: {
                'tab-basic': '<div class="tab-basic-content">基本内容</div>',
                'tab-config': '<div class="tab-config-content">配置内容</div>',
            },
        })
        expect(wrapper.find('.el-tabs').exists()).toBe(true)
        expect(wrapper.find('.tab-basic-content').exists()).toBe(true)
        expect(wrapper.find('.tab-config-content').exists()).toBe(true)
        expect(wrapper.find('.drawer-slot-content').exists()).toBe(false)
    })

    it('tabs 模式：点击第二个标签触发 update:activeTabName', async () => {
        const wrapper = await mountDrawer({
            props: { tabs: [{ name: 'basic', label: '基本信息' }, { name: 'config', label: '配置详情' }] },
            slots: { 'tab-basic': '<div>基本</div>' },
        })
        const tabItems = wrapper.findAll('.el-tabs__item')
        expect(tabItems).toHaveLength(2)
        await tabItems[1]!.trigger('click')
        expect(wrapper.emitted('update:activeTabName')).toEqual([['config']])
    })

    it('footer：showFooter=false 不渲染底部队（v1 默认）', async () => {
        const wrapper = await mountDrawer()
        expect(wrapper.find('.drawer-footer').exists()).toBe(false)
    })

    it('footer：showFooter=true 默认渲染关闭按钮，点击触发 close + update:visible(false)', async () => {
        const wrapper = await mountDrawer({ props: { showFooter: true } })
        const closeBtn = wrapper.findAll('button').find((b) => b.text().includes('关闭'))
        expect(closeBtn).toBeTruthy()
        await closeBtn!.trigger('click')
        expect(wrapper.emitted('close')).toHaveLength(1)
        expect(wrapper.emitted('update:visible')).toEqual([[false]])
    })

    it('footer：#footer 插槽覆盖默认关闭按钮', async () => {
        const wrapper = await mountDrawer({
            props: { showFooter: true },
            slots: { footer: '<button class="custom-footer-btn">保存</button>' },
        })
        expect(wrapper.find('.drawer-footer .custom-footer-btn').exists()).toBe(true)
        const closeBtn = wrapper.findAll('button').find((b) => b.text().includes('关闭'))
        expect(closeBtn).toBeUndefined()
    })
})

describe('DetailDrawer 2.0 描述列表（items/sections）', () => {
    it('items：渲染 label-value 网格，0 渲染 "0"，null/undefined/空串渲染 "-"', async () => {
        const items: DetailItem[] = [
            { label: '资产名称', value: 'web-01' },
            { label: '核心数', value: 0 },
            { label: '备注', value: '' },
            { label: '标签', value: null },
            { label: '未定义' },
        ]
        const wrapper = await mountDrawer({ props: { items } })
        const grid = wrapper.find('.detail-grid')
        expect(grid.exists()).toBe(true)
        const gridItems = wrapper.findAll('.detail-item')
        expect(gridItems).toHaveLength(5)
        expect(gridItems[0]!.find('.detail-item__label').text()).toBe('资产名称')
        expect(gridItems[0]!.find('.detail-item__value').text()).toBe('web-01')
        expect(gridItems[1]!.find('.detail-item__value').text()).toBe('0')
        expect(gridItems[2]!.find('.detail-item__value').text()).toBe('-')
        expect(gridItems[3]!.find('.detail-item__value').text()).toBe('-')
        expect(gridItems[4]!.find('.detail-item__value').text()).toBe('-')
    })

    it('items：formatter 生效且同时接收 value 与 item 两个入参', async () => {
        const items: DetailItem[] = [
            {
                label: '创建时间',
                value: 1700000000000,
                formatter: (value, item) => `${item.label}:${value}`,
            },
        ]
        const wrapper = await mountDrawer({ props: { items } })
        expect(wrapper.find('.detail-item__value').text()).toBe('创建时间:1700000000000')
    })

    it('items：span 透传为跨列样式，默认项无跨列', async () => {
        const items: DetailItem[] = [
            { label: '资产ID', value: 'i-123', span: 2 },
            { label: '区域', value: 'cn-hangzhou' },
        ]
        const wrapper = await mountDrawer({ props: { items } })
        const gridItems = wrapper.findAll('.detail-item')
        expect(gridItems[0]!.attributes('style')).toContain('span 2')
        expect(gridItems[1]!.attributes('style')).toBeUndefined()
    })

    it('columns：修改栅格列数，非法值回退默认 2 列', async () => {
        const items: DetailItem[] = [{ label: '名称', value: 'n' }]
        const wrapper = await mountDrawer({ props: { items, columns: 3 } })
        const grid = wrapper.find('.detail-grid').element as HTMLElement
        expect(grid.style.getPropertyValue('--detail-columns')).toBe('3')

        const fallback = await mountDrawer({ props: { items, columns: 0 } })
        const fallbackGrid = fallback.find('.detail-grid').element as HTMLElement
        expect(fallbackGrid.style.getPropertyValue('--detail-columns')).toBe('2')
    })

    it('sections：分区块按序渲染标题与各自网格', async () => {
        const sections: DetailSection[] = [
            { title: '基本信息', items: [{ label: '名称', value: 'web-01' }] },
            { title: '网络信息', items: [{ label: 'VPC', value: 'vpc-1' }, { label: '交换机', value: 'vsw-1' }] },
        ]
        const wrapper = await mountDrawer({ props: { sections } })
        const sectionEls = wrapper.findAll('.detail-section')
        expect(sectionEls).toHaveLength(2)
        const titles = wrapper.findAll('.detail-section__title').map((t) => t.text())
        expect(titles).toEqual(['基本信息', '网络信息'])
        expect(wrapper.findAll('.detail-item')).toHaveLength(3)
        expect(wrapper.find('.detail-grid .detail-item__value').text()).toBe('web-01')
    })

    it('sections：无标题的 section 不渲染标题元素', async () => {
        const sections: DetailSection[] = [{ items: [{ label: '名称', value: 'web-01' }] }]
        const wrapper = await mountDrawer({ props: { sections } })
        expect(wrapper.findAll('.detail-section')).toHaveLength(1)
        expect(wrapper.find('.detail-section__title').exists()).toBe(false)
        expect(wrapper.find('.detail-item__value').text()).toBe('web-01')
    })

    it('sections 与 items 同时提供：sections 优先', async () => {
        const wrapper = await mountDrawer({
            props: {
                items: [{ label: '扁平项', value: 'flat' }],
                sections: [{ title: '分区', items: [{ label: '分区项', value: 'sectioned' }] }],
            },
        })
        expect(wrapper.find('.detail-item__value').text()).toBe('sectioned')
        expect(wrapper.text()).not.toContain('扁平项')
    })

    it('items 与默认插槽共存：网格在前、插槽内容在后', async () => {
        const wrapper = await mountDrawer({ props: { items: [{ label: '名称', value: 'web-01' }] } })
        expect(wrapper.find('.detail-descriptions .detail-item').exists()).toBe(true)
        expect(wrapper.find('.detail-descriptions .drawer-slot-content').exists()).toBe(false)
        expect(wrapper.find('.drawer-slot-content').exists()).toBe(true)
    })

    it('tabs 与 items 同时提供：tabs 优先（v1 分支先行），items 忽略', async () => {
        const wrapper = await mountDrawer({
            props: {
                tabs: [{ name: 'basic', label: '基本信息' }],
                items: [{ label: '名称', value: 'web-01' }],
            },
            slots: { 'tab-basic': '<div class="tab-basic-content">基本内容</div>' },
        })
        expect(wrapper.find('.el-tabs').exists()).toBe(true)
        expect(wrapper.find('.detail-descriptions').exists()).toBe(false)
        expect(wrapper.find('.tab-basic-content').exists()).toBe(true)
    })
})

describe('DetailDrawer 2.0 内置加载态（StateBlock）', () => {
    it('loading=true：渲染骨架屏且隐藏内容（含 tabs 模式）', async () => {
        const slotMode = await mountDrawer({ props: { loading: true } })
        expect(slotMode.find('.el-skeleton').exists()).toBe(true)
        expect(slotMode.find('.drawer-slot-content').exists()).toBe(false)

        const tabsMode = await mountDrawer({
            props: { loading: true, tabs: [{ name: 'basic', label: '基本信息' }] },
            slots: { 'tab-basic': '<div class="tab-basic-content">基本内容</div>' },
        })
        expect(tabsMode.find('.el-skeleton').exists()).toBe(true)
        expect(tabsMode.find('.el-tabs').exists()).toBe(false)
        expect(tabsMode.find('.tab-basic-content').exists()).toBe(false)
    })

    it('loading 由 true 切回 false：内容恢复渲染', async () => {
        const wrapper = await mountDrawer({ props: { loading: true } })
        expect(wrapper.find('.el-skeleton').exists()).toBe(true)
        expect(wrapper.find('.drawer-slot-content').exists()).toBe(false)

        await wrapper.setProps({ loading: false })
        expect(wrapper.find('.el-skeleton').exists()).toBe(false)
        expect(wrapper.find('.drawer-slot-content').exists()).toBe(true)
    })
})
