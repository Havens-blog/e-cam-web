// @vitest-environment happy-dom
/**
 * RuleFormDialog 条件编辑器升级 + dry-run 预览单测（servicetree-overhaul-p1p2 任务 4）：
 * 覆盖条件校验前置（无完整条件不调 dry-run）、dry-run 请求体组装（conditions + node_id/env_id）、
 * 命中清单渲染（资产/云平台/地域/当前绑定状态）、0 命中显性警告、capped 截断提示。
 */
import { flushPromises, mount } from '@vue/test-utils'
import {
    ElAlert,
    ElButton,
    ElCol,
    ElForm,
    ElFormItem,
    ElIcon,
    ElInput,
    ElInputNumber,
    ElMessage,
    ElOption,
    ElOptionGroup,
    ElRow,
    ElSelect,
    ElSwitch,
    ElTag
} from 'element-plus'
import { defineComponent, h, inject, provide } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dryRunRulesApi } from '@/api/service-tree'
import type { DryRunResult } from '@/api/types/service-tree'
import RuleFormDialog from '../RuleFormDialog.vue'

vi.mock('@/api/service-tree', () => ({
    createRuleApi: vi.fn(),
    updateRuleApi: vi.fn(),
    getTreeApi: vi.fn().mockResolvedValue({ data: null }),
    listEnvironmentsApi: vi.fn().mockResolvedValue({ data: { list: [] } }),
    dryRunRulesApi: vi.fn()
}))

/** el-dialog 替身：modelValue 为真时渲染默认+footer 插槽，规避 overlay/teleport */
const ElDialogStub = defineComponent({
    name: 'ElDialog',
    props: { modelValue: { type: Boolean, default: false } },
    setup(props, { slots }) {
        return () =>
            props.modelValue ? h('div', { class: 'el-dialog-stub' }, [slots.default?.(), slots.footer?.()]) : null
    }
})

/** el-tree-select 替身：happy-dom 下树选择器无交互价值 */
const ElTreeSelectStub = defineComponent({
    name: 'ElTreeSelect',
    props: { modelValue: { type: null, default: undefined } },
    setup() {
        return () => h('div', { class: 'el-tree-select-stub' })
    }
})

/** el-table/el-table-column 替身：真实 ElTable 依赖 MutationObserver，happy-dom 不支持。
 * 行作用域经 provide 传递，使列的 scoped slot 以 { row } 渲染，保证行内容可断言。 */
const STUB_ROW_KEY = Symbol('stubRow')
const StubRowProvider = defineComponent({
    name: 'StubRowProvider',
    props: { row: { type: null, required: true } },
    setup(props, { slots }) {
        provide(STUB_ROW_KEY, props.row)
        return () => slots.default?.()
    }
})
const ElTableStub = defineComponent({
    name: 'ElTable',
    props: { data: { type: Array, default: () => [] } },
    setup(props, { slots }) {
        return () =>
            h(
                'div',
                { class: 'el-table-stub' },
                (props.data as any[]).map((row) => h(StubRowProvider, { row }, slots))
            )
    }
})
const ElTableColumnStub = defineComponent({
    name: 'ElTableColumn',
    props: { prop: { type: String, default: '' }, label: { type: String, default: '' } },
    setup(_, { slots }) {
        const row = inject<any>(STUB_ROW_KEY)
        return () => h('div', { class: 'el-table-column-stub' }, slots.default?.({ row }))
    }
})

/** 挂载组件并通过 setupState 预填表单（name/node/env 走必填校验，conditions 传参） */
async function mountDialog(conditions: Array<{ field: string; operator: string; value: string }>) {
    const wrapper = mount(RuleFormDialog, {
        props: { visible: true, isEdit: false },
        global: {
            components: {
                ElDialog: ElDialogStub,
                ElTreeSelect: ElTreeSelectStub,
                ElAlert,
                ElButton,
                ElCol,
                ElForm,
                ElFormItem,
                ElIcon,
                ElInput,
                ElInputNumber,
                ElMessage,
                ElOption,
                ElOptionGroup,
                ElRow,
                ElSelect,
                ElSwitch,
                ElTable: ElTableStub,
                ElTableColumn: ElTableColumnStub,
                ElTag
            }
        }
    })
    await flushPromises()
    const form = (wrapper.vm as any).form
    form.name = '测试规则'
    form.nodeId = 3
    form.envId = 2
    form.conditions = conditions as any
    return wrapper
}

const makeResult = (over: Partial<DryRunResult>): DryRunResult => ({
    items: [],
    total: 0,
    capped: false,
    ...over
})

describe('RuleFormDialog dry-run 试运行', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('无条件时点试运行不调 API 且给出警告', async () => {
        const warnSpy = vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({}) as any)
        const wrapper = await mountDialog([])
        await (wrapper.vm as any).handleDryRun()
        expect(dryRunRulesApi).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith('请至少添加一个匹配条件')
        warnSpy.mockRestore()
    })

    it('条件值缺失时点试运行不调 API', async () => {
        const warnSpy = vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({}) as any)
        const wrapper = await mountDialog([{ field: 'tag.service', operator: 'contains', value: '' }])
        await (wrapper.vm as any).handleDryRun()
        expect(dryRunRulesApi).not.toHaveBeenCalled()
        expect(warnSpy).toHaveBeenCalledWith('请填写条件值')
        warnSpy.mockRestore()
    })

    it('dry-run 请求体组装 conditions + node_id/env_id，命中清单渲染且无警告', async () => {
        vi.mocked(dryRunRulesApi).mockResolvedValue({
            data: makeResult({
                items: [
                    {
                        resource_id: 11,
                        asset_id: 'i-bp1',
                        asset_name: '订单服务-01',
                        provider: 'aliyun',
                        region: 'cn-hangzhou',
                        bind_status: 'unbound'
                    },
                    {
                        resource_id: 12,
                        asset_id: 'i-bp2',
                        asset_name: '订单服务-02',
                        provider: 'tencent',
                        region: 'ap-shanghai',
                        bind_status: 'manual',
                        bound_node_id: 8,
                        bound_node_name: 'SMT订单节点'
                    }
                ],
                total: 2
            })
        } as any)
        const warnSpy = vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({}) as any)
        const wrapper = await mountDialog([{ field: 'tag.service', operator: 'contains', value: 'smt' }])
        await (wrapper.vm as any).handleDryRun()
        await flushPromises()

        expect(dryRunRulesApi).toHaveBeenCalledTimes(1)
        expect(dryRunRulesApi).toHaveBeenCalledWith({
            conditions: [{ field: 'tag.service', operator: 'contains', value: 'smt' }],
            node_id: 3,
            env_id: 2
        })
        const vm = wrapper.vm as any
        expect(vm.dryRunVisible).toBe(true)
        expect(vm.dryRunResult.items).toHaveLength(2)
        expect(vm.dryRunResult.total).toBe(2)
        const text = wrapper.text()
        expect(text).toContain('共命中')
        expect(text).toContain('订单服务-01')
        expect(text).toContain('i-bp1')
        expect(text).toContain('未绑定')
        expect(text).toContain('手动绑定')
        expect(text).toContain('SMT订单节点')
        // 0 命中警告不应出现
        expect(wrapper.find('.el-alert--warning').exists()).toBe(false)
        warnSpy.mockRestore()
    })

    it('0 命中时渲染显性警告文案', async () => {
        vi.mocked(dryRunRulesApi).mockResolvedValue({ data: makeResult({}) } as any)
        const wrapper = await mountDialog([{ field: 'name', operator: 'eq', value: '不存在的主机' }])
        await (wrapper.vm as any).handleDryRun()
        await flushPromises()

        const alert = wrapper.find('.el-alert--warning')
        expect(alert.exists()).toBe(true)
        expect(alert.text()).toContain('未命中任何资产')
    })

    it('capped 截断时提示仅展示部分命中', async () => {
        vi.mocked(dryRunRulesApi).mockResolvedValue({
            data: makeResult({
                items: [
                    {
                        resource_id: 1,
                        asset_id: 'i-1',
                        asset_name: 'a',
                        provider: 'aliyun',
                        region: 'r',
                        bind_status: 'rule'
                    }
                ],
                total: 800,
                capped: true
            })
        } as any)
        const wrapper = await mountDialog([{ field: 'region', operator: 'eq', value: 'cn-hangzhou' }])
        await (wrapper.vm as any).handleDryRun()
        await flushPromises()

        expect(wrapper.text()).toContain('800')
        expect(wrapper.text()).toContain('仅展示前')
    })
})

describe('RuleFormDialog 条件编辑器字段选项', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('字段下拉包含 region、自由 tag 建议、资源组预设项且允许自由创建', async () => {
        const wrapper = await mountDialog([{ field: 'tag.env', operator: 'eq', value: 'prod' }])
        // 展开字段下拉（第三个 select 为首个条件的字段选择器），popper teleport 到 body
        const fieldSelect = wrapper.findAll('.el-select').at(2)
        expect(fieldSelect).toBeTruthy()
        await fieldSelect!.find('.el-select__wrapper').trigger('click')
        await flushPromises()
        const bodyText = document.body.textContent || ''
        // 基础 4 项（region 后端已支持）
        expect(bodyText).toContain('地域 (region)')
        // 常用 tag 建议 + 自由 tag key 提示
        expect(bodyText).toContain('tag.service')
        // 资源组预设项
        expect(bodyText).toContain('资源组ID (attributes.project_id)')
        // allow-create 自由输入已启用
        expect(fieldSelect!.find('.el-select__wrapper').classes().join(' ')).toBeTruthy()
        expect((wrapper.vm as any).form.conditions[0].field).toBe('tag.env')
    })
})
