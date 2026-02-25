<template>
  <div class="oss-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">对象存储 OSS</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ pagination.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">标准存储</span>
            <span class="stat-num blue">{{ standardCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">低频存储</span>
            <span class="stat-num">{{ iaCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">归档存储</span>
            <span class="stat-num">{{ archiveCount }}</span>
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
        <span class="page-info">本页{{ ossList.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
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
            placeholder="搜索存储桶名称"
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
        <el-select v-model="filters.storage_class" placeholder="存储类型" size="small" clearable @change="handleFilterChange">
          <el-option label="标准存储" value="Standard" />
          <el-option label="低频存储" value="IA" />
          <el-option label="归档存储" value="Archive" />
        </el-select>
        <el-select v-model="filters.acl" placeholder="访问权限" size="small" clearable @change="handleFilterChange">
          <el-option label="私有" value="private" />
          <el-option label="公共读" value="public-read" />
          <el-option label="公共读写" value="public-read-write" />
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
              <th class="col-name">存储桶名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in ossList" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click="handleRowClick(item)">
              <td class="col-checkbox" @click.stop>
                <el-checkbox :model-value="selectedIds.includes(item.id)" @change="handleSelect(item.id, $event)" />
              </td>
              <td class="col-name">
                <div class="name-cell">
                  <el-icon class="bucket-icon"><Folder /></el-icon>
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id }}</span>
                </div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'storage_class'">
                  <el-tag size="small" :type="getStorageClassType(item.attributes?.storage_class)">{{ getStorageClassText(item.attributes?.storage_class) }}</el-tag>
                </template>
                <template v-else-if="col.key === 'acl'">{{ getAclText(item.attributes?.acl) }}</template>
                <template v-else-if="col.key === 'versioning'">{{ item.attributes?.versioning ? '已开启' : '未开启' }}</template>
                <template v-else-if="col.key === 'object_count'">{{ formatNumber(item.attributes?.object_count) }}</template>
                <template v-else-if="col.key === 'storage_size'">{{ formatStorageSize(item.attributes?.storage_size) }}</template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.attributes?.provider)" class="platform-icon" />
                </template>
                <template v-else-if="col.key === 'region'">{{ item.attributes?.region || '-' }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatDateTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, item)">
                  <span class="action-link">更多</span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="files">文件管理</el-dropdown-item>
                      <el-dropdown-item command="settings">基础设置</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && ossList.length === 0" class="empty-state">
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
    <OssDetailDrawer v-model:visible="detailDrawerVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <ExportDialog v-model:visible="exportDialogVisible" :instances="ossList" :selected-ids="selectedIds" :total="pagination.total" />
    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { listOSSAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import IconFont from '@/components/IconFont/index.vue'
import { Box, Download, Folder, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import OssDetailDrawer from './components/OssDetailDrawer.vue'


const loading = ref(false)
const ossList = ref<Asset[]>([])
const selectedIds = ref<number[]>([])
const selectAll = ref(false)
const searchKeyword = ref('')
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive({ provider: '', storage_class: '', acl: '', region: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

const defaultColumnSettings: ColumnConfig[] = [
  { key: 'storage_class', label: '存储类型', width: 90, visible: true },
  { key: 'acl', label: '访问权限', width: 80, visible: true },
  { key: 'versioning', label: '版本控制', width: 80, visible: true },
  { key: 'object_count', label: '对象数量', width: 90, visible: true },
  { key: 'storage_size', label: '存储量', width: 90, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'region', label: '区域', width: 100, visible: true },
  { key: 'create_time', label: '创建时间', width: 140, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const standardCount = computed(() => ossList.value.filter(i => i.attributes?.storage_class === 'Standard').length)
const iaCount = computed(() => ossList.value.filter(i => i.attributes?.storage_class === 'IA').length)
const archiveCount = computed(() => ossList.value.filter(i => i.attributes?.storage_class === 'Archive').length)

const initColumnSettings = () => {
  const saved = localStorage.getItem('oss-column-settings')
  if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return } } catch { /* ignore */ } }
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
      storage_class: filters.storage_class || undefined,
      acl: filters.acl || undefined,
    }
    const res = await listOSSAssetsApi(params)
    ossList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
  } catch (e) { console.error('获取OSS列表失败:', e) }
  finally { loading.value = false }
}

const handleRefresh = () => fetchData()
const handleSearch = () => { pagination.page = 1; fetchData() }
const handleFilterChange = () => { pagination.page = 1; fetchData() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handleCurrentChange = (page: number) => { pagination.page = page; fetchData() }

const handleSelectAll = (val: boolean | string | number) => { selectedIds.value = val ? ossList.value.map(i => i.id) : [] }
const handleSelect = (id: number, val: boolean | string | number) => {
  if (val) { if (!selectedIds.value.includes(id)) selectedIds.value.push(id) }
  else { selectedIds.value = selectedIds.value.filter(i => i !== id) }
  selectAll.value = selectedIds.value.length === ossList.value.length
}
const handleRowClick = (item: Asset) => { handleSelect(item.id, !selectedIds.value.includes(item.id)) }
const handleViewDetail = (item: Asset) => { detailInstance.value = item; detailDrawerVisible.value = true }
const handleAction = (cmd: string, item: Asset) => { if (cmd === 'view') handleViewDetail(item) }

const getStorageClassText = (type?: string) => {
  if (!type) return '-'
  const map: Record<string, string> = { Standard: '标准存储', IA: '低频存储', Archive: '归档存储', ColdArchive: '冷归档存储' }
  return map[type] || type
}
const getStorageClassType = (type?: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
  if (!type) return 'info'
  const map: Record<string, '' | 'success' | 'warning' | 'info' | 'danger'> = { Standard: '', IA: 'warning', Archive: 'info', ColdArchive: 'info' }
  return map[type] || 'info'
}
const getAclText = (acl?: string) => {
  if (!acl) return '-'
  const map: Record<string, string> = { private: '私有', 'public-read': '公共读', 'public-read-write': '公共读写' }
  return map[acl] || acl
}
const formatNumber = (num?: number) => { if (!num) return '0'; return num.toLocaleString() }
const formatStorageSize = (size?: number) => {
  if (!size) return '-'
  if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(2)} TB`
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} GB`
  if (size >= 1024) return `${(size / 1024).toFixed(2)} MB`
  return `${size} KB`
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
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }

onMounted(() => { initColumnSettings(); fetchData() })
</script>

<style scoped lang="scss">
@import '../styles/storage.scss';

.bucket-icon {
  color: #f0a020;
  margin-right: 8px;
}
</style>
