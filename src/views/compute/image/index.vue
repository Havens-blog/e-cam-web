<template>
  <div class="image-page">
    <!-- 页面顶部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡）；
         tab 沿用原侧栏「镜像类型」域（image_owner_alias: 全部/公共/自定义/共享/市场）；
         5 状态标 总数/公共/自定义/共享（stats 接口口径）/导入中（创建族派生计数） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">镜像管理</h1>
        <div class="tab-nav">
          <span
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="handleTabChange(tab.key)"
          >
            {{ tab.label }}
          </span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ imageCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">公共</span>
            <span class="stat-num blue">{{ imageCounts.system }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">自定义</span>
            <span class="stat-num">{{ imageCounts.custom }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">共享</span>
            <span class="stat-num">{{ imageCounts.shared }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">导入中</span>
            <span class="stat-num orange">{{ imageCounts.importing }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：镜像领域动作。创建镜像/导入无后端接线能力（原页可接线动作仅 同步/行内创建实例），
         按 eip/waf 先例禁用 + tooltip；同步为已接线动作（ImageSyncDialog），主色落在同步上 -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            创建镜像
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Upload /></el-icon>
            导入镜像
          </el-button>
        </el-tooltip>
        <el-button type="primary" size="small" @click="syncDialogVisible = true">
          <el-icon><Refresh /></el-icon>
          同步镜像
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ imageList.length }}条 / 共{{ pagination.total }}条</span>
        <el-button size="small" circle @click="fetchData" title="刷新">
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
                  placeholder="输入搜索内容，回车添加条件（镜像名称 / ID…）"
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

    <!-- 表格区域（无多选列；首列镜像名 + 等宽 ID 副行） -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">云上ID/名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in imageList" :key="item.id" @click="handleRowClick(item)">
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id || '-' }}</span>
                </div>
                <div class="cell-sub">{{ item.asset_id }}</div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'image_type'">
                  <el-tag
                    v-if="item.attributes?.image_owner_alias"
                    size="small"
                    :type="getImageTagType(item.attributes?.image_owner_alias)"
                    effect="plain"
                  >
                    {{ getImageTypeLabel(item.attributes?.image_owner_alias) }}
                  </el-tag>
                  <span v-else class="cell-muted">-</span>
                </template>
                <template v-else-if="col.key === 'os'">
                  <span class="cell-text" :title="item.attributes?.os_name || ''">{{ getOsText(item.attributes) }}</span>
                </template>
                <template v-else-if="col.key === 'architecture'">
                  <span class="cell-text">{{ item.attributes?.architecture || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'size'">
                  <span class="cell-text">{{ item.attributes?.size ? item.attributes.size + ' GB' : '-' }}</span>
                </template>
                <template v-else-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.status)"></span>
                  <span class="status-text">{{ getStatusText(item.status) }}</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">
                  <span class="cell-text">{{ item.region || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'cloud_account_name'">{{ item.attributes?.cloud_account_name || '-' }}</template>
                <template v-else-if="col.key === 'creation_time'">{{ formatTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="handleCreateInstance(item)">创建实例</span>
                <span class="action-link" @click="handleViewDetail(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && imageList.length === 0" class="empty-state">
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

    <!-- 同步对话框（原页同步镜像能力保留） -->
    <ImageSyncDialog v-model:visible="syncDialogVisible" />

    <!-- 详情抽屉（原组件保留，行点击/详情入口不变） -->
    <ImageDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 原多选列（selectable 恒 false 死列）随紧凑标准删除（AC 口径），传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog
      v-model:visible="exportDialogVisible"
      :instances="imageList"
      :selected-ids="[]"
      :total="pagination.total"
      :fetch-all-rows="fetchAllExportRows"
      :config="exportConfig"
    />

    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog
      v-model:visible="columnSettingsVisible"
      :columns="columnSettings"
      @update:columns="handleColumnsUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import { getImageStatsApi, listImageAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { ASSET_STATUS_LABELS, IMAGE_STATUS_LABELS, IMAGE_TYPE_LABELS, OS_TYPE_LABELS } from '@/utils/fieldLabels'
import { fetchAllRows } from '@/utils/exportAll'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting, Upload } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ImageDetailDrawer from './components/ImageDetailDrawer.vue'
import ImageSyncDialog from './components/ImageSyncDialog.vue'

/** 状态族判定（状态点色调 + 「导入中」统计共用口径）。
 *  实测值域仅 Available(141)/available(506)/active(16)/NORMAL(6) 四个大小写变体，
 *  全部为成功族，无 creating/failed（2026-09-24 全量 669 条探查）；
 *  原页 statusLabels 缺 active/NORMAL 键会裸显英文，家族按镜像域近义态防御性扩展 */
const AVAILABLE_FAMILY = ['available', 'Available', 'active', 'Active', 'ACTIVE', 'normal', 'Normal', 'NORMAL', 'ok', 'OK', 'usable', 'in_use', 'InUse']
const IMPORTING_FAMILY = ['creating', 'Creating', 'importing', 'Importing', 'pending', 'Pending', 'waiting', 'Waiting', 'progressing', 'initializing']
const UNAVAILABLE_FAMILY = ['unavailable', 'UnAvailable', 'failed', 'Failed', 'error', 'Error']

/** 状态 → 状态点色调类（可用=绿 / 导入中=黄 / 不可用=红 / 未知=红） */
const getStatusClass = (status?: string) => {
  if (AVAILABLE_FAMILY.includes(status || '')) return 'running'
  if (IMPORTING_FAMILY.includes(status || '')) return 'pending'
  if (UNAVAILABLE_FAMILY.includes(status || '')) return 'error'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源；词表见 utils/fieldLabels IMAGE_STATUS_LABELS，未知值回退全局单源 lenient 透出） */
const getStatusText = (status?: string) => {
  if (!status) return '-'
  return IMAGE_STATUS_LABELS[status] || ASSET_STATUS_LABELS[status] || status
}

/** 镜像类型映射（沿用原页口径：system 公共 / self 自定义 / others 共享 / marketplace 市场）。
 *  实测当前数据 669 条全部为 self（自定义），公共/共享/市场为真实数据 0 态 */
const getImageTypeLabel = (alias: string | undefined): string => {
  if (!alias) return '-'
  return IMAGE_TYPE_LABELS[alias] || alias
}

const getImageTagType = (alias: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    system: 'primary', self: 'warning', others: 'success', marketplace: 'info',
  }
  return map[alias] || 'info'
}

/** 操作系统列文案：实测 AWS 系镜像 os_name 为「Created for policy: …」采集描述（360/669 条），
 *  platform 才是干净的系统族（Linux/UNIX、Windows Server…），故 platform 优先、os_name 兜底 */
const getOsText = (attr: any): string => {
  if (!attr) return '-'
  return attr.platform || attr.os_name || OS_TYPE_LABELS[attr.os_type] || '-'
}

/** 共享导出取值：status/类型/OS 按实测值域出文案（与列表口径同源） */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  const attr = instance.attributes || {}
  if (key === 'instance_name') return instance.asset_name || ''
  if (key === 'instance_id') return instance.asset_id || ''
  if (key === 'status') return getStatusText(instance.status)
  if (key === 'image_type') return getImageTypeLabel(attr.image_owner_alias)
  if (key === 'os') return getOsText(attr)
  if (key === 'architecture') return attr.architecture || ''
  if (key === 'size') return attr.size != null && attr.size !== 0 ? `${attr.size} GB` : ''
  if (key === 'provider') return getProviderLabel(instance.provider || '')
  if (key === 'region') return instance.region || ''
  if (key === 'cloud_account_name') return attr.cloud_account_name || ''
  if (key === 'creation_time') return attr.creation_time || ''
  return attr[key] || ''
}

/** 共享导出配置（原页无导出能力，按 proposal 风险缓解条款新增，字段按镜像领域派生） */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'instance_name', label: '镜像名称' },
    { key: 'instance_id', label: '镜像ID' },
    { key: 'status', label: '状态' },
    { key: 'image_type', label: '类型' },
    { key: 'os', label: '操作系统' },
    { key: 'architecture', label: '架构' },
    { key: 'size', label: '大小(GB)' },
    { key: 'provider', label: '云平台' },
    { key: 'region', label: '地域' },
    { key: 'cloud_account_name', label: '云账号' },
    { key: 'creation_time', label: '创建时间' },
  ],
  getValue: getExportValue,
  filename: '镜像管理',
  defaultFields: ['instance_name', 'instance_id', 'status', 'image_type', 'os', 'architecture', 'size', 'provider', 'region'],
}

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)
const activeTab = ref('all')

// 筛选条件（字段搜索栏映射到后端实测有效参数：
// name LIKE 匹配 asset_name+asset_id；account_id 精确；architecture/os_type/platform/status/provider/region
// 精确区分大小写；status 实测虽有效但值域 4 变体全成功族无区分度 → 不作搜索字段；
// cloud_account_name 实测后端忽略，不作搜索字段。image_owner_alias 由页头 tab 域管理）
const filters = reactive({
  name: '',
  account_id: '',
  architecture: '',
  os_type: '',
  platform: '',
  provider: '' as CloudProvider | '',
  region: '',
  image_owner_alias: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const imageList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 同步对话框（原 ImageSyncDialog 组件保留）
const syncDialogVisible = ref(false)

// 导出和自定义列
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

// 默认列配置：可见列按 AC 领域口径（类型/操作系统/架构/大小/状态/平台/地域），
// 云账号/创建时间实测全量有值 → 保留为可勾选列不进默认视图
// （col key 新键 image-column-settings 无历史漂移，无迁移）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'image_type', label: '类型', width: 90, visible: true },
  { key: 'os', label: '操作系统', width: 150, visible: true },
  { key: 'architecture', label: '架构', width: 90, visible: true },
  { key: 'size', label: '大小', width: 80, visible: true },
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 130, visible: true },
  { key: 'cloud_account_name', label: '云账号', width: 150, visible: false },
  { key: 'creation_time', label: '创建时间', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('image-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnsUpdate = (columns: ColumnConfig[]) => { columnSettings.value = columns }

// 页头 tab（沿用原侧栏「镜像类型」域，切换即过滤 image_owner_alias）
const tabs = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '公共镜像' },
  { key: 'self', label: '自定义镜像' },
  { key: 'others', label: '共享镜像' },
  { key: 'marketplace', label: '市场镜像' },
]

const handleTabChange = (key: string) => {
  if (activeTab.value === key) return
  activeTab.value = key
  filters.image_owner_alias = key === 'all' ? '' : key
  pagination.page = 1
  fetchData()
}

// ==================== 全局领域统计（总数/公共/自定义/共享/导入中） ====================
// 总数/公共/自定义/共享走原 stats 接口口径（与全量扫描一致，2026-09-24 实测 669/0/669/0）；
// 「导入中」stats 接口无此维度 → 全量分页扫描按创建族本地计数（eip/cdn/waf 同款）。
// 同一遍扫描动态派生 地域/镜像平台/架构 搜索选项（值域随采集同步增长，静态枚举必漂移）
const IMAGE_COUNTS_PAGE_SIZE = 1000
const IMAGE_COUNTS_MAX_PAGES = 10

const imageCounts = reactive({ total: 0, system: 0, custom: 0, shared: 0, importing: 0 })

const fetchImageStats = async () => {
  try {
    const res = await getImageStatsApi()
    const data = (res as any).data || res
    imageCounts.total = data.total || 0
    imageCounts.system = data.system || 0
    imageCounts.custom = data.custom || 0
    imageCounts.shared = data.shared || 0
  } catch {
    ElMessage.error('获取镜像统计失败')
  }
}

const fetchImageCounts = async () => {
  try {
    let importing = 0
    const regionCounts: Record<string, number> = {}
    const platformCounts: Record<string, number> = {}
    const architectureCounts: Record<string, number> = {}
    for (let page = 1; page <= IMAGE_COUNTS_MAX_PAGES; page++) {
      const res = await listImageAssetsApi({ limit: IMAGE_COUNTS_PAGE_SIZE, offset: (page - 1) * IMAGE_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      for (const it of items) {
        if (!it) continue
        if (IMPORTING_FAMILY.includes(it.status || '')) importing++
        if (it.region) regionCounts[it.region] = (regionCounts[it.region] || 0) + 1
        const attr = it.attributes || {}
        if (attr.platform) platformCounts[attr.platform] = (platformCounts[attr.platform] || 0) + 1
        if (attr.architecture) architectureCounts[attr.architecture] = (architectureCounts[attr.architecture] || 0) + 1
      }
      if (items.length < IMAGE_COUNTS_PAGE_SIZE) break
    }
    imageCounts.importing = importing
    const toOptions = (counts: Record<string, number>) => Object.entries(counts)
      .map(([value, count]) => ({ label: value, value, count }))
      .sort((a, b) => b.count - a.count)
    regionOptions.value = toOptions(regionCounts)
    platformOptions.value = toOptions(platformCounts)
    architectureOptions.value = toOptions(architectureCounts)
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取镜像统计失败')
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
const searchConditions = ref<SearchCondition[]>([])

// 搜索字段配置（7 个后端实测有效参数；实测值域选项逐值列出）
const searchFields = [
  { key: 'name', label: '镜像名称/ID', hasOptions: false },
  { key: 'account_id', label: '云账号', hasOptions: true },
  { key: 'architecture', label: '架构', hasOptions: true },
  { key: 'os_type', label: '操作系统', hasOptions: true },
  { key: 'platform', label: '镜像平台', hasOptions: true },
  { key: 'provider', label: '云平台', hasOptions: true },
  { key: 'region', label: '地域', hasOptions: true },
]

const searchFieldLabels: Record<string, string> = {
  name: '镜像名称/ID',
  account_id: '云账号',
  architecture: '架构',
  os_type: '操作系统',
  platform: '镜像平台',
  provider: '云平台',
  region: '地域',
}

// 有固定选项的字段（选项值 = 后端实测值域：精确匹配区分大小写）。
// architecture/platform/region 动态派生（随采集同步增长，静态枚举必漂移）；
// os_type 为稳定域枚举（实测 linux 498/windows 171，大写 Linux 查 0）；
// 云账号选项来自账号列表接口（原侧栏账号筛选能力在紧凑骨架的承接）
const staticFieldOptions: Record<string, { label: string; value: string }[]> = {
  os_type: [
    { label: 'Linux', value: 'linux' },
    { label: 'Windows', value: 'windows' },
  ],
  provider: CLOUD_PROVIDERS.map(p => ({ label: p.label, value: p.value })),
}

const regionOptions = ref<{ label: string; value: string }[]>([])
const platformOptions = ref<{ label: string; value: string }[]>([])
const architectureOptions = ref<{ label: string; value: string }[]>([])
const accountOptions = ref<{ label: string; value: string }[]>([])

const searchFieldOptions = computed<Record<string, { label: string; value: string }[]>>(() => ({
  ...staticFieldOptions,
  account_id: accountOptions.value,
  architecture: architectureOptions.value,
  platform: platformOptions.value,
  region: regionOptions.value,
}))

/** 云账号搜索选项（原侧栏账号筛选能力保留：id 精确过滤） */
const loadAccountOptions = async () => {
  try {
    const res = await listCloudAccountsApi({ limit: 200 })
    const data = (res as any).data || res
    const accounts = (data.accounts || data.data || []).filter((a: any) => a != null)
    accountOptions.value = accounts.map((a: any) => ({ label: a.name || `账号#${a.id}`, value: String(a.id) }))
  } catch {
    ElMessage.error('获取云账号列表失败')
  }
}

const handleSearchFocus = () => {
  searchFilterVisible.value = true
}

const selectSearchFilter = (field: string) => {
  currentSearchField.value = field
  searchKeyword.value = ''
  // 如果没有固定选项，聚焦到输入框
  if (!searchFieldOptions.value[field]) {
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

  // 如果没有选择字段，默认按名称/ID 搜索
  const field = currentSearchField.value || 'name'

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
  // 先清除所有搜索相关的筛选（image_owner_alias 由页头 tab 管理，不在此清）
  filters.name = ''
  filters.account_id = ''
  filters.architecture = ''
  filters.os_type = ''
  filters.platform = ''
  filters.provider = ''
  filters.region = ''

  // 应用所有搜索条件（映射到后端实测有效的筛选参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'name':
        filters.name = cond.value
        break
      case 'account_id':
        filters.account_id = cond.value
        break
      case 'architecture':
        filters.architecture = cond.value
        break
      case 'os_type':
        filters.os_type = cond.value
        break
      case 'platform':
        filters.platform = cond.value
        break
      case 'provider':
        // 选项值来自固定 provider 列表（hasOptions 字段），值域恒为合法 CloudProvider 键
        filters.provider = cond.value as CloudProvider
        break
      case 'region':
        filters.region = cond.value
        break
    }
  })

  pagination.page = 1
  fetchData()
}

// ==================== 数据获取 ====================

/** 组装列表查询参数（列表分页与导出全量拉取共用，保证筛选口径一致） */
const buildListParams = (page: number, size: number): Record<string, any> => {
  const params: Record<string, any> = {
    offset: (page - 1) * size,
    limit: size,
  }
  if (filters.name) params.name = filters.name
  if (filters.account_id) params.account_id = filters.account_id
  if (filters.architecture) params.architecture = filters.architecture
  if (filters.os_type) params.os_type = filters.os_type
  if (filters.platform) params.platform = filters.platform
  if (filters.provider) params.provider = filters.provider
  if (filters.region) params.region = filters.region
  if (filters.image_owner_alias) params.image_owner_alias = filters.image_owner_alias
  return params
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listImageAssetsApi(buildListParams(pagination.page, pagination.size))
    imageList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计与动态选项
    fetchImageStats()
    fetchImageCounts()
  } catch (error: any) {
    console.error('获取镜像列表失败:', error)
    ElMessage.error(error.message || '获取镜像列表失败')
    imageList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（共享 fetchAllRows 工具），供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listImageAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

// 行点击开详情（与 eip/waf 页一致）
const handleRowClick = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleViewDetail = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

/** 行内「创建实例」跳转（原页已接线能力逐字保留：携 image_id 进开通向导） */
const handleCreateInstance = (row: Asset) => {
  router.push(`/compute/template/create?image_id=${row?.asset_id || ''}`)
}

/** 格式化时间：实测 creation_time 全量为 ISO 带 T/Z（dayjs 可解析） */
const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(time)
}

const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

onMounted(() => {
  loadColumnSettings()
  // H-03：全局搜索/实例详情「查看资产」带 query.search 跳入时预填关键词
  const s = route.query.search
  if (typeof s === 'string' && s) {
    filters.name = s
    searchKeyword.value = s
  }
  fetchData()
  loadAccountOptions()
})
</script>

<style lang="scss" scoped>
.image-page {
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
    user-select: none;

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

  // 首/末列对齐页面 20px 横向节奏（去多选列后首列镜像名不再贴边错位）
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

.col-name { width: 280px; max-width: 280px; }
.col-actions { width: 120px; }

// 单元格样式
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 260px;

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

.cell-text {
  color: var(--text-secondary);
}

.cell-muted {
  color: var(--text-muted);
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

.platform-icon { font-size: 20px; }

.action-link {
  color: var(--accent-blue);
  cursor: pointer;
  margin-right: 12px;

  &:last-child {
    margin-right: 0;
  }

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
