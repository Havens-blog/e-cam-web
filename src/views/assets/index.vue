<template>
  <PageContainer class="assets-page">
    <template #header>
      <div class="page-header">
        <div class="page-heading">
          <h2 class="page-title">资产管理</h2>
          <p class="page-subtitle">查看和管理所有云平台的资产</p>
        </div>
        <div class="page-actions">
          <el-button type="primary" @click="handleDiscover">
            <el-icon><Search /></el-icon>
            发现资产
          </el-button>
          <el-button type="primary" @click="handleSync">
            <el-icon><Refresh /></el-icon>
            同步资产
          </el-button>
        </div>
      </div>
    </template>

    <!-- 筛选器（FilterBar 五字段等价旧 AssetFilters） -->
    <template #filters>
      <FilterBar v-model="filters" :fields="filterFields" @field-change="handleFilterChange">
        <template #actions>
          <el-button @click="resetFilters">重置</el-button>
        </template>
      </FilterBar>
    </template>

    <!-- 密度切换（规格指定增强） -->
    <div class="table-toolbar">
      <span class="table-toolbar__label">密度</span>
      <el-button
        size="small"
        :type="density === 'default' ? 'primary' : undefined"
        @click="density = 'default'"
      >
        默认
      </el-button>
      <el-button
        size="small"
        :type="density === 'compact' ? 'primary' : undefined"
        @click="density = 'compact'"
      >
        紧凑
      </el-button>
    </div>

    <!-- 资产表格（DataTable fetch 模式：三态/批量操作条组件内置） -->
    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchAssets"
      selectable
      :batch-actions="batchActions"
      :density="density"
      error-text="获取资产列表失败"
      max-height="calc(100vh - 24rem)"
      stripe
      @row-click="handleRowClick"
      @batch-action="handleBatchAction"
    >
      <template #provider="{ row }">
        <div class="provider-cell">
          <ProviderIcon :provider="row.provider || ''" size="small" />
          <span>{{ getProviderLabel(row.provider || '') }}</span>
        </div>
      </template>
      <template #status="{ row }">
        <AssetStatusBadge :status="row.status || ''" :labels="ASSET_STATUS_LABELS" />
      </template>
      <template #ops="{ row }">
        <el-button size="small" type="primary" link @click.stop="handleView(row)">
          查看
        </el-button>
        <el-button size="small" type="primary" link @click.stop="handleEdit(row)">
          编辑
        </el-button>
        <el-button size="small" type="danger" link @click.stop="handleDelete(row)">
          删除
        </el-button>
      </template>
    </DataTable>

    <!-- 固定分页 -->
    <template #footer>
      <div v-if="pagination.total > 0" class="pagination-content">
        <div class="pagination-info">
          <div class="page-display">
            <el-button
              size="small"
              :disabled="pagination.page === 1"
              title="第一页"
              @click="handleCurrentChange(1)"
            >
              首页
            </el-button>
            <span class="page-info">{{ pagination.page }}/{{ totalPages }}</span>
            <el-button
              size="small"
              :disabled="pagination.page === totalPages"
              title="最后一页"
              @click="handleCurrentChange(totalPages)"
            >
              末页
            </el-button>
          </div>
          <span class="total-info">共 {{ pagination.total }} 条</span>
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>

    <!-- 发现资产对话框 -->
    <el-dialog v-model="discoverDialogVisible" title="发现资产" width="500px">
      <el-form :model="discoverForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select
            v-model="discoverForm.provider"
            placeholder="请选择云厂商"
            style="width: 100%"
          >
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="区域" required>
          <el-input v-model="discoverForm.region" placeholder="例如: cn-beijing" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="discoverDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="discovering" @click="submitDiscover">
          开始发现
        </el-button>
      </template>
    </el-dialog>

    <!-- 同步资产对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步资产" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select
            v-model="syncForm.provider"
            placeholder="请选择云厂商"
            style="width: 100%"
          >
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="资产类型">
          <el-select
            v-model="syncForm.asset_types"
            multiple
            placeholder="留空表示同步所有类型"
            style="width: 100%"
            clearable
          >
            <el-option label="虚拟机" value="ecs" />
            <el-option label="存储" value="storage" />
            <el-option label="网络" value="network" />
            <el-option label="数据库" value="database" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select
            v-model="syncForm.regions"
            multiple
            placeholder="留空表示同步所有区域"
            style="width: 100%"
            clearable
            allow-create
            filterable
          >
            <el-option label="北京" value="cn-beijing" />
            <el-option label="上海" value="cn-shanghai" />
            <el-option label="广州" value="cn-guangzhou" />
            <el-option label="深圳" value="cn-shenzhen" />
          </el-select>
        </el-form-item>
        <el-alert
          title="提示"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 16px"
        >
          同步操作将更新现有资产信息并发现新资产。如果不指定资产类型和区域，将同步该云厂商下的所有资产。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">
          开始同步
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑资产" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="资产名称">
          <el-input v-model="editForm.asset_name" placeholder="请输入资产名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="editForm.status"
            placeholder="请选择状态"
            style="width: 100%"
          >
            <el-option
              v-for="s in ASSET_STATUS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="成本">
          <el-input-number
            v-model="editForm.cost"
            :min="0"
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="updating" @click="submitEdit">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 资产详情抽屉（行点击 / 查看按钮同路径） -->
    <DetailDrawer
      v-model:visible="detailDrawerVisible"
      v-model:active-tab-name="detailActiveTab"
      :title="detailAsset?.asset_name || '资产详情'"
      size="65%"
      :tabs="[
        { name: 'basic', label: '基本信息' },
        { name: 'config', label: '配置详情' },
        { name: 'monitor', label: '监控数据' }
      ]"
    >
      <template #header-actions>
        <el-button size="small" @click="handleEdit(detailAsset!)">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button size="small" type="danger" @click="handleDelete(detailAsset!)">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>

      <template #tab-basic>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="资产名称">
            {{ detailAsset?.asset_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="资产类型">
            <el-tag size="small">{{ detailAsset?.asset_type || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="云平台">
            <el-tag size="small">{{ detailAsset?.provider || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="区域">
            {{ detailAsset?.region || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detailAsset?.status === 'running' ? 'success' : 'info'" size="small">
              {{ detailAsset?.status || '-' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="标签">
            <span v-if="detailAsset?.tags && detailAsset.tags.length > 0">
              <el-tag v-for="tag in detailAsset.tags" :key="tag.key" size="small" style="margin-right: 4px">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
            </span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="资产ID" :span="2">
            {{ detailAsset?.asset_id || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ detailAsset?.create_time || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ detailAsset?.update_time || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>

      <template #tab-config>
        <el-card shadow="never">
          <template #header>
            <span>配置信息</span>
          </template>
          <pre class="config-content">{{ detailAsset?.metadata || '暂无配置信息' }}</pre>
        </el-card>
      </template>

      <template #tab-monitor>
        <el-empty description="监控数据功能开发中" :image-size="100">
          <el-button type="primary">敬请期待</el-button>
        </el-empty>
      </template>
    </DetailDrawer>
  </PageContainer>
</template>

<script setup lang="ts">
import {
  deleteAssetApi,
  listAssetsApi,
  submitDiscoverAssetsTaskApi,
  submitSyncAssetsTaskApi,
  updateAssetApi,
} from '@/api'
import type * as asset from '@/api/types/asset'
import type { Asset } from '@/api/types/asset'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import DataTable from '@/components/DataTable/index.vue'
import type {
  DataTableBatchAction,
  DataTableColumn,
  DataTableDensity,
} from '@/components/DataTable/types'
import DetailDrawer from '@/components/DetailDrawer/index.vue'
import FilterBar from '@/components/FilterBar/index.vue'
import type { FilterField } from '@/components/FilterBar/types'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import {
  ASSET_STATUS,
  ASSET_TYPES,
  CLOUD_PROVIDERS,
  getAssetTypeLabel,
  getProviderLabel,
} from '@/utils/constants'
import { ASSET_STATUS_LABELS } from '@/utils/fieldLabels'
import { formatCost, formatTime } from '@/utils/formatters'
import { Delete, Edit, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ==================== 筛选（FilterBar 五字段，等价旧 AssetFilters） ====================

const filterFields: FilterField[] = [
  { key: 'provider', label: '云厂商', type: 'select', options: CLOUD_PROVIDERS, placeholder: '全部' },
  { key: 'asset_type', label: '资产类型', type: 'select', options: ASSET_TYPES, placeholder: '全部' },
  { key: 'region', label: '区域', type: 'input', placeholder: '输入区域', width: 150 },
  { key: 'status', label: '状态', type: 'select', options: ASSET_STATUS, placeholder: '全部' },
  { key: 'asset_name', label: '资产名称', type: 'input', placeholder: '搜索资产名称', width: 200 },
]

/** 筛选值对象（FilterBar v-model：字段变更以新对象整体替换） */
const filters = ref<Record<string, unknown>>({})

/** 筛选值取字符串（空值归一 undefined，等价旧页 `x || undefined` 传参） */
const filterString = (key: string): string => String(filters.value[key] ?? '')

// ==================== 列表（DataTable fetch 模式：三态由组件内置承载） ====================

const tableRef = ref<{ refresh: () => Promise<void>; clearSelection: () => void } | null>(null)

/** 表格密度（规格指定增强：default=默认行高 / compact=紧凑） */
const density = ref<DataTableDensity>('default')

/** 列配置：与旧 AssetTable 列结构逐列等价（宽度/对齐/格式化/固定操作列） */
const columns: DataTableColumn<Asset>[] = [
  { prop: 'asset_id', label: '资产ID', width: 180, showOverflowTooltip: true },
  { prop: 'asset_name', label: '资产名称', minWidth: 150, showOverflowTooltip: true },
  { label: '云厂商', width: 140, align: 'center', slot: 'provider' },
  {
    prop: 'asset_type',
    label: '资产类型',
    width: 120,
    align: 'center',
    formatter: (_row, _column, cellValue) => getAssetTypeLabel(String(cellValue)),
  },
  { prop: 'region', label: '区域', width: 120, align: 'center' },
  { label: '状态', width: 100, align: 'center', slot: 'status' },
  {
    prop: 'cost',
    label: '成本',
    width: 100,
    align: 'right',
    formatter: (_row, _column, cellValue) => formatCost(Number(cellValue ?? 0)),
  },
  {
    prop: 'discover_time',
    label: '发现时间',
    width: 160,
    align: 'center',
    formatter: (_row, _column, cellValue) => formatTime(cellValue as string | undefined, 'YYYY-MM-DD HH:mm'),
  },
  { label: '操作', width: 180, fixed: 'right', align: 'center', slot: 'ops' },
]

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const totalPages = computed(() => Math.ceil(pagination.total / pagination.size))

/** 列表拉取（挂载即由 DataTable 调起；分页与筛选在调用时读取最新值） */
const fetchAssets = async (): Promise<Asset[]> => {
  const params = {
    provider: (filterString('provider') || undefined) as asset.CloudProvider | undefined,
    asset_type: filterString('asset_type') || undefined,
    region: filterString('region') || undefined,
    status: filterString('status') || undefined,
    name: filterString('asset_name') || undefined,
    offset: (pagination.page - 1) * pagination.size,
    limit: pagination.size,
  }
  const { data } = await listAssetsApi(params)
  pagination.total = data.total || 0
  return data.items || data.assets || []
}

/** 筛选变更（FilterBar field-change 统一透传）：回第 1 页并重拉 */
const handleFilterChange = () => {
  pagination.page = 1
  void tableRef.value?.refresh()
}

/** 重置筛选：清空全部字段并重拉 */
const resetFilters = () => {
  filters.value = {}
  pagination.page = 1
  void tableRef.value?.refresh()
}

/** 分页大小变化（回第 1 页） */
const handleSizeChange = (newSize: number) => {
  pagination.size = newSize
  pagination.page = 1
  void tableRef.value?.refresh()
}

/** 当前页变化 */
const handleCurrentChange = (newPage: number) => {
  pagination.page = newPage
  void tableRef.value?.refresh()
}

// ==================== 批量操作条（规格指定增强，动作由既有删除能力组成） ====================

const batchActions: DataTableBatchAction[] = [{ key: 'delete', label: '批量删除', type: 'danger' }]

const handleBatchAction = async (key: string, rows: Asset[]) => {
  if (key !== 'delete' || rows.length === 0) {
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${rows.length} 个资产吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return
  }
  const results = await Promise.allSettled(rows.map((row) => deleteAssetApi(row.id)))
  const failed = results.filter((result) => result.status === 'rejected').length
  if (failed > 0) {
    ElMessage.error(`${failed} 个资产删除失败`)
  } else {
    ElMessage.success('删除成功')
  }
  tableRef.value?.clearSelection()
  void tableRef.value?.refresh()
}

// ==================== 详情抽屉（行点击 / 查看按钮同路径） ====================

const detailDrawerVisible = ref(false)
const detailAsset = ref<Asset | null>(null)
const detailActiveTab = ref('basic')

/** 行点击直达详情（规格指定增强） */
const handleRowClick = (row: Asset) => {
  handleView(row)
}

// 查看资产详情
const handleView = (asset: Asset) => {
  detailAsset.value = asset
  detailDrawerVisible.value = true
}

// ==================== 编辑资产 ====================

const updating = ref(false)
const editDialogVisible = ref(false)

const editForm = reactive({
  id: 0,
  asset_name: '',
  status: '',
  cost: 0,
})

// 编辑资产
const handleEdit = (asset: Asset) => {
  editForm.id = asset.id
  editForm.asset_name = asset.asset_name
  editForm.status = asset.status
  editForm.cost = asset.cost ?? 0
  editDialogVisible.value = true
}

// 提交编辑
const submitEdit = async () => {
  if (!editForm.asset_name) {
    ElMessage.warning('请输入资产名称')
    return
  }

  updating.value = true
  try {
    await updateAssetApi(editForm.id, {
      asset_name: editForm.asset_name,
      status: editForm.status,
      cost: editForm.cost,
    })
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    void tableRef.value?.refresh()
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    updating.value = false
  }
}

// ==================== 删除资产 ====================

// 删除资产
const handleDelete = async (asset: Asset) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除资产"${asset.asset_name}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deleteAssetApi(asset.id)
    ElMessage.success('删除成功')
    void tableRef.value?.refresh()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// ==================== 发现资产 ====================

const discovering = ref(false)
const discoverDialogVisible = ref(false)

const discoverForm = reactive({
  provider: '',
  region: '',
})

// 发现资产
const handleDiscover = () => {
  discoverForm.provider = ''
  discoverForm.region = ''
  discoverDialogVisible.value = true
}

// 提交发现
const submitDiscover = async () => {
  if (!discoverForm.provider || !discoverForm.region) {
    ElMessage.warning('请填写完整信息')
    return
  }

  discovering.value = true
  try {
    const { data } = await submitDiscoverAssetsTaskApi({
      provider: discoverForm.provider,
      region: discoverForm.region,
    })
    ElMessage.success(`任务已提交，任务ID: ${data.task_id}`)
    discoverDialogVisible.value = false
    // 跳转到任务详情页面
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交任务失败')
  } finally {
    discovering.value = false
  }
}

// ==================== 同步资产 ====================

const syncDialogVisible = ref(false)
const syncing = ref(false)

const syncForm = reactive({
  provider: '',
  asset_types: [] as string[],
  regions: [] as string[],
})

// 同步资产
const handleSync = () => {
  syncForm.provider = ''
  syncForm.asset_types = []
  syncForm.regions = []
  syncDialogVisible.value = true
}

// 提交同步
const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }

  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: syncForm.asset_types.length > 0 ? syncForm.asset_types : undefined,
      regions: syncForm.regions.length > 0 ? syncForm.regions : undefined,
    })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    // 跳转到任务详情页面
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交同步任务失败')
  } finally {
    syncing.value = false
  }
}
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 16px;

  .page-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-primary);
  }

  .page-subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  &__label { font-size: 12px; color: var(--text-tertiary); }
}

.provider-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

// 规格增强：行点击直达详情的指针暗示
.assets-page :deep(.el-table__row) {
  cursor: pointer;
}

.pagination-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 16px;

    .page-display {
      display: flex;
      align-items: center;
      gap: 8px;

      .page-info {
        min-width: 60px;
        padding: 4px 12px;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        color: var(--text-primary);
        background: var(--bg-hover);
        border-radius: 6px;
      }
    }

    .total-info { font-size: 14px; color: var(--text-secondary); }
  }

  :deep(.el-pagination__total) { display: none; }
}

.config-content {
  max-height: 500px;
  padding: 16px;
  overflow-x: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}
</style>
