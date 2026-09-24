<template>
  <div class="cdn-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡）；
         「在线域名」大卡口径并入「在线」状态标，证书标 = cert_name 非空派生计数 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">CDN 加速域名</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">在线</span>
          <span class="tab-item">离线</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ cdnCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">在线</span>
            <span class="stat-num blue">{{ cdnCounts.online }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">离线</span>
            <span class="stat-num">{{ cdnCounts.offline }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">HTTPS 开启</span>
            <span class="stat-num">{{ cdnCounts.https }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">证书</span>
            <span class="stat-num">{{ cdnCounts.cert }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：CDN 领域动作。添加域名/刷新缓存无后端接线能力（原页接线动作仅同步/导出/自定义列），
         按 eip 先例禁用 + tooltip；成本明细为原「本月成本」大卡唯一接线入口，收敛为按钮保留能力；
         同步为已接线动作，主色落在同步上 -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            添加域名
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>刷新缓存</el-button>
        </el-tooltip>
        <el-button size="small" @click="costPanelVisible = true">成本明细</el-button>
        <el-button type="primary" size="small" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ cdnList.length }}条 / 共{{ pagination.total }}条</span>
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
                  placeholder="输入搜索内容，回车添加条件（域名 / 业务类型 / 服务区域…）"
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

    <!-- 表格区域（无多选列；首列加速域名 + 等宽 ID 副行） -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">加速域名</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in cdnList" :key="item.id" @click="handleRowClick(item)">
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ extractDomainName(item) }}</span>
                </div>
                <!-- asset_id 实测恒等于域名（598 行全量），仅在两者不同时出副行避免整列重复 -->
                <div v-if="item.asset_id && item.asset_id !== extractDomainName(item)" class="cell-sub">{{ item.asset_id }}</div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.status)"></span>
                  <span class="status-text">{{ getStatusText(item.status) }}</span>
                </template>
                <template v-else-if="col.key === 'cname'">
                  <span class="mono text-ellipsis" :title="extractCname(item)">{{ extractCname(item) || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'business_type'">
                  <span class="cell-text">{{ cdnBusinessTypeLabel(item.attributes?.business_type) }}</span>
                </template>
                <template v-else-if="col.key === 'https_enabled'">
                  <el-icon v-if="item.attributes?.https_enabled" class="bool-on" :size="15"><CircleCheck /></el-icon>
                  <span v-else class="bool-off">—</span>
                </template>
                <template v-else-if="col.key === 'cert_name'">{{ item.attributes?.cert_name || '-' }}</template>
                <template v-else-if="col.key === 'service_area'">
                  <span class="cell-text">{{ cdnServiceAreaLabel(item.attributes?.service_area) }}</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'http2_enabled'">
                  <el-icon v-if="item.attributes?.http2_enabled" class="bool-on" :size="15"><CircleCheck /></el-icon>
                  <span v-else class="bool-off">—</span>
                </template>
                <template v-else-if="col.key === 'creation_time'">{{ formatTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="handleViewDetail(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && cdnList.length === 0" class="empty-state">
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

    <!-- 同步对话框（原页同步实例能力保留） -->
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
    <!-- 成本面板（原「本月成本」大卡入口收敛为操作栏按钮） -->
    <CdnCostPanel v-model:visible="costPanelVisible" />
    <!-- 原多选列未接线（selectedIds 恒空）随列删除，传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog
      v-model:visible="exportDialogVisible"
      :instances="cdnList"
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
import { submitSyncAssetsTaskApi } from '@/api'
import { listCDNAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { fetchAllRows } from '@/utils/exportAll'
import {
  CDN_BUSINESS_TYPE_OPTIONS,
  CDN_SERVICE_AREA_OPTIONS,
  cdnBusinessTypeLabel,
  cdnServiceAreaLabel,
  cdnStatusLabel,
} from '@/utils/cdn'
import { ArrowLeft, ArrowRight, Box, CircleCheck, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CdnCostPanel from './components/CdnCostPanel.vue'
import CdnDetailDrawer from './components/CdnDetailDrawer.vue'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'

/** 状态族判定（状态点色调 + 全局统计共用口径）。
 *  实测统一值域仅 online(566)/offline(31)/InProgress(1) 三值（2026-09-24 全量 598 条探查）；
 *  其余为历史原始值兼容族（utils/cdn CDN_STATUS_LABELS 同源），未知值防御性计入异常色调 */
const ONLINE_FAMILY = ['online', 'Online', 'Deployed', 'deployed', 'active', 'Active', 'Started', 'started']
const OFFLINE_FAMILY = ['offline', 'Offline', 'stopped', 'Stopped', 'disabled', 'closed', 'Closed']
const PENDING_FAMILY = ['InProgress', 'inprogress', 'deploying', 'Deploying', 'creating', 'Configuring', 'configuring', 'Checking', 'checking', 'pending']

/** 状态 → 状态点色调类（在线=绿 / 离线=灰 / 过渡态=黄 / 其余=红） */
const getStatusClass = (status?: string) => {
  if (ONLINE_FAMILY.includes(status || '')) return 'running'
  if (OFFLINE_FAMILY.includes(status || '')) return 'stopped'
  if (PENDING_FAMILY.includes(status || '')) return 'pending'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源，共享 utils/cdn 映射含历史原始值） */
const getStatusText = (status?: string) => cdnStatusLabel(status)

/** 共享导出取值：原本地 getExportValue 逐字搬运（零漂移，不在迁移中优化） */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  const attr = instance.attributes || {}
  if (key === 'domain_name') return attr.domain_name || instance.asset_id || ''
  if (key === 'cname') return attr.cname || ''
  if (key === 'status') return cdnStatusLabel(instance.status)
  if (key === 'business_type') return cdnBusinessTypeLabel(attr.business_type)
  if (key === 'https_enabled') return attr.https_enabled ? '已开启' : '未开启'
  if (key === 'service_area') return cdnServiceAreaLabel(attr.service_area)
  if (key === 'provider') return getProviderLabel(instance.provider || '')
  if (key === 'creation_time') return attr.creation_time || ''
  return attr[key] || ''
}

/** 共享导出配置：字段/默认勾选沿用原 exportConfig，文件名前缀原样保留 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'domain_name', label: '域名' }, { key: 'cname', label: 'CNAME' }, { key: 'status', label: '状态' },
    { key: 'business_type', label: '业务类型' }, { key: 'https_enabled', label: 'HTTPS' }, { key: 'service_area', label: '加速区域' },
    { key: 'provider', label: '云平台' }, { key: 'creation_time', label: '创建时间' },
  ],
  getValue: getExportValue,
  filename: 'CDN加速域名',
  defaultFields: ['domain_name', 'cname', 'status', 'business_type', 'https_enabled', 'service_area', 'provider'],
}

const router = useRouter()

// 状态
const loading = ref(false)

// 筛选条件（字段搜索栏映射到后端实测有效参数）
const filters = reactive({
  name: '',
  provider: '' as CloudProvider | '',
  status: '',
  business_type: '',
  service_area: '',
  https_enabled: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const cdnList = ref<Asset[]>([])

// 详情抽屉 / 成本面板
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const costPanelVisible = ref(false)

// 导出和自定义列
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

// 默认列配置：可见列按 AC 领域口径（CNAME/业务类型/HTTPS/证书/服务区域/状态/平台），
// HTTP/2 与创建时间保留为可勾选列（col key 与历史 cdn-column-settings 零漂移，无迁移）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'cname', label: 'CNAME', width: 220, visible: true },
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'business_type', label: '业务类型', width: 100, visible: true },
  { key: 'https_enabled', label: 'HTTPS', width: 80, visible: true },
  { key: 'cert_name', label: '证书名称', width: 140, visible: true },
  { key: 'service_area', label: '服务区域', width: 100, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'http2_enabled', label: 'HTTP/2', width: 80, visible: false },
  { key: 'creation_time', label: '创建时间', width: 150, visible: false },
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

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)

// ===== 全局领域统计（总数/在线/离线/HTTPS 开启/证书） =====
// 状态标为全局口径（不受当前筛选影响），全量分页拉取后本地计数（eip 同款）。
// 实测状态值域仅 online/offline/InProgress 三值（统一枚举），HTTPS 按属性布尔计数；
// 证书 = cert_name 非空派生计数（当前 598 行全空，显示 0 为真实数据状态）。
const CDN_COUNTS_PAGE_SIZE = 1000
const CDN_COUNTS_MAX_PAGES = 10

const cdnCounts = reactive({ total: 0, online: 0, offline: 0, https: 0, cert: 0 })

const fetchCdnCounts = async () => {
  try {
    let online = 0
    let offline = 0
    let https = 0
    let cert = 0
    let total = 0
    for (let page = 1; page <= CDN_COUNTS_MAX_PAGES; page++) {
      const res = await listCDNAssetsApi({ limit: CDN_COUNTS_PAGE_SIZE, offset: (page - 1) * CDN_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        if (ONLINE_FAMILY.includes(it.status || '')) online++
        else if (OFFLINE_FAMILY.includes(it.status || '')) offline++
        const attr = it.attributes || {}
        if (attr.https_enabled === true) https++
        if (attr.cert_name) cert++
      }
      if (items.length < CDN_COUNTS_PAGE_SIZE) break
    }
    cdnCounts.total = total
    cdnCounts.online = online
    cdnCounts.offline = offline
    cdnCounts.https = https
    cdnCounts.cert = cert
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取CDN统计失败')
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

// 搜索字段配置（按本页现有 col.key 派生 + 后端实测有效参数筛除）：
// name 实测按域名 LIKE 匹配（不匹配 CNAME）；status/business_type/service_area 为统一枚举精确匹配
// （历史原始值如 Started/page/mainland 实测 total 不变）；https_enabled 'true'/'false' 有效；
// cname/cert_name/http2_enabled 实测后端忽略（传参 total 不变），不作搜索字段
const searchFields = [
  { key: 'domain_name', label: '域名', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'business_type', label: '业务类型', hasOptions: true },
  { key: 'service_area', label: '服务区域', hasOptions: true },
  { key: 'https_enabled', label: 'HTTPS', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
]

const searchFieldLabels: Record<string, string> = {
  domain_name: '域名',
  status: '状态',
  business_type: '业务类型',
  service_area: '服务区域',
  https_enabled: 'HTTPS',
  provider: '平台',
}

// 有固定选项的字段（选项值 = 后端实测值域：统一枚举精确匹配）
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '正常', value: 'online' },
    { label: '已停用', value: 'offline' },
    { label: '部署中', value: 'InProgress' },
  ],
  business_type: CDN_BUSINESS_TYPE_OPTIONS,
  service_area: CDN_SERVICE_AREA_OPTIONS,
  https_enabled: [
    { label: '开启', value: 'true' },
    { label: '关闭', value: 'false' },
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

  // 如果没有选择字段，默认用域名搜索
  const field = currentSearchField.value || 'domain_name'

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
  filters.name = ''
  filters.provider = ''
  filters.status = ''
  filters.business_type = ''
  filters.service_area = ''
  filters.https_enabled = ''

  // 应用所有搜索条件（映射到后端实测有效的筛选参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'domain_name':
        filters.name = cond.value
        break
      case 'status':
        filters.status = cond.value
        break
      case 'business_type':
        filters.business_type = cond.value
        break
      case 'service_area':
        filters.service_area = cond.value
        break
      case 'https_enabled':
        filters.https_enabled = cond.value
        break
      case 'provider':
        // 选项值来自固定 provider 列表（hasOptions 字段），值域恒为合法 CloudProvider 键
        filters.provider = cond.value as CloudProvider
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
  if (filters.provider) params.provider = filters.provider
  if (filters.status) params.status = filters.status
  if (filters.business_type) params.business_type = filters.business_type
  if (filters.service_area) params.service_area = filters.service_area
  if (filters.https_enabled) params.https_enabled = filters.https_enabled
  return params
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listCDNAssetsApi(buildListParams(pagination.page, pagination.size))
    cdnList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchCdnCounts()
  } catch (error: any) {
    console.error('获取CDN列表失败:', error)
    ElMessage.error(error.message || '获取CDN列表失败')
    cdnList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（原 fetchAllExportRows 保留），供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listCDNAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

// 行点击开详情（与 eip/NAS 页一致）
const handleRowClick = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleViewDetail = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleSync = () => { syncForm.provider = ''; syncDialogVisible.value = true }

const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['cdn'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交同步任务失败')
  } finally {
    syncing.value = false
  }
}

/** 域名展示：attr.domain_name 优先，asset_name 兜底（含历史「域名 CNAME: x」拼接格式解析） */
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

/** 格式化时间：实测 ISO（331 条）与空格分隔（198 条）两种格式，dayjs 均可解析 */
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
  fetchData()
})
</script>

<style lang="scss" scoped>
.cdn-page {
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

  // 首/末列对齐页面 20px 横向节奏（去多选列后首列域名不再贴边错位）
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

.col-name { width: 260px; max-width: 260px; }
.col-actions { width: 70px; }

// 单元格样式
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 240px;

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

.mono {
  font-family: var(--font-mono);
  font-size: 12.5px;
}

.bool-on { color: var(--accent-green); }
.bool-off { color: var(--text-muted); font-size: 12px; }

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
