<template>
  <div class="canvas-wrapper" v-loading="store.loading">
    <!-- Stats bar -->
    <div v-if="store.graphData" class="stats-bar">
      <i class="fas fa-route"></i>
      节点 <strong>{{ store.graphData.stats.node_count }}</strong> |
      连线 <strong>{{ store.graphData.stats.edge_count }}</strong> |
      域名 <strong>{{ store.graphData.stats.domain_count }}</strong>
      <span v-if="store.graphData.stats.broken_count > 0" class="broken-count">
        | 断链 <strong>{{ store.graphData.stats.broken_count }}</strong>
      </span>
    </div>
    <!-- Empty state -->
    <div v-if="!store.loading && (!store.graphData || store.graphData.nodes.length === 0)" class="empty-state">
      <template v-if="!store.selectedDomain">
        <el-icon :size="56" color="#a78bfa"><Connection /></el-icon>
        <div class="empty-title">选择入口域名查看链路拓扑</div>
        <div class="empty-desc">在左侧筛选面板输入或选择域名，查看该域名的全链路拓扑</div>
      </template>
      <template v-else>
        <el-icon :size="48"><Share /></el-icon>
        <div class="empty-title">暂无拓扑数据</div>
        <div class="empty-desc">该域名暂未发现关联的云资源链路</div>
      </template>
    </div>
    <!-- ECharts container -->
    <div ref="chartRef" class="chart-container"></div>
  </div>
</template>

<script setup lang="ts">
import { useTopologyStore } from '@/stores/topology'
import { Connection, Share } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { buildChartOption } from '../composables/useTopologyChart'

const emit = defineEmits<{ 'select-node': [nodeId: string] }>()
const store = useTopologyStore()
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let renderTimer: ReturnType<typeof setTimeout> | null = null
let flowTimer: ReturnType<typeof setInterval> | null = null
let flowOffset = 0

function initChart() {
  if (!chartRef.value) return
  if (chart) { chart.dispose(); chart = null }
  chart = echarts.init(chartRef.value, undefined, { renderer: 'canvas' })
  chart.on('click', (params: any) => {
    if (params.dataType === 'node' && params.data?.id) {
      emit('select-node', params.data.id)
    }
  })
}

function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => {
    if (!chart || !store.graphData || store.graphData.nodes.length === 0) return
    const option = buildChartOption(store.graphData, store.layoutMode)
    chart.setOption(option, true)
    startFlowAnimation()
  }, 50)
}

function startFlowAnimation() {
  if (flowTimer) clearInterval(flowTimer)
  flowOffset = 0
  flowTimer = setInterval(() => {
    if (!chart) return
    flowOffset -= 1
    chart.setOption({
      series: [{ lineStyle: { dashOffset: flowOffset } }]
    }, false)
  }, 80)
}

let resizeTimer: ReturnType<typeof setTimeout> | null = null
function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => { chart?.resize() }, 150)
}
function zoomIn() { chart?.dispatchAction({ type: 'graphRoam', zoom: 1.2 }) }
function zoomOut() { chart?.dispatchAction({ type: 'graphRoam', zoom: 0.8 }) }
function fitView() { setTimeout(() => { chart?.resize(); scheduleRender() }, 50) }

defineExpose({ zoomIn, zoomOut, fitView })

watch(() => store.graphData, () => {
  if (!chart && chartRef.value) initChart()
  scheduleRender()
}, { deep: true, flush: 'post' })

watch(() => store.layoutMode, () => { scheduleRender() }, { flush: 'post' })

onMounted(() => {
  setTimeout(() => {
    initChart()
    scheduleRender()
  }, 100)
  window.addEventListener('resize', handleResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (renderTimer) clearTimeout(renderTimer)
  if (resizeTimer) clearTimeout(resizeTimer)
  if (flowTimer) clearInterval(flowTimer)
  chart?.dispose()
})
</script>

<style scoped>
.canvas-wrapper { position: relative; width: 100%; height: 100%; background: var(--bg-base); overflow: hidden; }
.chart-container { width: 100%; height: 100%; }
.stats-bar { position: absolute; top: 14px; left: 14px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 8px 14px; font-size: 12px; color: var(--text-secondary); z-index: 10; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(10px); }
.stats-bar strong { color: var(--text-primary); font-size: 16px; }
.broken-count { color: var(--accent-red); }
.broken-count strong { color: var(--accent-red); }
.empty-state { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-tertiary); z-index: 5; }
.empty-title { font-size: 16px; font-weight: 600; }
.empty-desc { font-size: 13px; }
</style>
