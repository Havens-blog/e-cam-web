// @vitest-environment happy-dom
/**
 * 服务树总览二期可见性单测（servicetree-overhaul-p1p2 任务 7）：
 * AC1 树节点子树资产数徽标（非 0 高亮 / 0 灰显）+ 节点详情与徽标一致；
 * AC2 关联资产 tab 聚合语义（include_children 默认开 + 来源节点列）；
 * AC3 环境疑异资产行标红 + tooltip 疑异原因。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ServiceTreePage from '../index.vue'

vi.mock('@/api/service-tree', () => ({
    bindResourceApi: vi.fn(),
    deleteNodeApi: vi.fn(),
    getNodeAssetSummaryApi: vi.fn(),
    listEnvironmentsApi: vi.fn(),
    listNodeAssetsApi: vi.fn(),
    listNodeBindingsApi: vi.fn(),
    listNodesApi: vi.fn(),
    unbindResourceApi: vi.fn(),
    batchBindResourceApi: vi.fn(),
    createEnvironmentApi: vi.fn()
}))
vi.mock('@/api', () => ({
    listAssetsApi: vi.fn(),
    listCmdbInstancesApi: vi.fn()
}))

// 子组件替身：屏蔽 cascading 依赖，本单测只关注总览页自身逻辑
vi.mock('../components/NodeFormDialog.vue', () => ({ default: { name: 'NodeFormDialog', template: '<div />' } }))
vi.mock('../components/MoveNodeDialog.vue', () => ({ default: { name: 'MoveNodeDialog', template: '<div />' } }))
vi.mock('../components/BindResourceDialog.vue', () => ({ default: { name: 'BindResourceDialog', template: '<div />' } }))
vi.mock('../components/UnbindConfirmDialog.vue', () => ({ default: { name: 'UnbindConfirmDialog', template: '<div />' } }))
vi.mock('../components/ResourceDetailDrawer.vue', () => ({
    default: { name: 'ResourceDetailDrawer', template: '<div />' }
}))

import {
    getNodeAssetSummaryApi,
    listEnvironmentsApi,
    listNodeAssetsApi,
    listNodeBindingsApi,
    listNodesApi
} from '@/api/service-tree'
import { listAssetsApi } from '@/api'
import type { AssetSummary, ServiceTreeNode } from '@/api/types/service-tree'

// ==================== mock 数据 ====================

const nodes: ServiceTreeNode[] = [
    { id: 1, name: 'SMT订单', parent_id: 0, level: 1, order: 1, status: 1 },
    { id: 2, name: '生产环境', parent_id: 1, level: 2, order: 1, status: 1 },
    { id: 3, name: '开发环境', parent_id: 1, level: 2, order: 2, status: 1 }
]

const summaryOf = (total: number, suspicious: AssetSummary['suspicious']): AssetSummary => ({
    total,
    by_environment: {},
    by_provider: {},
    by_type: total > 0 ? { ecs: total } : {},
    by_bind_type: {},
    suspicious
})

const prodMisbound: AssetSummary['suspicious'] = [
    {
        asset_id: 'i-prod-1',
        asset_name: 'web-prod-01',
        bound_env_id: 1,
        bound_env_code: 'dev',
        reason: '命名含 prod 却绑定 dev 环境'
    }
]

const summaryById = new Map<number, AssetSummary>([
    [1, summaryOf(12, prodMisbound)],
    [2, summaryOf(12, prodMisbound)],
    [3, summaryOf(0, [])]
])

const bindingsPayload = {
    data: {
        list: [
            {
                id: 11,
                node_id: 1,
                env_id: 1,
                resource_type: 'asset',
                resource_id: 100,
                bind_type: 'rule'
            }
        ],
        total: 1
    }
}

const nodeAssetsPayload = {
    data: {
        items: [
            {
                binding_id: 11,
                node_id: 2,
                env_id: 1,
                bind_type: 'rule',
                id: 100,
                asset_id: 'i-prod-1',
                asset_name: 'web-prod-01',
                asset_type: 'ecs',
                provider: 'aliyun',
                region: 'cn-hangzhou',
                status: 'running',
                account_id: 1,
                attributes: {},
                create_time: 0,
                update_time: 0
            }
        ],
        total: 1
    }
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

class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

const wrappers: VueWrapper[] = []

async function mountPage(): Promise<VueWrapper> {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(ServiceTreePage, {
        attachTo: document.body,
        global: { plugins: [pinia, ElementPlus] }
    })
    wrappers.push(wrapper)
    await flushPromises()
    await nextTick()
    return wrapper
}

beforeEach(() => {
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vi.mocked(listNodesApi).mockResolvedValue({ data: { list: nodes, total: nodes.length } } as never)
    vi.mocked(listEnvironmentsApi).mockResolvedValue({
        data: { list: [{ id: 1, code: 'dev', name: '开发', color: '#aaaaaa', order: 1, status: 1 }] }
    } as never)
    vi.mocked(getNodeAssetSummaryApi).mockImplementation(async (_nodeId: number) => {
        return { data: summaryById.get(_nodeId) ?? summaryOf(0, []) } as never
    })
    vi.mocked(listNodeBindingsApi).mockResolvedValue(bindingsPayload as never)
    vi.mocked(listAssetsApi).mockResolvedValue({
        data: {
            assets: [
                {
                    id: 100,
                    asset_id: 'i-prod-1',
                    asset_name: 'web-prod-01',
                    asset_type: 'ecs',
                    provider: 'aliyun',
                    region: 'cn-hangzhou',
                    status: 'running'
                }
            ]
        }
    } as never)
    vi.mocked(listNodeAssetsApi).mockResolvedValue(nodeAssetsPayload as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

// ==================== AC1：树节点徽标 + 详情一致 ====================

describe('AC1 树节点子树资产数徽标', () => {
    it('非 0 节点显示数字徽标，0 节点灰显徽标', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        const badges = wrapper.findAll('.node-badge')
        expect(badges.length).toBe(3)
        const texts = badges.map((b) => b.text())
        expect(texts).toContain('12')
        expect(texts).toContain('0')
        const zeroBadges = wrapper.findAll('.node-badge--zero')
        expect(zeroBadges.length).toBe(1)
        expect(zeroBadges[0]!.text()).toBe('0')
    })

    it('选中节点详情子树资产数与徽标一致', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        // 默认选中第一个根节点（SMT订单，徽标 12），详情卡应显示同源数字
        const infoCard = wrapper.find('.node-info-card')
        expect(infoCard.exists()).toBe(true)
        expect(infoCard.text()).toContain('子树资产')
        expect(infoCard.text()).toContain('12')
    })
})

// ==================== AC2：关联资产 tab 聚合语义 ====================

describe('AC2 关联资产聚合语义', () => {
    it('切换关联资产 tab 默认含子节点聚合查询', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        const tabs = wrapper.findAll('.el-tabs__item')
        await tabs[1]!.trigger('click')
        await flushPromises()
        expect(vi.mocked(listNodeAssetsApi)).toHaveBeenCalled()
        const args = vi.mocked(listNodeAssetsApi).mock.calls.at(-1)!
        expect(args[1]?.include_children).toBe(true)
    })

    it('聚合视图显示来源节点列并映射节点名', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        const tabs = wrapper.findAll('.el-tabs__item')
        await tabs[1]!.trigger('click')
        await flushPromises()
        const headers = wrapper.findAll('.el-tabs__content th')
        expect(headers.some((h) => h.text() === '来源节点')).toBe(true)
        // row.node_id = 2 应映射为「生产环境」而非裸 ID
        const cells = wrapper.findAll('.el-tabs__content td')
        expect(cells.some((c) => c.text() === '生产环境')).toBe(true)
    })
})

// ==================== AC3：环境疑异标红 + tooltip ====================

describe('AC3 环境疑异标红', () => {
    it('绑定资源表中疑异资产行标红，tooltip 携带疑异原因', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        const suspiciousRows = wrapper.findAll('.el-tabs__content tr.suspicious-row')
        expect(suspiciousRows.length).toBeGreaterThan(0)
        const tooltipContents = wrapper.findAllComponents({ name: 'ElTooltip' }).map((t) => String(t.props('content') ?? ''))
        expect(tooltipContents.some((c) => c.includes('命名含 prod 却绑定 dev 环境'))).toBe(true)
    })

    it('疑异清单渲染醒目提示条', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        expect(wrapper.find('.suspicious-alert').exists()).toBe(true)
        expect(wrapper.find('.suspicious-alert').text()).toContain('1')
    })

    it('关联资产表中疑异行同样标红', async () => {
        const wrapper = await mountPage()
        await flushPromises()
        const tabs = wrapper.findAll('.el-tabs__item')
        await tabs[1]!.trigger('click')
        await flushPromises()
        expect(wrapper.findAll('.el-tabs__content tr.suspicious-row').length).toBeGreaterThan(0)
    })
})
