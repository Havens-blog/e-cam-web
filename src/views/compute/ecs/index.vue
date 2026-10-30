<template>
  <div class="vm-page">
    <!-- 页面头部（拆至 components/InstancePageHeader.vue） -->
    <InstancePageHeader
      :page-title="pageTitle"
      :total-count="totalCount"
      :running-count="runningCount"
      :stopped-count="stoppedCount"
      :active-stat-filter="activeStatFilter"
      @stat-click="handleStatBadgeClick"
    />

    <!-- 操作栏（拆至 components/InstanceActionBar.vue） -->
    <InstanceActionBar
      v-model:has-tags="filters.has_tags"
      v-model:tag-key="filters.tag_key"
      v-model:tag-value="filters.tag_value"
      v-model:tag-filter-visible="tagFilterVisible"
      :available-tag-keys="availableTagKeys"
      :page-count="instances.length"
      :total="pagination.total"
      @add="handleAdd"
      @refresh="handleRefresh"
      @open-export="exportDialogVisible = true"
      @open-columns="columnSettingsVisible = true"
      @filter-change="handleFilterChange"
    />

    <!-- 搜索栏（拆至 components/InstanceSearchBar.vue） -->
    <InstanceSearchBar v-model:conditions="searchConditions" @apply="applySearchConditions" />

    <!-- 错误态：请求失败时显示持久错误说明 + 重试，而不是把失败渲染成「暂无数据」 -->
    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      @retry="fetchInstances"
    />

    <!-- 表格区域（拆至 components/InstanceTable.vue） -->
    <InstanceTable
      v-else
      :instances="instances"
      :loading="loading"
      :visible-columns="visibleColumns"
      @row-click="handleRowClick"
      @view-detail="handleViewDetail"
      @action="handleAction"
    />

    <!-- 分页 -->
    <div v-if="!errorInfo" class="pagination-bar">
      <div class="pagination-right">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
        <span class="resource-info">配置: CPU: 0核/总, 内存: 0G/T, 存储: 0G/T</span>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="640px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <InstanceForm ref="formRef" :instance="currentInstance" :is-edit="isEdit" :models="modelOptions" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 实例详情抽屉 -->
    <InstanceDetailDrawer
      v-model:visible="detailDrawerVisible"
      :instance="detailInstance"
      @edit="handleEdit"
      @delete="handleDelete"
    />

    <!-- 导出对话框 -->
    <AssetExportDialog
      v-model:visible="exportDialogVisible"
      :instances="instances"
      :selected-ids="[]"
      :total="pagination.total"
      :fetch-all-rows="fetchAllExportRows"
      :config="exportConfig"
    />

    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog
      v-model:visible="columnSettingsVisible"
      :columns="columnSettings"
      @update:columns="handleColumnSettingsChange"
    />
  </div>
</template>

<script setup lang="ts">
import { listECSAssetsApi } from '@/api/asset'
import { listTagsApi } from '@/api/tag'
import type { Asset } from '@/api/types/asset'
import { fetchAllRows } from '@/utils/exportAll'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { CHARGE_TYPE_LABELS, ECS_STATUS_LABELS, labelOfLenient } from '@/utils/fieldLabels'
import { getProviderLabel } from '@/utils/constants'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { AssetExportDialog, type ExportFieldConfig } from '@haven/ui/AssetExportDialog'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import InstanceDetailDrawer from './components/InstanceDetailDrawer.vue'
import InstanceForm from './components/InstanceForm.vue'
// 拆分子组件（结构分解，行为零变化）：页面头部 / 操作栏 / 搜索栏 / 表格
import InstanceActionBar from './components/InstanceActionBar.vue'
import InstancePageHeader from './components/InstancePageHeader.vue'
import InstanceSearchBar from './components/InstanceSearchBar.vue'
import InstanceTable from './components/InstanceTable.vue'
// 纯展示格式化函数与 SearchCondition 类型已迁至同目录 utils.ts（单源复用）
import type { SearchCondition } from './utils'

const route = useRoute()
const router = useRouter()

// 状态
const loading = ref(false)
// 列表请求失败时置为 ErrorInfo，由 <ErrorDisplay> 渲染**持久**的错误态 + 重试。
// 此前仅弹一个 3 秒自动消失的 ElMessage，然后把列表清空 → 页面持久显示「暂无数据」，
// 与「真的没有实例」无法区分，容易让运维误判资源不存在（BACKLOG §二 T1）。
const errorInfo = ref<ErrorInfo | null>(null)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentInstance = ref<Asset | null>(null)

// 导出和列设置对话框
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

// 数据
const instances = ref<Asset[]>([])
const modelOptions = ref<any[]>([])

// 列配置
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 80, visible: true },
  { key: 'ip', label: 'IP', width: 130, visible: true },
  { key: 'os', label: '系统', width: 40, visible: true },
  { key: 'spec', label: '规格', width: 110, visible: true },
  { key: 'security_group', label: '安全组', width: 90, visible: true },
  { key: 'billing', label: '计费方式', width: 80, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'project', label: '项目', width: 80, visible: true },
  { key: 'region', label: '区域', width: 100, visible: true },
  { key: 'host_name', label: '主机名', width: 150, visible: false },
  { key: 'public_ip', label: '公网IP', width: 120, visible: false },
  { key: 'cpu', label: 'CPU', width: 60, visible: false },
  { key: 'memory', label: '内存', width: 70, visible: false },
  { key: 'cloud_account', label: '云账号', width: 120, visible: false },
  { key: 'vpc', label: 'VPC', width: 150, visible: false },
  { key: 'zone', label: '可用区', width: 100, visible: false },
  { key: 'expired_time', label: '到期时间', width: 140, visible: false },
  { key: 'create_time', label: '创建时间', width: 140, visible: false },
  { key: 'tags', label: '标签', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

// 初始化列配置
const initColumnSettings = () => {
  const saved = localStorage.getItem('vm-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        columnSettings.value = parsed
        return
      }
    } catch (e) {
      console.error('解析列设置失败:', e)
    }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnSettingsChange = (columns: ColumnConfig[]) => {
  columnSettings.value = columns
}

const filters = reactive({
  keyword: '',
  uid: '',
  status: '',
  region: '',
  zone: '',
  provider: '',
  charge_type: '',
  os_type: '',
  instance_type: '',
  vpc_id: '',
  private_ip: '',
  public_ip: '',
  project_id: '',
  has_tags: '' as '' | 'true' | 'false',
  tag_key: '',
  tag_value: '',
})

// 标签筛选面板可见性（面板本体已迁至 components/InstanceActionBar.vue）
const tagFilterVisible = ref(false)

// 已生效的搜索条件：与搜索栏子组件 v-model 双向绑定
// （统计卡片点击 handleStatBadgeClick 也会增删 status 条件，故仍留在页面层）
const searchConditions = ref<SearchCondition[]>([])

const applySearchConditions = () => {
  // 先清除所有搜索相关的筛选
  filters.keyword = ''
  filters.private_ip = ''
  filters.public_ip = ''
  filters.status = ''
  filters.provider = ''
  filters.region = ''
  filters.instance_type = ''
  filters.charge_type = ''
  filters.vpc_id = ''
  filters.os_type = ''

  // 应用所有搜索条件
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
      case 'host_name':
        filters.keyword = cond.value
        break
      case 'private_ip':
        filters.private_ip = cond.value
        break
      case 'status':
        filters.status = cond.value
        break
      case 'provider':
        filters.provider = cond.value
        break
      case 'region':
        filters.region = cond.value
        break
      case 'instance_type':
        filters.instance_type = cond.value
        break
      case 'charge_type':
        filters.charge_type = cond.value
        break
      case 'vpc_id':
        filters.vpc_id = cond.value
        break
      case 'os_type':
        filters.os_type = cond.value
        break
    }
  })

  // 同步统计卡片高亮状态
  const statusCond = searchConditions.value.find(c => c.field === 'status')
  activeStatFilter.value = statusCond?.value || ''

  pagination.page = 1
  fetchInstances()
}

// 从标签管理 API 获取全量 ECS 标签键（不受分页限制）
const availableTagKeys = ref<string[]>([])

const loadAvailableTagKeys = async () => {
  try {
    const res = await listTagsApi({ resource_type: 'ecs', limit: 200 })
    const items = res.data?.items || []
    const keysSet = new Set<string>()
    items.filter((item: any) => item != null).forEach((item: any) => {
      if (item?.key) keysSet.add(item.key)
    })
    availableTagKeys.value = Array.from(keysSet).sort()
  } catch {
    // Fallback: extract from current page data
    const keysSet = new Set<string>()
    instances.value.forEach(instance => {
      const tags = instance.attributes?.tags
      if (tags && typeof tags === 'object') {
        Object.keys(tags).forEach(key => keysSet.add(key))
      }
    })
    availableTagKeys.value = Array.from(keysSet).sort()
  }
}

const handleFilterChange = () => {
  pagination.page = 1
  fetchInstances()
}

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 计算属性
const pageTitle = computed(() => {
  if (filters.uid) {
    const model = modelOptions.value.find(m => m.uid === filters.uid)
    return model?.name || '虚拟机'
  }
  return '虚拟机'
})

const dialogTitle = computed(() => (isEdit.value ? '编辑实例' : '创建实例'))

// 全局状态统计（从后端获取，非当前页）
const totalCount = ref(0)
const runningCount = ref(0)
const stoppedCount = ref(0)

const fetchStatusCounts = async () => {
  try {
    const [totalRes, runningRes, stoppedRes] = await Promise.all([
      listECSAssetsApi({ limit: 1, offset: 0 }),
      listECSAssetsApi({ status: 'running', limit: 1, offset: 0 }),
      listECSAssetsApi({ status: 'stopped', limit: 1, offset: 0 }),
    ])
    const totalData = (totalRes as any).data || totalRes
    const runningData = (runningRes as any).data || runningRes
    const stoppedData = (stoppedRes as any).data || stoppedRes
    totalCount.value = totalData.total || 0
    runningCount.value = runningData.total || 0
    stoppedCount.value = stoppedData.total || 0
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取实例状态统计失败')
  }
}

// 统计卡片点击筛选
const activeStatFilter = ref('')

const handleStatBadgeClick = (status: string) => {
  // 点击已激活的卡片 或 点击"总数"，清除状态筛选
  if (activeStatFilter.value === status || !status) {
    activeStatFilter.value = ''
    // 移除搜索条件中的状态条件
    const idx = searchConditions.value.findIndex(c => c.field === 'status')
    if (idx > -1) searchConditions.value.splice(idx, 1)
  } else {
    activeStatFilter.value = status
    const existingIdx = searchConditions.value.findIndex(c => c.field === 'status')
    const cond = { field: 'status', value: status, displayValue: ECS_STATUS_LABELS[status] || status }
    if (existingIdx > -1) {
      searchConditions.value[existingIdx] = cond
    } else {
      searchConditions.value.push(cond)
    }
  }
  applySearchConditions()
}

// 行点击开详情（与 RDS/Redis 页一致）
const handleRowClick = (item: Asset) => { handleViewDetail(item) }

// 获取模型列表（暂时保留空实现）
const fetchModels = async () => {
  // 新API不需要模型列表
}

/** 组装列表查询参数（列表分页与导出全量拉取共用，保证筛选口径一致） */
const buildListParams = (page: number, size: number): Record<string, any> => {
  const params: Record<string, any> = {
    name: filters.keyword || undefined,
    offset: (page - 1) * size,
    limit: size,
  }

  // 添加筛选条件
  if (filters.status) params.status = filters.status
  if (filters.region) params.region = filters.region
  if (filters.provider) params.provider = filters.provider
  if (filters.private_ip) params.private_ip = filters.private_ip
  if (filters.public_ip) params.public_ip = filters.public_ip
  if (filters.vpc_id) params.vpc_id = filters.vpc_id
  if (filters.charge_type) params.charge_type = filters.charge_type
  return params
}

// 获取实例列表
const fetchInstances = async () => {
  loading.value = true
  try {
    const res = await listECSAssetsApi(buildListParams(pagination.page, pagination.size))
    const responseData = (res as any).data || res
    instances.value = responseData.items || []
    pagination.total = responseData.total || 0
    errorInfo.value = null
    // 同步刷新全局状态统计
    fetchStatusCounts()
  } catch (error: any) {
    console.error('获取实例列表失败:', error)
    // 保留 errorInfo 让页面持续显示错误态与重试入口；不再只靠瞬时 toast + 清空列表
    // （否则用户会看到「暂无数据」，把请求失败误读成「没有实例」）
    errorInfo.value = handleApiError(error, '获取实例列表失败')
    instances.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 刷新
const handleRefresh = () => {
  fetchInstances()
}

/** 导出「全部数据」：按当前筛选分页拉取全量（主题A compute-1 F-H2），供 ExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listECSAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

/** 导出配置：字段/取值逐字自原 components/ExportDialog.vue 迁移（零漂移） */
const exportConfig: ExportFieldConfig<Asset> = {
  fields: [
    { key: 'asset_id', label: '云上ID' },
    { key: 'asset_name', label: '名称' },
    { key: 'host_name', label: '主机名' },
    { key: 'status', label: '状态' },
    { key: 'private_ip', label: '私网IP' },
    { key: 'public_ip', label: '公网IP' },
    { key: 'os_name', label: '操作系统' },
    { key: 'instance_type', label: '规格' },
    { key: 'cpu', label: 'CPU' },
    { key: 'memory', label: '内存' },
    { key: 'charge_type', label: '计费方式' },
    { key: 'provider', label: '云平台' },
    { key: 'cloud_account_name', label: '云账号' },
    { key: 'region', label: '区域' },
    { key: 'zone', label: '可用区' },
    { key: 'vpc_id', label: 'VPC' },
    { key: 'vswitch_id', label: '子网' },
    { key: 'security_groups', label: '安全组' },
    { key: 'image_id', label: '镜像ID' },
    { key: 'expired_time', label: '到期时间' },
    { key: 'creation_time', label: '创建时间' },
    { key: 'tags', label: '标签' },
  ],
  getValue: (instance: Asset, key: string): string => {
    if (key === 'asset_id' || key === 'asset_name') {
      return instance[key] || ''
    }
    const attr = instance.attributes || {}
    if (key === 'status') {
      return ECS_STATUS_LABELS[attr.status] || attr.status || ''
    }
    if (key === 'charge_type') return labelOfLenient(CHARGE_TYPE_LABELS, attr.charge_type, '')
    if (key === 'provider') return getProviderLabel(attr.provider || '')
    if (key === 'memory') {
      const mem = attr.memory
      if (!mem) return ''
      return mem >= 1024 ? `${(mem / 1024).toFixed(0)}GB` : `${mem}MB`
    }
    if (key === 'cpu') {
      return attr.cpu ? `${attr.cpu}核` : ''
    }
    if (key === 'security_groups') {
      const groups = attr.security_groups || attr.security_group_ids
      if (Array.isArray(groups)) return groups.length.toString()
      return ''
    }
    if (key === 'tags') {
      const tags = attr.tags
      if (tags && typeof tags === 'object') {
        return Object.entries(tags).map(([k, v]) => `${k}:${v}`).join('; ')
      }
      return ''
    }
    return attr[key] || ''
  },
  filename: '虚拟机列表',
  defaultFields: ['asset_id', 'asset_name', 'status', 'private_ip', 'public_ip', 'os_name', 'instance_type', 'charge_type', 'provider', 'region'],
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  fetchInstances()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  fetchInstances()
}

// 添加实例
const handleAdd = () => {
  router.push('/compute/template/create')
}

// 编辑实例
const handleEdit = (instance: Asset) => {
  isEdit.value = true
  currentInstance.value = instance
  dialogVisible.value = true
}

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

const handleViewDetail = (instance: Asset) => {
  detailInstance.value = instance
  detailDrawerVisible.value = true
}

// 操作处理
const handleAction = (command: string, instance: Asset) => {
  switch (command) {
    case 'view':
      handleViewDetail(instance)
      break
    case 'edit':
      handleEdit(instance)
      break
    case 'delete':
      handleDelete(instance)
      break
  }
}

// 删除实例
const handleDelete = async (instance: Asset) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除实例"${instance.asset_name || instance.asset_id}"吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    // TODO: 新API暂不支持删除操作
    ElMessage.warning('删除功能暂未开放')
    detailDrawerVisible.value = false
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    submitting.value = true
    await formRef.value.submit()
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    fetchInstances()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDialogClosed = () => {
  currentInstance.value = null
  if (formRef.value) formRef.value.reset()
}

onMounted(() => {
  initColumnSettings()
  if (route.params.uid) {
    filters.uid = route.params.uid as string
  } else if (route.query.uid) {
    filters.uid = route.query.uid as string
  }
  // H-03：实例详情「查看资产」带 query.search 跳入时，首载前预填关键词（uid 精确 / keyword 模糊不同维度，共存无害）
  const s = route.query.search
  if (typeof s === 'string' && s) {
    filters.keyword = s
    // 搜索框在子组件内（独立缓冲），通过 conditions 注入 chip 才能看到关键字
    searchConditions.value.push({ field: 'asset_name', value: s, displayValue: s })
  }
  fetchModels()
  fetchInstances()
  loadAvailableTagKeys()
})

watch(
  () => route.params.uid,
  (newUid) => {
    if (newUid) {
      filters.uid = newUid as string
      pagination.page = 1
      fetchInstances()
    }
  }
)
</script>

<style scoped lang="scss">
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px;  // 抵消外层 padding
  height: calc(100% + 48px);
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.clear-btn {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-dialog-content {
  padding: 0;
}

// 分页栏
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.pagination-right {
  display: flex;
  align-items: center;
  gap: 16px;

  .resource-info {
    font-size: 12px;
    color: var(--text-secondary);
  }
}
</style>
