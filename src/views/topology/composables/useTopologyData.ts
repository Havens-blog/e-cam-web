import { getTopologyApi, getTopologyDomainsApi } from '@/api/topology'
import type { TopologyQueryParams } from '@/api/types/topology'
import { useTopologyStore } from '@/stores/topology'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { MOCK_DOMAINS, MOCK_GRAPH } from './useMockData'

/**
 * 拓扑数据获取与筛选逻辑
 * 后端 API 请求失败时（网络错误/格式错误）才 fallback 到 mock
 * 后端返回空数据时正常显示空状态
 */
export function useTopologyData() {
    const store = useTopologyStore()
    const { queryParams, loading, graphData, domainList } = storeToRefs(store)

    async function loadDomains() {
        try {
            const res = await getTopologyDomainsApi()
            const data = (res as any)?.data || res
            domainList.value = (data?.domains || data || []).filter((i: any) => i != null)
        } catch {
            console.warn('[Topology] Domains API unavailable, using mock')
            domainList.value = MOCK_DOMAINS
        }
    }

    async function loadTopology(params?: TopologyQueryParams) {
        const p = params || queryParams.value
        loading.value = true
        try {
            const res = await getTopologyApi(p)
            const data = (res as any)?.data || res
            graphData.value = {
                nodes: (data?.nodes || []).filter((n: any) => n != null),
                edges: (data?.edges || []).filter((e: any) => e != null),
                stats: data?.stats || { node_count: 0, edge_count: 0, domain_count: 0, broken_count: 0, max_depth: 0 },
            }
        } catch {
            console.warn('[Topology] Topology API unavailable, using mock')
            graphData.value = MOCK_GRAPH
        } finally {
            loading.value = false
        }
    }

    async function refresh() {
        await loadDomains()
        // 强制刷新：传 refresh=true，后端会清除缓存数据并重新从云 API 构建
        const p = { ...queryParams.value, refresh: true }
        await loadTopology(p)
    }

    // 筛选条件变化时自动加载
    watch(queryParams, () => {
        loadTopology()
    }, { deep: true })

    return { loadDomains, loadTopology, refresh }
}
