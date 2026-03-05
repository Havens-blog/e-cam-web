<template>
  <PageContainer>
    <ManagerHeader
      title="负载均衡"
      subtitle="SLB / ALB / NLB 负载均衡管理"
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
            <span class="stat-value running">{{ activeCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">公网</span>
            <span class="stat-value">{{ internetCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">内网</span>
            <span class="stat-value">{{ intranetCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <LbFilters
      :model-value="filters"
      @update:model-value="handleFiltersUpdate"
      @search="handleSearch"
      @refresh="fetchData"
    />

    <!-- LB 表格 -->
    <div class="lb-content">
      <el-table
        v-loading="loading"
        :data="lbList"
        stripe
        style="width: 100%"
        max-height="calc(100vh - 22rem)"
        @row-click="handleRowClick"
        highlight-current-row
      >
        <el-table-column type="selection" width="40" />
        <el-table-column label="实例ID/名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="id-name-cell">
              <span class="asset-id">{{ row.asset_id || '-' }}</span>
              <span v-if="row.asset_name" class="asset-name">{{ row.asset_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <LbStatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getLBTypeTag(row.attributes?.load_balancer_type)">
              {{ getLBTypeLabel(row.attributes?.load_balancer_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="VIP地址" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono-text">{{ row.attributes?.address || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="网络类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.attributes?.address_type === 'internet' ? 'warning' : 'info'" effect="plain">
              {{ row.attributes?.address_type === 'internet' ? '公网' : '内网' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="带宽" width="90">
          <template #default="{ row }">
            {{ row.attributes?.bandwidth ? row.attributes.bandwidth + ' Mbps' : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="平台" width="60" align="center">
          <template #default="{ row }">
            <ProviderIcon :provider="row.provider" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="区域" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getRegionLabel(row.provider, row.region) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="handleRowClick(row)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && lbList.length === 0" description="暂无数据" />
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ lbList.length }}条 / 共{{ pagination.total }}条</span>
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
    <el-dialog v-model="syncDialogVisible" title="同步负载均衡" width="600px">
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
            <el-option label="杭州" value="cn-hangzhou" />
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
    <LbDetailDrawer
      v-model:visible="detailVisible"
      :instance="detailInstance"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listLBAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import LbDetailDrawer from './components/LbDetailDrawer.vue'
import LbFilters from './components/LbFilters.vue'
import LbStatusBadge from './components/LbStatusBadge.vue'

const router = useRouter()

const loading = ref(false)

const filters = reactive({
  provider: '',
  region: '',
  name: '',
  lb_type: '',
  address_type: '',
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const lbList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 同步
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '', regions: [] as string[] })
const syncing = ref(false)

// 统计
const activeCount = computed(() => lbList.value.filter(i =>
  ['active', 'Active', 'running', 'Running'].includes(i.status)
).length)
const internetCount = computed(() => lbList.value.filter(i =>
  i.attributes?.address_type === 'internet'
).length)
const intranetCount = computed(() => lbList.value.filter(i =>
  i.attributes?.address_type === 'intranet'
).length)

const getLBTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = { slb: 'SLB', alb: 'ALB', nlb: 'NLB' }
  return map[type || ''] || type || 'SLB'
}

const getLBTypeTag = (type: string | undefined): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const map: Record<string, 'success' | 'warning' | 'info' | 'primary' | 'danger'> = { slb: 'primary', alb: 'success', nlb: 'warning' }
  return map[type || ''] || 'info'
}

const getRegionLabel = (provider: string, region: string) => {
  const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === region)
  return regionItem?.label || region || '-'
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    if (filters.provider) params.provider = filters.provider
    if (filters.region) params.region = filters.region
    if (filters.name) params.name = filters.name
    if (filters.lb_type) params.lb_type = filters.lb_type
    if (filters.address_type) params.address_type = filters.address_type

    const res = await listLBAssetsApi(params)
    const responseData = (res as any).data || res
    lbList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取负载均衡列表失败')
    lbList.value = []
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
      asset_types: ['lb'],
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
    }
  }
}

.lb-content {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;

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

  .mono-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
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
