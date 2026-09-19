/**
 * Feature: topology-mock-removal, 移除 mock 回退后的诚实错误态
 *
 * Validates: 拓扑页移除 mock 回退（task 1）
 *
 * - 拓扑/域名 API 失败 → dataStatus='error'（或保持非实时）+ loadError 提示 + 数据置空，无 mock 残留
 * - API 成功 → dataStatus='live'；后端返回空数据 → 正常空态，不误报错误
 * - 加载中 → dataStatus='loading'，不误显实时；失败后重试成功 → 错误状态正确清除
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as topologyApi from '@/api/topology'
import type { ResponseData } from '@/api/request/types'
import type { TopoGraph, TopoNode } from '@/api/types/topology'
import { useTopologyStore } from '@/stores/topology'
import { useTopologyData } from './useTopologyData'

vi.mock('@/api/topology', () => ({
    getTopologyApi: vi.fn(),
    getTopologyDomainsApi: vi.fn(),
}))

const mockedGetTopologyApi = vi.mocked(topologyApi.getTopologyApi)
const mockedGetTopologyDomainsApi = vi.mocked(topologyApi.getTopologyDomainsApi)

/** 构造拓扑节点（仅含测试关注字段） */
function makeNode(id: string, name: string): TopoNode {
    return { id, name, type: 'dns_record' } as TopoNode
}

/** 构造后端成功返回的拓扑图响应 */
function makeGraphResponse(nodes: TopoNode[] = []): ResponseData<TopoGraph> {
    return {
        code: 0,
        data: {
            nodes,
            edges: [],
            stats: { node_count: nodes.length, edge_count: 0, domain_count: 0, broken_count: 0, max_depth: 0 },
        },
        message: 'ok',
    }
}

beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
})

describe('useTopologyData 诚实错误态', () => {
    it('初始状态为 idle 且无错误', () => {
        const store = useTopologyStore()
        expect(store.dataStatus).toBe('idle')
        expect(store.loadError).toBeNull()
    })

    it('拓扑 API 失败：dataStatus=error、loadError 指引刷新、graphData 置空且无 mock 假数据', async () => {
        mockedGetTopologyApi.mockRejectedValueOnce(new Error('Network Error'))
        const store = useTopologyStore()
        const { loadTopology } = useTopologyData()

        await loadTopology()

        expect(store.dataStatus).toBe('error')
        expect(store.loadError).toContain('拓扑数据加载失败')
        expect(store.loadError).toContain('Network Error')
        expect(store.loadError).toContain('请刷新重试')
        expect(store.graphData).toBeNull()
        expect(JSON.stringify(store.graphData)).not.toContain('example.com')
        expect(store.loading).toBe(false)
    })

    it('域名 API 失败：domainList 置空、loadError 记录、无 mock 域名', async () => {
        mockedGetTopologyDomainsApi.mockRejectedValueOnce(new Error('Network Error'))
        const store = useTopologyStore()
        const { loadDomains } = useTopologyData()

        await loadDomains()

        expect(store.domainList).toEqual([])
        expect(store.loadError).toContain('域名列表加载失败')
        expect(store.loadError).toContain('请刷新重试')
    })

    it('拓扑 API 成功：dataStatus=live、loadError 清空、graphData 为真实数据', async () => {
        mockedGetTopologyApi.mockResolvedValueOnce(makeGraphResponse([makeNode('dns-real', 'api.real-domain.com')]))
        const store = useTopologyStore()
        const { loadTopology } = useTopologyData()

        await loadTopology()

        expect(store.dataStatus).toBe('live')
        expect(store.loadError).toBeNull()
        expect(store.graphData?.nodes).toHaveLength(1)
        expect(store.graphData?.nodes[0]?.id).toBe('dns-real')
    })

    it('后端返回空数据：live 状态 + 空数据，不误报错误', async () => {
        mockedGetTopologyApi.mockResolvedValueOnce(makeGraphResponse([]))
        const store = useTopologyStore()
        const { loadTopology } = useTopologyData()

        await loadTopology()

        expect(store.dataStatus).toBe('live')
        expect(store.loadError).toBeNull()
        expect(store.graphData?.nodes).toEqual([])
    })

    it('加载中 dataStatus=loading，完成后转 live，不误显实时', async () => {
        let resolveApi!: (value: ResponseData<TopoGraph>) => void
        mockedGetTopologyApi.mockImplementationOnce(() => new Promise(resolve => { resolveApi = resolve }))
        const store = useTopologyStore()
        const { loadTopology } = useTopologyData()

        const pending = loadTopology()
        expect(store.dataStatus).toBe('loading')
        expect(store.loadError).toBeNull()

        resolveApi(makeGraphResponse([]))
        await pending
        expect(store.dataStatus).toBe('live')
    })

    it('失败后 refresh 重试成功：错误状态正确清除并转 live', async () => {
        mockedGetTopologyDomainsApi.mockResolvedValue({ data: { domains: [] } } as any)
        mockedGetTopologyApi
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce(makeGraphResponse([makeNode('dns-real', 'api.real-domain.com')]))
        const store = useTopologyStore()
        const { refresh } = useTopologyData()

        await refresh()
        expect(store.dataStatus).toBe('error')
        expect(store.loadError).not.toBeNull()

        await refresh()
        expect(store.dataStatus).toBe('live')
        expect(store.loadError).toBeNull()
        expect(store.graphData?.nodes[0]?.id).toBe('dns-real')
    })
})
