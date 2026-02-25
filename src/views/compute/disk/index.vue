<template>
  <div class="vm-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">云盘</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ pagination.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">使用中</span>
            <span class="stat-num blue">{{ inUseCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">可用</span>
            <span class="stat-num">{{ availableCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-left">
        <el-input v-model="filters.keyword" placeholder="搜索云盘名称/ID" clearable style="width: 200px" @clear="handleSearch" @keyup.enter="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.provider" placeholder="云平台" clearable style="width: 120px" @change="handleSearch">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="AWS" value="aws" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px" @change="handleSearch">
          <el-option label="使用中" value="In_use" />
          <el-option label="可用" value="Available" />
          <el-option label="创建中" value="Creating" />
        </el-select>
        <el-select v-model="filters.disk_type" placeholder="磁盘类型" clearable style="width: 120px" @change="handleSearch">
          <el-option label="系统盘" value="system" />
          <el-option label="数据盘" value="data" />
        </el-select>
      </div>
      <div class="action-right">
        <el-button size="small" circle @click="fetchData" title="刷新"><el-icon><Refresh /></el-icon></el-button>
        <el-button size="small" circle @click="exportDialogVisible = true" title="导出"><el-icon><Download /></el-icon></el-button>
        <el-button size="small" circle @click="columnSettingsVisible = true" title="自定义列"><el-icon><Setting /></el-icon></el-button>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-checkbox"><el-checkbox v-model="selectAll" @change="handleSelectAll" /></th>
              <th class="col-name">云盘ID/名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in instances" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click="handleRowClick(item)">
              <td class="col-checkbox" @click.stop><el-checkbox :model-value="selectedIds.includes(item.id)" @change="handleSelect(item.id, $event)" /></td>
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_id }}</span>
                  <span class="instance-sub">{{ item.asset_name || '-' }}</span>
                </div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.status)"></span>
                  <span class="status-text">{{ getStatusText(item.status) }}</span>
                </template>
                <template v-else-if="col.key === 'disk_type'">
                  <span class="env-tag" :class="item.attributes?.disk_type === 'system' ? 'warning' : ''">{{ item.attributes?.disk_type === 'system' ? '系统盘' : '数据盘' }}</span>
                </template>
                <template v-else-if="col.key === 'size'">{{ item.attributes?.size || '-' }} GB</template>
                <template v-else-if="col.key === 'category'">{{ getDiskCategory(item.attributes?.category) }}</template>
                <template v-else-if="col.key === 'instance'"><span class="text-ellipsis">{{ item.attributes?.instance_id || '-' }}</span></template>
                <template v-else-if="col.key === 'platform'"><IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" /></template>
                <template v-else-if="col.key === 'region'">{{ item.region || '-' }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="handleViewDetail(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && instances.length === 0" class="empty-state">
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
        <el-pagination :current-page="pagination.page" :page-size="pagination.size" :page-sizes="[20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next" @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
    </div>

    <DiskDetailDrawer v-model:visible="detailVisible" :instance="currentInstance" />
    <ExportDialog v-model:visible="exportDialogVisible" :instances="instances" :total="pagination.total" />
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { listDiskAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import IconFont from '@/components/IconFont/index.vue'
import { Box, Download, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import ColumnSettingsDialog from './components/ColumnSettingsDialog.vue'
import DiskDetailDrawer from './components/DiskDetailDrawer.vue'
import ExportDialog from './components/ExportDialog.vue'

const loading = ref(false)
const instances = ref<Asset[]>([])
const detailVisible = ref(false)
const currentInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)
const selectedIds = ref<number[]>([])
const selectAll = ref(false)

const filters = reactive({ keyword: '', provider: '', status: '', disk_type: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

const defaultColumnSettings = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'disk_type', label: '磁盘类型', width: 90, visible: true },
  { key: 'size', label: '容量', width: 80, visible: true },
  { key: 'category', label: '云盘类型', width: 120, visible: true },
  { key: 'instance', label: '挂载实例', width: 180, visible: true },
  { key: 'platform', label: '云平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 120, visible: true },
]
const columnSettings = ref([...defaultColumnSettings])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const inUseCount = computed(() => instances.value.filter(i => i.status?.toLowerCase().includes('use')).length)
const availableCount = computed(() => instances.value.filter(i => i.status?.toLowerCase().includes('available')).length)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listDiskAssetsApi({ offset: (pagination.page - 1) * pagination.size, limit: pagination.size, provider: (filters.provider || undefined) as any, status: filters.status || undefined, name: filters.keyword || undefined, disk_type: filters.disk_type || undefined })
    const data = res.data as any
    instances.value = data?.items || []
    pagination.total = data?.total || 0
  } catch (e) { console.error(e) } finally { loading.value = false }
}

const handleSearch = () => { pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handleRowClick = (row: Asset) => { currentInstance.value = row; detailVisible.value = true }
const handleViewDetail = (row: Asset) => { currentInstance.value = row; detailVisible.value = true }
const handleColumnSettingsChange = (cols: any[]) => { columnSettings.value = cols; localStorage.setItem('disk-column-settings', JSON.stringify(cols)) }
const handleSelectAll = (val: boolean | string | number) => { selectedIds.value = val ? instances.value.map(i => i.id) : [] }
const handleSelect = (id: number, val: boolean | string | number) => { if (val) { selectedIds.value.push(id) } else { selectedIds.value = selectedIds.value.filter(i => i !== id) } }

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (s.includes('use')) return 'running'; if (s.includes('available')) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { in_use: '使用中', available: '可用', creating: '创建中', attaching: '挂载中', detaching: '卸载中' }; return map[status.toLowerCase()] || status }
const getDiskCategory = (category?: string) => { if (!category) return '-'; const map: Record<string, string> = { cloud_efficiency: '高效云盘', cloud_ssd: 'SSD云盘', cloud_essd: 'ESSD云盘', cloud: '普通云盘' }; return map[category] || category }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }

onMounted(() => {
  const saved = localStorage.getItem('disk-column-settings')
  if (saved) { try { columnSettings.value = JSON.parse(saved) } catch {} }
  fetchData()
})
</script>

<style scoped lang="scss">
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px;
  height: calc(100% + 48px);
}

.page-top {
  padding: 16px 20px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 24px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.stats-badges {
  display: flex;
  gap: 16px;
  margin-left: auto;
}

.stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  min-width: 60px;

  .stat-label { font-size: 11px; color: var(--text-tertiary); }
  .stat-num { font-size: 16px; font-weight: 600; color: var(--text-primary); &.blue { color: var(--accent-blue); } }
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.action-left { display: flex; align-items: center; gap: 8px; }
.action-right { display: flex; align-items: center; gap: 12px; }

.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-elevated);
}

.table-header {
  flex-shrink: 0;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  overflow: hidden;
}

.table-body {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;

  th, td { padding: 10px 12px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  th { background: var(--bg-surface); color: var(--text-secondary); font-weight: 500; }
  td { border-bottom: 1px solid var(--border-subtle); }
  tbody tr { transition: background 150ms ease; cursor: pointer; &:hover { background: var(--bg-hover); } &.selected { background: rgba(59, 130, 246, 0.08); } }
}

.col-checkbox { width: 40px; }
.col-name { width: 220px; max-width: 220px; }
.col-actions { width: 80px; }

.name-cell {
  display: flex;
  flex-direction: column;
  max-width: 200px;

  .instance-name { color: var(--accent-blue); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; &:hover { text-decoration: underline; } }
  .instance-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  background: var(--text-muted);
  &.running { background: var(--accent-green); }
  &.stopped { background: var(--text-tertiary); }
  &.pending { background: var(--accent-yellow); }
}

.status-text { color: var(--text-secondary); }
.platform-icon { font-size: 20px; }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; display: inline-block; }

.env-tag {
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  &.warning { background: rgba(230, 162, 60, 0.1); color: #e6a23c; }
}

.action-link { color: var(--accent-blue); cursor: pointer; &:hover { text-decoration: underline; } }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
  p { margin-top: 12px; }
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.pagination-left { display: flex; align-items: center; gap: 12px; .select-info { font-size: 13px; color: var(--text-tertiary); } }
.pagination-right { display: flex; align-items: center; gap: 16px; }
</style>
