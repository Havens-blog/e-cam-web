import { getTopologyApi, getTopologyDomainsApi } from '@/api/topology'
import type { TopologyQueryParams } from '@/api/types/topology'
import { useTopologyStore } from '@/stores/topology'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

/**
 * 拓扑数据获取与筛选逻辑
 * API 失败时记录错误状态并保持空数据（诚实错误态，不回退假数据）
 * 后端返回空数据时正常显示空状态，与加载失败严格区分
 */
export function useTopologyData() {
    const store = useTopologyStore()
    const { queryParams, loading, graphData, domainList, dataStatus, loadError } = storeToRefs(store)

    function toErrorMessage(e: unknown): string {
        return e instanceof Error ? e.message : String(e)
    }

    async function loadDomains() {
        try {
            const res = await getTopologyDomainsApi()
            const data = (res as any)?.data || res
            domainList.value = (data?.domains || data || []).filter((i: any) => i != null)
        } catch (e) {
            console.warn('[Topology] Domains API failed:', e)
            domainList.value = []
            loadError.value = `域名列表加载失败（${toErrorMessage(e)}），后端未启动或接口异常，请刷新重试`
        }
    }

    async function loadTopology(params?: TopologyQueryParams) {
        const p = params || queryParams.value
        loading.value = true
        dataStatus.value = 'loading'
        loadError.value = null
        try {
            const res = await getTopologyApi(p)
            const data = (res as any)?.data || res
            graphData.value = {
                nodes: (data?.nodes || []).filter((n: any) => n != null),
                edges: (data?.edges || []).filter((e: any) => e != null),
                stats: data?.stats || { node_count: 0, edge_count: 0, domain_count: 0, broken_count: 0, max_depth: 0 },
            }
            dataStatus.value = 'live'
        } catch (e) {
            console.warn('[Topology] Topology API failed:', e)
            graphData.value = null
            dataStatus.value = 'error'
            loadError.value = `拓扑数据加载失败（${toErrorMessage(e)}），后端未启动或接口异常，请刷新重试`
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
