<template>
  <PageContainer>
    <ManagerHeader
      title="CDN 加速"
      subtitle="内容分发网络加速域名管理"
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
            <span class="stat-label">在线</span>
            <span class="stat-value running">{{ onlineCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <div class="cdn-filters">
      <div class="filters-left">
        <el-form :inline="true" class="filters-form">
          <el-form-item>
            <el-input v-model="filters.name" placeholder="搜索域名" clearable @input="handleSearchInput" style="width: 300px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.provider" placeholder="云厂商" clearable @change="handleSearch" style="width: 120px">
              <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.business_type" placeholder="业务类型" clearable @change="handleSearch" style="width: 120px">
              <el-option label="网页加速" value="web" />
              <el-option label="下载加速" value="download" />
              <el-option label="流媒体" value="media" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="handleReset"><el-icon><RefreshLeft /></el-icon></el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="filters-right">
        <el-button size="small" circle @click="exportDialogVisible = true" title="导出">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" circle @click="columnSettingsVisible = true" title="自定义列">
          <el-icon><Setting /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- CDN 表格 -->
    <div class="cdn-content">
      <el-table v-loading="loading" :data="cdnList" stripe style="width: 100%" max-height="calc(100vh - 22rem)" @row-click="handleRowClick" @selection-change="handleSelectionChange" highlight-current-row>
        <el-table-column type="selection" width="40" />
        <el-table-column label="域名" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="id-name-cell">
              <span class="asset-id">{{ extractDomainName(row) }}</span>
              <span v-if="extractCname(row)" class="asset-name">CNAME: {{ extractCname(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <template v-for="col in visibleColumns" :key="col.key">
          <el-table-column v-if="col.key === 'status'" label="状态" :width="col.width" align="center">
            <template #default="{ row }"><CdnStatusBadge :status="row.status" /></template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'business_type'" label="业务类型" :width="col.width">
            <template #default="{ row }">
              <el-tag size="small" :type="safeTagType(getBusinessTypeTag(row.attributes?.business_type)) || undefined">{{ getBusinessTypeLabel(row.attributes?.business_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'https_enabled'" label="HTTPS" :width="col.width" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.attributes?.https_enabled ? 'success' : 'info'" effect="plain">{{ row.attributes?.https_enabled ? '已开启' : '未开启' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'service_area'" label="加速区域" :width="col.width">
            <template #default="{ row }">{{ getServiceAreaLabel(row.attributes?.service_area) }}</template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'platform'" label="平台" :width="col.width" align="center">
            <template #default="{ row }"><ProviderIcon :provider="row.provider" size="small" /></template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'creation_time'" label="创建时间" :width="col.width" show-overflow-tooltip>
            <template #default="{ row }">{{ row.attributes?.creation_time || '-' }}</template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'cname'" label="CNAME" :width="col.width" show-overflow-tooltip>
            <template #default="{ row }">{{ row.attributes?.cname || '-' }}</template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'http2_enabled'" label="HTTP/2" :width="col.width" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.attributes?.http2_enabled ? 'success' : 'info'" effect="plain">{{ row.attributes?.http2_enabled ? '已开启' : '未开启' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-else-if="col.key === 'cert_name'" label="证书名称" :width="col.width" show-overflow-tooltip>
            <template #default="{ row }">{{ row.attributes?.cert_name || '-' }}</template>
          </el-table-column>
        </template>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="handleRowClick(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && cdnList.length === 0" description="暂无数据" />
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ cdnList.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
        </div>
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size" :total="pagination.total" :page-sizes="[20, 50, 100]" layout="sizes, prev, pager, next, jumper" @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
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
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, safeTagType } from '@/utils/constants'
import { Download, Refresh, RefreshLeft, Search, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CdnDetailDrawer from './components/CdnDetailDrawer.vue'
import CdnStatusBadge from './components/CdnStatusBadge.vue'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'

const router = useRouter()
const loading = ref(false)
const filters = reactive({ provider: '', name: '', business_type: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const cdnList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)
let searchTimer: number | null = null

// 导出和自定义列
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)
const selectedIds = ref<number[]>([])

const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 100, visible: true },
  { key: 'business_type', label: '业务类型', width: 100, visible: true },
  { key: 'https_enabled', label: 'HTTPS', width: 80, visible: true },
  { key: 'service_area', label: '加速区域', width: 100, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'creation_time', label: '创建时间', width: 140, visible: true },
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

const onlineCount = computed(() => cdnList.value.filter(i =>
  ['online', 'Deployed', 'active'].includes(i.status)
).length)

const getBusinessTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = { web: '网页加速', download: '下载加速', media: '流媒体', vodDomainName: '点播', wholeSite: '全站加速' }
  return map[type || ''] || type || '-'
}
const getBusinessTypeTag = (type: string | undefined): string => {
  const map: Record<string, string> = { web: 'primary', download: 'success', media: 'warning' }
  return map[type || ''] || 'info'
}
const getServiceAreaLabel = (area: string | undefined) => {
  const map: Record<string, string> = { domestic: '中国大陆', overseas: '海外', global: '全球', mainland: '中国大陆' }
  return map[area || ''] || area || '-'
}

/** 从 asset_name 中提取域名（去掉 CNAME: 后面的部分） */
const extractDomainName = (row: Asset) => {
  // 优先取 attributes.domain_name
  if (row.attributes?.domain_name) return row.attributes.domain_name
  const name = row.asset_name || row.asset_id || ''
  // 后端可能把域名和CNAME拼在一起，格式: "域名CNAME: cname值"
  const idx = name.indexOf('CNAME:')
  return idx > 0 ? name.substring(0, idx) : name || '-'
}

/** 从 asset_name 中提取 CNAME */
const extractCname = (row: Asset) => {
  if (row.attributes?.cname) return row.attributes.cname
  const name = row.asset_name || row.asset_id || ''
  const idx = name.indexOf('CNAME:')
  if (idx > 0) {
    return name.substring(idx + 'CNAME:'.length).trim()
  }
  return ''
}

const fetchData = async () => {
  loading.value = true
  try {
     
    const params: Record<string, any> = { offset: (pagination.page - 1) * pagination.size, limit: pagination.size }
    if (filters.provider) params.provider = filters.provider
    if (filters.name) params.name = filters.name
    if (filters.business_type) params.business_type = filters.business_type
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
const handleReset = () => { Object.assign(filters, { provider: '', name: '', business_type: '' }); handleSearch() }
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

onMounted(() => { loadColumnSettings(); fetchData() })
</script>
