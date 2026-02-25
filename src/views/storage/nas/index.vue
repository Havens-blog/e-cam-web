<template>
  <div class="nas-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">文件存储 NAS</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ pagination.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">运行中</span>
            <span class="stat-num blue">{{ runningCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">已停止</span>
            <span class="stat-num">{{ stoppedCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-left">
        <el-button size="small" :disabled="!selectedIds.length">批量操作</el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ nasList.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
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

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-row">
        <div class="search-input-wrap">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索文件系统名称"
            size="small"
            clearable
            :prefix-icon="Search"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </div>
        <el-select v-model="filters.provider" placeholder="云平台" size="small" clearable @change="handleFilterChange">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="AWS" value="aws" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
        <el-select v-model="filters.file_system_type" placeholder="文件系统类型" size="small" clearable @change="handleFilterChange">
          <el-option label="通用型" value="standard" />
          <el-option label="极速型" value="extreme" />
          <el-option label="CPFS" value="cpfs" />
        </el-select>
        <el-select v-model="filters.protocol_type" placeholder="协议类型" size="small" clearable @change="handleFilterChange">
          <el-option label="NFS" value="NFS" />
          <el-option label="SMB" value="SMB" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" size="small" clearable @change="handleFilterChange">
          <el-option label="运行中" value="Running" />
          <el-option label="已停止" value="Stopped" />
          <el-option label="创建中" value="Pending" />
        </el-select>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-checkbox"><el-checkbox v-model="selectAll" @change="handleSelectAll" /></th>
              <th class="col-name">名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in nasList" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click="handleRowClick(item)">
              <td class="col-checkbox" @click.stop>
                <el-checkbox :model-value="selectedIds.includes(item.id)" @change="handleSelect(item.id, $event)" />
              </td>
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id }}</span>
                </div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.attributes?.status)"></span>
                  <span class="status-text">{{ getStatusText(item.attributes?.status) }}</span>
                </template>
                <template v-else-if="col.key === 'file_system_type'">{{ getFileSystemTypeText(item.attributes?.file_system_type) }}</template>
                <template v-else-if="col.key === 'protocol_type'">{{ item.attributes?.protocol_type || '-' }}</template>
                <template v-else-if="col.key === 'storage_type'">{{ item.attributes?.storage_type || '-' }}</template>
                <template v-else-if="col.key === 'capacity'">{{ formatCapacity(item.attributes?.capacity) }}</template>
                <template v-else-if="col.key === 'used_capacity'">{{ formatCapacity(item.attributes?.used_capacity) }}</template>
                <template v-else-if="col.key === 'mount_target_count'">{{ item.attributes?.mount_target_count || 0 }}</template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.attributes?.provider)" class="platform-icon" />
                </template>
                <template v-else-if="col.key === 'region'">{{ item.attributes?.region || '-' }}</template>
                <template v-else-if="col.key === 'vpc_id'">{{ item.attributes?.vpc_id || '-' }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatDateTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, item)">
                  <span class="action-link">更多</span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="mount">挂载点管理</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && nasList.length === 0" class="empty-state">
          <el-icon :size="48"><Box /></el-icon>
          <p>暂无数据</p>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <div class="pagination-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox>
        <span class="select-info">已选 {{ selectedIds.length }} 项</span>
      </div>
      <div class="pagination-right">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <NasDetailDrawer v-model:visible="detailDrawerVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <ExportDialog v-model:visible="exportDialogVisible" :instances="nasList" :selected-ids="selectedIds" :total="pagination.total" />
    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { listNASAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import IconFont from '@/components/IconFont/index.vue'
import { Box, Download, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import NasDetailDrawer from './components/NasDetailDrawer.vue'


const loading = ref(false)
const nasList = ref<Asset[]>([])
const selectedIds = ref<number[]>([])
const selectAll = ref(false)
const searchKeyword = ref('')
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive({
  provider: '',
  file_system_type: '',
  protocol_type: '',
  status: '',
  region: '',
})

const pagination = reactive({ page: 1, size: 20, total: 0 })

const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 80, visible: true },
  { key: 'file_system_type', label: '文件系统类型', width: 160, visible: true },
  { key: 'protocol_type', label: '协议类型', width: 80, visible: true },
  { key: 'storage_type', label: '存储类型', width: 80, visible: true },
  { key: 'capacity', label: '已用容量', width: 90, visible: true },
  { key: 'used_capacity', label: '总容量', width: 90, visible: false },
  { key: 'mount_target_count', label: '挂载点数', width: 80, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'region', label: '区域', width: 110, visible: true },
  { key: 'vpc_id', label: 'VPC', width: 150, visible: false },
  { key: 'create_time', label: '创建时间', width: 140, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const runningCount = computed(() => nasList.value.filter(i => i.attributes?.status?.toLowerCase() === 'running').length)
const stoppedCount = computed(() => nasList.value.filter(i => i.attributes?.status?.toLowerCase() === 'stopped').length)

const initColumnSettings = () => {
  const saved = localStorage.getItem('nas-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnSettingsChange = (columns: ColumnConfig[]) => { columnSettings.value = columns }

const fetchData = async () => {
  loading.value = true
  try {
    const params = {
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
      name: searchKeyword.value || undefined,
      provider: filters.provider || undefined,
      file_system_type: filters.file_system_type || undefined,
      protocol_type: filters.protocol_type || undefined,
      status: filters.status || undefined,
    }
    const res = await listNASAssetsApi(params)
    nasList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
  } catch (e) { console.error('获取NAS列表失败:', e) }
  finally { loading.value = false }
}

const handleRefresh = () => fetchData()
const handleSearch = () => { pagination.page = 1; fetchData() }
const handleFilterChange = () => { pagination.page = 1; fetchData() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handleCurrentChange = (page: number) => { pagination.page = page; fetchData() }

const handleSelectAll = (val: boolean | string | number) => { selectedIds.value = val ? nasList.value.map(i => i.id) : [] }
const handleSelect = (id: number, val: boolean | string | number) => {
  if (val) { if (!selectedIds.value.includes(id)) selectedIds.value.push(id) }
  else { selectedIds.value = selectedIds.value.filter(i => i !== id) }
  selectAll.value = selectedIds.value.length === nasList.value.length
}
const handleRowClick = (item: Asset) => { handleSelect(item.id, !selectedIds.value.includes(item.id)) }
const handleViewDetail = (item: Asset) => { detailInstance.value = item; detailDrawerVisible.value = true }
const handleAction = (cmd: string, item: Asset) => { if (cmd === 'view') handleViewDetail(item) }

const getStatusClass = (status?: string) => {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'running') return 'running'
  if (s === 'stopped') return 'stopped'
  return ''
}
const getStatusText = (status?: string) => {
  if (!status) return '-'
  const map: Record<string, string> = { running: '运行中', stopped: '已停止', pending: '创建中', Running: '运行中', Stopped: '已停止', Pending: '创建中' }
  return map[status] || status
}
const getFileSystemTypeText = (type?: string) => {
  if (!type) return '-'
  const map: Record<string, string> = { standard: '通用型', extreme: '极速型', cpfs: 'CPFS' }
  return map[type] || type
}
const formatCapacity = (capacity?: number) => {
  if (!capacity) return '-'
  if (capacity >= 1024 * 1024) return `${(capacity / 1024 / 1024).toFixed(1)} TB`
  if (capacity >= 1024) return `${(capacity / 1024).toFixed(1)} GB`
  return `${capacity} MB`
}
const getPlatformIcon = (provider?: string) => {
  if (!provider) return 'Alibaba_Cloud'
  const p = provider.toLowerCase()
  if (p.includes('aliyun')) return 'Alibaba_Cloud'
  if (p.includes('tencent')) return 'Tencent_Cloud'
  if (p.includes('huawei')) return 'Huawei_Cloud'
  if (p.includes('aws')) return 'AWS'
  if (p.includes('volcano')) return 'Bytecloud'
  return 'Alibaba_Cloud'
}
const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-'
  try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr }
}

onMounted(() => { initColumnSettings(); fetchData() })
</script>

<style scoped lang="scss">
@import '../styles/storage.scss';
</style>
