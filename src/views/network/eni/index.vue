<template>
  <PageContainer>
    <ManagerHeader
      title="弹性网卡"
      subtitle="管理所有云平台的弹性网卡（ENI）资源"
      @refresh="fetchData"
    >
      <template #actions>
        <el-button @click="exportDialogVisible = true">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button type="primary" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </template>
    </ManagerHeader>

    <!-- 统计卡片 -->
    <EniStatsCards
      :total="pagination.total"
      :in-use-count="inUseCount"
      :available-count="availableCount"
      :primary-count="primaryCount"
      :secondary-count="secondaryCount"
    />

    <!-- 筛选器 -->
    <div class="eni-filters">
      <div class="filters-left">
        <el-input
          v-model="filters.name"
          placeholder="搜索网卡ID、名称、IP..."
          clearable
          @input="handleSearchInput"
          style="width: 280px"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.provider" placeholder="全部云平台" clearable @change="handleSearch" style="width: 130px">
          <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
        <el-select v-model="filters.status" placeholder="全部状态" clearable @change="handleSearch" style="width: 120px">
          <el-option label="使用中" value="in_use" />
          <el-option label="可用" value="available" />
          <el-option label="绑定中" value="attaching" />
          <el-option label="解绑中" value="detaching" />
        </el-select>
        <el-select v-model="filters.type" placeholder="网卡类型" clearable @change="handleSearch" style="width: 120px">
          <el-option label="主网卡" value="Primary" />
          <el-option label="辅助网卡" value="Secondary" />
        </el-select>
      </div>
      <div class="filters-right">
        <el-tooltip content="刷新">
          <el-button :icon="Refresh" circle size="small" @click="fetchData" />
        </el-tooltip>
        <el-tooltip content="重置筛选">
          <el-button :icon="RefreshLeft" circle size="small" @click="handleReset" />
        </el-tooltip>
      </div>
    </div>

    <!-- ENI 表格 -->
    <div class="eni-table-wrapper">
      <el-table
        v-loading="loading"
        :data="eniList"
        style="width: 100%"
        max-height="calc(100vh - 26rem)"
        @row-click="handleRowClick"
        @selection-change="handleSelectionChange"
        highlight-current-row
      >
        <el-table-column type="selection" width="40" />
        <el-table-column label="网卡ID / 名称" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="id-name-cell">
              <span class="cell-id">{{ row.asset_id || '-' }}</span>
              <span v-if="row.asset_name && row.asset_name !== row.asset_id" class="cell-name">{{ row.asset_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <EniStatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.attributes?.type === 'Primary' ? 'primary' : 'info'" effect="plain">
              {{ row.attributes?.type === 'Primary' ? '主网卡' : '辅助网卡' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="主私网IP" width="140">
          <template #default="{ row }">
            <span v-if="row.attributes?.primary_private_ip" class="ip-text">{{ row.attributes.primary_private_ip }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="云平台" width="140">
          <template #default="{ row }">
            <div class="provider-cell">
              <ProviderIcon :provider="row.provider" size="small" />
              <span>{{ row.attributes?.cloud_account_name || getProviderLabel(row.provider) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="绑定实例" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.attributes?.instance_id">
              <div class="id-name-cell">
                <span class="cell-id" style="font-size: 11.5px">{{ row.attributes.instance_id }}</span>
                <span v-if="row.attributes.instance_name" class="cell-name">{{ row.attributes.instance_name }}</span>
              </div>
            </template>
            <span v-else class="text-muted">未绑定</span>
          </template>
        </el-table-column>
        <el-table-column label="VPC" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono-text">{{ row.attributes?.vpc_id || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="安全组" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.attributes?.security_group_ids?.length" size="small" effect="plain">
              {{ row.attributes.security_group_ids.length }}
            </el-tag>
            <span v-else class="text-muted">0</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">
            <span class="mono-text">{{ formatTime(row.attributes?.creation_time) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="handleRowClick(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && eniList.length === 0" description="暂无数据" />
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="pagination-bar">
      <span class="pagination-info">
        共 {{ pagination.total }} 条 · 第 {{ pagination.page }}/{{ Math.ceil(pagination.total / pagination.size) }} 页
        <template v-if="selectedIds.length > 0"> · 已选 {{ selectedIds.length }} 条</template>
      </span>
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

    <!-- 同步对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步弹性网卡" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select v-model="syncForm.provider" placeholder="请选择云厂商" style="width: 100%">
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <EniDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <EniExportDialog v-model:visible="exportDialogVisible" :instances="eniList" :selected-ids="selectedIds" :total="pagination.total" />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listENIAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { Download, Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import EniDetailDrawer from './components/EniDetailDrawer.vue'
import EniExportDialog from './components/EniExportDialog.vue'
import EniStatsCards from './components/EniStatsCards.vue'
import EniStatusBadge from './components/EniStatusBadge.vue'

const router = useRouter()
const loading = ref(false)
const filters = reactive({ provider: '', name: '', status: '', type: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const eniList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)
let searchTimer: number | null = null

const exportDialogVisible = ref(false)
const selectedIds = ref<number[]>([])

const inUseCount = computed(() => eniList.value.filter(i =>
  ['in_use', 'InUse', 'ACTIVE', 'BINDBOUND'].includes(i.status)
).length)

const availableCount = computed(() => eniList.value.filter(i =>
  ['available', 'Available', 'DOWN', 'BINDUNBOUND'].includes(i.status)
).length)

const primaryCount = computed(() => eniList.value.filter(i =>
  i.attributes?.type === 'Primary'
).length)

const secondaryCount = computed(() => eniList.value.filter(i =>
  i.attributes?.type === 'Secondary' || i.attributes?.type !== 'Primary'
).length)

const handleSelectionChange = (rows: Asset[]) => { selectedIds.value = rows.map(r => r.id) }

const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(time)
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { offset: (pagination.page - 1) * pagination.size, limit: pagination.size }
    if (filters.provider) params.provider = filters.provider
    if (filters.name) params.name = filters.name
    if (filters.status) params.status = filters.status
    if (filters.type) params.type = filters.type
    const res = await listENIAssetsApi(params)
    const responseData = (res as any).data || res
    eniList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取弹性网卡列表失败'
    ElMessage.error(msg)
    eniList.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

const handleSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => { pagination.page = 1; fetchData() }, 500)
}
const handleSearch = () => { pagination.page = 1; fetchData() }
const handleSizeChange = () => { pagination.page = 1; fetchData() }
const handlePageChange = () => { fetchData() }
const handleReset = () => { Object.assign(filters, { provider: '', name: '', status: '', type: '' }); handleSearch() }
const handleRowClick = (row: Asset) => { detailInstance.value = row; detailVisible.value = true }
const handleSync = () => { syncForm.provider = ''; syncDialogVisible.value = true }
const submitSync = async () => {
  if (!syncForm.provider) { ElMessage.warning('请选择云厂商'); return }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['eni'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '提交同步任务失败'
    ElMessage.error(msg)
  } finally { syncing.value = false }
}

onMounted(() => { fetchData() })
</script>

<style scoped lang="scss">
.eni-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;

  .filters-left { display: flex; align-items: center; gap: 8px; flex: 1; }
  .filters-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 12px; }
}

.eni-table-wrapper {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  overflow: hidden;

  :deep(.el-table) { cursor: pointer; }

  .id-name-cell {
    display: flex; flex-direction: column; line-height: 1.4;
    .cell-id { color: var(--el-color-primary); font-weight: 500; font-size: 13px; cursor: pointer; &:hover { text-decoration: underline; } }
    .cell-name { color: var(--text-tertiary); font-size: 11px; margin-top: 2px; }
  }

  .provider-cell { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-secondary); }

  .ip-text {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.06);
    padding: 1px 6px;
    border-radius: 3px;
  }

  .mono-text { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; color: var(--text-tertiary); }
  .text-muted { color: var(--text-tertiary); font-size: 12px; }
}

.pagination-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; background: var(--glass-bg); border: 1px solid var(--glass-border);
  border-radius: 10px; margin-top: 12px;
  .pagination-info { font-size: 12px; color: var(--text-tertiary); }
}
</style>
