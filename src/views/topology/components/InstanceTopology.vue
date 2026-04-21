<template>
  <div class="instance-topo" v-loading="loading">
    <div v-if="!loading && (!graph || graph.nodes.length === 0)" class="empty-state">
      <el-icon :size="40"><Share /></el-icon>
      <div>暂无实例拓扑数据</div>
    </div>
    <div ref="chartRef" class="topo-chart"></div>
  </div>
</template>

<script setup lang="ts">
import { getTopologyApi } from '@/api/topology'
import type { TopoEdge, TopoGraph, TopoNode } from '@/api/types/topology'
import { Share } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getNodeColor } from './../../topology/composables/useTopologyChart'

const props = defineProps<{ resourceId: string }>()
const router = useRouter()
const chartRef = ref<HTMLDivElement | null>(null)
const loading = ref(false)
const graph = ref<TopoGraph | null>(null)
let chart: echarts.ECharts | null = null

async function loadData() {
  if (!props.resourceId) return
  loading.value = true
  try {
    const res = await getTopologyApi({ mode: 'instance', resource_id: props.resourceId })
    graph.value = ((res as any)?.data || res) as TopoGraph
    renderChart()
  } catch { graph.value = null }
  finally { loading.value = false }
}

function toTreeData(nodes: TopoNode[], edges: TopoEdge[], rootId: string): any {
  const childMap = new Map<string, string[]>()
  for (const e of edges) {
    const children = childMap.get(e.source_id) ?? []
    children.push(e.target_id)
    childMap.set(e.source_id, children)
  }
  const nodeMap = new Map<string, TopoNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  function build(id: string, visited: Set<string>): any {
    if (visited.has(id)) return null
    visited.add(id)
    const node = nodeMap.get(id)
    if (!node) return null
    const kids = (childMap.get(id) ?? []).map(cid => build(cid, visited)).filter(Boolean)
    return {
      name: node.name, value: node.id, type: node.type,
      itemStyle: { color: getNodeColor(node), borderColor: getNodeColor(node) },
      children: kids.length > 0 ? kids : undefined,
    }
  }
  return build(rootId, new Set())
}

function renderChart() {
  if (!chart || !graph.value || graph.value.nodes.length === 0) return
  const treeData = toTreeData(graph.value.nodes, graph.value.edges, props.resourceId)
  if (!treeData) return
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: 'rgba(26,34,54,.95)', textStyle: { color: '#f1f5f9', fontSize: 12 } },
    series: [{
      type: 'tree', layout: 'orthogonal', orient: 'LR',
      data: [treeData],
      symbolSize: 14, initialTreeDepth: 3,
      label: { position: 'right', fontSize: 11, color: '#94a3b8', distance: 8 },
      leaves: { label: { position: 'right' } },
      lineStyle: { color: 'rgba(255,255,255,0.1)', width: 1.5 },
      expandAndCollapse: true,
      animationDuration: 300,
    }],
  }, true)
}

function handleResize() { chart?.resize() }

watch(() => props.resourceId, loadData)
onMounted(() => {
  if (chartRef.value) chart = echarts.init(chartRef.value)
  chart?.on('dblclick', (p: any) => { if (p.data?.value) router.push(`/assets/${p.data.value}?tab=topology`) })
  window.addEventListener('resize', handleResize)
  loadData()
})
onUnmounted(() => { window.removeEventListener('resize', handleResize); chart?.dispose() })
</script>

<style scoped>
.instance-topo { width: 100%; height: 400px; position: relative; }
.topo-chart { width: 100%; height: 100%; }
.empty-state { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #64748b; font-size: 13px; }
</style>
