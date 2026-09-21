// @vitest-environment happy-dom
/**
 * assets 资产列表等价重写单测（ui-unify-phase3-pilot-pages 任务 3）：
 * 旧页用户路径盘点全保留（页头/五筛选字段/九列结构/分页/发现/同步/编辑/删除/
 * 详情抽屉），PageContainer + FilterBar + DataTable 组件化骨架，规格增强
 * （行点击开 DetailDrawer 2.0 / 密度切换 / 批量操作条），scoped 样式 <100 行，
 * 以及「零新增硬编码颜色字面量」Hard Rule 守卫（页面色字面量 ⊆ 旧页基线）。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DetailDrawer from '@/components/DetailDrawer/index.vue'
import ElementPlus, {
    ElMessage,
    ElMessageBox,
    ElPagination,
    ElTable,
} from 'element-plus'
import {
    deleteAssetApi,
    listAssetsApi,
    submitDiscoverAssetsTaskApi,
    submitSyncAssetsTaskApi,
    updateAssetApi,
} from '@/api'
import type { Asset } from '@/api/types/asset'
import { getAssetTypeLabel, getProviderLabel } from '@/utils/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import AssetsPage from '../index.vue'

vi.mock('@/api', () => ({
    listAssetsApi: vi.fn(),
    deleteAssetApi: vi.fn(),
    updateAssetApi: vi.fn(),
    submitDiscoverAssetsTaskApi: vi.fn(),
    submitSyncAssetsTaskApi: vi.fn(),
}))

// ==================== mock 数据（形状对齐 Asset / 列表响应） ====================

const assetRows: Asset[] = [
    {
        id: 1,
        asset_id: 'i-aaa111',
        asset_name: 'web-01',
        asset_type: 'ecs',
        tenant_id: 't1',
        account_id: 1,
        provider: 'aws',
        region: 'cn-north-1',
        status: 'running',
        attributes: {},
        create_time: 0,
        update_time: 0,
        cost: 12.5,
        discover_time: '2026-09-20 10:00:00',
    },
    {
        id: 2,
        asset_id: 'i-bbb222',
        asset_name: 'db-01',
        asset_type: 'rds',
        tenant_id: 't1',
        account_id: 1,
        provider: 'aliyun',
        region: 'cn-east-1',
        status: 'stopped',
        attributes: {},
        create_time: 0,
        update_time: 0,
        cost: 88,
        discover_time: '2026-09-19 08:30:00',
    },
    {
        id: 3,
        asset_id: 'i-ccc333',
        asset_name: 'cache-01',
        asset_type: 'redis',
        tenant_id: 't1',
        account_id: 1,
        provider: 'tencent',
        region: 'ap-guangzhou',
        status: 'error',
        attributes: {},
        create_time: 0,
        update_time: 0,
        discover_time: '2026-09-18 21:10:00',
    },
]

const assetsPayload = { data: { items: assetRows, total: 42 } }

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

/** el-dialog 替身：规避 overlay 过渡，modelValue 真时渲染标题/默认/页脚插槽 */
const ElDialogStub = defineComponent({
    name: 'ElDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        title: { type: String, default: '' },
    },
    setup(props, { slots }) {
        return () =>
            props.modelValue
                ? h('div', { class: 'dialog-stub' }, [
                      h('div', { class: 'dialog-stub__title' }, [props.title]),
                      h('div', { class: 'dialog-stub__body' }, [slots.default?.()]),
                      h('div', { class: 'dialog-stub__footer' }, [slots.footer?.()]),
                  ])
                : null
    },
})

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

async function mountPage(): Promise<{ wrapper: VueWrapper; router: Router }> {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/tasks/:id', component: { template: '<div />' } },
        ],
    })
    await router.push('/')
    const wrapper = mount(AssetsPage, {
        attachTo: document.body,
        global: {
            plugins: [router, ElementPlus],
            stubs: { teleport: true, ElDialog: ElDialogStub, ElDrawer: ElDrawerStub },
        },
    })
    wrappers.push(wrapper)
    // el-table 列注册是异步的：flush 后再断言
    await flushPromises()
    await nextTick()
    return { wrapper, router }
}

const buttonWithText = (wrapper: VueWrapper, text: string) =>
    wrapper.findAll('button').find((button) => button.text().includes(text))

/** ElMessageBox.confirm 桩（成功路径默认确认） */
const stubConfirm = () => vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vi.mocked(listAssetsApi).mockResolvedValue(assetsPayload as never)
    vi.mocked(deleteAssetApi).mockResolvedValue({} as never)
    vi.mocked(updateAssetApi).mockResolvedValue({} as never)
    vi.mocked(submitDiscoverAssetsTaskApi).mockResolvedValue({ data: { task_id: 'T-123' } } as never)
    vi.mocked(submitSyncAssetsTaskApi).mockResolvedValue({ data: { task_id: 'T-456' } } as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.documentElement.classList.remove('dark', 'light')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

// ==================== AC1：旧页用户路径盘点全保留 ====================

describe('AC1 页面骨架与页头（旧页路径 1-4）', () => {
    it('PageContainer 骨架 + 页头标题副标题 + 发现/同步按钮', async () => {
        const { wrapper } = await mountPage()
        expect(wrapper.find('.page-container').exists()).toBe(true)
        expect(wrapper.find('.page-container__header').exists()).toBe(true)
        expect(wrapper.find('.page-container__filters').exists()).toBe(true)
        expect(wrapper.find('.page-container__body').exists()).toBe(true)
        expect(wrapper.find('.page-title').text()).toBe('资产管理')
        expect(wrapper.find('.page-subtitle').text()).toBe('查看和管理所有云平台的资产')
        expect(buttonWithText(wrapper, '发现资产')).toBeTruthy()
        expect(buttonWithText(wrapper, '同步资产')).toBeTruthy()
    })

    it('FilterBar 渲染五个筛选字段标签 + 重置按钮（旧 AssetFilters 等价）', async () => {
        const { wrapper } = await mountPage()
        const labels = wrapper.findAll('.filter-bar .el-form-item__label').map((node) => node.text())
        expect(labels).toEqual(['云厂商', '资产类型', '区域', '状态', '资产名称'])
        expect(buttonWithText(wrapper, '重置')).toBeTruthy()
    })

    it('发现资产对话框：必填校验提示，填写后提交跳转任务详情', async () => {
        const warnSpy = vi.spyOn(ElMessage, 'warning').mockImplementation((() => ({ close: () => {} })) as never)
        const successSpy = vi.spyOn(ElMessage, 'success').mockImplementation((() => ({ close: () => {} })) as never)
        const { wrapper, router } = await mountPage()
        await buttonWithText(wrapper, '发现资产')!.trigger('click')
        const dialog = wrapper.find('.dialog-stub')
        expect(dialog.exists()).toBe(true)
        expect(dialog.find('.dialog-stub__title').text()).toBe('发现资产')

        // 空表单提交 → 必填警告
        const emptySubmit = dialog.findAll('button').find((button) => button.text().includes('开始发现'))
        await emptySubmit!.trigger('click')
        await flushPromises()
        expect(warnSpy).toHaveBeenCalled()

        // 填写云厂商 + 区域后提交 → 任务提示 + 跳转
        await dialog.findAllComponents({ name: 'ElSelect' })[0]!.vm.$emit('update:modelValue', 'aws')
        await dialog.findAllComponents({ name: 'ElInput' })[0]!.find('input').setValue('cn-beijing')
        await emptySubmit!.trigger('click')
        await flushPromises()
        expect(submitDiscoverAssetsTaskApi).toHaveBeenCalledWith({ provider: 'aws', region: 'cn-beijing' })
        expect(successSpy).toHaveBeenCalled()
        expect(router.currentRoute.value.fullPath).toBe('/tasks/T-123')
    })

    it('同步资产对话框：提交成功跳转任务详情；未选云厂商时拦截', async () => {
        const warnSpy = vi.spyOn(ElMessage, 'warning').mockImplementation((() => ({ close: () => {} })) as never)
        const { wrapper, router } = await mountPage()
        await buttonWithText(wrapper, '同步资产')!.trigger('click')
        const dialog = wrapper.find('.dialog-stub')
        expect(dialog.find('.dialog-stub__title').text()).toBe('同步资产')

        const submit = dialog.findAll('button').find((button) => button.text().includes('开始同步'))
        await submit!.trigger('click')
        await flushPromises()
        expect(warnSpy).toHaveBeenCalled()

        await dialog.findAllComponents({ name: 'ElSelect' })[0]!.vm.$emit('update:modelValue', 'aws')
        await submit!.trigger('click')
        await flushPromises()
        expect(submitSyncAssetsTaskApi).toHaveBeenCalledWith({ provider: 'aws', asset_types: undefined, regions: undefined })
        expect(router.currentRoute.value.fullPath).toBe('/tasks/T-456')
    })
})

describe('AC1 表格列结构与行渲染（旧页路径 5-7）', () => {
    it('九个业务列表头顺序等价，且含规格增强的选择列', async () => {
        const { wrapper } = await mountPage()
        const headerCells = wrapper.findAll('.el-table__header th .cell').map((node) => node.text())
        expect(headerCells).toEqual([
            '',
            '资产ID',
            '资产名称',
            '云厂商',
            '资产类型',
            '区域',
            '状态',
            '成本',
            '发现时间',
            '操作',
        ])
    })

    it('行渲染等价：云厂商映射/类型映射/状态徽章/成本/发现时间格式', async () => {
        const { wrapper } = await mountPage()
        const rows = wrapper.findAll('.el-table__body tbody tr')
        expect(rows).toHaveLength(3)
        expect(rows[0]!.text()).toContain('i-aaa111')
        expect(rows[0]!.text()).toContain('web-01')
        expect(rows[0]!.text()).toContain(getProviderLabel('aws'))
        expect(rows[0]!.text()).toContain(getAssetTypeLabel('ecs'))
        expect(rows[0]!.text()).toContain('运行中')
        expect(rows[0]!.text()).toContain('¥12.50')
        expect(rows[0]!.text()).toContain('2026-09-20 10:00')
        expect(rows[1]!.text()).toContain(getProviderLabel('aliyun'))
        expect(rows[1]!.text()).toContain('已停止')
        expect(rows[2]!.text()).toContain(getAssetTypeLabel('redis'))
        // 成本缺失行：等价回退 ¥0.00（旧页直接 formatCost(row.cost)）
        expect(rows[2]!.text()).toContain('¥0.00')
    })

    it('行内操作列：查看/编辑/删除三按钮齐备', async () => {
        const { wrapper } = await mountPage()
        const row = wrapper.findAll('.el-table__body tbody tr')[0]!
        const ops = row.findAll('.el-button').map((button) => button.text())
        expect(ops).toEqual(['查看', '编辑', '删除'])
    })
})

describe('AC1 筛选与分页链路（旧页路径 5/8）', () => {
    it('云厂商筛选 change 后以新参数回第 1 页重拉', async () => {
        const { wrapper } = await mountPage()
        vi.mocked(listAssetsApi).mockClear()
        const providerSelect = wrapper.findAllComponents({ name: 'ElSelect' })[0]!
        providerSelect.vm.$emit('update:modelValue', 'aws')
        providerSelect.vm.$emit('change', 'aws')
        await flushPromises()
        expect(listAssetsApi).toHaveBeenCalledTimes(1)
        expect(listAssetsApi).toHaveBeenLastCalledWith(
            expect.objectContaining({ provider: 'aws', offset: 0, limit: 20 }),
        )
    })

    it('资产名称筛选 change 后以 name 参数重拉（等价旧防抖搜索路径）', async () => {
        const { wrapper } = await mountPage()
        vi.mocked(listAssetsApi).mockClear()
        const nameInput = wrapper.findAllComponents({ name: 'ElInput' })[1]!
        nameInput.vm.$emit('update:modelValue', 'web')
        nameInput.vm.$emit('change', 'web')
        await flushPromises()
        expect(listAssetsApi).toHaveBeenLastCalledWith(
            expect.objectContaining({ name: 'web', offset: 0, limit: 20 }),
        )
    })

    it('重置筛选：清空全部字段并回第 1 页重拉', async () => {
        const { wrapper } = await mountPage()
        const providerSelect = wrapper.findAllComponents({ name: 'ElSelect' })[0]!
        providerSelect.vm.$emit('update:modelValue', 'aws')
        providerSelect.vm.$emit('change', 'aws')
        await flushPromises()
        vi.mocked(listAssetsApi).mockClear()

        await buttonWithText(wrapper, '重置')!.trigger('click')
        await flushPromises()
        expect(listAssetsApi).toHaveBeenLastCalledWith(
            expect.objectContaining({ provider: undefined, offset: 0, limit: 20 }),
        )
    })

    it('分页信息：共 N 条 + 页码 x/y + sizes/pager/jumper 结构', async () => {
        const { wrapper } = await mountPage()
        expect(wrapper.find('.page-info').text()).toBe('1/3')
        expect(wrapper.find('.total-info').text()).toBe('共 42 条')
        expect(wrapper.find('.el-pagination').exists()).toBe(true)
        expect(wrapper.find('.el-pagination__sizes').exists()).toBe(true)
        expect(wrapper.find('.el-pagination__jump').exists()).toBe(true)
    })

    it('翻页与改页大小：offset/limit 按新值重拉，size 变更回第 1 页', async () => {
        const { wrapper } = await mountPage()
        const pagination = wrapper.findComponent(ElPagination)
        pagination.vm.$emit('update:current-page', 2)
        pagination.vm.$emit('current-change', 2)
        await flushPromises()
        expect(listAssetsApi).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20, limit: 20 }))

        pagination.vm.$emit('update:page-size', 10)
        pagination.vm.$emit('size-change', 10)
        await flushPromises()
        expect(listAssetsApi).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, limit: 10 }))
        expect(wrapper.find('.page-info').text()).toBe('1/5')
    })

    it('首页/末页快捷按钮：页首禁用首页、末页点击跳最后一页', async () => {
        const { wrapper } = await mountPage()
        const first = wrapper.find('button[title="第一页"]')
        const last = wrapper.find('button[title="最后一页"]')
        expect(first.attributes('disabled')).toBeDefined()
        await last.trigger('click')
        await flushPromises()
        expect(listAssetsApi).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 40, limit: 20 }))
    })

    it('总数为 0 时不渲染分页内容（等价旧页 v-if）', async () => {
        vi.mocked(listAssetsApi).mockResolvedValue({ data: { items: [], total: 0 } } as never)
        const { wrapper } = await mountPage()
        expect(wrapper.find('.pagination-content').exists()).toBe(false)
    })
})

describe('AC1 编辑与删除（旧页路径 10-11）', () => {
    it('操作列编辑：打开对话框预填资产数据，保存后更新并重拉', async () => {
        const successSpy = vi.spyOn(ElMessage, 'success').mockImplementation((() => ({ close: () => {} })) as never)
        const { wrapper } = await mountPage()
        vi.mocked(listAssetsApi).mockClear()
        const row = wrapper.findAll('.el-table__body tbody tr')[0]!
        await row.findAll('.el-button')[1]!.trigger('click')
        const dialog = wrapper.find('.dialog-stub')
        expect(dialog.find('.dialog-stub__title').text()).toBe('编辑资产')
        const nameInput = dialog.findAllComponents({ name: 'ElInput' })[0]!
        expect((nameInput.find('input').element as HTMLInputElement).value).toBe('web-01')
        expect(dialog.findComponent({ name: 'ElInputNumber' }).props('modelValue')).toBe(12.5)

        await dialog.findAll('button').find((button) => button.text().includes('保存'))!.trigger('click')
        await flushPromises()
        expect(updateAssetApi).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ asset_name: 'web-01', status: 'running' }),
        )
        expect(successSpy).toHaveBeenCalled()
        expect(listAssetsApi).toHaveBeenCalledTimes(1)
    })

    it('操作列删除：确认后调用删除接口并重拉；取消则不删', async () => {
        const confirmSpy = stubConfirm()
        const { wrapper } = await mountPage()
        const row = wrapper.findAll('.el-table__body tbody tr')[0]!
        vi.mocked(listAssetsApi).mockClear()
        await row.findAll('.el-button')[2]!.trigger('click')
        await flushPromises()
        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('web-01'), '确认删除', expect.anything())
        expect(deleteAssetApi).toHaveBeenCalledWith(1)
        expect(listAssetsApi).toHaveBeenCalledTimes(1)

        // 取消路径：confirm 拒绝为 'cancel' 时不误报错误
        const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation((() => ({ close: () => {} })) as never)
        confirmSpy.mockRejectedValueOnce('cancel' as never)
        await row.findAll('.el-button')[2]!.trigger('click')
        await flushPromises()
        expect(deleteAssetApi).toHaveBeenCalledTimes(1)
        expect(errorSpy).not.toHaveBeenCalled()
    })
})

describe('AC1 DataTable 三态（组件内置承载）', () => {
    it('拉取失败呈现错误态（错误信息 + 重试），恢复后重试成功渲染行', async () => {
        vi.mocked(listAssetsApi).mockRejectedValueOnce(new Error('boom') as never)
        const { wrapper } = await mountPage()
        expect(wrapper.find('[role="alert"]').exists()).toBe(true)
        expect(wrapper.find('[role="alert"]').text()).toContain('boom')
        expect(wrapper.find('.state-block__retry').exists()).toBe(true)

        await wrapper.find('.state-block__retry').trigger('click')
        await flushPromises()
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        expect(wrapper.findAll('.el-table__body tbody tr')).toHaveLength(3)
    })

    it('空数据呈现空态文案「暂无数据」且不渲染表格行', async () => {
        vi.mocked(listAssetsApi).mockResolvedValue({ data: { items: [], total: 0 } } as never)
        const { wrapper } = await mountPage()
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('暂无数据')
        expect(wrapper.findAll('.el-table__body tbody tr')).toHaveLength(0)
    })
})

// ==================== AC2：规格指定增强 ====================

describe('AC2 行点击开 DetailDrawer 2.0（规格增强）', () => {
    it('行点击打开抽屉：标题为资产名、三标签页、基础信息描述与头操作按钮', async () => {
        const { wrapper } = await mountPage()
        const drawer = wrapper.findComponent(DetailDrawer)
        expect(drawer.props('visible')).toBe(false)

        await wrapper.findAll('.el-table__body tbody tr')[0]!.trigger('click')
        await flushPromises()
        expect(drawer.props('visible')).toBe(true)
        expect(drawer.props('title')).toBe('web-01')
        expect(wrapper.find('.drawer-stub').exists()).toBe(true)
        expect(wrapper.find('.drawer-title').text()).toBe('web-01')

        const tabs = wrapper.findAll('.el-tabs__item').map((node) => node.text())
        expect(tabs).toEqual(['基本信息', '配置详情', '监控数据'])
        const descText = wrapper.find('.drawer-stub').text()
        expect(descText).toContain('i-aaa111')
        expect(descText).toContain('资产名称')
        const headerButtons = wrapper
            .find('.drawer-stub__header')
            .findAll('button')
            .map((button) => button.text())
            .join('|')
        expect(headerButtons).toContain('编辑')
        expect(headerButtons).toContain('删除')
    })

    it('操作列点击不触发行点击（事件冒泡守卫）：编辑不开抽屉、查看开抽屉', async () => {
        const { wrapper } = await mountPage()
        const row = wrapper.findAll('.el-table__body tbody tr')[0]!
        const drawer = wrapper.findComponent(DetailDrawer)

        await row.findAll('.el-button')[1]!.trigger('click') // 编辑
        await flushPromises()
        expect(drawer.props('visible')).toBe(false)

        await row.findAll('.el-button')[0]!.trigger('click') // 查看
        await flushPromises()
        expect(drawer.props('visible')).toBe(true)
    })
})

describe('AC2 密度切换与批量操作条（规格增强）', () => {
    it('密度切换：默认 → 紧凑透传 el-table size=small', async () => {
        const { wrapper } = await mountPage()
        const table = wrapper.findComponent(ElTable)
        expect(table.props('size')).toBe('default')
        await buttonWithText(wrapper, '紧凑')!.trigger('click')
        expect(table.props('size')).toBe('small')
        await buttonWithText(wrapper, '默认')!.trigger('click')
        expect(table.props('size')).toBe('default')
    })

    it('勾选行出现批量操作条，批量删除逐行删除后清空选择并重拉', async () => {
        const confirmSpy = stubConfirm()
        const successSpy = vi.spyOn(ElMessage, 'success').mockImplementation((() => ({ close: () => {} })) as never)
        const { wrapper } = await mountPage()
        expect(wrapper.find('.data-table__batch-bar').exists()).toBe(false)

        const tableVm = wrapper.findComponent(ElTable).vm as unknown as {
            toggleRowSelection: (row: Asset) => void
        }
        tableVm.toggleRowSelection(assetRows[0]!)
        tableVm.toggleRowSelection(assetRows[1]!)
        await flushPromises()
        const batchBar = wrapper.find('.data-table__batch-bar')
        expect(batchBar.exists()).toBe(true)
        expect(batchBar.text()).toContain('已选 2 项')

        vi.mocked(listAssetsApi).mockClear()
        await buttonWithText(wrapper, '批量删除')!.trigger('click')
        await flushPromises()
        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('2'), '确认删除', expect.anything())
        expect(successSpy).toHaveBeenCalled()
        expect(wrapper.find('.data-table__batch-bar').exists()).toBe(false)
        expect(listAssetsApi).toHaveBeenCalledTimes(1)
    })
})

// ==================== AC3：scoped 样式与硬编码色守卫 ====================

describe('AC3 scoped 样式 <100 行 + 零新增硬编码色', () => {
    it('style 块行数 <100 且只消费令牌（布局微调）', async () => {
        const raw = (await import('../index.vue?raw')).default
        const match = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)
        expect(match).toBeTruthy()
        const styleBody = match![1]!
        expect(styleBody.split('\n').length).toBeLessThan(100)
        expect(styleBody).toContain('var(--text-primary)')
        expect(styleBody).toContain('var(--bg-elevated)')
        expect(styleBody).toContain('var(--border-subtle)')
    })

    it('页面色字面量 ⊆ 旧页基线（零新增），且无旧蓝 #3b82f6 系', async () => {
        // 旧版 index.vue（HEAD 基线）全部颜色字面量盘点：仅 pagination-fixed 的投影阴影
        const OLD_PAGE_COLORS = new Set(['rgba(0,0,0,0.1)'])
        const raw = (await import('../index.vue?raw')).default
        const colors = (raw.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []).map((color) =>
            color.replace(/\s+/g, '').toLowerCase(),
        )
        const unknown = colors.filter((color) => !OLD_PAGE_COLORS.has(color))
        expect(unknown).toEqual([])
        expect(colors.some((color) => color.includes('3b82f6'))).toBe(false)
    })
})
