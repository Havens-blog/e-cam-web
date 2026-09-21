// @vitest-environment happy-dom
/**
 * dashboard 仪表盘等价重写单测（ui-unify-phase3-pilot-pages 任务 2）：
 * 旧页用户路径盘点全保留（统计卡四路径/四图表区/即将过期资源表/时间筛选），
 * PageContainer + StatCard + StateBlock 组件化骨架，scoped 样式 <100 行，
 * 以及「零新增硬编码颜色字面量」Hard Rule 守卫（页面色字面量 ⊆ 旧页基线）。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { getCostDistributionApi } from '@/api/finops'
import {
    getByRegionApi,
    getExpiringApi,
    getOverviewApi,
} from '@/api/dashboard'
import { getGlobalAssetStatsApi } from '@/api/service-tree'
import ElementPlus, { ElMessage } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { getProviderLabel } from '@/utils/constants'
import { useAppStore } from '@/stores/app'
import DashboardPage from './index.vue'

vi.mock('@/api/dashboard', () => ({
    getOverviewApi: vi.fn(),
    getByRegionApi: vi.fn(),
    getExpiringApi: vi.fn(),
}))
vi.mock('@/api/finops', () => ({
    getCostDistributionApi: vi.fn(),
}))
vi.mock('@/api/service-tree', () => ({
    getGlobalAssetStatsApi: vi.fn(),
}))

// ==================== echarts 桩（happy-dom 无 canvas，只验证 option 组装） ====================
interface ChartOption {
    series?: Array<{
        type?: string
        itemStyle?: { color?: string }
        data?: Array<{ value?: number; name?: string; itemStyle?: { color?: string } }>
        emphasis?: unknown
        label?: { formatter?: unknown }
    }>
    yAxis?: { data?: string[] }
    graphic?: Array<{ type?: string; style?: { text?: string } }>
    [key: string]: unknown
}
type ChartStub = {
    setOption: ReturnType<typeof vi.fn>
    resize: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
}
const chartStubs = vi.hoisted(
    () => [] as Array<{ setOption: { mock: { calls: Array<Array<unknown>> } }; resize: unknown; dispose: unknown }>,
)
vi.mock('echarts', () => ({
    init: vi.fn(() => {
        const stub = {
            setOption: vi.fn(),
            resize: vi.fn(),
            dispose: vi.fn(),
        }
        chartStubs.push(stub as never)
        return stub
    }),
}))

const optionOf = (stub: ChartStub): ChartOption => stub.setOption.mock.calls[0]![0] as ChartOption
const stubWhere = (pred: (option: ChartOption) => boolean): ChartStub | undefined =>
    (chartStubs as unknown as ChartStub[]).find((stub) => stub.setOption.mock.calls.some((call) => pred(call[0] as ChartOption)))

// ==================== mock 数据 ====================
const DAY_MS = 86400000

const overviewPayload = {
    data: {
        total: 5123,
        by_provider: [
            { key: 'aws', count: 3000 },
            { key: 'alicloud', count: 1500 },
            { key: 'tencent', count: 623 },
        ],
        by_type: [],
        by_status: [{ key: 'Running', count: 1024 }],
    },
}

const assetTypePayload = {
    data: {
        by_asset_type: { cloud_rds: 1200, cloud_vm: 3000, oss: 500 },
    },
}

const regionPayload = {
    data: {
        items: Array.from({ length: 12 }, (_, i) => ({ key: `cn-region-${String(i + 1).padStart(2, '0')}`, count: 100 - i * 5 })),
    },
}

const costPayload = {
    data: Array.from({ length: 12 }, (_, i) => ({
        key: `svc-${String(i).padStart(2, '0')}`,
        amount: 0,
        amount_cny: (i + 1) * 100,
        percent: 0,
    })),
}

const expiringPayload = {
    data: {
        items: [
            {
                id: 1,
                asset_id: 'i-aaa',
                asset_name: 'web-01',
                asset_type: 'cloud_vm',
                account_id: 1,
                provider: 'aws',
                region: 'cn-north-1',
                status: 'Running',
                attributes: { expired_time: Date.now() + 3 * DAY_MS },
                create_time: 0,
                update_time: 0,
            },
            {
                id: 2,
                asset_id: 'i-bbb',
                asset_name: 'db-01',
                asset_type: 'cloud_rds',
                account_id: 1,
                provider: 'alicloud',
                region: 'cn-east-2',
                status: 'Running',
                attributes: { expired_time: Date.now() + 15 * DAY_MS },
                create_time: 0,
                update_time: 0,
            },
            {
                id: 3,
                asset_id: 'i-ccc',
                asset_name: 'cache-01',
                asset_type: 'cloud_redis',
                account_id: 1,
                provider: 'tencent',
                region: 'ap-guangzhou',
                status: 'Running',
                attributes: { expired_time: Date.now() + 60 * DAY_MS },
                create_time: 0,
                update_time: 0,
            },
        ],
        total: 25,
    } satisfies { items: Array<Record<string, unknown>>; total: number },
}

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

/** el-select 内部自建 ResizeObserver（happy-dom 无实现） */
class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

/** 本文件所有挂载实例（afterEach 统一卸载） */
const wrappers: VueWrapper[] = []
const scrollIntoViewMock = vi.fn()

async function mountPage(): Promise<{ wrapper: VueWrapper; router: Router }> {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/assets', component: { template: '<div />' } },
            { path: '/accounts', component: { template: '<div />' } },
        ],
    })
    await router.push('/')
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(DashboardPage, {
        attachTo: document.body,
        global: { plugins: [pinia, router, ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await nextTick()
    return { wrapper, router }
}

beforeEach(() => {
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    ;(Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scrollIntoViewMock
    chartStubs.length = 0
    scrollIntoViewMock.mockReset()
    vi.mocked(getOverviewApi).mockResolvedValue(overviewPayload as never)
    vi.mocked(getGlobalAssetStatsApi).mockResolvedValue(assetTypePayload as never)
    vi.mocked(getByRegionApi).mockResolvedValue(regionPayload as never)
    vi.mocked(getCostDistributionApi).mockResolvedValue(costPayload as never)
    vi.mocked(getExpiringApi).mockResolvedValue(expiringPayload as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.documentElement.classList.remove('dark', 'light')
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

// ==================== AC1：旧页用户路径盘点全保留 ====================

describe('AC1 页面骨架与统计卡（旧页路径 1-5）', () => {
    it('页头渲染标题与副标题，页面由 PageContainer 承载', async () => {
        const { wrapper } = await mountPage()
        expect(wrapper.find('.page-container').exists()).toBe(true)
        expect(wrapper.find('.page-container__header').exists()).toBe(true)
        expect(wrapper.find('.page-container__body').exists()).toBe(true)
        expect(wrapper.find('.page-title').text()).toBe('多云概览')
        expect(wrapper.find('.page-subtitle').text()).toBe('多云资源管理平台 · 统一视图')
    })

    it('四张统计卡渲染：标签/数值（k-w 缩写）/副标题齐全', async () => {
        const { wrapper } = await mountPage()
        const cards = wrapper.findAll('.stat-card')
        expect(cards).toHaveLength(4)
        expect(cards[0]!.text()).toContain('资产总数')
        expect(cards[0]!.text()).toContain('5.1k')
        expect(cards[0]!.text()).toContain('覆盖 3 个云厂商')
        expect(cards[1]!.text()).toContain('云厂商')
        expect(cards[1]!.text()).toContain('3')
        expect(cards[1]!.text()).toContain('多云统一接入')
        expect(cards[2]!.text()).toContain('运行中')
        expect(cards[2]!.text()).toContain('1024')
        expect(cards[2]!.text()).toContain('占实体资产 20%')
        expect(cards[3]!.text()).toContain('即将过期')
        expect(cards[3]!.text()).toContain('25')
        expect(cards[3]!.text()).toContain('30 天窗口')
    })

    it('统计卡点击路径：资产总数→/assets、云厂商→/accounts', async () => {
        const { wrapper, router } = await mountPage()
        const cards = wrapper.findAll('.stat-card')
        await cards[0]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.fullPath).toBe('/assets')
        await cards[1]!.trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.fullPath).toBe('/accounts')
    })

    it('统计卡点击路径：即将过期→平滑滚动到过期区；运行中不可点击', async () => {
        const { wrapper } = await mountPage()
        const cards = wrapper.findAll('.stat-card')
        expect(cards[0]!.classes()).toContain('clickable')
        expect(cards[1]!.classes()).toContain('clickable')
        expect(cards[2]!.classes()).not.toContain('clickable')
        expect(cards[3]!.classes()).toContain('clickable')
        await cards[3]!.trigger('click')
        expect(scrollIntoViewMock).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
    })

    it('数据加载失败时统计卡数值显示 -（等价旧页占位）', async () => {
        vi.mocked(getOverviewApi).mockRejectedValue(new Error('boom') as never)
        vi.mocked(getExpiringApi).mockRejectedValue(new Error('boom') as never)
        const { wrapper } = await mountPage()
        const cards = wrapper.findAll('.stat-card')
        expect(cards[0]!.text()).toContain('-')
        expect(cards[1]!.text()).toContain('-')
        expect(cards[2]!.text()).toContain('-')
        expect(cards[3]!.text()).toContain('-')
    })
})

describe('AC1 四图表区（旧页路径 6-9）', () => {
    it('四张图表卡标题齐全，成本卡带上月年月标签', async () => {
        const { wrapper } = await mountPage()
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        const costMonth = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`
        const headings = wrapper.findAll('.panel-card__header h3').map((node) => node.text())
        expect(headings[0]).toBe('云厂商分布')
        expect(headings[1]).toBe('资产类型分布')
        expect(headings[2]).toBe('地域分布 TOP10')
        expect(headings[3]).toBe(`产品成本 TOP10（${costMonth}）`)
        expect(headings[4]).toBe('即将过期资源')
    })

    it('云厂商分布饼图：外置标签、#7170ff 打头色板、环心显示资产总数', async () => {
        await mountPage()
        const stub = stubWhere((option) => option.series?.[0]?.type === 'pie')
        expect(stub).toBeTruthy()
        const option = optionOf(stub!)
        const pie = option.series![0]!
        expect(pie.data![0]!.name).toBe(getProviderLabel('aws'))
        expect(pie.data![0]!.itemStyle!.color).toBe('#7170ff')
        expect(pie.data![1]!.itemStyle!.color).toBe('#d97706')
        expect(pie.emphasis).toBeTruthy()
        const centerText = option.graphic?.find((node) => node.type === 'text')
        expect(centerText?.style?.text).toBe('5123')
    })

    it('资产类型分布：单色条形 #7170ff、按数量降序、类型中文映射', async () => {
        await mountPage()
        const stub = stubWhere((option) => option.series?.[0]?.itemStyle?.color === '#7170ff')
        expect(stub).toBeTruthy()
        const option = optionOf(stub!)
        expect(option.yAxis!.data).toEqual(['OSS', 'RDS', '虚拟机'])
        expect(option.series![0]!.data).toEqual([500, 1200, 3000])
    })

    it('地域分布 TOP10：截取前 10、条形 #0891b2', async () => {
        await mountPage()
        const stub = stubWhere((option) => option.series?.[0]?.itemStyle?.color === '#0891b2')
        expect(stub).toBeTruthy()
        const option = optionOf(stub!)
        expect(option.yAxis!.data).toHaveLength(10)
        expect(option.yAxis!.data![0]).toBe('cn-region-10')
        expect(option.series![0]!.data).toHaveLength(10)
    })

    it('产品成本 TOP10：#8b5cf6、amount_cny 降序、超 10 项合并「其他」', async () => {
        await mountPage()
        const stub = stubWhere((option) => option.series?.[0]?.itemStyle?.color === '#8b5cf6')
        expect(stub).toBeTruthy()
        const option = optionOf(stub!)
        expect(option.yAxis!.data).toContain('其他 (2项)')
        expect(option.yAxis!.data).toHaveLength(11)
        expect(option.series![0]!.data).toEqual([300, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200])
        expect(typeof option.series![0]!.label!.formatter).toBe('function')
    })

    it('图表容器由 StateBlock 承载：成功态渲染四个容器且无骨架屏残留', async () => {
        const { wrapper } = await mountPage()
        expect(wrapper.findAll('.chart-container')).toHaveLength(4)
        expect(wrapper.find('.el-skeleton').exists()).toBe(false)
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    })
})

describe('AC1 即将过期资源表（旧页路径 10-11）', () => {
    it('7 列表头齐全，行渲染含类型/云厂商映射与格式化过期时间', async () => {
        const { wrapper } = await mountPage()
        const headerCells = wrapper.findAll('.el-table__header th .cell').map((node) => node.text())
        expect(headerCells).toEqual(expect.arrayContaining(['资源名称', '资源ID', '类型', '云厂商', '地域', '过期时间', '剩余天数']))
        const rows = wrapper.findAll('.el-table__body tbody tr')
        expect(rows).toHaveLength(3)
        expect(rows[0]!.text()).toContain('web-01')
        expect(rows[0]!.text()).toContain('虚拟机')
        expect(rows[0]!.text()).toContain(getProviderLabel('aws'))
        expect(rows[1]!.text()).toContain('RDS')
        expect(rows[2]!.text()).toContain('Redis')
        expect(rows[0]!.text()).toMatch(/\d{4}\/\d{1,2}\/\d{1,2}/)
    })

    it('剩余天数 tag 分级（danger/warning/info）与过期时间着色（expire-danger/expire-warning）', async () => {
        const { wrapper } = await mountPage()
        const rows = wrapper.findAll('.el-table__body tbody tr')
        expect(rows[0]!.find('.el-tag--danger').exists()).toBe(true)
        expect(rows[0]!.find('span.expire-danger').exists()).toBe(true)
        expect(rows[1]!.find('.el-tag--warning').exists()).toBe(true)
        expect(rows[1]!.find('span.expire-warning').exists()).toBe(true)
        expect(rows[2]!.find('.el-tag--info').exists()).toBe(true)
        expect(rows[2]!.find('span.expire-danger').exists()).toBe(false)
        expect(rows[2]!.find('span.expire-warning').exists()).toBe(false)
    })

    it('天数筛选 change 后以新窗口重新拉取（7/30/90）', async () => {
        const { wrapper } = await mountPage()
        expect(getExpiringApi).toHaveBeenCalledWith(expect.objectContaining({ days: 30, limit: 20 }))
        vi.mocked(getExpiringApi).mockClear()
        const select = wrapper.findComponent({ name: 'ElSelect' })
        expect(select.exists()).toBe(true)
        ;(select.vm as unknown as { $emit: (event: string, ...args: unknown[]) => void }).$emit('update:modelValue', 7)
        ;(select.vm as unknown as { $emit: (event: string, ...args: unknown[]) => void }).$emit('change', 7)
        await flushPromises()
        expect(getExpiringApi).toHaveBeenCalledWith(expect.objectContaining({ days: 7, limit: 20 }))
    })

    it('过期列表为空或失败时呈现对应 empty-text（等价旧页双文案）', async () => {
        vi.mocked(getExpiringApi).mockRejectedValue(new Error('boom') as never)
        const { wrapper } = await mountPage()
        expect(wrapper.find('.el-table__empty-text').text()).toBe('加载失败，请切换天数后重试')
    })
})

describe('AC1 错误反馈与生命周期（旧页路径 12-13）', () => {
    it('五处拉取失败：toast 提示 + StateBlock 错误态文案与重试按钮', async () => {
        const spy = vi.spyOn(ElMessage, 'error').mockImplementation((() => ({ close: () => {} })) as never)
        vi.mocked(getOverviewApi).mockRejectedValue(new Error('boom') as never)
        vi.mocked(getGlobalAssetStatsApi).mockRejectedValue(new Error('boom') as never)
        vi.mocked(getByRegionApi).mockRejectedValue(new Error('boom') as never)
        vi.mocked(getCostDistributionApi).mockRejectedValue(new Error('boom') as never)
        vi.mocked(getExpiringApi).mockRejectedValue(new Error('boom') as never)
        const { wrapper } = await mountPage()
        expect(spy).toHaveBeenCalledTimes(5)
        const alerts = wrapper.findAll('[role="alert"]')
        expect(alerts).toHaveLength(4)
        const alertText = alerts.map((node) => node.text()).join('|')
        expect(alertText).toContain('获取总览数据失败')
        expect(alertText).toContain('资产类别统计加载失败')
        expect(alertText).toContain('地域统计加载失败')
        expect(alertText).toContain('产品成本分布加载失败')
        expect(wrapper.findAll('.state-block__retry')).toHaveLength(4)
    })

    it('错误态重试：接口恢复后点击重试，图表与统计卡恢复渲染', async () => {
        const spy = vi.spyOn(ElMessage, 'error').mockImplementation((() => ({ close: () => {} })) as never)
        vi.mocked(getOverviewApi).mockRejectedValueOnce(new Error('boom') as never)
        const { wrapper } = await mountPage()
        expect(wrapper.findAll('[role="alert"]')).toHaveLength(1)
        expect(wrapper.findAll('.chart-container')).toHaveLength(3)
        vi.mocked(getOverviewApi).mockResolvedValue(overviewPayload as never)
        await wrapper.find('.state-block__retry').trigger('click')
        await flushPromises()
        await nextTick()
        expect(wrapper.findAll('[role="alert"]')).toHaveLength(0)
        expect(wrapper.findAll('.chart-container')).toHaveLength(4)
        const cards = wrapper.findAll('.stat-card')
        expect(cards[0]!.text()).toContain('5.1k')
        const stub = stubWhere((option) => option.series?.[0]?.type === 'pie')
        expect(stub).toBeTruthy()
        expect(spy).toHaveBeenCalledTimes(1)
    })

    it('成本数据为空：StateBlock 空态文案「暂无成本数据」，不初始化图表', async () => {
        vi.mocked(getCostDistributionApi).mockResolvedValue({ data: [] } as never)
        const { wrapper } = await mountPage()
        const panels = wrapper.findAll('section.panel-card')
        expect(panels[3]!.text()).toContain('暂无成本数据')
        expect(panels[3]!.find('.chart-container').exists()).toBe(false)
        expect(wrapper.findAll('.chart-container')).toHaveLength(3)
    })

    it('窗口 resize 触发四图重绘；组件卸载触发四图 dispose', async () => {
        const { wrapper } = await mountPage()
        const stubs = [...(chartStubs as unknown as ChartStub[])]
        expect(stubs).toHaveLength(4)
        window.dispatchEvent(new Event('resize'))
        expect(stubs.every((stub) => (stub.resize as { mock: { calls: unknown[] } }).mock.calls.length >= 1)).toBe(true)
        wrappers.splice(wrappers.indexOf(wrapper), 1)
        wrapper.unmount()
        expect(stubs.every((stub) => (stub.dispose as { mock: { calls: unknown[] } }).mock.calls.length >= 1)).toBe(true)
    })

    it('双主题：切换主题后四图以新令牌重渲（dispose+init），系列色不变', async () => {
        const { wrapper } = await mountPage()
        expect(chartStubs).toHaveLength(4)
        const appStore = useAppStore()
        appStore.theme = 'light'
        await nextTick()
        await nextTick()
        expect(chartStubs).toHaveLength(8)
        // 重渲后饼图系列色仍是迁移后的靛紫打头
        const pie = stubWhere((option) => option.series?.[0]?.type === 'pie')
        expect(pie).toBeTruthy()
        expect(optionOf(pie!).series![0]!.data![0]!.itemStyle!.color).toBe('#7170ff')
        expect(wrapper.findAll('.chart-container')).toHaveLength(4)
    })
})

// ==================== AC2：scoped 样式与硬编码色守卫 ====================

describe('AC2 scoped 样式 <100 行 + 零新增硬编码色', () => {
    const pageRaw = async (): Promise<string> => (await import('./index.vue?raw')).default

    it('style 块行数 <100 且只消费令牌（布局微调）', async () => {
        const raw = await pageRaw()
        const match = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)
        expect(match).toBeTruthy()
        const styleBody = match![1]!
        expect(styleBody.split('\n').length).toBeLessThan(100)
        // 页面自有卡面走 --bg-surface/--border-subtle 令牌（AC3 计算样式断言的对象）
        expect(styleBody).toContain('var(--bg-surface)')
        expect(styleBody).toContain('var(--border-subtle)')
        // 过期着色消费 accent 令牌，不再落 hex
        expect(styleBody).toContain('var(--accent-red)')
        expect(styleBody).toContain('var(--accent-yellow)')
    })

    it('页面色字面量 ⊆ 旧页基线（零新增），且无旧蓝 #3b82f6 系', async () => {
        // 旧版 index.vue（HEAD 基线，fc0b2e4 迁移后）的全部颜色字面量盘点
        const OLD_PAGE_COLORS = new Set([
            '#7170ff', '#d97706', '#0891b2', '#16a34a', '#8b5cf6',
            'rgba(23,23,23,0.95)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)',
            '#fafafa', '#d4d4d8', '#71717a', '#a1a1aa',
            '#818cf8', '#fbbf24', '#4ade80', '#f87171',
            'rgba(113,112,255,0.14)', 'rgba(217,119,6,0.16)', 'rgba(22,163,74,0.16)', 'rgba(239,68,68,0.14)',
            '#ef4444', '#f59e0b',
        ])
        const raw = await pageRaw()
        const colors = (raw.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []).map((color) => color.toLowerCase())
        const unknown = colors.filter((color) => !OLD_PAGE_COLORS.has(color))
        expect(unknown).toEqual([])
        expect(colors.some((color) => color.includes('3b82f6'))).toBe(false)
    })
})
