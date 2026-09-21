// @vitest-environment happy-dom
/**
 * DataTable 表格封装单测（ui-unify-phase2-components 任务 3）：
 * 覆盖声明式列渲染（prop/label/width/formatter/自定义单元格 slot）、
 * 内置三态（loading 骨架屏 / empty 空态 / fetch 失败错误态 + retry，复用 StateBlock）、
 * 多选批量操作（selection-change 透传、底部批量操作条聚合与 batch-action 事件）、
 * 密度切换（default/compact → el-table size）与冻结表头（max-height 透传），
 * 以及 expose 的 refresh / clearSelection。
 *
 * el-table 在 happy-dom 下会经 MutationObserver 挂 DOM watch（realm 不匹配
 * 私有字段报错），统一以 no-op 桩替换；勾选交互走真实 DOM click 链路。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ElButton, ElEmpty, ElIcon, ElSkeleton, ElTable, ElTableColumn } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, type Component } from 'vue'
import DataTable from '../DataTable/index.vue'
import type { DataTableBatchAction, DataTableColumn } from '../DataTable/types'

/** assets 页列结构的 API 反推锚点（实现说明要求可无损表达） */
interface AssetRow {
    id: number
    name: string
    region: string
    cost: number
}

const ROWS: AssetRow[] = [
    { id: 1, name: 'vm-1', region: 'cn-beijing', cost: 100 },
    { id: 2, name: 'vm-2', region: 'cn-shanghai', cost: 200 },
    { id: 3, name: 'vm-3', region: 'cn-guangzhou', cost: 300 },
]

const BASE_COLUMNS: DataTableColumn<AssetRow>[] = [
    { prop: 'name', label: '资产名称', minWidth: 150, showOverflowTooltip: true },
    { prop: 'region', label: '区域', width: 120, align: 'center' },
    { prop: 'cost', label: '成本', width: 100, align: 'right', formatter: (row) => `¥${row.cost}` },
]

const BATCH_ACTIONS: DataTableBatchAction[] = [
    { key: 'sync', label: '批量同步', type: 'primary' },
    { key: 'delete', label: '批量删除', type: 'danger' },
]

interface MountOptions {
    columns?: DataTableColumn<AssetRow>[]
    data?: AssetRow[]
    fetch?: () => Promise<AssetRow[]>
    loading?: boolean
    selectable?: boolean
    expandable?: boolean
    batchActions?: DataTableBatchAction[]
    density?: 'default' | 'compact'
    maxHeight?: string | number
    emptyText?: string
    skeletonRows?: number
    errorText?: string
    attrs?: Record<string, unknown>
    slots?: Record<string, string>
}

/** 挂载辅助：vitest 无 unplugin 自动注册，显式注册用到的 Element Plus 组件 */
async function mountTable(opts: MountOptions = {}) {
    const {
        columns = BASE_COLUMNS,
        data = ROWS,
        fetch,
        loading,
        selectable,
        expandable,
        batchActions,
        density,
        maxHeight,
        emptyText,
        skeletonRows,
        errorText,
        attrs = {},
        slots = {},
    } = opts
    // 泛型组件经 VTU mount 时 props 类型会退化为 unknown（vue-tsc 已知限制），
    // 以类型擦除后的组件挂载；泛型正确性由组件侧 vue-tsc 与用例运行时断言保证
    const wrapper = mount(DataTable as unknown as Component, {
        props: {
            columns,
            data,
            ...(fetch ? { fetch } : {}),
            ...(loading === undefined ? {} : { loading }),
            ...(selectable === undefined ? {} : { selectable }),
            ...(expandable === undefined ? {} : { expandable }),
            ...(batchActions === undefined ? {} : { batchActions }),
            ...(density === undefined ? {} : { density }),
            ...(maxHeight === undefined ? {} : { maxHeight }),
            ...(emptyText === undefined ? {} : { emptyText }),
            ...(skeletonRows === undefined ? {} : { skeletonRows }),
            ...(errorText === undefined ? {} : { errorText }),
        },
        attrs,
        slots,
        global: {
            components: { ElTable, ElTableColumn, ElButton, ElSkeleton, ElEmpty, ElIcon },
        },
    })
    await flushPromises()
    await nextTick()
    return wrapper
}

/** 勾选第 index 行的选择框（真实 DOM click 链路触发 el-table selection-change） */
async function selectRow(wrapper: VueWrapper, index: number): Promise<void> {
    const input = wrapper.findAll('.el-table__body .el-checkbox input')[index]!
    await input.setValue(true)
    await flushPromises()
    await nextTick()
}

beforeEach(() => {
    // el-table 的 key-render-helper 在 happy-dom 下触发 MutationObserver realm
    // 私有字段报错；其仅用于 DOM 变更后强制重渲染，单测以 no-op 桩替代
    vi.stubGlobal(
        'MutationObserver',
        class {
            observe() {}
            disconnect() {}
            unobserve() {}
            takeRecords() {
                return []
            }
        },
    )
})

afterEach(() => {
    vi.unstubAllGlobals()
})

// ==================== 列渲染（声明式 columns） ====================

describe('DataTable 列渲染', () => {
    it('表头与单元格按 columns 配置渲染，formatter 生效', async () => {
        const wrapper = await mountTable()
        expect(wrapper.find('.el-table__header-wrapper').text()).toContain('资产名称')
        expect(wrapper.find('.el-table__header-wrapper').text()).toContain('区域')
        expect(wrapper.find('.el-table__header-wrapper').text()).toContain('成本')
        const body = wrapper.find('.el-table__body-wrapper').text()
        expect(body).toContain('vm-1')
        expect(body).toContain('cn-beijing')
        expect(body).toContain('¥100')
    })

    it('列 width/minWidth/align/fixed/sortable/showOverflowTooltip 透传 el-table-column', async () => {
        const wrapper = await mountTable({
            columns: [
                ...BASE_COLUMNS,
                { prop: 'id', label: '操作', width: 180, fixed: 'right', sortable: true },
            ],
        })
        const cols = wrapper.findAllComponents(ElTableColumn)
        expect(cols).toHaveLength(4)
        expect(cols[0]!.props('minWidth')).toBe(150)
        expect(cols[0]!.props('showOverflowTooltip')).toBe(true)
        expect(cols[1]!.props('width')).toBe(120)
        expect(cols[1]!.props('align')).toBe('center')
        expect(cols[2]!.props('align')).toBe('right')
        expect(cols[3]!.props('fixed')).toBe('right')
        expect(cols[3]!.props('sortable')).toBe(true)
    })

    it('自定义单元格 slot：作用域携带 row 与 $index', async () => {
        const wrapper = await mountTable({
            columns: [
                { prop: 'name', label: '资产名称' },
                { prop: 'region', label: '区域', slot: 'region' },
            ],
            slots: {
                region: '<template #region="params"><span class="region-cell">{{ params.row.region }}-自定义</span></template>',
            },
        })
        const cells = wrapper.findAll('.region-cell')
        expect(cells).toHaveLength(3)
        expect(cells[0]!.text()).toBe('cn-beijing-自定义')
    })

    it('$attrs 透传 el-table（stripe 等 el-table 既有 props）', async () => {
        const wrapper = await mountTable({ attrs: { stripe: true } })
        expect(wrapper.findComponent(ElTable).props('stripe')).toBe(true)
    })

    it('数据经 fetch 注入：挂载后自动加载并渲染', async () => {
        const fetch = vi.fn().mockResolvedValue(ROWS)
        const wrapper = await mountTable({ fetch })
        expect(fetch).toHaveBeenCalledTimes(1)
        expect(wrapper.find('.el-table__body-wrapper').text()).toContain('vm-1')
    })

    it('fetch 函数标识变化（筛选闭包更新）触发重新加载', async () => {
        const fetchA = vi.fn().mockResolvedValue(ROWS)
        const wrapper = await mountTable({ fetch: fetchA })
        const fetchB = vi.fn().mockResolvedValue([ROWS[0]!])
        await wrapper.setProps({ fetch: fetchB })
        await flushPromises()
        expect(fetchA).toHaveBeenCalledTimes(1)
        expect(fetchB).toHaveBeenCalledTimes(1)
        expect(wrapper.find('.el-table__body-wrapper').text()).not.toContain('vm-2')
    })
})

// ==================== 内置三态 ====================

describe('DataTable 内置三态', () => {
    it('loading：骨架屏替代表格，行数可配置', async () => {
        const wrapper = await mountTable({ loading: true, skeletonRows: 5 })
        expect(wrapper.find('.el-skeleton').exists()).toBe(true)
        expect(wrapper.findAll('.el-skeleton__paragraph')).toHaveLength(5)
        expect(wrapper.find('.el-table').exists()).toBe(false)
    })

    it('空数据：渲染空态，文案缺省「暂无数据」、可自定义', async () => {
        const wrapper = await mountTable({ data: [] })
        expect(wrapper.find('.el-empty').exists()).toBe(true)
        expect(wrapper.find('.el-empty').text()).toContain('暂无数据')

        const custom = await mountTable({ data: [], emptyText: '没有匹配的资产' })
        expect(custom.find('.el-empty').text()).toContain('没有匹配的资产')
    })

    it('fetch 失败：错误态展示错误信息，retry 重新拉取成功后恢复表格', async () => {
        const fetch = vi
            .fn<() => Promise<AssetRow[]>>()
            .mockRejectedValueOnce(new Error('网络超时'))
            .mockResolvedValue(ROWS)
        const wrapper = await mountTable({ fetch })

        expect(wrapper.find('.state-block__state--error').exists()).toBe(true)
        expect(wrapper.find('.state-block__error-text').text()).toContain('网络超时')
        expect(wrapper.find('.el-table').exists()).toBe(false)

        await wrapper.find('.state-block__retry').trigger('click')
        await flushPromises()
        expect(fetch).toHaveBeenCalledTimes(2)
        expect(wrapper.emitted('retry')).toHaveLength(1)
        expect(wrapper.find('.el-table__body-wrapper').text()).toContain('vm-1')
    })

    it('fetch 返回空数组：空态', async () => {
        const wrapper = await mountTable({ fetch: vi.fn().mockResolvedValue([]) })
        expect(wrapper.find('.el-empty').exists()).toBe(true)
    })

    it('fetch 抛非 Error：错误态展示 errorText 兜底文案', async () => {
        const wrapper = await mountTable({
            fetch: vi.fn().mockRejectedValue('boom'),
            errorText: '加载失败兜底',
        })
        expect(wrapper.find('.state-block__state--error').exists()).toBe(true)
        expect(wrapper.find('.state-block__error-text').text()).toContain('加载失败兜底')
    })
})

// ==================== 多选与批量操作 ====================

describe('DataTable 多选与批量操作', () => {
    it('selectable 开启多选列', async () => {
        const wrapper = await mountTable({ selectable: true })
        const hasSelectionColumn = wrapper
            .findAllComponents(ElTableColumn)
            .some((col) => col.props('type') === 'selection')
        expect(hasSelectionColumn).toBe(true)
    })

    it('勾选行触发 selection-change 并聚合底部批量操作条', async () => {
        const wrapper = await mountTable({ selectable: true, batchActions: BATCH_ACTIONS })
        await selectRow(wrapper, 0)

        expect(wrapper.emitted('selection-change')![0]![0]).toEqual([ROWS[0]!])
        const bar = wrapper.find('.data-table__batch-bar')
        expect(bar.exists()).toBe(true)
        expect(bar.text()).toContain('已选 1 项')
        expect(bar.text()).toContain('批量同步')
        expect(bar.text()).toContain('批量删除')
    })

    it('未选中 / 未开启 selectable / 未配置 actions 时不渲染批量操作条', async () => {
        const noSelection = await mountTable({ selectable: true, batchActions: BATCH_ACTIONS })
        expect(noSelection.find('.data-table__batch-bar').exists()).toBe(false)

        const noActions = await mountTable({ selectable: true })
        await selectRow(noActions, 1)
        expect(noActions.find('.data-table__batch-bar').exists()).toBe(false)

        const notSelectable = await mountTable({ batchActions: BATCH_ACTIONS })
        expect(notSelectable.find('.data-table__batch-bar').exists()).toBe(false)
    })

    it('点击批量动作按钮：batch-action 事件携带 key 与当前选中行', async () => {
        const wrapper = await mountTable({ selectable: true, batchActions: BATCH_ACTIONS })
        await selectRow(wrapper, 0)
        await selectRow(wrapper, 2)

        const syncButton = wrapper
            .findAll('.data-table__batch-actions button')
            .find((btn) => btn.text().includes('批量同步'))!
        await syncButton.trigger('click')

        const emitted = wrapper.emitted('batch-action')!
        expect(emitted).toHaveLength(1)
        expect(emitted[0]![0]).toBe('sync')
        expect(emitted[0]![1]).toEqual([ROWS[0]!, ROWS[2]!])
    })

    it('批量条「取消选择」清空选中并隐藏批量条', async () => {
        const wrapper = await mountTable({ selectable: true, batchActions: BATCH_ACTIONS })
        await selectRow(wrapper, 0)
        expect(wrapper.find('.data-table__batch-bar').exists()).toBe(true)

        await wrapper.find('.data-table__batch-clear').trigger('click')
        await flushPromises()
        await nextTick()
        expect(wrapper.find('.data-table__batch-bar').exists()).toBe(false)
    })

    it('disabled 动作按钮渲染禁用态', async () => {
        const wrapper = await mountTable({
            selectable: true,
            batchActions: [{ key: 'locked', label: '禁用动作', disabled: true }],
        })
        await selectRow(wrapper, 0)
        const button = wrapper
            .findAll('.data-table__batch-actions button')
            .find((btn) => btn.text().includes('禁用动作'))!
        expect(button.classes()).toContain('is-disabled')
    })
})

// ==================== 行内展开列（expandable，alert/events 页锚点） ====================

describe('DataTable 行内展开列', () => {
    it('默认不渲染展开列（既有使用方零影响）', async () => {
        const wrapper = await mountTable()
        const hasExpandColumn = wrapper
            .findAllComponents(ElTableColumn)
            .some((col) => col.props('type') === 'expand')
        expect(hasExpandColumn).toBe(false)
    })

    it('expandable 渲染 type=expand 首列，#expand 插槽收 row 作用域渲染展开内容', async () => {
        const wrapper = await mountTable({
            expandable: true,
            slots: {
                expand: '<template #expand="params"><pre class="expand-pre">{{ params.row.name }}</pre></template>',
            },
        })
        const columns = wrapper.findAllComponents(ElTableColumn)
        expect(columns[0]!.props('type')).toBe('expand')
        expect(columns[1]!.props('label')).toBe('资产名称')

        expect(wrapper.find('.expand-pre').exists()).toBe(false)
        await wrapper.findAll('.el-table__expand-icon')[0]!.trigger('click')
        await flushPromises()
        await nextTick()
        const pre = wrapper.find('.expand-pre')
        expect(pre.exists()).toBe(true)
        expect(pre.text()).toBe('vm-1')
    })
})

// ==================== 密度与冻结表头 ====================

describe('DataTable 密度与冻结表头', () => {
    it('density 缺省 default → el-table size=default；compact → small', async () => {
        const defaultWrapper = await mountTable()
        expect(defaultWrapper.findComponent(ElTable).props('size')).toBe('default')

        const compact = await mountTable({ density: 'compact' })
        expect(compact.findComponent(ElTable).props('size')).toBe('small')
    })

    it('maxHeight 透传 el-table 实现冻结表头（assets 页锚点用法）', async () => {
        const wrapper = await mountTable({ maxHeight: 'calc(100vh - 24rem)' })
        expect(wrapper.findComponent(ElTable).props('maxHeight')).toBe('calc(100vh - 24rem)')
    })
})

// ==================== expose ====================

describe('DataTable expose', () => {
    it('refresh() 重新触发 fetch 加载', async () => {
        const fetch = vi.fn().mockResolvedValue(ROWS)
        const wrapper = await mountTable({ fetch })
        expect(fetch).toHaveBeenCalledTimes(1)

        const exposed = wrapper.vm as unknown as { refresh: () => Promise<void> }
        await exposed.refresh()
        expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('clearSelection() 清空选中行并隐藏批量条', async () => {
        const wrapper = await mountTable({ selectable: true, batchActions: BATCH_ACTIONS })
        await selectRow(wrapper, 0)
        expect(wrapper.find('.data-table__batch-bar').exists()).toBe(true)

        const exposed = wrapper.vm as unknown as { clearSelection: () => void }
        exposed.clearSelection()
        await flushPromises()
        await nextTick()
        expect(wrapper.find('.data-table__batch-bar').exists()).toBe(false)
    })
})
