<template>
  <PageContainer>
    <ManagerHeader
      title="交换机"
      subtitle="交换机/子网管理"
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
        </div>
      </template>
    </ManagerHeader>

    <VSwitchFilters
      :model-value="filters"
      @update:model-value="handleFiltersUpdate"
      @search="handleSearch"
      @refresh="fetchData"
    />

    <div class="vswitch-content">
      <el-table
        v-loading="loading"
        :data="vswitchList"
        stripe
        style="width: 100%"
        max-height="calc(100vh - 20rem)"
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
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <VSwitchStatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="CIDR" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono-text">{{ row.attributes?.cidr_block || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可用区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.attributes?.zone || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="VPC ID" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span
              v-if="row.attributes?.vpc_id"
              class="vpc-link"
              @click.stop="handleVpcClick(row.attributes.vpc_id, row.provider)"
            >{{ row.attributes.vpc_id }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="可用IP数" width="100" align="center">
          <template #default="{ row }">
            {{ row.attributes?.available_ip_count ?? '-' }}
          </template>
        </el-table-column>
        <el-table-column label="平台" width="60" align="center">
          <template #default="{ row }">
            <ProviderIcon :provider="row.provider" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="区域" min-width="140" show-overflow-tooltip>
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
      <el-empty v-if="!loading && vswitchList.length === 0" description="暂无数据" />
    </div>

    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ vswitchList.length }}条 / 共{{ pagination.total }}条</span>
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

    <el-dialog v-model="syncDialogVisible" title="同步交换机/子网" width="600px">
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

    <VSwitchDetailDrawer
      v-model:visible="detailVisible"
      :instance="detailInstance"
      @vpc-click="handleVpcClick"
    />

    <!-- VPC 详情抽屉 -->
    <VpcDetailDrawer
      v-model:visible="vpcDetailVisible"
      :instance="vpcDetailInstance"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { getVPCAssetApi, listVSwitchAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VpcDetailDrawer from '../vpc/components/VpcDetailDrawer.vue'
import VSwitchDetailDrawer from './components/VSwitchDetailDrawer.vue'
import VSwitchFilters from './components/VSwitchFilters.vue'
import VSwitchStatusBadge from './components/VSwitchStatusBadge.vue'

const route = useRoute()
const router = useRouter()
const loading = ref(false)

const filters = reactive({ provider: '', region: '', status: '', name: '', vpc_id: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const vswitchList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '', regions: [] as string[] })
const syncing = ref(false)

// VPC 详情抽屉
const vpcDetailVisible = ref(false)
const vpcDetailInstance = ref<Asset | null>(null)

const handleVpcClick = async (vpcId: string, provider?: string) => {
  if (!vpcId) return
  try {
    const params: Record<string, string> = {}
    if (provider) params.provider = provider
    const res = await getVPCAssetApi(vpcId, params)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API 响应结构需要解包
    const data = (res as unknown as { data: Asset }).data || res
    vpcDetailInstance.value = data as Asset
    vpcDetailVisible.value = true
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '获取 VPC 详情失败'
    ElMessage.error(msg)
  }
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
    if (filters.status) params.status = filters.status
    if (filters.name) params.name = filters.name
    if (filters.vpc_id) params.vpc_id = filters.vpc_id

    const res = await listVSwitchAssetsApi(params)
    const responseData = (res as any).data || res
    vswitchList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取交换机列表失败')
    vswitchList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleFiltersUpdate = (newFilters: typeof filters) => { Object.assign(filters, newFilters) }
const handleSearch = () => { pagination.page = 1; fetchData() }
const handleReset = () => { Object.assign(filters, { provider: '', name: '', region: '', status: '', vpc_id: '' }); handleSearch() }
const handleSizeChange = () => { pagination.page = 1; fetchData() }
const handlePageChange = () => { fetchData() }
const handleRowClick = (row: Asset) => { detailInstance.value = row; detailVisible.value = true }

const handleSync = () => {
  syncForm.provider = ''
  syncForm.regions = []
  syncDialogVisible.value = true
}

const submitSync = async () => {
  if (!syncForm.provider) { ElMessage.warning('请选择云厂商'); return }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: ['vswitch'],
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
  // 从 URL query 读取 vpc_id 过滤参数（从 VPC 详情跳转过来）
  const queryVpcId = route.query.vpc_id
  if (typeof queryVpcId === 'string' && queryVpcId) {
    filters.vpc_id = queryVpcId
  }
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
    .stat-label { font-size: 13px; color: var(--text-secondary); }
    .stat-value { font-size: 16px; font-weight: 600; color: var(--text-primary); }
  }
}

.vswitch-content {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  :deep(.el-table) { cursor: pointer; }
  .id-name-cell {
    display: flex; flex-direction: column; line-height: 1.4;
    .asset-id { color: var(--el-color-primary); cursor: pointer; font-size: 13px; &:hover { text-decoration: underline; } }
    .asset-name { color: var(--text-tertiary); font-size: 12px; margin-top: 2px; }
  }
  .mono-text { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--el-color-primary); }
  .vpc-link { color: var(--el-color-primary); cursor: pointer; &:hover { text-decoration: underline; } }
}

.pagination-fixed {
  position: sticky; bottom: 0; z-index: 100;
  background: var(--bg-elevated); border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  .pagination-content {
    display: flex; justify-content: space-between; align-items: center; padding: 12px 24px;
  }
  .pagination-info .page-size-info { font-size: 13px; color: var(--text-secondary); }
}
</style>
