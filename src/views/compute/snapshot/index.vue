<template>
  <div class="snapshot-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">快照</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">公有云</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ snapshotCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">正常</span>
            <span class="stat-num blue">{{ snapshotCounts.normal }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">手动创建</span>
            <span class="stat-num">{{ snapshotCounts.user }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">自动创建</span>
            <span class="stat-num">{{ snapshotCounts.auto }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">定时快照</span>
            <span class="stat-num">{{ snapshotCounts.timer }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：快照领域动作（不照搬主机电源操作）；新建/回滚/删除为快照标准领域动作，cam 后端仅有列表/详情端点
         （asset.ts 仅 listSnapshotAssetsApi/getSnapshotAssetApi，无写入端点）→ 全部禁用 + tooltip（同安全组批口径） -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            新建快照
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>回滚</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>删除</el-button>
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
              <th class="col-name">快照ID/名称</th>
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
                  <span class="status-dot" :class="getStatusClass(item.status)"></span>
                  <span class="status-text">{{ getStatusText(item.status) }}</span>
                </template>
                <template v-else-if="col.key === 'size'">{{ item.attributes?.source_disk_size || '-' }} GB</template>
                <template v-else-if="col.key === 'source_disk'"><span class="text-ellipsis">{{ item.attributes?.source_disk_id || '-' }}</span></template>
                <template v-else-if="col.key === 'progress'">
                  <el-progress v-if="item.attributes?.progress" :percentage="parseInt(item.attributes.progress)" :stroke-width="6" />
                  <span v-else>100%</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">{{ item.region || '-' }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatTime(item.create_time) }}</template>
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
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- 详情抽屉 -->
    <SnapshotDetailDrawer v-model:visible="detailVisible" :instance="currentInstance" />
    <!-- 原本地导出弹窗的「已选中」随多选列移除而失去来源，传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog v-model:visible="exportDialogVisible" :instances="instances" :selected-ids="[]" :total="pagination.total" :fetch-all-rows="fetchAllExportRows" :config="exportConfig" />
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { listSnapshotAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import { fetchAllRows } from '@/utils/exportAll'
import IconFont from '@/components/IconFont/index.vue'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import { getProviderLabel } from '@/utils/constants'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import ColumnSettingsDialog from './components/ColumnSettingsDialog.vue'
import SnapshotDetailDrawer from './components/SnapshotDetailDrawer.vue'
import { getProviderIcon } from '@/utils/icon-mapping'
import { SNAPSHOT_STATUS_LABELS, labelOfLenient } from '@/utils/fieldLabels'

interface ColumnConfig { key: string; label: string; width?: number; visible: boolean }

/** 共享导出取值：原本地 ExportDialog 内联取值逻辑逐字搬运（零漂移，不在迁移中优化） */
const getExportValue: ExportFieldConfig['getValue'] = (i: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return i[key] || ''
  if (key === 'create_time') return i.create_time ? new Date(i.create_time).toLocaleString('zh-CN') : ''
  // status/provider/region 是 Asset 顶层字段，attributes 里恒空（compute-2 F-H4）；状态导出同样走单源文案防裸显英文
  if (key === 'status') return getStatusText(i.status || i.attributes?.status)
  if (key === 'provider') return i.provider || i.attributes?.provider || ''
  if (key === 'region') return i.region || i.attributes?.region || ''
  return i.attributes?.[key] || ''
}

/** 共享导出配置：字段/默认勾选沿用原本地 ExportDialog availableFields / exportForm.fields，文件名前缀原样保留 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'asset_id', label: '快照ID' }, { key: 'asset_name', label: '名称' }, { key: 'status', label: '状态' },
    { key: 'source_disk_id', label: '源云盘' }, { key: 'source_disk_size', label: '源盘容量' },
    { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' }, { key: 'create_time', label: '创建时间' },
  ],
  getValue: getExportValue,
  filename: '快照列表',
  defaultFields: ['asset_id', 'asset_name', 'status', 'source_disk_id', 'source_disk_size', 'provider', 'region'],
}

const loading = ref(false)
const instances = ref<Asset[]>([])
const detailVisible = ref(false)
const currentInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive<{ keyword: string; provider: CloudProvider | ''; region: string; source_disk_id: string }>({
  keyword: '',
  provider: '',
  region: '',
  source_disk_id: '',
})
const pagination = reactive({ page: 1, size: 20, total: 0 })

// 列定义沿用原页 key/label/width（与 snapshot-column-settings 历史保存设置零漂移，无需迁移）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'size', label: '源盘容量', width: 100, visible: true },
  { key: 'source_disk', label: '源云盘', width: 180, visible: true },
  { key: 'progress', label: '进度', width: 120, visible: true },
  { key: 'platform', label: '云平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 120, visible: true },
  { key: 'create_time', label: '创建时间', width: 160, visible: true },
]
const columnSettings = ref<ColumnConfig[]>([...defaultColumnSettings])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

// ==================== 全局领域统计（总数/正常/手动创建/自动创建/定时快照） ====================
// 实测值域（2026-09-24 全量 3620 条）：顶层 status 仅 4 个厂商侧「成功」值——accomplished(阿里云 1165) /
// available(华为 69 + 火山 1527) / NORMAL(腾讯 55) / completed(AWS 804)，无 progressing/failed/空值。
// 状态维度无区分度（正常=总数），其余状态标按快照类型分布派生（user 1356 / auto 1413 / timer 838，
// copied/imported 共 13 条不入标）。类型维度无后端筛选参数，故全量拉取后本地计数（limit=1000 一次一页，实测 4 页取全）。
const SNAPSHOT_SUCCESS_KEYWORDS = ['accomplished', 'normal', 'available', 'completed']
const SNAPSHOT_COUNTS_PAGE_SIZE = 1000
const SNAPSHOT_COUNTS_MAX_PAGES = 10

const snapshotCounts = reactive({ total: 0, normal: 0, user: 0, auto: 0, timer: 0 })

/** 成功族状态判定：各厂商成功值不同（无统一值），行内状态展示与状态标计数按同组关键词归一 */
const isSnapshotSuccess = (status?: string) => {
  const s = (status || '').toLowerCase()
  return SNAPSHOT_SUCCESS_KEYWORDS.some(k => s.includes(k))
}

const fetchSnapshotCounts = async () => {
  try {
    let total = 0
    let normal = 0
    let user = 0
    let auto = 0
    let timer = 0
    for (let page = 1; page <= SNAPSHOT_COUNTS_MAX_PAGES; page++) {
      const res = await listSnapshotAssetsApi({ limit: SNAPSHOT_COUNTS_PAGE_SIZE, offset: (page - 1) * SNAPSHOT_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        if (isSnapshotSuccess(it.status)) normal++
        const t = it.attributes?.snapshot_type
        if (t === 'user') user++
        else if (t === 'auto') auto++
        else if (t === 'timer') timer++
      }
      if (items.length < SNAPSHOT_COUNTS_PAGE_SIZE) break
    }
    snapshotCounts.total = total
    snapshotCounts.normal = normal
    snapshotCounts.user = user
    snapshotCounts.auto = auto
    snapshotCounts.timer = timer
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取快照统计失败')
  }
}

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
const route = useRoute()
const searchConditions = ref<SearchCondition[]>([])

// 搜索字段配置（仅覆盖实测有效的后端筛选维度，均经 :8888 实探验证：name 同时匹配 asset_id、
// provider/region/source_disk_id 传参 total 变化。status 参数虽有效但值域为各厂商成功态同义词
// （accomplished/available/NORMAL/completed），无区分度且原页「正常=accomplished」口径会漏 2/3 数据 → 不作搜索字段）
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
  { key: 'source_disk_id', label: '源云盘ID', hasOptions: false },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  provider: '平台',
  region: '区域',
  source_disk_id: '源云盘ID',
}

// 有固定选项的字段
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
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
  filters.provider = ''
  filters.region = ''
  filters.source_disk_id = ''

  // 应用所有搜索条件（映射到 ListSnapshotParams 支持的参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
        filters.keyword = cond.value
        break
      case 'provider':
        // 选项值来自固定 provider 列表（hasOptions 字段），值域恒为合法 CloudProvider 键
        filters.provider = cond.value as CloudProvider
        break
      case 'region':
        filters.region = cond.value
        break
      case 'source_disk_id':
        filters.source_disk_id = cond.value
        break
    }
  })

  pagination.page = 1
  fetchData()
}

// ==================== 数据获取 ====================

/** 组装列表查询参数（仅实测有效的筛选维度；列表分页与导出全量拉取共用，保证筛选口径一致） */
const buildListParams = (page: number, size: number) => ({
  offset: (page - 1) * size,
  limit: size,
  name: filters.keyword || undefined,
  provider: filters.provider || undefined,
  region: filters.region || undefined,
  source_disk_id: filters.source_disk_id || undefined,
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listSnapshotAssetsApi(buildListParams(pagination.page, pagination.size))
    instances.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchSnapshotCounts()
  } catch (e) {
    console.error('获取快照列表失败:', e)
    ElMessage.error('获取快照列表失败')
    instances.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（主题A compute-2 F-H2），供 ExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listSnapshotAssetsApi(buildListParams(page, pageSize))
    return { list: res.data?.items || [], total: res.data?.total || 0 }
  }, { onProgress })

const handleRefresh = () => { fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
// 行点击开详情（与主机/安全组页一致）
const handleRowClick = (row: Asset) => { handleViewDetail(row) }
const handleViewDetail = (row: Asset) => { currentInstance.value = row; detailVisible.value = true }
const handleColumnSettingsChange = (cols: ColumnConfig[]) => { columnSettings.value = cols; localStorage.setItem('snapshot-column-settings', JSON.stringify(cols)) }

/** 状态文案：成功族（accomplished/available/NORMAL/completed）归一为「正常」，词表走 fieldLabels 单源 SNAPSHOT_STATUS_LABELS */
const getStatusText = (status?: string) => labelOfLenient(SNAPSHOT_STATUS_LABELS, (status || '').toLowerCase(), '-')
/** 状态点色：绿=成功族 / 红=失败 / 黄=其余（创建中等） */
const getStatusClass = (status?: string) => {
  if (isSnapshotSuccess(status)) return 'running'
  const s = (status || '').toLowerCase()
  if (s.includes('failed')) return 'error'
  return 'pending'
}
const getPlatformIcon = (provider?: string) => getProviderIcon(provider || '')
/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')
const formatTime = (time?: number) => time ? new Date(time).toLocaleString('zh-CN') : '-'

onMounted(() => {
  const saved = localStorage.getItem('snapshot-column-settings')
  if (saved) { try { columnSettings.value = JSON.parse(saved) } catch {} }
  // H-03：全局搜索/实例详情「查看资产」带 query.search 跳入时预填关键词
  const s = route.query.search
  if (typeof s === 'string' && s) {
    filters.keyword = s
    searchKeyword.value = s
  }
  fetchData()
})
</script>

<style lang="scss" scoped>
.snapshot-page {
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

  // 首/末列对齐页面 20px 横向节奏（去多选列后首列名称不再贴边错位）
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

.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 6px; background: var(--text-muted); &.running { background: var(--accent-green); } &.error { background: var(--accent-red); } &.pending { background: var(--accent-yellow); } }
.status-text { color: var(--text-secondary); }
.platform-icon { font-size: 20px; }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; display: inline-block; }

.action-link {
  color: var(--accent-blue);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
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
