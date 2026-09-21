// @vitest-environment happy-dom
/**
 * FilterBar 配置化筛选栏单测（ui-unify-phase2-components 任务 2）：
 * 覆盖字段渲染（input/select/date、本地与远程 options、日期范围）、
 * v-model 双向绑定与不可变更新、字段 change 事件透传（field-change）、
 * actions 操作插槽，以及基于容器宽度测量（ResizeObserver 桩 +
 * getBoundingClientRect 桩）驱动的折叠逻辑与 computeFitLayout 纯函数边界。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { ElButton, ElDatePicker, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import FilterBar from '../FilterBar/index.vue'
import { computeFitLayout, FILTER_BAR_GAP, FILTER_BAR_TOGGLE_WIDTH } from '../FilterBar/fit'
import type { FilterField } from '../FilterBar/types'

/** assets 页筛选字段的 API 反推锚点（实现说明要求可无损表达） */
const PROVIDER_OPTIONS = [
    { value: 'aliyun', label: '阿里云' },
    { value: 'aws', label: 'AWS' },
]
const BASE_FIELDS: FilterField[] = [
    { key: 'provider', label: '云厂商', type: 'select', placeholder: '全部', clearable: true, options: PROVIDER_OPTIONS },
    { key: 'asset_type', label: '资产类型', type: 'select', placeholder: '全部', clearable: true, options: [{ value: 'compute', label: '计算服务' }] },
    { key: 'region', label: '区域', type: 'input', placeholder: '输入区域', clearable: true },
    { key: 'status', label: '状态', type: 'select', placeholder: '全部', clearable: true, options: [{ value: 'running', label: '运行中' }] },
    { key: 'asset_name', label: '资产名称', type: 'input', placeholder: '搜索资产名称', clearable: true },
]

/** 纯 input 字段：不含 el-select（其内部会自建 ResizeObserver 干扰实例计数） */
const INPUT_FIELDS: FilterField[] = BASE_FIELDS.map((field, index) => ({
    key: `field-${index}`,
    label: field.label,
    type: 'input' as const,
}))

interface MountOptions {
    fields?: FilterField[]
    modelValue?: Record<string, unknown>
    collapsible?: boolean
    slots?: Record<string, string>
}

/** 挂载辅助：vitest 无 unplugin 自动注册，显式注册用到的 Element Plus 组件 */
async function mountBar(opts: MountOptions = {}) {
    const { fields = BASE_FIELDS, modelValue = {}, collapsible, slots = {} } = opts
    const wrapper = mount(FilterBar, {
        props: {
            fields,
            modelValue,
            ...(collapsible === undefined ? {} : { collapsible }),
        },
        slots,
        global: {
            components: { ElButton, ElDatePicker, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElSelect },
        },
    })
    await flushPromises()
    await nextTick()
    return wrapper
}

// ==================== 测量桩：getBoundingClientRect + ResizeObserver ====================

/** 桩宽度表：按元素类名返回定宽，0 表示不可测量 */
const rectWidths = { root: 0, item: 0, toggle: 0, actions: 0 }

const makeRect = (width: number): DOMRect =>
    ({ width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect

class MockResizeObserver {
    static instances: MockResizeObserver[] = []
    callback: ResizeObserverCallback
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        MockResizeObserver.instances.push(this)
    }

    /** 手动触发一次容器尺寸变化回调 */
    trigger(): void {
        this.callback([], this as unknown as ResizeObserver)
    }
}

const elementProto = Element.prototype as unknown as Record<string, unknown>
const originalGetBCR = elementProto.getBoundingClientRect as ((this: Element) => DOMRect) | undefined

beforeEach(() => {
    rectWidths.root = 0
    rectWidths.item = 0
    rectWidths.toggle = 0
    rectWidths.actions = 0
    MockResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    elementProto.getBoundingClientRect = function (this: HTMLElement) {
        if (this.classList.contains('filter-bar')) return makeRect(rectWidths.root)
        if (this.classList.contains('filter-bar__toggle')) return makeRect(rectWidths.toggle)
        if (this.classList.contains('filter-bar__item--actions')) return makeRect(rectWidths.actions)
        if (this.classList.contains('filter-bar__item')) return makeRect(rectWidths.item)
        return makeRect(0)
    }
})

afterEach(() => {
    if (originalGetBCR) elementProto.getBoundingClientRect = originalGetBCR
    else delete elementProto.getBoundingClientRect
    vi.unstubAllGlobals()
})

// ==================== 字段渲染 ====================

describe('FilterBar 字段渲染', () => {
    it('资产页锚点字段（云厂商/资产类型/区域/状态/资产名称）可无损表达', async () => {
        const wrapper = await mountBar({
            modelValue: { provider: '', asset_type: '', region: '', status: '', asset_name: '' },
        })
        const labels = wrapper.findAll('.el-form-item__label').map((node) => node.text())
        expect(labels).toEqual(['云厂商', '资产类型', '区域', '状态', '资产名称'])
        expect(wrapper.find('input[placeholder="输入区域"]').exists()).toBe(true)
        expect(wrapper.find('input[placeholder="搜索资产名称"]').exists()).toBe(true)
        const optionLabels = wrapper.findAllComponents(ElOption).map((option) => option.props('label'))
        expect(optionLabels).toEqual(['阿里云', 'AWS', '计算服务', '运行中'])
        const select = wrapper.findComponent(ElSelect)
        expect(select.props('placeholder')).toBe('全部')
        expect(select.props('clearable')).toBe(true)
    })

    it('未配置 placeholder/width 时按字段类型给默认值', async () => {
        const wrapper = await mountBar({
            fields: [
                { key: 'name', label: '资产名称', type: 'input' },
                { key: 'type', label: '资产类型', type: 'select', options: [{ value: 'compute', label: '计算' }] },
                { key: 'created', label: '创建日期', type: 'date' },
            ],
        })
        const input = wrapper.find('input[placeholder="请输入资产名称"]')
        expect(input.exists()).toBe(true)
        // EP 把 style 落在控件根节点（.el-input），不在原生 input 上
        expect(wrapper.find('.el-input').attributes('style')).toContain('width: 200px')
        const select = wrapper.findComponent(ElSelect)
        expect(select.props('placeholder')).toBe('请选择资产类型')
        const date = wrapper.findComponent(ElDatePicker)
        expect(date.props('placeholder')).toBe('请选择创建日期')
        expect(wrapper.find('.el-date-editor').attributes('style')).toContain('width: 220px')
    })

    it('date 字段：单值为 date；range 为 daterange 并携带值格式与分隔符（含 datetime 默认格式）', async () => {
        const wrapper = await mountBar({
            fields: [
                { key: 'created', label: '创建日期', type: 'date' },
                {
                    key: 'range',
                    label: '时间范围',
                    type: 'date',
                    range: true,
                    valueFormat: 'YYYY-MM-DD HH:mm:ss',
                    startPlaceholder: '起',
                    endPlaceholder: '止',
                    rangeSeparator: '到',
                },
                { key: 'dt', label: '时间', type: 'date', dateType: 'datetimerange' },
            ],
        })
        const pickers = wrapper.findAllComponents(ElDatePicker)
        expect(pickers[0]!.props('type')).toBe('date')
        expect(pickers[0]!.props('valueFormat')).toBe('YYYY-MM-DD')
        expect(pickers[1]!.props('type')).toBe('daterange')
        expect(pickers[1]!.props('valueFormat')).toBe('YYYY-MM-DD HH:mm:ss')
        expect(pickers[1]!.props('startPlaceholder')).toBe('起')
        expect(pickers[1]!.props('endPlaceholder')).toBe('止')
        expect(pickers[1]!.props('rangeSeparator')).toBe('到')
        // EP DatePicker 是多根组件，style 落在 .el-date-editor 根节点上
        expect(wrapper.find('.el-date-editor--daterange').attributes('style')).toContain('width: 360px')
        expect(pickers[2]!.props('type')).toBe('datetimerange')
        expect(pickers[2]!.props('valueFormat')).toBe('YYYY-MM-DD HH:mm:ss')
    })

    it('select 字段：remote/remoteMethod/loading 透传，remote 默认启用 filterable', async () => {
        const remoteMethod = vi.fn()
        const wrapper = await mountBar({
            fields: [{ key: 'host', label: '主机', type: 'select', remote: true, remoteMethod, loading: true }],
        })
        const select = wrapper.findComponent(ElSelect)
        expect(select.props('remote')).toBe(true)
        expect(select.props('remoteMethod')).toBe(remoteMethod)
        expect(select.props('loading')).toBe(true)
        expect(select.props('filterable')).toBe(true)
    })

    it('actions 插槽渲染在字段行尾部', async () => {
        const wrapper = await mountBar({ slots: { actions: '<button class="bar-reset">重置</button>' } })
        expect(wrapper.find('.filter-bar__item--actions .bar-reset').exists()).toBe(true)
        expect(wrapper.find('.bar-reset').text()).toBe('重置')
    })
})

// ==================== 双向绑定与事件透传 ====================

describe('FilterBar 双向绑定与事件透传', () => {
    it('input 输入 → 以新对象 emit update:modelValue，且不原地修改入参', async () => {
        const initial: Record<string, unknown> = { region: '', asset_name: '' }
        const wrapper = await mountBar({ fields: BASE_FIELDS.filter((f) => f.type === 'input'), modelValue: initial })
        await wrapper.find('input[placeholder="输入区域"]').setValue('cn-beijing')
        const emitted = wrapper.emitted('update:modelValue') ?? []
        const last = emitted.at(-1)?.[0] as Record<string, unknown>
        expect(last).toEqual({ region: 'cn-beijing', asset_name: '' })
        expect(last).not.toBe(initial)
        expect(initial).toEqual({ region: '', asset_name: '' })
    })

    it('父级更新 modelValue → 控件值同步（双向）', async () => {
        const wrapper = await mountBar({ fields: [{ key: 'region', label: '区域', type: 'input' }] })
        await wrapper.setProps({ modelValue: { region: 'cn-shanghai' } })
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('cn-shanghai')
    })

    it('select 选择 → update:modelValue 携带新对象；change → field-change 透传字段配置与新值', async () => {
        const initial: Record<string, unknown> = {}
        const wrapper = await mountBar({ fields: [BASE_FIELDS[0]!], modelValue: initial })
        const select = wrapper.findComponent(ElSelect)
        select.vm.$emit('update:modelValue', 'aliyun')
        await nextTick()
        const updates = wrapper.emitted('update:modelValue') ?? []
        expect(((updates.at(-1)?.[0] ?? {}) as Record<string, unknown>).provider).toBe('aliyun')
        select.vm.$emit('change', 'aliyun')
        await nextTick()
        const changes = wrapper.emitted('field-change') ?? []
        expect(changes).toHaveLength(1)
        const [field, value] = changes[0] as [FilterField, unknown]
        expect(field.key).toBe('provider')
        expect(value).toBe('aliyun')
    })

    it('date 选择 → 值对象更新且 field-change 透传', async () => {
        const wrapper = await mountBar({ fields: [{ key: 'range', label: '时间范围', type: 'date', range: true }] })
        const picker = wrapper.findComponent(ElDatePicker)
        picker.vm.$emit('update:modelValue', ['2026-09-01', '2026-09-20'])
        await nextTick()
        const updates = wrapper.emitted('update:modelValue') ?? []
        expect(updates.at(-1)?.[0]).toEqual({ range: ['2026-09-01', '2026-09-20'] })
        picker.vm.$emit('change', ['2026-09-01', '2026-09-20'])
        await nextTick()
        const changes = wrapper.emitted('field-change') ?? []
        const [field, value] = changes[0] as [FilterField, unknown]
        expect(field.key).toBe('range')
        expect(value).toEqual(['2026-09-01', '2026-09-20'])
    })

    it('input change 事件（失焦/回车）→ field-change 按 1:1 透传', async () => {
        const wrapper = await mountBar({ fields: [{ key: 'region', label: '区域', type: 'input' }] })
        const input = wrapper.find('input')
        // happy-dom 的 setValue 合成一次 change（EP 语义 change → 透传 1）
        await input.setValue('cn-xy')
        // 真实 v-model：把 emit 的新值回写，控件值与筛选值保持一致后再提交一次
        await wrapper.setProps({ modelValue: { region: 'cn-xy' } })
        await input.trigger('change')
        // EP 的 change 逐个原生 change 无条件 emit，FilterBar 契约是 1:1 透传
        const changes = wrapper.emitted('field-change') ?? []
        expect(changes).toHaveLength(2)
        for (const payload of changes) {
            const [field, value] = payload as [FilterField, unknown]
            expect(field.key).toBe('region')
            expect(value).toBe('cn-xy')
        }
    })
})

// ==================== 折叠逻辑（容器宽度测量驱动） ====================

describe('FilterBar 折叠逻辑（容器宽度测量驱动）', () => {
    it('容器足够宽 → 全部字段展示且无切换按钮', async () => {
        rectWidths.root = 700
        rectWidths.item = 120
        const wrapper = await mountBar()
        expect(wrapper.find('.filter-bar__toggle').exists()).toBe(false)
        for (const item of wrapper.findAll('.filter-bar__item')) {
            expect(item.attributes('style') ?? '').not.toContain('display: none')
        }
    })

    it('一行放不下 → 折叠溢出字段并出现「展开」按钮', async () => {
        rectWidths.root = 500
        rectWidths.item = 120
        const wrapper = await mountBar()
        const toggle = wrapper.find('.filter-bar__toggle')
        expect(toggle.exists()).toBe(true)
        expect(toggle.text()).toContain('展开')
        const items = wrapper.findAll('.filter-bar__item')
        expect(items).toHaveLength(5)
        expect(items[0]!.attributes('style') ?? '').not.toContain('display: none')
        expect(items[2]!.attributes('style') ?? '').not.toContain('display: none')
        expect(items[3]!.attributes('style')).toContain('display: none')
        expect(items[4]!.attributes('style')).toContain('display: none')
    })

    it('点击「展开/收起」切换全部字段与折叠态', async () => {
        rectWidths.root = 500
        rectWidths.item = 120
        const wrapper = await mountBar()
        await wrapper.find('.filter-bar__toggle').trigger('click')
        expect(wrapper.find('.filter-bar__toggle').text()).toContain('收起')
        for (const item of wrapper.findAll('.filter-bar__item')) {
            expect(item.attributes('style') ?? '').not.toContain('display: none')
        }
        await wrapper.find('.filter-bar__toggle').trigger('click')
        expect(wrapper.findAll('.filter-bar__item')[3]!.attributes('style')).toContain('display: none')
    })

    it('ResizeObserver 回调驱动重测量：由宽变窄后出现折叠', async () => {
        rectWidths.root = 700
        rectWidths.item = 120
        const wrapper = await mountBar({ fields: INPUT_FIELDS })
        expect(wrapper.find('.filter-bar__toggle').exists()).toBe(false)
        rectWidths.root = 500
        MockResizeObserver.instances[0]!.trigger()
        await flushPromises()
        await nextTick()
        expect(wrapper.find('.filter-bar__toggle').exists()).toBe(true)
        expect(wrapper.findAll('.filter-bar__item')[3]!.attributes('style')).toContain('display: none')
    })

    it('卸载时断开 ResizeObserver', async () => {
        rectWidths.root = 700
        rectWidths.item = 120
        const wrapper = await mountBar({ fields: INPUT_FIELDS })
        const observer = MockResizeObserver.instances[0]!
        wrapper.unmount()
        expect(observer.disconnect).toHaveBeenCalled()
    })

    it('collapsible=false → 不折叠且无切换按钮', async () => {
        rectWidths.root = 300
        rectWidths.item = 120
        const wrapper = await mountBar({ collapsible: false })
        expect(wrapper.find('.filter-bar__toggle').exists()).toBe(false)
        for (const item of wrapper.findAll('.filter-bar__item')) {
            expect(item.attributes('style') ?? '').not.toContain('display: none')
        }
    })

    it('容器宽度不可测量（0）→ 退化为全部展示', async () => {
        const wrapper = await mountBar()
        expect(wrapper.find('.filter-bar__toggle').exists()).toBe(false)
        expect(wrapper.findAll('.filter-bar__item')).toHaveLength(5)
        for (const item of wrapper.findAll('.filter-bar__item')) {
            expect(item.attributes('style') ?? '').not.toContain('display: none')
        }
    })
})

// ==================== computeFitLayout 纯函数 ====================

describe('computeFitLayout 折叠阈值纯函数', () => {
    it('全部放得下（含间距）→ 不折叠', () => {
        expect(computeFitLayout([120, 120, 120], 700)).toEqual({ visibleCount: 3, needToggle: false })
    })

    it('恰好放满（合计等于容器宽）→ 不折叠', () => {
        const total = 120 * 3 + FILTER_BAR_GAP * 2
        expect(computeFitLayout([120, 120, 120], total)).toEqual({ visibleCount: 3, needToggle: false })
    })

    it('放不下时按预留���度求解一行可容纳的字段数', () => {
        // reserve 88：120≤412 ✓ / 256≤412 ✓ / 392≤412 ✓ / 528>412 ✗ → 可容纳 3 个
        expect(computeFitLayout([120, 120, 120, 120, 120], 500, 16, FILTER_BAR_TOGGLE_WIDTH)).toEqual({
            visibleCount: 3,
            needToggle: true,
        })
    })

    it('容器不可测量（width<=0）→ 退化为不折叠', () => {
        expect(computeFitLayout([120, 120], 0)).toEqual({ visibleCount: 2, needToggle: false })
        expect(computeFitLayout([120, 120], -1)).toEqual({ visibleCount: 2, needToggle: false })
    })

    it('一行连一个字段都放不下 → 放弃折叠换行展示全部', () => {
        expect(computeFitLayout([400], 300, 16, 88)).toEqual({ visibleCount: 1, needToggle: false })
    })

    it('空字段数组 → 无需折叠', () => {
        expect(computeFitLayout([], 300)).toEqual({ visibleCount: 0, needToggle: false })
    })
})
