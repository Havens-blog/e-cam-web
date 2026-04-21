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
          <el-tag v-if="viewMode === 'model'" type="info" size="small" effect="plain" style="margin-right: 12px">
            Shift + 拖拽节点可创建关系
          </el-tag>
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
        <!-- 拖拽连线覆盖层 -->
        <canvas ref="dragOverlayRef" class="drag-overlay" :class="{ active: dragState.dragging }"></canvas>
        <!-- 拖拽提示 -->
        <Transition name="fade">
          <div v-if="dragState.dragging" class="drag-hint">
            拖拽到目标模型以创建关系
          </div>
        </Transition>
      </div>

      <!-- 模型关系创建对话框 -->
      <el-dialog
        v-model="relationDialog.visible"
        title="创建模型关系"
        width="480px"
        :close-on-click-modal="false"
        @closed="resetRelationDialog"
      >
        <div class="relation-dialog-nodes">
          <div class="relation-node">
            <span class="node-dot" :style="{ background: getCategoryColor(relationDialog.sourceNode?.category || '') }"></span>
            <span>{{ relationDialog.sourceNode?.name }}</span>
          </div>
          <el-icon :size="20" color="var(--text-tertiary)"><Right /></el-icon>
          <div class="relation-node">
            <span class="node-dot" :style="{ background: getCategoryColor(relationDialog.targetNode?.category || '') }"></span>
            <span>{{ relationDialog.targetNode?.name }}</span>
          </div>
        </div>
        <el-form ref="relationFormRef" :model="relationDialog.form" :rules="relationRules" label-width="90px" style="margin-top: 20px">
          <el-form-item label="关系UID" prop="uid">
            <el-input v-model="relationDialog.form.uid" placeholder="如 ecs_belongs_to_vpc" />
          </el-form-item>
          <el-form-item label="关系名称" prop="name">
            <el-input v-model="relationDialog.form.name" placeholder="如 ECS属于VPC" />
          </el-form-item>
          <el-form-item label="关系类型" prop="relation_type">
            <el-select v-model="relationDialog.form.relation_type" placeholder="请选择" style="width: 100%">
              <el-option label="归属 (belongs_to)" value="belongs_to" />
              <el-option label="包含 (contains)" value="contains" />
              <el-option label="绑定 (bindto)" value="bindto" />
              <el-option label="连接 (connects)" value="connects" />
              <el-option label="依赖 (depends_on)" value="depends_on" />
            </el-select>
          </el-form-item>
          <el-form-item label="方向" prop="direction">
            <el-select v-model="relationDialog.form.direction" placeholder="请选择" style="width: 100%">
              <el-option label="一对一" value="one_to_one" />
              <el-option label="一对多" value="one_to_many" />
              <el-option label="多对多" value="many_to_many" />
            </el-select>
          </el-form-item>
          <el-form-item label="源→目标" prop="source_to_target">
            <el-input v-model="relationDialog.form.source_to_target" placeholder="如：属于" />
          </el-form-item>
          <el-form-item label="目标→源" prop="target_to_source">
            <el-input v-model="relationDialog.form.target_to_source" placeholder="如：包含" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="relationDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="relationDialog.submitting" @click="handleCreateRelation">创建</el-button>
        </template>
      </el-dialog>

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
import { createModelRelationApi, getInstanceTopologyApi, getModelTopologyApi, listCmdbInstancesApi } from '@/api'
import type {
  CreateModelRelationReq,
  InstanceVO,
  ModelTopologyEdge,
  ModelTopologyGraph,
  ModelTopologyNode,
  RelationDirection,
  RelationType,
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
  Right,
  Share,
  ZoomIn,
  ZoomOut
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import type { FormInstance, FormRules } from 'element-plus'
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

// ==================== 拖拽连线状态 ====================
const dragOverlayRef = ref<HTMLCanvasElement>()

interface DragLinkState {
  dragging: boolean
  sourceNode: ModelTopologyNode | null
  sourcePixel: { x: number; y: number } | null
  currentPixel: { x: number; y: number } | null
  hoverTarget: ModelTopologyNode | null
}
const dragState = reactive<DragLinkState>({
  dragging: false,
  sourceNode: null,
  sourcePixel: null,
  currentPixel: null,
  hoverTarget: null,
})

// ==================== 关系创建对话框 ====================
const relationFormRef = ref<FormInstance>()
const relationDialog = reactive({
  visible: false,
  submitting: false,
  sourceNode: null as ModelTopologyNode | null,
  targetNode: null as ModelTopologyNode | null,
  form: {
    uid: '',
    name: '',
    relation_type: 'belongs_to' as RelationType,
    direction: 'one_to_many' as RelationDirection,
    source_to_target: '',
    target_to_source: '',
  },
})

const relationRules: FormRules = {
  uid: [{ required: true, message: '请输入关系UID', trigger: 'blur' }],
  name: [{ required: true, message: '请输入关系名称', trigger: 'blur' }],
  relation_type: [{ required: true, message: '请选择关系类型', trigger: 'change' }],
}

// 自动生成 UID 和名称
const autoFillRelationForm = () => {
  const src = relationDialog.sourceNode
  const tgt = relationDialog.targetNode
  if (!src || !tgt) return
  const srcKey = src.uid.replace(/^(aliyun|aws|tencent|huawei|volcano)_/, '')
  const tgtKey = tgt.uid.replace(/^(aliyun|aws|tencent|huawei|volcano)_/, '')
  relationDialog.form.uid = `${srcKey}_belongs_to_${tgtKey}`
  relationDialog.form.name = `${src.name}属于${tgt.name}`
  relationDialog.form.source_to_target = '属于'
  relationDialog.form.target_to_source = '包含'
}

const resetRelationDialog = () => {
  relationDialog.sourceNode = null
  relationDialog.targetNode = null
  relationDialog.form.uid = ''
  relationDialog.form.name = ''
  relationDialog.form.relation_type = 'belongs_to'
  relationDialog.form.direction = 'one_to_many'
  relationDialog.form.source_to_target = ''
  relationDialog.form.target_to_source = ''
  relationFormRef.value?.resetFields()
}

const handleCreateRelation = async () => {
  const valid = await relationFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const src = relationDialog.sourceNode
  const tgt = relationDialog.targetNode
  if (!src || !tgt) return

  relationDialog.submitting = true
  try {
    const data: CreateModelRelationReq = {
      uid: relationDialog.form.uid,
      name: relationDialog.form.name,
      source_uid: src.uid,
      target_uid: tgt.uid,
      relation_type: relationDialog.form.relation_type,
      direction: relationDialog.form.direction,
      source_to_target: relationDialog.form.source_to_target,
      target_to_source: relationDialog.form.target_to_source,
    }
    await createModelRelationApi(data)
    ElMessage.success('模型关系创建成功')
    relationDialog.visible = false
    // 刷新拓扑图
    fetchModelTopology()
  } catch (error: any) {
    ElMessage.error(error?.message || '创建失败')
  } finally {
    relationDialog.submitting = false
  }
}

// ==================== 拖拽连线绘制 ====================
const drawDragLine = () => {
  const canvas = dragOverlayRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 同步 canvas 尺寸
  const rect = canvas.parentElement?.getBoundingClientRect()
  if (rect) {
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!dragState.dragging || !dragState.sourcePixel || !dragState.currentPixel) return

  const { x: sx, y: sy } = dragState.sourcePixel
  const { x: ex, y: ey } = dragState.currentPixel

  // 绘制连线
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.strokeStyle = dragState.hoverTarget ? '#3b82f6' : '#71717a'
  ctx.lineWidth = dragState.hoverTarget ? 2.5 : 1.5
  ctx.setLineDash([6, 4])
  ctx.stroke()

  // 绘制箭头
  const angle = Math.atan2(ey - sy, ex - sx)
  const arrowLen = 10
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - arrowLen * Math.cos(angle - Math.PI / 6), ey - arrowLen * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - arrowLen * Math.cos(angle + Math.PI / 6), ey - arrowLen * Math.sin(angle + Math.PI / 6))
  ctx.strokeStyle = dragState.hoverTarget ? '#3b82f6' : '#71717a'
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.stroke()

  // 目标高亮圆圈
  if (dragState.hoverTarget) {
    ctx.beginPath()
    ctx.arc(ex, ey, 28, 0, Math.PI * 2)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.setLineDash([])
    ctx.stroke()
  }
}

// 安装拖拽连线事件（仅模型拓扑模式）
const installDragLinkEvents = () => {
  const c = chart.value
  if (!c) return

  const zr = c.getZr()

  // 右键按下开始拖拽连线（左键保留给 ECharts 原生拖拽/点击）
  zr.on('mousedown', (e: any) => {
    if (viewMode.value !== 'model') return
    // 使用 Shift+左键 或 右键 触发连线
    if (!(e.event?.shiftKey || e.event?.button === 2)) return

    // 查找点击的节点
    const point = [e.offsetX, e.offsetY]
    const dataIndex = findNodeAtPoint(c, point)
    if (dataIndex === -1) return

    const opt = c.getOption() as any
    const nodeData = opt?.series?.[0]?.data?.[dataIndex]
    if (!nodeData?.value || nodeData.id?.startsWith('__label_')) return

    e.event?.preventDefault?.()
    e.event?.stopPropagation?.()

    const wrapperRect = chartRef.value?.parentElement?.getBoundingClientRect()
    const chartRect = chartRef.value?.getBoundingClientRect()
    if (!wrapperRect || !chartRect) return

    dragState.dragging = true
    dragState.sourceNode = nodeData.value as ModelTopologyNode
    dragState.sourcePixel = {
      x: e.offsetX + (chartRect.left - wrapperRect.left),
      y: e.offsetY + (chartRect.top - wrapperRect.top),
    }
    dragState.currentPixel = { ...dragState.sourcePixel }
    dragState.hoverTarget = null
  })

  zr.on('mousemove', (e: any) => {
    if (!dragState.dragging) return

    const wrapperRect = chartRef.value?.parentElement?.getBoundingClientRect()
    const chartRect = chartRef.value?.getBoundingClientRect()
    if (!wrapperRect || !chartRect) return

    dragState.currentPixel = {
      x: e.offsetX + (chartRect.left - wrapperRect.left),
      y: e.offsetY + (chartRect.top - wrapperRect.top),
    }

    // 检测是否悬停在目标节点上
    const point = [e.offsetX, e.offsetY]
    const dataIndex = findNodeAtPoint(c, point)
    if (dataIndex !== -1) {
      const opt = c.getOption() as any
      const nodeData = opt?.series?.[0]?.data?.[dataIndex]
      if (nodeData?.value && !nodeData.id?.startsWith('__label_') && nodeData.value.uid !== dragState.sourceNode?.uid) {
        dragState.hoverTarget = nodeData.value as ModelTopologyNode
      } else {
        dragState.hoverTarget = null
      }
    } else {
      dragState.hoverTarget = null
    }

    drawDragLine()
  })

  zr.on('mouseup', (_e: any) => {
    if (!dragState.dragging) return

    if (dragState.hoverTarget && dragState.sourceNode) {
      // 打开关系创建对话框
      relationDialog.sourceNode = dragState.sourceNode
      relationDialog.targetNode = dragState.hoverTarget
      autoFillRelationForm()
      relationDialog.visible = true
    }

    // 重置拖拽状态
    dragState.dragging = false
    dragState.sourceNode = null
    dragState.sourcePixel = null
    dragState.currentPixel = null
    dragState.hoverTarget = null
    drawDragLine() // 清除画布
  })

  // 禁用右键菜单
  chartRef.value?.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })
}

// 查找指定像素位置的节点索引
const findNodeAtPoint = (c: echarts.ECharts, point: number[]): number => {
  const opt = c.getOption() as any
  const nodes = opt?.series?.[0]?.data || []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node.value || node.id?.startsWith('__label_')) continue
    // 将数据坐标转换为像素坐标
    const pos = c.convertToPixel({ seriesIndex: 0 }, [node.x ?? 0, node.y ?? 0])
    if (!pos) continue
    const size = typeof node.symbolSize === 'number' ? node.symbolSize : 40
    const dx = (point[0] ?? 0) - (pos[0] ?? 0)
    const dy = (point[1] ?? 0) - (pos[1] ?? 0)
    if (Math.sqrt(dx * dx + dy * dy) <= size * 0.7) {
      return i
    }
  }
  return -1
}

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
      fixed: false,
      draggable: true,
      label: {
        show: true,
        position: 'bottom' as const,
        fontSize: filteredNodes.length > 30 ? 9 : 11,
        color: isIsolated ? getCssVar('--text-muted') || '#71717a' : getCssVar('--text-primary') || '#fafafa',
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
        color: getCssVar('--text-tertiary') || '#a1a1aa',
        backgroundColor: getCssVar('--bg-overlay') || '#1a1a1a',
        padding: [2, 6],
        borderRadius: 3,
      },
      emphasis: {
        label: { show: true },
        lineStyle: { width: 2.5, color: '#3b82f6' },
      },
      lineStyle: {
        color: getCssVar('--border-strong') || 'rgba(255,255,255,0.15)',
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
    draggable: true,
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
    // 用 force 布局 + fixed:true 保持分层位置，ECharts 原生支持拖拽 fixed 节点
    seriesConfig.layout = 'force'
    seriesConfig.force = {
      initLayout: 'none',
      repulsion: 0,
      gravity: 0,
      edgeLength: 0,
      friction: 1,
      layoutAnimation: true,
    }
    // 将所有有坐标的节点设为 fixed，force 引擎不会移动它们，但拖拽时会临时解除
    graphNodes.forEach(n => {
      if (n.x !== undefined && n.y !== undefined) {
        n.fixed = true
      }
    })
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
      ...getTooltipStyle(),
      formatter: (params: any) => {
        const sc = getTooltipSubColor()
        if (params.dataType === 'node') {
          const v = params.data.value as ModelTopologyNode
          if (!v) return ''
          return `<div style="font-weight:600;margin-bottom:4px">${v.name}</div>
            <div style="color:${sc};font-size:11px">UID: ${v.uid}</div>
            <div style="color:${sc};font-size:11px">分类: ${CATEGORY_LABELS[v.category] || v.category}</div>
            <div style="color:${sc};font-size:11px">厂商: ${v.provider === 'all' ? '通用' : v.provider}</div>`
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

  // 安装拖拽连线事件
  installDragLinkEvents()
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
        color: getCssVar('--text-primary') || '#fafafa',
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
      color: getCssVar('--text-tertiary') || '#a1a1aa',
      backgroundColor: getCssVar('--bg-overlay') || '#1a1a1a',
      padding: [2, 6],
      borderRadius: 3,
    },
    emphasis: {
      label: { show: true },
      lineStyle: { width: 2.5, color: '#3b82f6' },
    },
    lineStyle: {
      color: getCssVar('--border-strong') || 'rgba(255,255,255,0.15)',
      width: 1,
      type: edge.relation_type === 'belongs_to' ? 'dashed' as const : 'solid' as const,
      curveness: 0.15,
      opacity: 0.6,
    },
  }))

  c.setOption({
    tooltip: {
      trigger: 'item',
      ...getTooltipStyle(),
      formatter: (params: any) => {
        const sc = getTooltipSubColor()
        if (params.dataType === 'node') {
          const v = params.data.value as TopologyNode
          let html = `<div style="font-weight:600;margin-bottom:4px">${v.asset_name || v.asset_id}</div>
            <div style="color:${sc};font-size:11px">模型: ${v.model_name}</div>
            <div style="color:${sc};font-size:11px">资产ID: ${v.asset_id}</div>`
          if (v.attributes) {
            const attrs = v.attributes
            if (attrs.status) html += `<div style="color:${sc};font-size:11px">状态: ${attrs.status}</div>`
            if (attrs.private_ip) html += `<div style="color:${sc};font-size:11px">内网IP: ${attrs.private_ip}</div>`
            if (attrs.ip_address) html += `<div style="color:${sc};font-size:11px">IP: ${attrs.ip_address}</div>`
            if (attrs.cidr_block) html += `<div style="color:${sc};font-size:11px">CIDR: ${attrs.cidr_block}</div>`
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

const appStore = useAppStore()

// 读取当前主题下的 CSS 变量实际值
const getCssVar = (name: string): string => {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// 获取当前主题的 tooltip 样式
const getTooltipStyle = () => ({
  backgroundColor: getCssVar('--bg-overlay') || 'rgba(23,23,23,0.95)',
  borderColor: getCssVar('--border-base') || 'rgba(255,255,255,0.1)',
  textStyle: { color: getCssVar('--text-primary') || '#fafafa', fontSize: 12 },
})

const getTooltipSubColor = () => getCssVar('--text-tertiary') || '#a1a1aa'

// 主题切换时重新渲染图表
watch(() => appStore.theme, () => {
  nextTick(() => {
    if (chart.value) {
      chart.value.dispose()
      chart.value = null
    }
    if (viewMode.value === 'model') {
      renderModelGraph()
    } else {
      renderInstanceGraph()
    }
  })
})

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

    .drag-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 10;

      &.active {
        pointer-events: none; // 始终不拦截鼠标事件
      }
    }

    .drag-hint {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 16px;
      background: rgba(59, 130, 246, 0.9);
      color: #fff;
      font-size: 12px;
      border-radius: 20px;
      z-index: 15;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
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

// 淡入淡出
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 关系创建对话框
.relation-dialog-nodes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  background: var(--glass-bg, #f5f5f5);
  border-radius: 8px;

  .relation-node {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: var(--bg-surface, #fff);
    border: 1px solid var(--border-base, #e5e5e5);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;

    .node-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  }
}
</style>
