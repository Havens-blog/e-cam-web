<template>
  <PageContainer>
    <ManagerHeader
      title="CDN 加速"
      subtitle="管理所有云平台的内容分发网络加速域名"
      @refresh="fetchData"
    >
      <template #actions>
        <el-button @click="columnSettingsVisible = true">
          <el-icon><Setting /></el-icon>
          自定义列
        </el-button>
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

    <!-- 统计卡片(全局真实计数,不受筛选影响) -->
    <div class="page-stats">
      <StatCard title="加速域名" :value="stats.total" icon="Connection" icon-color="#3b82f6" subtitle="多云平台统一纳管" />
      <StatCard title="在线域名" :value="stats.online" icon="CircleCheck" icon-color="#16a34a" :subtitle="onlineRateText" />
      <StatCard title="HTTPS 启用" :value="stats.https" icon="Lock" icon-color="#d97706" :subtitle="httpsRateText" />
    </div>

    <!-- 筛选器 -->
    <div class="cdn-filters">
      <div class="filters-left">
        <el-input
          v-model="filters.name"
          placeholder="搜索域名、CNAME..."
          clearable
          @input="handleSearchInput"
          style="width: 280px"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.provider" placeholder="全部云厂商" clearable @change="handleSearch" style="width: 130px">
          <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
        <el-select v-model="filters.status" placeholder="全部状态" clearable @change="handleSearch" style="width: 120px">
          <el-option label="正常" value="online" />
          <el-option label="配置中" value="configuring" />
          <el-option label="已停用" value="offline" />
          <el-option label="审核中" value="checking" />
        </el-select>
        <el-select v-model="filters.business_type" placeholder="业务类型" clearable @change="handleSearch" style="width: 130px">
          <el-option v-for="o in CDN_BUSINESS_TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="filters.service_area" placeholder="服务区域" clearable @change="handleSearch" style="width: 120px">
          <el-option v-for="o in CDN_SERVICE_AREA_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </div>
      <div class="filters-right">
        <el-tooltip content="重置筛选">
          <el-button :icon="RefreshLeft" circle size="small" @click="handleReset" />
        </el-tooltip>
      </div>
    </div>

    <!-- CDN 表格 -->
    <div class="cdn-table-wrapper">
      <el-table
        v-loading="loading"
        :data="cdnList"
        style="width: 100%"
        max-height="calc(100vh - 26rem)"
        @row-click="handleRowClick"
        @selection-change="handleSelectionChange"
        highlight-current-row
      >
        <el-table-column type="selection" width="40" />
        <el-table-column label="域名" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="domain-name">{{ extractDomainName(row) }}</span>
          </template>
        </el-table-column>
        <template v-for="col in visibleColumns" :key="col.key">
          <el-table-column v-if="col.key === 'status'" label="状态" :width="col.width" align="center">
            <template #default="{ row }">
              <AssetStatusBadge :status="row.status" :labels="statusLabels" />
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'business_type'" label="业务类型" :width="col.width">
            <template #default="{ row }">
              <span class="cell-text">{{ cdnBusinessTypeLabel(row.attributes?.business_type) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'platform'" label="云平台" :width="col.width">
            <template #default="{ row }">
              <div class="provider-cell">
                <ProviderIcon :provider="row.provider" size="small" />
                <span>{{ row.attributes?.cloud_account_name || getProviderLabel(row.provider) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'https_enabled'" label="HTTPS" :width="col.width" align="center">
            <template #default="{ row }">
              <el-icon v-if="row.attributes?.https_enabled" class="bool-on" :size="15"><CircleCheck /></el-icon>
              <span v-else class="bool-off">—</span>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'service_area'" label="服务区域" :width="col.width">
            <template #default="{ row }">
              {{ cdnServiceAreaLabel(row.attributes?.service_area) }}
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'creation_time'" label="创建时间" :width="col.width" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="mono-text">{{ formatTime(row.attributes?.creation_time) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'cname'" label="CNAME" :width="col.width" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="mono-text">{{ extractCname(row) || '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'http2_enabled'" label="HTTP/2" :width="col.width" align="center">
            <template #default="{ row }">
              <el-icon v-if="row.attributes?.http2_enabled" class="bool-on" :size="15"><CircleCheck /></el-icon>
              <span v-else class="bool-off">—</span>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'cert_name'" label="证书名称" :width="col.width" show-overflow-tooltip>
            <template #default="{ row }">{{ row.attributes?.cert_name || '-' }}</template>
          </el-table-column>
        </template>
      </el-table>
      <el-empty v-if="!loading && cdnList.length === 0" description="暂无数据" />
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
    <el-dialog v-model="syncDialogVisible" title="同步CDN域名" width="600px">
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
    <CdnDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <ExportDialog v-model:visible="exportDialogVisible" :instances="cdnList" :selected-ids="selectedIds" :total="pagination.total" />
    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnsUpdate" />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listCDNAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import StatCard from '@/components/StatCard.vue'
import {
  CDN_BUSINESS_TYPE_OPTIONS,
  CDN_SERVICE_AREA_OPTIONS,
  CDN_STATUS_LABELS,
  cdnBusinessTypeLabel,
  cdnServiceAreaLabel,
} from '@/utils/cdn'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { CircleCheck, Download, Refresh, RefreshLeft, Search, Setting } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CdnDetailDrawer from './components/CdnDetailDrawer.vue'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'

const router = useRouter()
const loading = ref(false)
const filters = reactive({ provider: '', name: '', business_type: '', status: '', service_area: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const cdnList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)
let searchTimer: number | null = null

const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)
const selectedIds = ref<number[]>([])

const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'business_type', label: '业务类型', width: 100, visible: true },
  { key: 'platform', label: '云平台', width: 140, visible: true },
  { key: 'https_enabled', label: 'HTTPS', width: 80, visible: true },
  { key: 'service_area', label: '加速区域', width: 100, visible: true },
  { key: 'creation_time', label: '创建时间', width: 150, visible: true },
  { key: 'cname', label: 'CNAME', width: 220, visible: false },
  { key: 'http2_enabled', label: 'HTTP/2', width: 80, visible: false },
  { key: 'cert_name', label: '证书名称', width: 140, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('cdn-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnsUpdate = (columns: ColumnConfig[]) => { columnSettings.value = columns }
const handleSelectionChange = (rows: Asset[]) => { selectedIds.value = rows.map(r => r.id) }

// ===== 全局真实统计(独立于筛选/分页,跨全量计数) =====
const stats = reactive({ total: 0, online: 0, https: 0 })

const rateText = (part: number, base: number, name: string) => {
  if (!base) return '暂无数据'
  return `${name}率 ${Math.round((part / base) * 100)}%`
}
const onlineRateText = computed(() => rateText(stats.online, stats.total, '在线'))
const httpsRateText = computed(() => rateText(stats.https, stats.total, '启用'))

const fetchStats = async () => {
  // 全量总数 / 在线(后端按统一枚举展开历史原始值) / HTTPS 启用,三个计数并发取
  const base = { offset: 0, limit: 1 }
  const [total, online, https] = await Promise.allSettled([
    listCDNAssetsApi({ ...base }),
    listCDNAssetsApi({ ...base, status: 'online' }),
    listCDNAssetsApi({ ...base, https_enabled: 'true' }),
  ])
  if (total.status === 'fulfilled') stats.total = (total.value as any).data?.total ?? 0
  if (online.status === 'fulfilled') stats.online = (online.value as any).data?.total ?? 0
  if (https.status === 'fulfilled') stats.https = (https.value as any).data?.total ?? 0
}

/** 状态值 → 展示文案(共享映射,含历史原始值兼容) */
const statusLabels = CDN_STATUS_LABELS

const extractDomainName = (row: Asset) => {
  if (row.attributes?.domain_name) return row.attributes.domain_name
  const name = row.asset_name || row.asset_id || ''
  const match = name.match(/^(.+?)CNAME:\s*(.+)$/)
  if (match) return match[1]
  return name || '-'
}

const extractCname = (row: Asset) => {
  if (row.attributes?.cname) return row.attributes.cname
  const name = row.asset_name || row.asset_id || ''
  const match = name.match(/^(.+?)CNAME:\s*(.+)$/)
  if (match) return match[2]
  return ''
}

/** 格式化时间：支持 ISO 字符串和 Unix 毫秒时间戳 */
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
    if (filters.business_type) params.business_type = filters.business_type
    if (filters.status) params.status = filters.status
    if (filters.service_area) params.service_area = filters.service_area
    const res = await listCDNAssetsApi(params)
    const responseData = (res as any).data || res
    cdnList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取CDN列表失败'
    ElMessage.error(msg)
    cdnList.value = []
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
const handleReset = () => { Object.assign(filters, { provider: '', name: '', business_type: '', status: '', service_area: '' }); handleSearch() }
const handleRowClick = (row: Asset) => { detailInstance.value = row; detailVisible.value = true }
const handleSync = () => { syncForm.provider = ''; syncDialogVisible.value = true }
const submitSync = async () => {
  if (!syncForm.provider) { ElMessage.warning('请选择云厂商'); return }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['cdn'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '提交同步任务失败'
    ElMessage.error(msg)
  } finally { syncing.value = false }
}

onMounted(() => { loadColumnSettings(); fetchData(); fetchStats() })
</script>

<style scoped lang="scss">
.cdn-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;

  .filters-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .filters-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: 12px;
  }
}

.cdn-table-wrapper {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  overflow: hidden;

  :deep(.el-table) {
    cursor: pointer;
  }

  .domain-name {
    color: var(--el-color-primary);
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .cell-text {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .bool-on { color: #4ade80; }
  .bool-off { color: var(--text-muted); font-size: 12px; }

  .provider-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--text-secondary);
  }

  .mono-text {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.page-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  margin-top: 12px;

  .pagination-info {
    font-size: 12px;
    color: var(--text-tertiary);
  }
}
</style>
