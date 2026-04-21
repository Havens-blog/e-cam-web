<template>
  <div class="topology-page">
    <!-- 顶部工具栏 -->
    <div class="topology-toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">业务链路拓扑</h2>
        <div class="live-indicator">
          <span class="live-dot"></span>
          <span class="live-text">实时</span>
        </div>
      </div>
      <div class="toolbar-right">
        <el-button size="small" @click="handleRefresh">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
        <el-divider direction="vertical" />
        <el-button size="small" circle title="放大" @click="handleZoomIn">
          <el-icon><ZoomIn /></el-icon>
        </el-button>
        <el-button size="small" circle title="缩小" @click="handleZoomOut">
          <el-icon><ZoomOut /></el-icon>
        </el-button>
        <el-button size="small" circle title="适应画布" @click="handleFitView">
          <el-icon><FullScreen /></el-icon>
        </el-button>
        <el-divider direction="vertical" />
        <el-radio-group v-model="store.layoutMode" size="small">
          <el-radio-button value="dag">DAG分层</el-radio-button>
          <el-radio-button value="force">力导向</el-radio-button>
        </el-radio-group>
        <el-divider direction="vertical" />
        <el-button size="small" :type="store.hideSilent ? 'primary' : 'default'" @click="store.hideSilent = !store.hideSilent">
          <el-icon><Hide /></el-icon> 隐藏沉默
        </el-button>
      </div>
    </div>

    <!-- 三栏布局 -->
    <div class="topology-content">
      <FilterPanel class="topology-filter" />
      <TopologyCanvas
        ref="canvasRef"
        class="topology-canvas"
        @select-node="handleSelectNode"
      />
      <DetailPanel
        v-if="store.detailPanelOpen"
        class="topology-detail"
        :node-id="store.selectedNodeId"
        @close="store.closeDetailPanel()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTopologyStore } from '@/stores/topology'
import { FullScreen, Hide, Refresh, ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import DetailPanel from './components/DetailPanel.vue'
import FilterPanel from './components/FilterPanel.vue'
import TopologyCanvas from './components/TopologyCanvas.vue'
import { useTopologyData } from './composables/useTopologyData'

const store = useTopologyStore()
const { loadDomains, loadTopology } = useTopologyData()
const route = useRoute()
const canvasRef = ref<InstanceType<typeof TopologyCanvas> | null>(null)

function handleSelectNode(nodeId: string) {
  store.selectNode(nodeId)
}
function handleRefresh() {
  loadDomains()
  if (store.selectedDomain) loadTopology()
}
function handleZoomIn() { canvasRef.value?.zoomIn() }
function handleZoomOut() { canvasRef.value?.zoomOut() }
function handleFitView() { canvasRef.value?.fitView() }

onMounted(() => {
  // 从 URL 参数初始化筛选条件
  if (route.query.provider) store.selectedProviders = [route.query.provider as string]
  if (route.query.domain) store.selectedDomain = route.query.domain as string
  loadDomains()
  // 仅在有域名参数时加载拓扑
  if (store.selectedDomain) loadTopology()
})
</script>

<style scoped>
.topology-page { display: flex; flex-direction: column; height: calc(100vh - 0px); background: var(--bg-base); color: var(--text-primary); }
.topology-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-elevated); backdrop-filter: blur(20px); flex-shrink: 0; }
.toolbar-left { display: flex; align-items: center; gap: 16px; }
.toolbar-right { display: flex; align-items: center; gap: 6px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
.live-indicator { display: flex; align-items: center; gap: 6px; }
.live-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite; }
.live-text { font-size: 12px; color: #10b981; font-weight: 500; }
.topology-content { display: flex; flex: 1; overflow: hidden; position: relative; min-height: 0; }
.topology-filter { width: 260px; flex-shrink: 0; }
.topology-canvas { flex: 1; min-height: 400px; }
.topology-detail { width: 380px; flex-shrink: 0; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
