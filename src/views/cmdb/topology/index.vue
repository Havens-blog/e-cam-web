<template>
  <PageContainer>
    <div class="topology-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">拓扑视图</h2>
          <p class="page-subtitle">可视化展示资源模型和实例之间的关联关系</p>
        </div>
        <div class="header-right">
          <el-radio-group v-model="viewMode" size="small" @change="handleViewModeChange">
            <el-radio-button value="model">模型拓扑</el-radio-button>
            <el-radio-button value="instance">实例拓扑</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="topology-toolbar">
        <div class="toolbar-left">
          <!-- 模型拓扑筛选 -->
          <template v-if="viewMode === 'model'">
            <el-select
              v-model="modelFilter.provider"
              placeholder="全部云厂商"
              clearable
              size="small"
              style="width: 140px"
              @change="fetchModelTopology"
            >
              <el-option label="阿里云" value="aliyun" />
              <el-option label="AWS" value="aws" />
              <el-option label="腾讯云" value="tencent" />
              <el-option label="华为云" value="huawei" />
              <el-option label="火山引擎" value="volcano" />
            </el-select>
          </template>
          <!-- 实例拓扑筛选 -->
          <template v-else>
            <el-select
              v-model="instanceFilter.instanceId"
              placeholder="搜索并选择实例"
              filterable
              remote
              :remote-method="searchInstances"
              :loading="instanceSearchLoading"
              clearable
              size="small"
              style="width: 300px"
              @change="fetchInstanceTopology"
            >
              <el-option
                v-for="inst in instanceOptions"
                :key="inst.id"
                :label="`${inst.asset_name || inst.asset_id} (${inst.uid})`"
                :value="inst.id"
              />
            </el-select>
            <el-select v-model="instanceFilter.depth" size="small" style="width: 90px" @change="fetchInstanceTopology">
              <el-option :value="1" label="1 层" />
              <el-option :value="2" label="2 层" />
              <el-option :value="3" label="3 层" />
            </el-select>
            <el-select v-model="instanceFilter.direction" size="small" style="width: 90px" @change="fetchInstanceTopology">
              <el-option value="both" label="双向" />
              <el-option value="outgoing" label="出向" />
              <el-option value="incoming" label="入向" />
            </el-select>
          </template>
        </div>
        <div class="toolbar-right">
          <el-button size="small" circle title="刷新" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button size="small" circle title="适应画布" @click="handleFitView">
            <el-icon><FullScreen /></el-icon>
          </el-button>
          <el-button size="small" circle title="放大" @click="handleZoomIn">
            <el-icon><ZoomIn /></el-icon>
          </el-button>
          <el-button size="small" circle title="缩小" @click="handleZoomOut">
            <el-icon><ZoomOut /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 图例 + 分类筛选 -->
      <div class="topology-legend">
        <div
          v-for="cat in categoryLegend"
          :key="cat.key"
          class="legend-item clickable"
          :class="{ dimmed: !visibleCategories.has(cat.key) }"
          @click="toggleCategory(cat.key)"
        >
          <span class="legend-dot" :style="{ background: visibleCategories.has(cat.key) ? cat.color : 'var(--text-muted)' }"></span>
          <span class="legend-label">{{ cat.label }}</span>
        </div>
        <div class="legend-divider"></div>
        <div class="legend-item">
          <span class="legend-line solid"></span>
          <span class="legend-label">绑定</span>
        </div>
        <div class="legend-item">
          <span class="legend-line dashed"></span>
          <span class="legend-label">归属</span>
        </div>
        <div class="legend-divider"></div>
        <template v-if="viewMode === 'model'">
          <el-radio-group v-model="layoutMode" size="small" @change="renderModelGraph">
            <el-radio-button value="grouped">分层布局</el-radio-button>
            <el-radio-button value="force">力导向</el-radio-button>
          </el-radio-group>
        </template>
      </div>

      <!-- 图表容器 -->
      <div class="topology-canvas-wrapper" v-loading="loading">
        <div v-if="showEmpty" class="empty-state">
          <el-icon :size="48" color="var(--text-muted)"><Share /></el-icon>
          <div class="empty-title">{{ emptyTitle }}</div>
          <div class="empty-desc">{{ emptyDesc }}</div>
        </div>
        <div ref="chartRef" class="topology-canvas"></div>
      </div>

      <!-- 节点详情面板 -->
      <Transition name="slide-panel">
        <div v-if="selectedNode" class="detail-panel">
          <div class="panel-header">
            <div class="panel-icon" :style="{ background: getCategoryColor(selectedNode.category) + '22', color: getCategoryColor(selectedNode.category) }">
              <el-icon :size="20"><component :is="getCategoryIcon(selectedNode.category)" /></el-icon>
            </div>
            <div class="panel-title-area">
              <div class="panel-title">{{ selectedNode.name }}</div>
              <div class="panel-subtitle">{{ selectedNode.subTitle }}</div>
            </div>
            <el-button text circle size="small" @click="selectedNode = null">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
          <div class="panel-body">
            <div v-for="(val, key) in selectedNode.attrs" :key="key" class="panel-row">
              <span class="panel-label">{{ key }}</span>
              <span class="panel-value">{{ val }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { getInstanceTopologyApi, getModelTopologyApi, listCmdbInstancesApi } from '@/api'
import type {
  InstanceVO,
  ModelTopologyEdge,
  ModelTopologyGraph,
  ModelTopologyNode,
  TopologyEdge,
  TopologyGraph,
  TopologyNode
} from '@/api/types/cmdb'
import {
  Box,
  Close,
  Coin,
  Connection,
  FullScreen,
  Monitor,
  Refresh,
  Share,
  ZoomIn,
  ZoomOut
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'

// ==================== 常量 ====================
const CATEGORY_COLORS: Record<string, string> = {
  compute: '#3b82f6',
  network: '#f59e0b',
  database: '#10b981',
  storage: '#8b5cf6',
  middleware: '#06b6d4',
  security: '#ef4444',
  iam: '#ec4899',
}

const CATEGORY_LABELS: Record<string, string> = {
  compute: '计算',
  network: '网络',
  database: '数据库',
  storage: '存储',
  middleware: '中间件',
  security: '安全',
  iam: 'IAM',
}

const categoryLegend = computed(() =>
  Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key,
    label,
    color: CATEGORY_COLORS[key] || '#71717a',
  }))
)

// ==================== 状态 ====================
const viewMode = ref<'model' | 'instance'>('model')
const loading = ref(false)
const chartRef = ref<HTMLElement>()
const chart = shallowRef<echarts.ECharts | null>(null)

const modelFilter = reactive({ provider: '' })
const modelTopology = ref<ModelTopologyGraph>({ nodes: [], edges: [] })

const instanceFilter = reactive({
  instanceId: undefined as number | undefined,
  depth: 2,
  direction: 'both' as 'both' | 'outgoing' | 'incoming',
})
const instanceSearchLoading = ref(false)
const instanceOptions = ref<InstanceVO[]>([])
const instanceTopology = ref<TopologyGraph>({ nodes: [], edges: [] })

interface SelectedNodeInfo {
  name: string
  subTitle: string
  category: string
  attrs: Record<string, string>
}
const selectedNode = ref<SelectedNodeInfo | null>(null)

// 分类筛选
const visibleCategories = ref(new Set(Object.keys(CATEGORY_LABELS)))
const layoutMode = ref<'grouped' | 'force'>('grouped')

const toggleCategory = (cat: string) => {
  const s = new Set(visibleCategories.value)
  if (s.has(cat)) {
    if (s.size <= 1) return // 至少保留一个
    s.delete(cat)
  } else {
    s.add(cat)
  }
  visibleCategories.value = s
  if (viewMode.value === 'model') renderModelGraph()
  else if (instanceFilter.instanceId) renderInstanceGraph()
}

// ==================== 空状态 ====================
const showEmpty = computed(() => {
  if (loading.value) return false
  if (viewMode.value === 'model') return modelTopology.value.nodes.length === 0
  if (!instanceFilter.instanceId) return true
  return instanceTopology.value.nodes.length === 0
})

const emptyTitle = computed(() => {
  if (viewMode.value === 'instance' && !instanceFilter.instanceId) return '请选择一个实例'
  return '暂无拓扑数据'
})

const emptyDesc = computed(() => {
  if (viewMode.value === 'instance' && !instanceFilter.instanceId) return '在上方搜索框中选择实例，查看其关联资源拓扑'
  return '请先创建模型关系或实例关系'
})

// ==================== 工具函数 ====================
const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || '#71717a'

const getCategoryIcon = (category: string) => {
  const map: Record<string, any> = {
    compute: Monitor,
    network: Connection,
    database: Coin,
    storage: Box,
    middleware: Box,
  }
  return map[category] || Box
}

const getNodeSymbol = (_icon?: string, category?: string) => {
  // 使用 ECharts 内置 symbol
  if (category === 'compute') return 'roundRect'
  if (category === 'network') return 'diamond'
  if (category === 'database') return 'circle'
  if (category === 'storage') return 'triangle'
  return 'circle'
}

// ==================== 数据获取 ====================
const fetchModelTopology = async () => {
  loading.value = true
  try {
    const res = await getModelTopologyApi(modelFilter.provider || undefined)
    const data = res.data as any
    modelTopology.value = data?.data || data || { nodes: [], edges: [] }
    nextTick(() => renderModelGraph())
  } catch (error) {
    console.error('获取模型拓扑失败:', error)
    ElMessage.error('获取模型拓扑失败')
  } finally {
    loading.value = false
  }
}

const searchInstances = async (query: string) => {
  if (!query) { instanceOptions.value = []; return }
  instanceSearchLoading.value = true
  try {
    const res = await listCmdbInstancesApi({ asset_name: query, limit: 20 } as any)
    const data = res.data as any
    instanceOptions.value = data?.data?.instances || data?.instances || data?.list || []
  } catch (error) {
    console.error('搜索实例失败:', error)
  } finally {
    instanceSearchLoading.value = false
  }
}

const fetchInstanceTopology = async () => {
  if (!instanceFilter.instanceId) return
  loading.value = true
  try {
    const res = await getInstanceTopologyApi(instanceFilter.instanceId, {
      depth: instanceFilter.depth,
      direction: instanceFilter.direction,
    })
    const data = res.data as any
    instanceTopology.value = data?.data || data || { nodes: [], edges: [] }
    nextTick(() => renderInstanceGraph())
  } catch (error) {
    console.error('获取实例拓扑失败:', error)
    ElMessage.error('获取实例拓扑失败')
  } finally {
    loading.value = false
  }
}

// ==================== 图表渲染 ====================
const ensureChart = () => {
  if (!chartRef.value) return null
  if (chart.value) {
    chart.value.dispose()
  }
  chart.value = echarts.init(chartRef.value, undefined, { renderer: 'canvas' })
  return chart.value
}

// 分层布局的行顺序（从上到下的逻辑层级）
const LAYER_ORDER = ['iam', 'security', 'network', 'compute', 'storage', 'database', 'middleware']

const renderModelGraph = () => {
  const c = ensureChart()
  if (!c) return
  const { nodes, edges } = modelTopology.value
  if (nodes.length === 0) { c.clear(); return }

  // 按分类筛选
  const filteredNodes = nodes.filter(n => visibleCategories.value.has(n.category))
  const nodeUids = new Set(filteredNodes.map(n => n.uid))
  const filteredEdges = edges.filter(e => nodeUids.has(e.source_model_uid) && nodeUids.has(e.target_model_uid))

  if (filteredNodes.length === 0) { c.clear(); return }

  const categories = [...new Set(filteredNodes.map(n => n.category))].map(cat => ({
    name: cat,
    itemStyle: { color: getCategoryColor(cat) },
  }))

  // 有连线的节点集合
  const connectedUids = new Set<string>()
  filteredEdges.forEach(e => { connectedUids.add(e.source_model_uid); connectedUids.add(e.target_model_uid) })

  const isGrouped = layoutMode.value === 'grouped'

  // ===== 分层水平布局 =====
  const calcLayeredPositions = (): Map<string, { x: number; y: number }> => {
    const posMap = new Map<string, { x: number; y: number }>()
    const groups = new Map<string, ModelTopologyNode[]>()
    filteredNodes.forEach(n => {
      if (!groups.has(n.category)) groups.set(n.category, [])
      groups.get(n.category)!.push(n)
    })

    // 按预定义层级排序，未知分类放最后
    const sortedCats = [...groups.keys()].sort((a, b) => {
      const ia = LAYER_ORDER.indexOf(a)
      const ib = LAYER_ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })

    const rowGap = 120 // 行间距
    const nodeGap = 100 // 同行节点间距
    const labelOffset = 80 // 左侧分类标签预留空间

    sortedCats.forEach((cat, rowIndex) => {
      const members = groups.get(cat)!
      const y = rowIndex * rowGap
      const totalWidth = (members.length - 1) * nodeGap
      const startX = labelOffset + (-totalWidth / 2) // 居中排列

      members.forEach((node, colIndex) => {
        posMap.set(node.uid, {
          x: startX + colIndex * nodeGap,
          y,
        })
      })
    })
    return posMap
  }

  const posMap = isGrouped ? calcLayeredPositions() : null

  const nodeSize = filteredNodes.length > 30 ? 32 : filteredNodes.length > 15 ? 40 : 46

  const graphNodes: any[] = filteredNodes.map((node: ModelTopologyNode) => {
    const pos = posMap?.get(node.uid)
    const isIsolated = !connectedUids.has(node.uid)
    return {
      id: node.uid,
      name: node.name.length > 10 ? node.name.slice(0, 9) + '…' : node.name,
      symbol: getNodeSymbol(node.icon, node.category),
      symbolSize: isIsolated ? nodeSize * 0.7 : nodeSize,
      category: categories.findIndex(c => c.name === node.category),
      x: pos?.x,
      y: pos?.y,
      fixed: isGrouped,
      label: {
        show: true,
        position: 'bottom' as const,
        fontSize: filteredNodes.length > 30 ? 9 : 11,
        color: isIsolated ? 'var(--text-muted)' : 'var(--text-primary)',
        overflow: 'truncate' as const,
        width: 80,
      },
      itemStyle: {
        color: getCategoryColor(node.category) + (isIsolated ? '88' : 'ff'),
        borderColor: getCategoryColor(node.category),
        borderWidth: 1.5,
        shadowBlur: isIsolated ? 0 : 6,
        shadowColor: getCategoryColor(node.category) + '30',
      },
      value: node,
    }
  })

  // 分层布局时，在每行最左侧添加分类标签节点
  if (isGrouped) {
    const rowGap = 120
    const groups = new Map<string, ModelTopologyNode[]>()
    filteredNodes.forEach(n => {
      if (!groups.has(n.category)) groups.set(n.category, [])
      groups.get(n.category)!.push(n)
    })
    const sortedCats = [...groups.keys()].sort((a, b) => {
      const ia = LAYER_ORDER.indexOf(a)
      const ib = LAYER_ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    const maxCount = Math.max(...[...groups.values()].map(g => g.length))
    const nodeGapVal = 100
    const leftEdge = 80 + (-(maxCount - 1) * nodeGapVal / 2) - 80

    sortedCats.forEach((cat, rowIndex) => {
      graphNodes.push({
        id: `__label_${cat}`,
        name: CATEGORY_LABELS[cat] || cat,
        symbol: 'rect',
        symbolSize: [0, 0],
        x: leftEdge,
        y: rowIndex * rowGap,
        fixed: true,
        category: categories.findIndex(c => c.name === cat),
        label: {
          show: true,
          position: 'inside' as const,
          fontSize: 13,
          fontWeight: 'bold' as const,
          color: getCategoryColor(cat),
          backgroundColor: getCategoryColor(cat) + '18',
          padding: [4, 10],
          borderRadius: 4,
        },
        itemStyle: { color: 'transparent', borderWidth: 0 },
        emphasis: { disabled: true },
        value: null,
      })
    })
  }

  // 构建 uid -> 行索引映射，用于计算跨行连线的 curveness
  const nodeRowMap = new Map<string, number>()
  if (isGrouped) {
    const groups = new Map<string, ModelTopologyNode[]>()
    filteredNodes.forEach(n => {
      if (!groups.has(n.category)) groups.set(n.category, [])
      groups.get(n.category)!.push(n)
    })
    const sortedCats = [...groups.keys()].sort((a, b) => {
      const ia = LAYER_ORDER.indexOf(a)
      const ib = LAYER_ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    sortedCats.forEach((cat, rowIndex) => {
      groups.get(cat)!.forEach(n => nodeRowMap.set(n.uid, rowIndex))
    })
  }

  const graphEdges = filteredEdges.map((edge: ModelTopologyEdge, idx: number) => {
    // 同行连线用小弧度，跨行连线用更大弧度避免重叠
    const srcRow = nodeRowMap.get(edge.source_model_uid) ?? 0
    const tgtRow = nodeRowMap.get(edge.target_model_uid) ?? 0
    const sameRow = srcRow === tgtRow
    const curveness = isGrouped
      ? (sameRow ? 0.3 + (idx % 3) * 0.1 : 0.15 + (idx % 4) * 0.05)
      : 0.2

    return {
      source: edge.source_model_uid,
      target: edge.target_model_uid,
      label: {
        show: false,
        formatter: edge.relation_name,
        fontSize: 10,
        color: 'var(--text-tertiary)',
        backgroundColor: 'var(--bg-overlay)',
        padding: [2, 6],
        borderRadius: 3,
      },
      emphasis: {
        label: { show: true },
        lineStyle: { width: 2.5, color: '#3b82f6' },
      },
      lineStyle: {
        color: 'var(--border-strong)',
        width: 1,
        type: edge.relation_type === 'belongs_to' ? 'dashed' as const : 'solid' as const,
        curveness,
        opacity: 0.5,
      },
    }
  })

  const seriesConfig: any = {
    type: 'graph',
    roam: true,
    draggable: !isGrouped,
    zoom: isGrouped ? 0.85 : 1,
    categories,
    data: graphNodes,
    edges: graphEdges,
    emphasis: {
      focus: 'adjacency',
      itemStyle: { borderWidth: 3 },
    },
    edgeSymbol: ['none', 'arrow'],
    edgeSymbolSize: [0, 7],
    scaleLimit: { min: 0.2, max: 4 },
  }

  if (isGrouped) {
    // 固定坐标布局，不用力导向
    seriesConfig.layout = 'none'
  } else {
    seriesConfig.layout = 'force'
    seriesConfig.force = {
      repulsion: Math.max(200, filteredNodes.length * 12),
      gravity: 0.15,
      edgeLength: [100, 180],
      friction: 0.6,
      layoutAnimation: true,
    }
  }

  c.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23,23,23,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa', fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const v = params.data.value as ModelTopologyNode
          if (!v) return '' // 标签节点
          return `<div style="font-weight:600;margin-bottom:4px">${v.name}</div>
            <div style="color:#a1a1aa;font-size:11px">UID: ${v.uid}</div>
            <div style="color:#a1a1aa;font-size:11px">分类: ${CATEGORY_LABELS[v.category] || v.category}</div>
            <div style="color:#a1a1aa;font-size:11px">厂商: ${v.provider === 'all' ? '通用' : v.provider}</div>`
        }
        if (params.dataType === 'edge') {
          return `<div style="font-weight:500">${params.data.label?.formatter || ''}</div>`
        }
        return ''
      },
    },
    animationDuration: 600,
    animationEasingUpdate: 'cubicOut',
    series: [seriesConfig],
  })

  c.off('click')
  c.on('click', (params: any) => {
    if (params.dataType === 'node') {
      const v = params.data.value as ModelTopologyNode
      if (!v) return // 标签节点
      selectedNode.value = {
        name: v.name,
        subTitle: v.uid,
        category: v.category,
        attrs: {
          '模型 UID': v.uid,
          '分类': CATEGORY_LABELS[v.category] || v.category,
          '云厂商': v.provider === 'all' ? '通用' : v.provider,
          '图标': v.icon || '-',
        },
      }
    }
  })
}

const renderInstanceGraph = () => {
  const c = ensureChart()
  if (!c) return
  const { nodes, edges } = instanceTopology.value
  if (nodes.length === 0) { c.clear(); return }

  const centerId = instanceFilter.instanceId

  // 按分类筛选，但始终保留中心节点
  const filteredNodes = nodes.filter(n => n.id === centerId || visibleCategories.value.has(n.category))
  const nodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = edges.filter(e => nodeIds.has(e.source_id) && nodeIds.has(e.target_id))

  const categories = [...new Set(filteredNodes.map(n => n.category))].map(cat => ({
    name: cat,
    itemStyle: { color: getCategoryColor(cat) },
  }))

  const nodeSize = filteredNodes.length > 20 ? 38 : 48

  const graphNodes = filteredNodes.map((node: TopologyNode) => {
    const isCenter = node.id === centerId
    return {
      id: String(node.id),
      name: (node.asset_name || node.asset_id).length > 10
        ? (node.asset_name || node.asset_id).slice(0, 9) + '…'
        : (node.asset_name || node.asset_id),
      symbol: getNodeSymbol(node.icon, node.category),
      symbolSize: isCenter ? nodeSize * 1.5 : nodeSize,
      category: categories.findIndex(c => c.name === node.category),
      fixed: isCenter,
      x: isCenter ? 0 : undefined,
      y: isCenter ? 0 : undefined,
      label: {
        show: true,
        position: 'bottom' as const,
        fontSize: isCenter ? 12 : 10,
        fontWeight: isCenter ? 'bold' as const : 'normal' as const,
        color: 'var(--text-primary)',
        overflow: 'truncate' as const,
        width: 80,
      },
      itemStyle: {
        color: isCenter ? getCategoryColor(node.category) : getCategoryColor(node.category) + 'cc',
        borderColor: isCenter ? '#fff' : getCategoryColor(node.category),
        borderWidth: isCenter ? 3 : 1.5,
        shadowBlur: isCenter ? 16 : 4,
        shadowColor: getCategoryColor(node.category) + (isCenter ? '60' : '20'),
      },
      value: node,
    }
  })

  const graphEdges = filteredEdges.map((edge: TopologyEdge) => ({
    source: String(edge.source_id),
    target: String(edge.target_id),
    label: {
      show: false,
      formatter: edge.relation_name,
      fontSize: 10,
      color: 'var(--text-tertiary)',
      backgroundColor: 'var(--bg-overlay)',
      padding: [2, 6],
      borderRadius: 3,
    },
    emphasis: {
      label: { show: true },
      lineStyle: { width: 2.5, color: '#3b82f6' },
    },
    lineStyle: {
      color: 'var(--border-strong)',
      width: 1,
      type: edge.relation_type === 'belongs_to' ? 'dashed' as const : 'solid' as const,
      curveness: 0.15,
      opacity: 0.6,
    },
  }))

  c.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23,23,23,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa', fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const v = params.data.value as TopologyNode
          let html = `<div style="font-weight:600;margin-bottom:4px">${v.asset_name || v.asset_id}</div>
            <div style="color:#a1a1aa;font-size:11px">模型: ${v.model_name}</div>
            <div style="color:#a1a1aa;font-size:11px">资产ID: ${v.asset_id}</div>`
          if (v.attributes) {
            const attrs = v.attributes
            if (attrs.status) html += `<div style="color:#a1a1aa;font-size:11px">状态: ${attrs.status}</div>`
            if (attrs.private_ip) html += `<div style="color:#a1a1aa;font-size:11px">内网IP: ${attrs.private_ip}</div>`
            if (attrs.ip_address) html += `<div style="color:#a1a1aa;font-size:11px">IP: ${attrs.ip_address}</div>`
            if (attrs.cidr_block) html += `<div style="color:#a1a1aa;font-size:11px">CIDR: ${attrs.cidr_block}</div>`
          }
          return html
        }
        if (params.dataType === 'edge') {
          return `<div style="font-weight:500">${params.data.label?.formatter || ''}</div>`
        }
        return ''
      },
    },
    animationDuration: 600,
    animationEasingUpdate: 'quinticInOut',
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      zoom: 1,
      force: {
        repulsion: Math.max(300, filteredNodes.length * 15),
        gravity: 0.12,
        edgeLength: [100, 200],
        friction: 0.6,
      },
      categories,
      data: graphNodes,
      edges: graphEdges,
      emphasis: {
        focus: 'adjacency',
        itemStyle: { borderWidth: 3 },
      },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: [0, 7],
      scaleLimit: { min: 0.3, max: 3 },
    }],
  })

  c.off('click')
  c.on('click', (params: any) => {
    if (params.dataType === 'node') {
      const v = params.data.value as TopologyNode
      const attrs: Record<string, string> = {
        '实例 ID': String(v.id),
        '模型': v.model_name,
        '资产 ID': v.asset_id,
        '分类': CATEGORY_LABELS[v.category] || v.category,
      }
      if (v.attributes) {
        Object.entries(v.attributes).forEach(([k, val]) => {
          if (val !== undefined && val !== null && val !== '') {
            const labelMap: Record<string, string> = {
              status: '状态', cpu: 'CPU', memory: '内存(MB)',
              private_ip: '内网IP', public_ip: '公网IP',
              ip_address: 'IP地址', bandwidth: '带宽(Mbps)',
              cidr_block: 'CIDR',
            }
            attrs[labelMap[k] || k] = String(val)
          }
        })
      }
      selectedNode.value = {
        name: v.asset_name || v.asset_id,
        subTitle: v.model_name,
        category: v.category,
        attrs,
      }
    }
  })
}

// ==================== 操作 ====================
const handleViewModeChange = () => {
  selectedNode.value = null
  if (viewMode.value === 'model') fetchModelTopology()
}

const handleRefresh = () => {
  if (viewMode.value === 'model') fetchModelTopology()
  else fetchInstanceTopology()
}

const handleFitView = () => {
  chart.value?.dispatchAction({ type: 'restore' })
}

const handleZoomIn = () => {
  if (!chart.value) return
  const opt = chart.value.getOption() as any
  const currentZoom = opt?.series?.[0]?.zoom || 1
  chart.value.setOption({ series: [{ zoom: currentZoom * 1.3 }] })
}

const handleZoomOut = () => {
  if (!chart.value) return
  const opt = chart.value.getOption() as any
  const currentZoom = opt?.series?.[0]?.zoom || 1
  chart.value.setOption({ series: [{ zoom: currentZoom / 1.3 }] })
}

// ==================== 响应式 ====================
const handleResize = () => {
  chart.value?.resize()
}

onMounted(() => {
  fetchModelTopology()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart.value?.dispose()
})
</script>

<style scoped lang="scss">
.topology-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    flex-shrink: 0;

    .header-left {
      .page-title {
        margin: 0 0 6px 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--text-tertiary);
      }
    }

    .header-right {
      :deep(.el-radio-button__inner) {
        background: var(--glass-bg);
        border-color: var(--glass-border);
        color: var(--text-secondary);
      }
      :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
        background: var(--accent-blue);
        border-color: var(--accent-blue);
        color: #fff;
      }
    }
  }

  .topology-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    margin-bottom: 12px;
    flex-shrink: 0;

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .toolbar-right {
      display: flex;
      gap: 6px;
    }
  }

  .topology-legend {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    flex-shrink: 0;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;

      &.clickable {
        cursor: pointer;
        user-select: none;
        padding: 2px 8px;
        border-radius: 4px;
        transition: opacity 0.2s, background 0.2s;

        &:hover {
          background: var(--glass-border);
        }
      }

      &.dimmed {
        opacity: 0.4;

        .legend-label {
          text-decoration: line-through;
        }
      }
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .legend-line {
      width: 20px;
      height: 0;
      border-top: 2px solid var(--text-tertiary);

      &.dashed {
        border-top-style: dashed;
      }
    }

    .legend-label {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .legend-divider {
      width: 1px;
      height: 14px;
      background: var(--border-subtle);
    }
  }

  .topology-canvas-wrapper {
    flex: 1;
    min-height: 0;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    position: relative;
    overflow: hidden;

    .topology-canvas {
      width: 100%;
      height: 100%;
      min-height: 500px;
    }

    .empty-state {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 5;

      .empty-title {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-secondary);
        margin: 16px 0 6px;
      }
      .empty-desc {
        font-size: 13px;
        color: var(--text-tertiary);
      }
    }
  }

  // 节点详情侧面板
  .detail-panel {
    position: absolute;
    top: 0;
    right: 0;
    width: 320px;
    height: 100%;
    background: var(--bg-surface);
    border-left: 1px solid var(--border-base);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
    z-index: 20;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .panel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--border-subtle);

      .panel-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .panel-title-area {
        flex: 1;
        min-width: 0;

        .panel-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .panel-subtitle {
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: 2px;
          font-family: var(--font-mono);
        }
      }
    }

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;

      .panel-row {
        display: flex;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-subtle);

        &:last-child {
          border-bottom: none;
        }

        .panel-label {
          width: 90px;
          flex-shrink: 0;
          font-size: 12px;
          color: var(--text-tertiary);
        }
        .panel-value {
          flex: 1;
          font-size: 13px;
          color: var(--text-primary);
          word-break: break-all;
          font-family: var(--font-mono);
        }
      }
    }
  }
}

// 面板滑入动画
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 250ms ease, opacity 250ms ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
