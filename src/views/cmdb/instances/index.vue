<template>
  <div class="instances-page">
    <!-- 页面头部 -->
    <ManagerHeader title="资源实例" subtitle="CMDB 资源实例管理">
      <template #stats>
        <div class="stat-item">
          <span class="stat-label">总数</span>
          <span class="stat-value">{{ pagination.total }}</span>
        </div>
      </template>
      <template #actions>
        <el-button type="primary" size="small" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新建实例
        </el-button>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <div class="filters">
      <div class="filters-left">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索名称/ID"
          clearable
          style="width: 200px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="filters.asset_type"
          placeholder="资产类型"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in assetTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="filters.provider"
          placeholder="云平台"
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option label="阿里云" value="aliyun" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="AWS" value="aws" />
          <el-option label="火山引擎" value="volcengine" />
        </el-select>
        <el-select
          v-model="filters.region"
          placeholder="区域"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option
            v-for="region in regionOptions"
            :key="region"
            :label="region"
            :value="region"
          />
        </el-select>
      </div>
      <div class="filters-right">
        <el-button size="small" circle @click="handleRefresh" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button size="small" circle @click="exportDialogVisible = true" title="导出">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" circle @click="columnSettingsVisible = true" title="自定义列">
          <el-icon><Setting /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <el-table
        :data="instances"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        @row-click="handleRowClick"
        row-key="id"
        style="width: 100%"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="asset_name" label="名称" min-width="180" fixed="left">
          <template #default="{ row }">
            <span class="name-link" @click.stop="handleViewDetail(row)">
              {{ row.asset_name || row.asset_id || '-' }}
            </span>
          </template>
        </el-table-column>
        <!-- 动态列 -->
        <el-table-column
          v-for="col in visibleColumns"
          :key="col.key"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
        >
          <template #default="{ row }">
            <!-- 资产类型 -->
            <template v-if="col.key === 'asset_type'">
              <el-tag size="small" :type="getAssetTypeTagType(row.uid)">
                {{ getAssetTypeLabel(row.uid) }}
              </el-tag>
            </template>
            <!-- 云平台 -->
            <template v-else-if="col.key === 'provider'">
              <div class="provider-cell">
                <IconFont :type="getProviderIcon(row.attributes?.provider)" :size="16" />
                <span>{{ getProviderLabel(row.attributes?.provider) }}</span>
              </div>
            </template>
            <!-- 区域 -->
            <template v-else-if="col.key === 'region'">
              {{ row.attributes?.region || '-' }}
            </template>
            <!-- 可用区 -->
            <template v-else-if="col.key === 'zone'">
              {{ row.attributes?.zone || '-' }}
            </template>
            <!-- 状态 -->
            <template v-else-if="col.key === 'status'">
              <span class="status-badge" :class="getStatusClass(row.attributes?.status)">
                {{ getStatusLabel(row.attributes?.status) }}
              </span>
            </template>
            <!-- 云账号 -->
            <template v-else-if="col.key === 'account'">
              {{ row.attributes?.cloud_account_name || '-' }}
            </template>
            <!-- 资产ID -->
            <template v-else-if="col.key === 'asset_id'">
              <span class="asset-id">{{ row.asset_id || '-' }}</span>
            </template>
            <!-- 创建时间 -->
            <template v-else-if="col.key === 'create_time'">
              {{ formatTime(row.attributes?.creation_time || row.create_time) }}
            </template>
            <!-- 更新时间 -->
            <template v-else-if="col.key === 'update_time'">
              {{ formatTime(row.update_time) }}
            </template>
            <!-- 标签 -->
            <template v-else-if="col.key === 'tags'">
              <span class="tags-text">{{ formatTags(row.attributes?.tags) }}</span>
            </template>
            <template v-else>-</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click.stop="handleViewDetail(row)">
              查看
            </el-button>
            <el-button type="danger" link size="small" @click.stop="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :page-sizes="[20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑实例' : '新建实例'"
      width="600px"
      :close-on-click-modal="false"
    >
      <InstanceForm ref="formRef" :instance="currentInstance" :is-edit="isEdit" :models="modelOptions" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 导出对话框 -->
    <ExportDialog
      v-model:visible="exportDialogVisible"
      :instances="instances"
      :selected-ids="selectedIds"
      :total="pagination.total"
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
import { deleteCmdbInstanceApi, listCmdbInstancesApi, listCmdbModelsApi } from '@/api'
import type { InstanceVO, ModelVO } from '@/api/types/cmdb'
import IconFont from '@/components/IconFont/index.vue'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import { Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import InstanceForm from './components/InstanceForm.vue'

const router = useRouter()

// 资产类型映射 - 用于跳转到对应详情页
const assetTypeRouteMap: Record<string, { label: string; icon: string; route: string; tagType: string }> = {
  ecs: { label: '云服务器', icon: 'caise-computer', route: '/compute/ecs', tagType: '' },
  rds: { label: 'RDS', icon: 'caise-database', route: '/databases/rds', tagType: 'success' },
  redis: { label: 'Redis', icon: 'caise-database', route: '/databases/redis', tagType: 'danger' },
  mongodb: { label: 'MongoDB', icon: 'caise-database', route: '/databases/mongodb', tagType: 'success' },
  vpc: { label: 'VPC', icon: 'caise-network_devices', route: '/network/vpc', tagType: 'info' },
  eip: { label: '弹性公网IP', icon: 'caise-network_devices', route: '/network/eip', tagType: 'info' },
  nas: { label: '文件存储', icon: 'caise-storage_device', route: '/storage/nas', tagType: 'warning' },
  oss: { label: '对象存储', icon: 'caise-storage_device', route: '/storage/oss', tagType: 'warning' },
  kafka: { label: 'Kafka', icon: 'caise-middleware', route: '/middleware/kafka', tagType: '' },
  elasticsearch: { label: 'Elasticsearch', icon: 'caise-middleware', route: '/middleware/elasticsearch', tagType: '' },
}

// 资产类型选项
const assetTypeOptions = [
  { label: '云服务器', value: 'ecs' },
  { label: 'RDS', value: 'rds' },
  { label: 'Redis', value: 'redis' },
  { label: 'MongoDB', value: 'mongodb' },
  { label: 'VPC', value: 'vpc' },
  { label: '弹性公网IP', value: 'eip' },
  { label: '文件存储', value: 'nas' },
  { label: '对象存储', value: 'oss' },
  { label: 'Kafka', value: 'kafka' },
  { label: 'Elasticsearch', value: 'elasticsearch' },
]

// 状态
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentInstance = ref<InstanceVO | null>(null)
const selectedIds = ref<number[]>([])
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

// 数据
const instances = ref<InstanceVO[]>([])
const modelOptions = ref<ModelVO[]>([])
const regionOptions = ref<string[]>([])

// 筛选条件
const filters = reactive({
  keyword: '',
  asset_type: '',
  provider: '',
  region: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 列配置
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'asset_type', label: '资产类型', width: 110, visible: true },
  { key: 'provider', label: '云平台', width: 100, visible: true },
  { key: 'region', label: '区域', width: 120, visible: true },
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'asset_id', label: '资产ID', width: 200, visible: true },
  { key: 'account', label: '云账号', width: 120, visible: false },
  { key: 'zone', label: '可用区', width: 120, visible: false },
  { key: 'create_time', label: '创建时间', width: 160, visible: true },
  { key: 'update_time', label: '更新时间', width: 160, visible: false },
  { key: 'tags', label: '标签', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

// 初始化列配置
const initColumnSettings = () => {
  const saved = localStorage.getItem('cmdb-instances-column-settings')
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

// 获取资产类型标签
const getAssetTypeLabel = (uid: string) => {
  const type = uid?.split('_')[0] || uid
  return assetTypeRouteMap[type]?.label || type || '-'
}

const getAssetTypeTagType = (uid: string) => {
  const type = uid?.split('_')[0] || uid
  return assetTypeRouteMap[type]?.tagType || ''
}

// 获取云平台图标和标签
const getProviderIcon = (provider: string) => {
  const iconMap: Record<string, string> = {
    aliyun: 'caise-aliyun',
    tencent: 'caise-tengxunyun',
    huawei: 'caise-huaweiyun',
    aws: 'caise-aws',
    volcengine: 'caise-huoshanyinqing',
  }
  return iconMap[provider] || 'caise-public_cloud'
}

const getProviderLabel = (provider: string) => {
  const labelMap: Record<string, string> = {
    aliyun: '阿里云',
    tencent: '腾讯云',
    huawei: '华为云',
    aws: 'AWS',
    volcengine: '火山引擎',
  }
  return labelMap[provider] || provider || '-'
}

// 获取状态样式和标签
const getStatusClass = (status: string) => {
  const classMap: Record<string, string> = {
    running: 'status-running',
    Running: 'status-running',
    available: 'status-running',
    Available: 'status-running',
    active: 'status-running',
    stopped: 'status-stopped',
    Stopped: 'status-stopped',
    pending: 'status-pending',
    Pending: 'status-pending',
    creating: 'status-pending',
    error: 'status-error',
    Error: 'status-error',
  }
  return classMap[status] || 'status-default'
}

const getStatusLabel = (status: string) => {
  const labelMap: Record<string, string> = {
    running: '运行中',
    Running: '运行中',
    available: '可用',
    Available: '可用',
    active: '活跃',
    stopped: '已停止',
    Stopped: '已停止',
    pending: '创建中',
    Pending: '创建中',
    creating: '创建中',
    error: '异常',
    Error: '异常',
  }
  return labelMap[status] || status || '-'
}

// 格式化时间
const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  const date = typeof time === 'number' ? new Date(time * 1000) : new Date(time)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化标签
const formatTags = (tags: Record<string, string> | undefined) => {
  if (!tags || typeof tags !== 'object') return '-'
  const entries = Object.entries(tags)
  if (entries.length === 0) return '-'
  return entries.slice(0, 3).map(([k, v]) => `${k}:${v}`).join(', ') + (entries.length > 3 ? '...' : '')
}

// 加载数据
const fetchInstances = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    if (filters.keyword) params.keyword = filters.keyword
    if (filters.asset_type) params.uid = filters.asset_type
    if (filters.provider) params.provider = filters.provider
    if (filters.region) params.region = filters.region

    const res = await listCmdbInstancesApi(params)
    const data = res.data?.data || res.data
    instances.value = data?.instances || data?.items || []
    pagination.total = data?.total || 0

    // 提取区域选项
    const regions = new Set<string>()
    instances.value.forEach(item => {
      if (item.attributes?.region) regions.add(item.attributes.region)
    })
    regionOptions.value = Array.from(regions).sort()
  } catch (error) {
    console.error('加载实例列表失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 加载模型列表
const fetchModels = async () => {
  try {
    const res = await listCmdbModelsApi({ limit: 100 })
    modelOptions.value = res.data?.data?.models || []
  } catch (error) {
    console.error('加载模型列表失败:', error)
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchInstances()
}

// 刷新
const handleRefresh = () => {
  fetchInstances()
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  fetchInstances()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchInstances()
}

// 选择
const handleSelectionChange = (selection: InstanceVO[]) => {
  selectedIds.value = selection.map(item => item.id)
}

// 行点击
const handleRowClick = (row: InstanceVO) => {
  handleViewDetail(row)
}

// 查看详情 - 跳转到对应类型的详情页
const handleViewDetail = (row: InstanceVO) => {
  const assetType = row.uid?.split('_')[0] || row.uid
  const routeInfo = assetTypeRouteMap[assetType]
  
  if (routeInfo) {
    // 跳转到对应资产类型的列表页，带上搜索参数定位到具体实例
    router.push({
      path: routeInfo.route,
      query: { search: row.asset_id }
    })
  } else {
    ElMessage.warning(`暂不支持查看 ${assetType} 类型的详情`)
  }
}

// 新建
const handleAdd = () => {
  isEdit.value = false
  currentInstance.value = null
  dialogVisible.value = true
}

// 提交
const handleSubmit = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate()
  if (!valid) return

  submitting.value = true
  try {
    await formRef.value.submit()
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    fetchInstances()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// 删除
const handleDelete = async (row: InstanceVO) => {
  try {
    await ElMessageBox.confirm(`确定要删除实例 "${row.asset_name || row.asset_id}" 吗？`, '删除确认', {
      type: 'warning',
    })
    await deleteCmdbInstanceApi(row.id)
    ElMessage.success('删除成功')
    fetchInstances()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 初始化
onMounted(() => {
  initColumnSettings()
  fetchInstances()
  fetchModels()
})
</script>

<style lang="scss" scoped>
.instances-page {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.filters {
  padding: 12px 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .filters-left {
    display: flex;
    gap: 12px;
    flex: 1;
  }

  .filters-right {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
}

.table-container {
  flex: 1;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  overflow: hidden;

  :deep(.el-table) {
    background: transparent;
    
    th.el-table__cell {
      background: var(--table-header-bg);
    }
    
    tr {
      cursor: pointer;
      
      &:hover > td.el-table__cell {
        background: var(--table-row-hover-bg);
      }
    }
  }
}

.name-link {
  color: var(--el-color-primary);
  cursor: pointer;
  
  &:hover {
    text-decoration: underline;
  }
}

.provider-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.asset-id {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  
  &.status-running {
    background: rgba(103, 194, 58, 0.1);
    color: #67c23a;
  }
  
  &.status-stopped {
    background: rgba(144, 147, 153, 0.1);
    color: #909399;
  }
  
  &.status-pending {
    background: rgba(230, 162, 60, 0.1);
    color: #e6a23c;
  }
  
  &.status-error {
    background: rgba(245, 108, 108, 0.1);
    color: #f56c6c;
  }
  
  &.status-default {
    background: rgba(144, 147, 153, 0.1);
    color: #909399;
  }
}

.tags-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pagination-container {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
