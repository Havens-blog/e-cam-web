<template>
  <PageContainer>
    <ManagerHeader
      title="VPC"
      subtitle="虚拟私有云管理"
      @refresh="fetchData"
    >
      <template #actions>
        <el-button type="primary" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </template>
      <template #extra>
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">总数</span>
            <span class="stat-value">{{ pagination.total }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">可用</span>
            <span class="stat-value running">{{ availableCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">异常</span>
            <span class="stat-value error">{{ errorCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <!-- Tab 切换 -->
    <div class="vpc-tabs">
      <el-radio-group v-model="activeTab">
        <el-radio-button label="all">全部</el-radio-button>
        <el-radio-button label="local">本地IDC</el-radio-button>
        <el-radio-button label="cloud">公有云</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 筛选器 -->
    <VpcFilters 
      :model-value="filters" 
      @update:model-value="handleFiltersUpdate" 
      @search="handleSearch"
      @refresh="fetchData"
      @export="showExportDialog = true"
      @column-settings="showColumnSettings = true"
    />

    <!-- VPC 表格 -->
    <div class="vpc-content">
      <el-table
        v-loading="loading"
        :data="vpcList"
        stripe
        style="width: 100%"
        max-height="calc(100vh - 22rem)"
        @row-click="handleRowClick"
        highlight-current-row
      >
        <el-table-column type="selection" width="40" />
        <el-table-column label="云上ID/名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="id-name-cell">
              <span class="asset-id">{{ row.asset_id || '-' }}</span>
              <span v-if="row.asset_name" class="asset-name">{{ row.asset_name }}</span>
            </div>
          </template>
        </el-table-column>
        <!-- 动态列 -->
        <el-table-column
          v-for="col in visibleColumns"
          :key="col.key"
          :label="col.label"
          :min-width="col.width"
          :show-overflow-tooltip="['account_name', 'shared_machines', 'network_domain', 'region', 'cidr_block', 'ipv6_cidr_block'].includes(col.key)"
          :align="['status', 'enable_internet_access', 'vswitch_count', 'platform', 'is_default'].includes(col.key) ? 'center' : undefined"
        >
          <template #default="{ row }">
            <!-- 状态列 -->
            <template v-if="col.key === 'status'">
              <VpcStatusBadge :status="row.status" />
            </template>
            <!-- IPv4网段列 -->
            <template v-else-if="col.key === 'cidr_block'">
              {{ row.attributes?.cidr_block || '-' }}
            </template>
            <!-- IPv6网段列 -->
            <template v-else-if="col.key === 'ipv6_cidr_block'">
              {{ row.attributes?.ipv6_cidr_block || '-' }}
            </template>
            <!-- 允许外网访问列 -->
            <template v-else-if="col.key === 'enable_internet_access'">
              {{ row.attributes?.enable_internet_access ? '启用' : '禁用' }}
            </template>
            <!-- IP数列 -->
            <template v-else-if="col.key === 'vswitch_count'">
              <span class="ip-count">{{ row.attributes?.vswitch_count || 0 }}</span>
            </template>
            <!-- 平台列 -->
            <template v-else-if="col.key === 'platform'">
              <ProviderIcon :provider="row.provider" size="small" />
            </template>
            <!-- 云账号列 -->
            <template v-else-if="col.key === 'account_name'">
              {{ row.attributes?.account_name || '-' }}
            </template>
            <!-- 共享机器列 -->
            <template v-else-if="col.key === 'shared_machines'">
              {{ row.attributes?.shared_machines || '-' }}
            </template>
            <!-- 网段域列 -->
            <template v-else-if="col.key === 'network_domain'">
              {{ row.attributes?.network_domain || '-' }}
            </template>
            <!-- 区域列 -->
            <template v-else-if="col.key === 'region'">
              {{ getRegionLabel(row.provider, row.region) }}
            </template>
            <!-- 默认VPC列 -->
            <template v-else-if="col.key === 'is_default'">
              {{ row.attributes?.is_default ? '是' : '-' }}
            </template>
            <!-- 创建时间列 -->
            <template v-else-if="col.key === 'create_time'">
              {{ row.create_time || '-' }}
            </template>
            <!-- 默认 -->
            <template v-else>-</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, row)">
              <el-button type="primary" link>
                同步状态
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="sync">同步状态</el-dropdown-item>
                  <el-dropdown-item command="view">查看详情</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && vpcList.length === 0" description="暂无数据" />
    </div>

    <!-- 固定分页 -->
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ vpcList.length }}条 / 选中0条 / 共{{ pagination.total }}条</span>
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 同步对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步VPC" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select v-model="syncForm.provider" placeholder="请选择云厂商" style="width: 100%">
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="syncForm.regions" multiple placeholder="留空表示同步所有区域" style="width: 100%" clearable allow-create filterable>
            <el-option label="北京" value="cn-beijing" />
            <el-option label="上海" value="cn-shanghai" />
            <el-option label="广州" value="cn-guangzhou" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <VpcDetailDrawer
      v-model:visible="detailVisible"
      :instance="detailInstance"
    />

    <!-- 导出对话框 -->
    <ExportDialog
      v-model:visible="showExportDialog"
      :instances="vpcList"
      :selected-ids="selectedIds"
      :total="pagination.total"
    />

    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog
      v-model:visible="showColumnSettings"
      :columns="columnSettings"
      @update:columns="handleColumnsUpdate"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listVPCAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { ArrowDown, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import VpcDetailDrawer from './components/VpcDetailDrawer.vue'
import VpcFilters from './components/VpcFilters.vue'
import VpcStatusBadge from './components/VpcStatusBadge.vue'

const router = useRouter()

// 状态
const loading = ref(false)
const activeTab = ref('all')

// 筛选条件
const filters = reactive({
  provider: '',
  region: '',
  status: '',
  name: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const vpcList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 导出和自定义列
const showExportDialog = ref(false)
const showColumnSettings = ref(false)
const selectedIds = ref<number[]>([])

// 默认列配置
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 80, visible: true },
  { key: 'cidr_block', label: 'IPv4网段', width: 130, visible: true },
  { key: 'vswitch_count', label: 'IP数', width: 70, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'account_name', label: '云账号', width: 100, visible: true },
  { key: 'region', label: '区域', width: 130, visible: true },
  { key: 'is_default', label: '默认VPC', width: 80, visible: true },
  { key: 'ipv6_cidr_block', label: 'IPv6网段', width: 130, visible: false },
  { key: 'enable_internet_access', label: '允许外网访问', width: 100, visible: false },
  { key: 'shared_machines', label: '共享机器', width: 100, visible: false },
  { key: 'network_domain', label: '网段域', width: 100, visible: false },
  { key: 'create_time', label: '创建时间', width: 140, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

// 加载列设置
const loadColumnSettings = () => {
  const saved = localStorage.getItem('vpc-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        columnSettings.value = parsed
        return
      }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnsUpdate = (columns: ColumnConfig[]) => {
  columnSettings.value = columns
}

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({
  provider: '',
  regions: [] as string[],
})
const syncing = ref(false)

// 计算属性
const availableCount = computed(() => vpcList.value.filter(i => 
  i.status === 'Available' || i.status === 'available' || i.status === '正常'
).length)
const errorCount = computed(() => vpcList.value.filter(i => 
  i.status === 'error' || i.status === 'Error'
).length)

// 获取区域标签
const getRegionLabel = (provider: string, region: string) => {
  const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === region)
  return regionItem?.label || region || '-'
}

// 获取数据
const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    if (filters.provider) params.provider = filters.provider
    if (filters.region) params.region = filters.region
    if (filters.status) params.status = filters.status
    if (filters.name) params.name = filters.name

    const res = await listVPCAssetsApi(params)
    const responseData = (res as any).data || res
    vpcList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取VPC列表失败')
    vpcList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleFiltersUpdate = (newFilters: typeof filters) => {
  Object.assign(filters, newFilters)
}

const handleSearch = () => {
  pagination.page = 1
  fetchData()
}

const handleSizeChange = () => {
  pagination.page = 1
  fetchData()
}

const handlePageChange = () => {
  fetchData()
}

const handleRowClick = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleCommand = (command: string, row: Asset) => {
  if (command === 'view') {
    detailInstance.value = row
    detailVisible.value = true
  } else if (command === 'sync') {
    ElMessage.info('同步状态功能开发中')
  }
}

const handleSync = () => {
  syncForm.provider = ''
  syncForm.regions = []
  syncDialogVisible.value = true
}

const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: ['vpc'],
      regions: syncForm.regions.length > 0 ? syncForm.regions : undefined,
    })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交同步任务失败')
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  loadColumnSettings()
  fetchData()
})
</script>

<style scoped lang="scss">
.stats-bar {
  display: flex;
  gap: 24px;
  
  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .stat-label {
      font-size: 13px;
      color: var(--text-secondary);
    }
    
    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      
      &.running {
        color: var(--el-color-success);
      }
      
      &.error {
        color: var(--el-color-danger);
      }
    }
  }
}

.vpc-tabs {
  margin-bottom: 16px;
  
  :deep(.el-radio-button__inner) {
    padding: 8px 20px;
  }
}

.vpc-content {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  :deep(.el-table) {
    cursor: pointer;
    
    .el-table__row:hover {
      background-color: var(--bg-hover);
    }
  }
  
  .id-name-cell {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
    
    .asset-id {
      color: var(--el-color-primary);
      cursor: pointer;
      font-size: 13px;
      
      &:hover {
        text-decoration: underline;
      }
    }
    
    .asset-name {
      color: var(--text-tertiary);
      font-size: 12px;
      margin-top: 2px;
    }
  }
  
  .ip-count {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.pagination-fixed {
  position: sticky;
  bottom: 0;
  z-index: 100;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  
  .pagination-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
  }
  
  .pagination-info {
    .page-size-info {
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
}
</style>
