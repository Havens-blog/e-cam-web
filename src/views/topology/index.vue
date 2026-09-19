<template>
  <div class="topology-page">
    <!-- 顶部工具栏 -->
    <div class="topology-toolbar">
      <div class="toolbar-left">
        <h2 class="page-title">业务链路拓扑</h2>
        <div class="live-indicator" :class="`status-${store.dataStatus}`">
          <span class="live-dot"></span>
          <span class="live-text">{{ statusText }}</span>
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

    <!-- 加载失败提示（诚实错误态：不回退假数据） -->
    <el-alert
      v-if="store.loadError"
      class="topology-alert"
      :title="store.loadError"
      type="error"
      show-icon
      :closable="false"
    />

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
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import DetailPanel from './components/DetailPanel.vue'
import FilterPanel from './components/FilterPanel.vue'
import TopologyCanvas from './components/TopologyCanvas.vue'
import { useTopologyData } from './composables/useTopologyData'

const store = useTopologyStore()
const { loadDomains, loadTopology, refresh } = useTopologyData()
const route = useRoute()
const canvasRef = ref<InstanceType<typeof TopologyCanvas> | null>(null)

// 徽章随数据状态联动：成功=绿「实时」、失败=橙「异常」、加载中/未加载=灰，不误显实时
const statusText = computed(() => {
  switch (store.dataStatus) {
    case 'live': return '实时'
    case 'loading': return '加载中'
    case 'error': return '异常'
    default: return '未加载'
  }
})

function handleSelectNode(nodeId: string) {
  store.selectNode(nodeId)
}
function handleRefresh() {
  refresh()
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
/* 100vh - 导航栏 56px（MainLayout $navbar-height）- main-content 上下 padding 24px*2，避免三栏工作区纵向溢出触发整页滚动 */
.topology-page { display: flex; flex-direction: column; height: calc(100vh - 56px - 48px); background: var(--bg-base); color: var(--text-primary); }
.topology-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-elevated); backdrop-filter: blur(20px); flex-shrink: 0; }
.toolbar-left { display: flex; align-items: center; gap: 16px; }
.toolbar-right { display: flex; align-items: center; gap: 6px; }
.page-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; margin: 0; }
.live-indicator { display: flex; align-items: center; gap: 6px; }
/* 默认灰（未加载/加载中），成功绿「实时」带呼吸动画，失败橙「异常」 */
.live-dot { width: 8px; height: 8px; background: #94a3b8; border-radius: 50%; }
.live-text { font-size: 12px; color: #94a3b8; font-weight: 500; }
.live-indicator.status-live .live-dot { background: #10b981; animation: pulse 2s infinite; }
.live-indicator.status-live .live-text { color: #10b981; }
.live-indicator.status-error .live-dot { background: #f59e0b; }
.live-indicator.status-error .live-text { color: #f59e0b; }
.topology-alert { margin: 8px 24px 0; flex-shrink: 0; }
.topology-content { display: flex; flex: 1; overflow: hidden; position: relative; min-height: 0; }
.topology-filter { width: 260px; flex-shrink: 0; }
.topology-canvas { flex: 1; min-height: 400px; }
.topology-detail { width: 380px; flex-shrink: 0; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
