<template>
  <PageContainer>
    <ManagerHeader
      title="镜像管理"
      subtitle="多云镜像资源统一管理"
      @refresh="fetchData"
    >
      <template #actions>
        <el-button type="primary" @click="syncDialogVisible = true">
          <el-icon><Refresh /></el-icon>
          同步镜像
        </el-button>
      </template>
    </ManagerHeader>

    <div class="image-page-layout">
      <!-- 左侧边栏 -->
      <AccountSidebar
        @update:account-id="handleAccountChange"
        @update:image-type="handleImageTypeChange"
        @quick-action="handleQuickAction"
      />

      <!-- 右侧内容区 -->
      <div class="image-main-content">
        <!-- 统计卡片 -->
        <ImageStatsCards :stats="stats" />

        <!-- 筛选器 -->
        <ImageFilters
          :model-value="filters"
          @update:model-value="handleFiltersUpdate"
          @search="handleSearch"
          @refresh="fetchData"
        />

        <!-- 批量操作栏 -->
        <transition name="batch-bar">
          <div v-if="selectedRows.length > 0" class="batch-actions">
            <div class="batch-left">
              <el-icon :size="16"><CircleCheck /></el-icon>
              <span class="batch-info">已选 <strong>{{ selectedRows.length }}</strong> 项</span>
            </div>
            <div class="batch-right">
              <el-button size="small" @click="handleBatchExport">
                <el-icon><Download /></el-icon> 批量导出
              </el-button>
              <el-button size="small" @click="handleBatchShare">
                <el-icon><Share /></el-icon> 批量共享
              </el-button>
              <el-button size="small" type="danger" @click="handleBatchDelete">
                <el-icon><Delete /></el-icon> 批量删除
              </el-button>
            </div>
          </div>
        </transition>

        <!-- 表格 -->
        <div class="image-content">
          <el-table
            v-loading="loading"
            :data="imageList"
            stripe
            style="width: 100%"
            max-height="calc(100vh - 26rem)"
            @row-click="handleRowClick"
            @selection-change="handleSelectionChange"
            highlight-current-row
            class="image-table"
          >
            <el-table-column type="selection" width="40" />
            <el-table-column label="镜像信息" min-width="260" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="image-info-cell">
                  <OsIcon
                    :os-type="row?.attributes?.os_type"
                    :platform="row?.attributes?.platform"
                    :size="36"
                  />
                  <div class="image-details">
                    <div class="image-name-row">
                      <span class="image-name">{{ row?.asset_name || row?.asset_id || '-' }}</span>
                      <el-tag
                        v-if="row?.attributes?.image_owner_alias"
                        :type="getImageTagType(row.attributes.image_owner_alias)"
                        size="small"
                        effect="plain"
                        round
                      >
                        {{ getImageTypeLabel(row.attributes.image_owner_alias) }}
                      </el-tag>
                    </div>
                    <span class="image-id">{{ row?.asset_id || '' }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="平台" width="60" align="center">
              <template #default="{ row }">
                <ProviderIcon :provider="row?.provider || ''" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作系统" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row?.attributes?.os_name || row?.attributes?.platform || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="大小" width="80" align="center">
              <template #default="{ row }">
                {{ row?.attributes?.size ? row.attributes.size + ' GB' : '-' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <ImageStatusBadge :status="row?.status || ''" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right" align="center">
              <template #default="{ row }">
                <div class="action-buttons">
                  <el-tooltip content="创建实例" placement="top">
                    <el-button type="primary" circle size="small" @click.stop="handleCreateInstance(row)">
                      <el-icon :size="14"><Plus /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="复制镜像" placement="top">
                    <el-button circle size="small" @click.stop="handleRowAction('copy', row)">
                      <el-icon :size="14"><CopyDocument /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="共享" placement="top">
                    <el-button circle size="small" @click.stop="handleRowAction('share', row)">
                      <el-icon :size="14"><Share /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <el-tooltip content="详情" placement="top">
                    <el-button circle size="small" @click.stop="handleRowClick(row)">
                      <el-icon :size="14"><View /></el-icon>
                    </el-button>
                  </el-tooltip>
                  <template v-if="row?.attributes?.image_owner_alias === 'self'">
                    <el-tooltip content="编辑" placement="top">
                      <el-button circle size="small" @click.stop="handleRowAction('edit', row)">
                        <el-icon :size="14"><Edit /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="删除" placement="top">
                      <el-button type="danger" circle size="small" @click.stop="handleRowAction('delete', row)">
                        <el-icon :size="14"><Delete /></el-icon>
                      </el-button>
                    </el-tooltip>
                  </template>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!loading && imageList.length === 0" description="暂无数据" />
        </div>

        <!-- 分页 -->
        <div v-if="pagination.total > 0" class="pagination-fixed">
          <div class="pagination-content">
            <div class="pagination-info">
              <span class="page-size-info">本页{{ imageList.length }}条 / 选中{{ selectedRows.length }}条 / 共{{ pagination.total }}条</span>
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
      </div>
    </div>

    <!-- 同步对话框 -->
    <ImageSyncDialog v-model:visible="syncDialogVisible" />

    <!-- 详情抽屉 -->
    <ImageDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
  </PageContainer>
</template>

<script setup lang="ts">
import type { ImageStatsResponse } from '@/api/asset'
import { getImageStatsApi, listImageAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import {
  CircleCheck, CopyDocument, Delete, Download, Edit,
  Plus, Refresh, Share, View,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AccountSidebar from './components/AccountSidebar.vue'
import ImageDetailDrawer from './components/ImageDetailDrawer.vue'
import ImageFilters from './components/ImageFilters.vue'
import ImageStatsCards from './components/ImageStatsCards.vue'
import ImageStatusBadge from './components/ImageStatusBadge.vue'
import ImageSyncDialog from './components/ImageSyncDialog.vue'
import OsIcon from './components/OsIcon.vue'

const router = useRouter()
const loading = ref(false)
const imageList = ref<Asset[]>([])
const pagination = reactive({ page: 1, size: 20, total: 0 })
const filters = reactive({
  provider: '', region: '', status: '', name: '',
  os_type: '', image_owner_alias: '', account_id: 0,
})
const stats = ref<ImageStatsResponse>({ total: 0, system: 0, custom: 0, shared: 0 })
const selectedRows = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)

const getImageTypeLabel = (alias: string | undefined): string => {
  const map: Record<string, string> = {
    system: '公共', self: '自定义', others: '共享', marketplace: '市场',
  }
  return map[alias || ''] || alias || '-'
}

const getImageTagType = (alias: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    system: 'primary', self: 'warning', others: 'success', marketplace: 'info',
  }
  return map[alias] || 'info'
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
    if (filters.os_type) params.os_type = filters.os_type
    if (filters.image_owner_alias) params.image_owner_alias = filters.image_owner_alias
    if (filters.account_id) params.account_id = filters.account_id
    const res = await listImageAssetsApi(params)
    const responseData = (res as any).data || res
    imageList.value = (responseData.items || []).filter((item: any) => item != null)
    pagination.total = responseData.total || 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取镜像列表失败'
    ElMessage.error(msg)
    imageList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const params: Record<string, any> = {}
    if (filters.account_id) params.account_id = filters.account_id
    if (filters.provider) params.provider = filters.provider
    const res = await getImageStatsApi(params)
    const data = (res as any).data || res
    stats.value = {
      total: data.total || 0, system: data.system || 0,
      custom: data.custom || 0, shared: data.shared || 0,
    }
  } catch {
    stats.value = { total: 0, system: 0, custom: 0, shared: 0 }
  }
}

const handleFiltersUpdate = (newFilters: typeof filters) => { Object.assign(filters, newFilters) }
const handleSearch = () => { pagination.page = 1; fetchData(); fetchStats() }
const handleSizeChange = () => { pagination.page = 1; fetchData() }
const handlePageChange = () => { fetchData() }
const handleSelectionChange = (rows: Asset[]) => { selectedRows.value = rows }
const handleRowClick = (row: Asset) => { detailInstance.value = row; detailVisible.value = true }

const handleAccountChange = (accountId: number) => {
  filters.account_id = accountId; pagination.page = 1; fetchData(); fetchStats()
}
const handleImageTypeChange = (type: string) => {
  filters.image_owner_alias = type; pagination.page = 1; fetchData(); fetchStats()
}
const handleCreateInstance = (row: Asset) => {
  router.push(`/compute/template/create?image_id=${row?.asset_id || ''}`)
}
const handleRowAction = (command: string, row: Asset) => {
  if (command === 'delete') {
    ElMessageBox.confirm(`确定要删除镜像 "${row?.asset_name || row?.asset_id}" 吗？`, '确认删除', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    }).then(() => { ElMessage.info('删除功能开发中') }).catch(() => {})
  } else { ElMessage.info(`${command} 功能开发中`) }
}
const handleQuickAction = (action: string) => {
  if (action === 'sync') { syncDialogVisible.value = true }
  else { ElMessage.info(`${action} 功能开发中`) }
}
const handleBatchExport = () => { ElMessage.info('批量导出功能开发中') }
const handleBatchShare = () => { ElMessage.info('批量共享功能开发中') }
const handleBatchDelete = () => {
  ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个镜像吗？`, '批量删除', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
  }).then(() => { ElMessage.info('批量删除功能开发中') }).catch(() => {})
}

onMounted(() => { fetchData(); fetchStats() })
</script>

<style scoped lang="scss">
.image-page-layout { display: flex; gap: 16px; }
.image-main-content { flex: 1; min-width: 0; }

.batch-actions {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), rgba(64, 158, 255, 0.08));
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 10px; margin-bottom: 12px;
  .batch-left {
    display: flex; align-items: center; gap: 6px;
    color: var(--el-color-primary); font-size: 13px;
  }
  .batch-right { display: flex; gap: 8px; }
}
.batch-bar-enter-active, .batch-bar-leave-active { transition: all 0.3s ease; }
.batch-bar-enter-from, .batch-bar-leave-to { opacity: 0; transform: translateY(-8px); }

.image-content {
  background: var(--glass-bg); backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border); border-radius: 12px; padding: 16px;
  :deep(.el-table) { cursor: pointer; --el-table-border-color: var(--border-subtle); }
  :deep(.el-table__row:hover > td) {
    background: linear-gradient(135deg, rgba(64,158,255,0.04), rgba(64,158,255,0.02)) !important;
  }
}

.image-info-cell {
  display: flex; align-items: center; gap: 12px;
  .image-details { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .image-name-row { display: flex; align-items: center; gap: 6px; }
  .image-name {
    font-size: 13px; font-weight: 500; color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .image-id {
    font-size: 12px; color: var(--text-tertiary);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }
}

.action-buttons {
  display: flex; align-items: center; gap: 4px;
  justify-content: center; flex-wrap: nowrap;
}

.pagination-fixed {
  position: sticky; bottom: 0; z-index: 100;
  background: var(--glass-bg); backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 0 0 12px 12px; margin-top: -1px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.06);
  .pagination-content {
    display: flex; justify-content: space-between;
    align-items: center; padding: 12px 24px;
  }
  .pagination-info .page-size-info { font-size: 13px; color: var(--text-secondary); }
}
</style>
