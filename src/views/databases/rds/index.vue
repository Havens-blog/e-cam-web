<template>
  <div class="rds-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">RDS 云数据库</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">公有云</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ statusCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">运行中</span>
            <span class="stat-num blue">{{ statusCounts.running }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">已停止</span>
            <span class="stat-num">{{ statusCounts.stopped }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">监控异常</span>
            <span class="stat-num orange">0</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">0</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：RDS 领域动作（不照搬主机电源操作） -->
    <div class="action-bar">
      <div class="action-left">
        <!-- F-C2/F-C3 同款主题 B 决策：本页无新建/重启/暂停/变更配置/扩容实现，统一禁用 + tooltip -->
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            新建
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>重启</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>暂停</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>变更配置</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>扩容</el-button>
        </el-tooltip>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ instances.length }}条 / 共{{ pagination.total }}条</span>
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

    <!-- 字段搜索栏（回车加条件 + 条件 chips） -->
    <div class="search-bar">
      <div class="search-row">
        <div class="search-input-wrap">
          <el-popover
            v-model:visible="searchFilterVisible"
            placement="bottom-start"
            :width="currentSearchField && searchFieldOptions[currentSearchField] ? 280 : 200"
            popper-class="search-filter-popover"
          >
            <template #reference>
              <div class="search-box">
                <el-icon class="search-icon"><Search /></el-icon>
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="search-input"
                  placeholder="输入搜索内容，回车添加条件"
                  @focus="handleSearchFocus"
                  @keyup.enter="handleSearchEnter"
                />
              </div>
            </template>
            <!-- 属性选择面板 -->
            <div v-if="!currentSearchField" class="search-filter-panel">
              <div class="search-filter-title">选择搜索属性</div>
              <div class="search-filter-list">
                <div
                  v-for="field in searchFields"
                  :key="field.key"
                  class="search-filter-item"
                  @click="selectSearchFilter(field.key)"
                >
                  <span>{{ field.label }}</span>
                  <el-icon v-if="field.hasOptions"><ArrowRight /></el-icon>
                </div>
              </div>
            </div>
            <!-- 属性值选择面板 -->
            <div v-else class="search-value-panel">
              <div class="search-value-header">
                <el-icon class="back-icon" @click="currentSearchField = ''"><ArrowLeft /></el-icon>
                <span>{{ searchFieldLabels[currentSearchField] }}</span>
              </div>
              <!-- 有固定选项的属性 -->
              <template v-if="searchFieldOptions[currentSearchField]">
                <div class="search-value-list">
                  <div
                    v-for="opt in searchFieldOptions[currentSearchField]"
                    :key="opt.value"
                    class="search-value-item"
                    @click="selectSearchValue(opt)"
                  >
                    {{ opt.label }}
                  </div>
                </div>
              </template>
              <!-- 需要输入的属性 -->
              <template v-else>
                <div class="search-value-input">
                  <el-input
                    v-model="searchKeyword"
                    :placeholder="`输入${searchFieldLabels[currentSearchField]}`"
                    size="small"
                    @keyup.enter="handleSearchEnter"
                  />
                  <el-button size="small" type="primary" @click="handleSearchEnter">确定</el-button>
                </div>
              </template>
            </div>
          </el-popover>
        </div>

        <!-- 已添加的搜索条件标签 -->
        <div class="search-tags" v-if="searchConditions.length > 0">
          <el-tag
            v-for="(cond, idx) in searchConditions"
            :key="idx"
            closable
            size="small"
            @close="removeSearchCondition(idx)"
          >
            {{ searchFieldLabels[cond.field] }}: {{ cond.displayValue }}
          </el-tag>
          <span class="clear-search-btn" @click="clearAllSearchConditions">清除</span>
        </div>
      </div>
    </div>

    <!-- 表格区域（无默认多选列） -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
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
            <tr v-for="item in instances" :key="item.id" @click="handleRowClick(item)">
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id }}</span>
                </div>
                <div class="cell-sub">{{ item.asset_id }}</div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.attributes?.status)"></span>
                  <span class="status-text">{{ getStatusText(item.attributes?.status) }}</span>
                </template>
                <template v-else-if="col.key === 'engine'">
                  <span>{{ item.attributes?.engine || '-' }} {{ item.attributes?.engine_version || '' }}</span>
                </template>
                <template v-else-if="col.key === 'instance_type'">
                  <span class="mono">{{ item.attributes?.instance_type || item.attributes?.db_instance_class || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'storage'">
                  <span class="mono">{{ item.attributes?.storage_size || item.attributes?.db_instance_storage || '-' }} GB</span>
                </template>
                <template v-else-if="col.key === 'connection'">
                  <span class="text-ellipsis mono">{{ item.attributes?.connection_string || item.attributes?.endpoint || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'port'">
                  <span class="mono">{{ item.attributes?.port || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'vpc'">
                  <span class="text-ellipsis mono">{{ item.attributes?.vpc_id || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.attributes?.provider)" class="platform-icon" :title="getProviderName(item.attributes?.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">
                  <span>{{ item.attributes?.region || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'charge_type'">
                  <span>{{ getChargeTypeText(item.attributes?.charge_type) }}</span>
                </template>
                <template v-else-if="col.key === 'create_time'">
                  <span>{{ formatDateTime(item.attributes?.creation_time) || formatTime(item.create_time) }}</span>
                </template>
                <template v-else><span>-</span></template>
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

    <!-- 详情抽屉 -->
    <RdsDetailDrawer v-model:visible="detailDrawerVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <AssetExportDialog v-model:visible="exportDialogVisible" :instances="instances" :selected-ids="[]" :total="pagination.total" :config="exportConfig" />
    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { listRDSAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CHARGE_TYPE_LABELS, labelOfLenient } from '@/utils/fieldLabels'
import { getProviderLabel } from '@/utils/constants'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import RdsDetailDrawer from './components/RdsDetailDrawer.vue'

/** 共享导出配置：字段沿用原 stub availableFields，取值走通用映射（asset_id/asset_name 直取、provider 归一、其余 attributes[key]） */
const getExportValue: ExportFieldConfig['getValue'] = (row, key) => {
  if (key === 'asset_id') return row.asset_id || ''
  if (key === 'asset_name') return row.asset_name || ''
  if (key === 'provider') return getProviderLabel(row.attributes?.provider || '')
  return row.attributes?.[key] || ''
}

const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'asset_name', label: '名称' },
    { key: 'asset_id', label: '云上ID' },
    { key: 'status', label: '状态' },
    { key: 'engine', label: '数据库类型' },
    { key: 'instance_type', label: '规格' },
    { key: 'storage', label: '存储' },
    { key: 'connection', label: '连接地址' },
    { key: 'port', label: '端口' },
    { key: 'region', label: '区域' },
    { key: 'provider', label: '云平台' },
  ],
  getValue: getExportValue,
  filename: 'RDS实例',
  defaultFields: ['asset_name', 'asset_id', 'status', 'engine', 'region'],
}

const loading = ref(false)
const instances = ref<Asset[]>([])
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive({ keyword: '', provider: '', status: '', region: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

// 全局状态统计（从后端获取，非当前页；主机页同款口径）
const statusCounts = reactive({ total: 0, running: 0, stopped: 0 })

const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'engine', label: '数据库类型', width: 140, visible: true },
  { key: 'instance_type', label: '规格', width: 140, visible: true },
  { key: 'storage', label: '存储', width: 80, visible: true },
  { key: 'connection', label: '连接地址', width: 200, visible: true },
  { key: 'port', label: '端口', width: 70, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'region', label: '区域', width: 100, visible: true },
  { key: 'vpc', label: 'VPC', width: 150, visible: false },
  { key: 'charge_type', label: '计费方式', width: 90, visible: false },
  { key: 'create_time', label: '创建时间', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const initColumnSettings = () => {
  const saved = localStorage.getItem('rds-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnSettingsChange = (columns: ColumnConfig[]) => { columnSettings.value = columns }

// ==================== 字段搜索栏（主机页同款：回车加条件 + 条件 chips） ====================

// 搜索条件类型
interface SearchCondition {
  field: string
  value: string
  displayValue: string
}

const searchFilterVisible = ref(false)
const currentSearchField = ref('')
const searchKeyword = ref('')
const searchConditions = ref<SearchCondition[]>([])

// 搜索字段配置（从本页实际数据派生：仅覆盖 ListAssetsParams 支持的筛选维度）
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  status: '状态',
  provider: '平台',
  region: '区域',
}

// 有固定选项的字段
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '运行中', value: 'running' },
    { label: '已停止', value: 'stopped' },
    { label: '创建中', value: 'creating' },
  ],
  provider: [
    { label: '阿里云', value: 'aliyun' },
    { label: '腾讯云', value: 'tencent' },
    { label: '华为云', value: 'huawei' },
    { label: 'AWS', value: 'aws' },
    { label: '火山引擎', value: 'volcano' },
  ],
}

const handleSearchFocus = () => {
  searchFilterVisible.value = true
}

const selectSearchFilter = (field: string) => {
  currentSearchField.value = field
  searchKeyword.value = ''
  // 如果没有固定选项，聚焦到输入框
  if (!searchFieldOptions[field]) {
    setTimeout(() => {
      const input = document.querySelector('.search-value-input input') as HTMLInputElement
      if (input) input.focus()
    }, 100)
  }
}

const selectSearchValue = (opt: { label: string; value: string }) => {
  // 添加搜索条件（同字段替换）
  const existingIdx = searchConditions.value.findIndex(c => c.field === currentSearchField.value)
  if (existingIdx > -1) {
    searchConditions.value[existingIdx] = { field: currentSearchField.value, value: opt.value, displayValue: opt.label }
  } else {
    searchConditions.value.push({ field: currentSearchField.value, value: opt.value, displayValue: opt.label })
  }

  // 重置并关闭
  currentSearchField.value = ''
  searchFilterVisible.value = false
  applySearchConditions()
}

const handleSearchEnter = () => {
  const value = searchKeyword.value.trim()
  if (!value) return

  // 如果没有选择字段，默认用名称搜索
  const field = currentSearchField.value || 'asset_name'

  // 检查是否已存在相同字段的条件，如果存在则替换
  const existingIdx = searchConditions.value.findIndex(c => c.field === field)
  if (existingIdx > -1) {
    searchConditions.value[existingIdx] = { field, value, displayValue: value }
  } else {
    searchConditions.value.push({ field, value, displayValue: value })
  }

  // 清空输入并重置字段
  searchKeyword.value = ''
  currentSearchField.value = ''
  searchFilterVisible.value = false

  // 应用搜索
  applySearchConditions()
}

const removeSearchCondition = (idx: number) => {
  searchConditions.value.splice(idx, 1)
  applySearchConditions()
}

const clearAllSearchConditions = () => {
  searchConditions.value = []
  applySearchConditions()
}

const applySearchConditions = () => {
  // 先清除所有搜索相关的筛选
  filters.keyword = ''
  filters.status = ''
  filters.provider = ''
  filters.region = ''

  // 应用所有搜索条件（映射到 ListAssetsParams 支持的参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
        filters.keyword = cond.value
        break
      case 'status':
        filters.status = cond.value
        break
      case 'provider':
        filters.provider = cond.value
        break
      case 'region':
        filters.region = cond.value
        break
    }
  })

  pagination.page = 1
  fetchInstances()
}

// ==================== 数据获取 ====================

/** 组装列表查询参数（仅 ListAssetsParams 支持的筛选维度） */
const buildListParams = (page: number, size: number): Record<string, any> => {
  const params: Record<string, any> = {
    name: filters.keyword || undefined,
    offset: (page - 1) * size,
    limit: size,
  }
  if (filters.status) params.status = filters.status
  if (filters.region) params.region = filters.region
  if (filters.provider) params.provider = filters.provider
  return params
}

const fetchInstances = async () => {
  loading.value = true
  try {
    const res = await listRDSAssetsApi(buildListParams(pagination.page, pagination.size))
    const data = res.data as any
    instances.value = data?.items || data?.data || []
    pagination.total = data?.total || 0
    // 同步刷新全局状态统计
    fetchStatusCounts()
  } catch (error) {
    console.error('获取RDS列表失败:', error)
    ElMessage.error('获取RDS列表失败')
    instances.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const fetchStatusCounts = async () => {
  try {
    const [totalRes, runningRes, stoppedRes] = await Promise.all([
      listRDSAssetsApi({ limit: 1, offset: 0 }),
      listRDSAssetsApi({ status: 'running', limit: 1, offset: 0 }),
      listRDSAssetsApi({ status: 'stopped', limit: 1, offset: 0 }),
    ])
    statusCounts.total = (totalRes.data as any)?.total || 0
    statusCounts.running = (runningRes.data as any)?.total || 0
    statusCounts.stopped = (stoppedRes.data as any)?.total || 0
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取RDS状态统计失败')
  }
}

const handleRefresh = () => fetchInstances()
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchInstances() }
const handleCurrentChange = (page: number) => { pagination.page = page; fetchInstances() }

const handleRowClick = (item: Asset) => { handleViewDetail(item) }
const handleViewDetail = (item: Asset) => { detailInstance.value = item; detailDrawerVisible.value = true }

const getStatusClass = (status?: string) => {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'running') return 'running'
  if (['stopped', 'shutdown'].includes(s)) return 'stopped'
  if (s === 'error') return 'error'
  return 'pending'
}

const getStatusText = (status?: string) => {
  if (!status) return '-'
  const map: Record<string, string> = { running: '运行中', stopped: '已停止', shutdown: '已停止', creating: '创建中', deleting: '删除中' }
  return map[status.toLowerCase()] || status
}

const getPlatformIcon = (provider?: string) => {
  if (!provider) return 'Alibaba_Cloud'
  const p = provider.toLowerCase()
  if (p.includes('aliyun') || p.includes('alibaba')) return 'Alibaba_Cloud'
  if (p.includes('tencent')) return 'Tencent_Cloud'
  if (p.includes('huawei')) return 'Huawei_Cloud'
  if (p.includes('aws')) return 'AWS'
  if (p.includes('volcano')) return 'Bytecloud'
  return 'Alibaba_Cloud'
}

/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

const getChargeTypeText = (chargeType?: string) => labelOfLenient(CHARGE_TYPE_LABELS, chargeType)

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-'
  try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr }
}

const formatTime = (time?: number) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

// H-03：实例详情「查看资产」带 query.search 跳入时，首载前预填关键词（无 query 直达零改动）
const route = useRoute()

onMounted(() => {
  initColumnSettings()
  const s = route.query.search
  if (typeof s === 'string' && s) filters.keyword = s
  fetchInstances()
})
</script>

<style lang="scss" scoped>
.rds-page {
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px; // 抵消外层 padding
  height: calc(100% + 48px);
}

// 页面顶部
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

.tab-nav {
  display: flex;
  gap: 4px;

  .tab-item {
    padding: 6px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      color: var(--accent-blue);
      background: rgba(113, 112, 255, 0.1);
    }
  }
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
  transition: all 200ms ease;

  .stat-label {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .stat-num {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;

    &.blue { color: var(--accent-blue); }
    &.orange { color: var(--accent-yellow); }
    &.red { color: var(--accent-red); }
  }
}

// 操作栏
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.action-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 12px;

  .page-info {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

// 搜索栏
.search-bar {
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input-wrap {
  position: relative;
  width: 320px;
  flex-shrink: 0;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    z-index: 1;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 12px 0 36px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: all 200ms ease;

    &::placeholder {
      color: var(--text-muted);
    }

    &:focus {
      border-color: var(--accent-blue);
    }
  }
}

.search-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.clear-search-btn {
  color: var(--accent-blue);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.search-filter-panel {
  margin: -12px;

  .search-filter-title {
    padding: 12px 14px 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search-filter-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 4px 6px 8px;
  }

  .search-filter-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .el-icon {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.search-value-panel {
  margin: -12px;

  .search-value-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);

    .back-icon {
      cursor: pointer;
      color: var(--text-muted);
      padding: 2px;
      border-radius: 4px;
      transition: all 150ms ease;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }
  }

  .search-value-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 6px;
  }

  .search-value-item {
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;
    margin-bottom: 2px;

    &:hover {
      background: rgba(113, 112, 255, 0.08);
      color: var(--accent-blue);
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .search-value-input {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
  }
}

// 表格区域
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

  th, td {
    padding: 10px 12px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // 首/末列对齐页面 20px 横向节奏
  th:first-child, td:first-child { padding-left: 20px; }
  th:last-child, td:last-child { padding-right: 20px; }

  th {
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-weight: 500;
  }

  td {
    border-bottom: 1px solid var(--border-subtle);
  }

  tbody tr {
    transition: background 150ms ease;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }
}

.col-name { width: 220px; max-width: 220px; }
.col-actions { width: 70px; }

// 单元格样式
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;

  .instance-name {
    color: var(--accent-blue);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      text-decoration: underline;
    }
  }
}

.cell-sub {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mono {
  font-family: var(--font-mono);
  font-size: 12px;
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
  &.error { background: var(--accent-red); }
  &.pending { background: var(--accent-yellow); }
}

.status-text {
  color: var(--text-secondary);
}

.platform-icon {
  font-size: 20px;
}

.action-link {
  color: var(--accent-blue);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: inline-block;
}

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);

  p {
    margin-top: 12px;
  }
}

// 分页栏
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
</style>
