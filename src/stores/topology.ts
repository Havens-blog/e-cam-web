import type { DomainItem, TopoGraph, TopoNode, TopologyQueryParams } from '@/api/types/topology'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 拓扑视图状态管理
 */
export const useTopologyStore = defineStore('topology', () => {
    // 筛选条件
    const selectedDomain = ref<string>('')
    const selectedProviders = ref<string[]>([])
    const selectedSourceCollectors = ref<string[]>([])
    const hideSilent = ref(false)
    const showBrokenOnly = ref(false)
    const showInternalCalls = ref(true)
    const showApmEdges = ref(true)

    // 布局模式
    const layoutMode = ref<'dag' | 'force'>('dag')

    // 选中节点
    const selectedNodeId = ref<string | null>(null)

    // 详情面板
    const detailPanelOpen = ref(false)

    // 缓存数据
    const graphData = ref<TopoGraph | null>(null)
    const domainList = ref<DomainItem[]>([])
    const loading = ref(false)

    // 数据状态：idle=未加载 loading=加载中 live=真实数据加载成功 error=加载失败
    // 用于徽章联动与空态/错误态区分，杜绝失败时误显「实时」
    const dataStatus = ref<'idle' | 'loading' | 'live' | 'error'>('idle')

    // 最近一次加载失败的错误信息（成功加载后清除；null=无错误）
    const loadError = ref<string | null>(null)

    // 计算属性：当前筛选参数
    const queryParams = computed<TopologyQueryParams>(() => ({
        mode: 'business',
        domain: selectedDomain.value || undefined,
        provider: selectedProviders.value.length > 0 ? selectedProviders.value.join(',') : undefined,
        source_collector: selectedSourceCollectors.value.length > 0 ? selectedSourceCollectors.value.join(',') : undefined,
        hide_silent: hideSilent.value || undefined,
    }))

    // 计算属性：过滤后的节点（前端内存过滤）
    const filteredNodes = computed<TopoNode[]>(() => {
        if (!graphData.value) return []
        let nodes = graphData.value.nodes || []

        if (showBrokenOnly.value) {
            const brokenIds = new Set<string>()
            // 找断链节点
            for (const n of nodes) {
                if (n.attributes?.is_broken) brokenIds.add(n.id)
            }
            // 找 pending 边关联的节点
            for (const e of (graphData.value.edges || [])) {
                if (e.status === 'pending') {
                    brokenIds.add(e.source_id)
                    brokenIds.add(e.target_id)
                }
            }
            nodes = nodes.filter(n => brokenIds.has(n.id))
        }

        return nodes
    })

    // Actions
    function selectNode(nodeId: string | null) {
        selectedNodeId.value = nodeId
        detailPanelOpen.value = nodeId !== null
    }

    function closeDetailPanel() {
        detailPanelOpen.value = false
        selectedNodeId.value = null
    }

    function toggleLayout() {
        layoutMode.value = layoutMode.value === 'dag' ? 'force' : 'dag'
    }

    function resetFilters() {
        selectedDomain.value = ''
        selectedProviders.value = []
        selectedSourceCollectors.value = []
        hideSilent.value = false
        showBrokenOnly.value = false
        showInternalCalls.value = true
        showApmEdges.value = true
    }

    return {
        selectedDomain, selectedProviders, selectedSourceCollectors,
        hideSilent, showBrokenOnly, showInternalCalls, showApmEdges, layoutMode,
        selectedNodeId, detailPanelOpen,
        graphData, domainList, loading, dataStatus, loadError,
        queryParams, filteredNodes,
        selectNode, closeDetailPanel, toggleLayout, resetFilters,
    }
})
