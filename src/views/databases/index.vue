<template>
  <PageContainer>
    <ManagerHeader
      :title="getPageTitle"
      :subtitle="getPageSubtitle"
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
            <span class="stat-label">运行中</span>
            <span class="stat-value running">{{ runningCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">操作失败</span>
            <span class="stat-value error">{{ errorCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <!-- 数据库类型 Tab -->
    <div class="database-tabs">
      <el-radio-group v-model="activeTab" @change="handleTabChange">
        <el-radio-button label="rds">RDS</el-radio-button>
        <el-radio-button label="redis">Redis</el-radio-button>
        <el-radio-button label="mongodb">MongoDB</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 筛选器 -->
    <DatabaseFilters v-model="filters" @search="handleSearch" />

    <!-- 数据库表格 -->
    <div class="database-content">
      <el-table
        v-loading="loading"
        :data="currentList"
        stripe
        style="width: 100%"
        max-height="calc(100vh - 22rem)"
        @row-click="handleRowClick"
        highlight-current-row
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="asset_name" label="名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="name-link">{{ row.asset_name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <DatabaseStatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="实例类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ getInstanceType(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型版本" width="100">
          <template #default="{ row }">
            {{ row.attributes?.engine || activeTab.toUpperCase() }} {{ row.attributes?.engine_version || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="链接地址" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="connection-text">
              内网：{{ row.attributes?.connection_string || row.attributes?.private_ip || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="端口" width="80" align="center">
          <template #default="{ row }">
            内网：{{ row.attributes?.port || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="计费方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.attributes?.charge_type === 'Prepaid' ? 'warning' : 'info'" size="small">
              {{ row.attributes?.charge_type === 'Prepaid' ? '包年包月' : '按量付费' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="60" align="center">
          <template #default="{ row }">
            <ProviderIcon :provider="row.provider" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="云账号" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.attributes?.account_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="项目" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.attributes?.project || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="region" label="区域" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getRegionLabel(row.provider, row.region) }}
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
      <el-empty v-if="!loading && currentList.length === 0" description="暂无数据" />
    </div>

    <!-- 固定分页 -->
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ currentList.length }}条 / 选中0条 / 共{{ pagination.total }}条</span>
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

    <!-- 同步数据库对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步数据库实例" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select v-model="syncForm.provider" placeholder="请选择云厂商" style="width: 100%">
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据库类型">
          <el-select v-model="syncForm.db_types" multiple placeholder="留空表示同步所有类型" style="width: 100%" clearable>
            <el-option label="RDS" value="rds" />
            <el-option label="Redis" value="redis" />
            <el-option label="MongoDB" value="mongodb" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="syncForm.regions" multiple placeholder="留空表示同步所有区域" style="width: 100%" clearable allow-create filterable>
            <el-option label="北京" value="cn-beijing" />
            <el-option label="上海" value="cn-shanghai" />
            <el-option label="广州" value="cn-guangzhou" />
            <el-option label="深圳" value="cn-shenzhen" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <DatabaseDetailDrawer
      v-model:visible="detailVisible"
      :db-type="activeTab"
      :instance="detailInstance"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listMongoDBAssetsApi, listRDSAssetsApi, listRedisAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { ArrowDown, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import DatabaseDetailDrawer from './components/DatabaseDetailDrawer.vue'
import DatabaseFilters from './components/DatabaseFilters.vue'
import DatabaseStatusBadge from './components/DatabaseStatusBadge.vue'

type DatabaseType = 'rds' | 'redis' | 'mongodb'

const router = useRouter()

// 状态
const loading = ref(false)
const activeTab = ref<DatabaseType>('rds')

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
const rdsList = ref<Asset[]>([])
const redisList = ref<Asset[]>([])
const mongoList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({
  provider: '',
  db_types: [] as string[],
  regions: [] as string[],
})
const syncing = ref(false)

// 计算属性
const currentList = computed(() => {
  switch (activeTab.value) {
    case 'rds': return rdsList.value
    case 'redis': return redisList.value
    case 'mongodb': return mongoList.value
    default: return rdsList.value
  }
})

const runningCount = computed(() => currentList.value.filter(i => i.status === 'running' || i.status === 'Running').length)
const errorCount = computed(() => currentList.value.filter(i => i.status === 'error' || i.status === 'Error').length)

const getPageTitle = computed(() => {
  const titles: Record<DatabaseType, string> = {
    rds: 'RDS实例',
    redis: 'Redis实例',
    mongodb: 'MongoDB实例',
  }
  return titles[activeTab.value]
})

const getPageSubtitle = computed(() => {
  const subtitles: Record<DatabaseType, string> = {
    rds: '管理关系型数据库实例',
    redis: '管理 Redis 缓存实例',
    mongodb: '管理 MongoDB 文档数据库实例',
  }
  return subtitles[activeTab.value]
})

// 获取实例类型
const getInstanceType = (row: Asset) => {
  if (activeTab.value === 'redis') {
    const arch = row.attributes?.architecture
    const map: Record<string, string> = { standard: '基础版', cluster: '集群版', rwsplit: '读写分离' }
    return map[arch] || '高可用'
  }
  if (activeTab.value === 'mongodb') {
    const type = row.attributes?.db_type
    const map: Record<string, string> = { replicate: '副本集', sharding: '分片集群', serverless: 'Serverless' }
    return map[type] || '副本集'
  }
  return row.attributes?.instance_class || '高可用'
}

// 获取区域标签
const getRegionLabel = (provider: string, region: string) => {
  const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === region)
  return regionItem?.label || region || '-'
}

// 获取对应的 API 函数
const getApiFunction = () => {
  switch (activeTab.value) {
    case 'rds': return listRDSAssetsApi
    case 'redis': return listRedisAssetsApi
    case 'mongodb': return listMongoDBAssetsApi
  }
}

// 获取当前列表引用
const getCurrentListRef = () => {
  switch (activeTab.value) {
    case 'rds': return rdsList
    case 'redis': return redisList
    case 'mongodb': return mongoList
  }
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

    const apiFunc = getApiFunction()
    const res = await apiFunc(params)
    const list = getCurrentListRef()
    const responseData = (res as any).data || res
    list.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取数据库列表失败')
    getCurrentListRef().value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchData()
}

const handleTabChange = () => {
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
  syncForm.db_types = []
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
    const assetTypes = syncForm.db_types.length > 0 ? syncForm.db_types : ['rds', 'redis', 'mongodb']
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: assetTypes,
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

.database-tabs {
  margin-bottom: 16px;
  
  :deep(.el-radio-button__inner) {
    padding: 8px 20px;
  }
}

.database-content {
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
  
  .name-link {
    color: var(--el-color-primary);
    cursor: pointer;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  .connection-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--text-secondary);
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
