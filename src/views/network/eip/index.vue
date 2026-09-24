<template>
  <div class="eip-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">弹性公网 IP (EIP)</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">已绑定</span>
          <span class="tab-item">未绑定</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ eipCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">已绑定</span>
            <span class="stat-num blue">{{ eipCounts.bound }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">未绑定</span>
            <span class="stat-num">{{ eipCounts.unbound }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">带宽告警</span>
            <span class="stat-num orange">0</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">{{ eipCounts.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：EIP 领域动作（申请/绑定/解绑/修改带宽/释放/标签均未实现，禁用 + tooltip，佐证=详情抽屉 F-EIP-02 同口径）；
         同步为唯一已接线动作（原 ManagerHeader 同步实例保留），故主色落在同步上 -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            申请 EIP
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>绑定实例</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>解绑</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>修改带宽</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>释放</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>标签</el-button>
        </el-tooltip>
        <el-button type="primary" size="small" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ eipList.length }}条 / 共{{ pagination.total }}条</span>
        <el-button size="small" circle @click="fetchData" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button size="small" circle @click="showExportDialog = true" title="导出">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" circle @click="showColumnSettings = true" title="自定义列">
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
                  placeholder="输入搜索内容，回车添加条件（名称 / IP / 关联实例…）"
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

    <!-- 表格区域（无多选列；首列名称 + 等宽 ID 副行） -->
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
            <tr v-for="item in eipList" :key="item.id" @click="handleRowClick(item)">
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
                <template v-else-if="col.key === 'ip_address'"><span class="mono">{{ item.attributes?.ip_address || '-' }}</span></template>
                <template v-else-if="col.key === 'bandwidth'"><span class="mono">{{ item.attributes?.bandwidth ? item.attributes.bandwidth + ' Mbps' : '-' }}</span></template>
                <template v-else-if="col.key === 'charge_type'">
                  <span v-if="item.attributes?.charge_type" class="env-tag">{{ getChargeTypeLabel(item.attributes.charge_type) }}</span>
                  <span v-else>-</span>
                </template>
                <template v-else-if="col.key === 'instance_id'">
                  <span v-if="item.attributes?.instance_id" class="mono text-ellipsis">{{ item.attributes.instance_id }}<template v-if="item.attributes?.instance_name"> · {{ item.attributes.instance_name }}</template></span>
                  <span v-else class="text-muted">未绑定</span>
                </template>
                <template v-else-if="col.key === 'instance_type'">{{ getInstanceTypeLabel(item.attributes?.instance_type) }}</template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'account_name'">{{ item.attributes?.account_name || '-' }}</template>
                <template v-else-if="col.key === 'region'">{{ getRegionLabel(item.provider, item.region) }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatTime(item.create_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="handleViewDetail(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && eipList.length === 0" class="empty-state">
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

    <!-- 同步对话框（原 ManagerHeader 同步实例，能力保留） -->
    <el-dialog v-model="syncDialogVisible" title="同步弹性公网IP" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select v-model="syncForm.provider" placeholder="请选择云厂商" style="width: 100%">
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select v-model="syncForm.regions" multiple placeholder="留空表示同步所有区域" style="width: 100%" clearable allow-create filterable>
            <el-option label="北京" value="cn-beijing" />
            <el-option label="上海" value="cn-shanghai" />
            <el-option label="广州" value="cn-guangzhou" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <EipDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 原多选列未接线（selectedIds 恒空）随列删除，传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog
      v-model:visible="showExportDialog"
      :instances="eipList"
      :selected-ids="[]"
      :total="pagination.total"
      :fetch-all-rows="fetchAllExportRows"
      :config="exportConfig"
    />

    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog
      v-model:visible="showColumnSettings"
      :columns="columnSettings"
      @update:columns="handleColumnsUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listEIPAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel, PROVIDER_CONFIGS } from '@/utils/constants'
import { fetchAllRows } from '@/utils/exportAll'
import { CHARGE_TYPE_LABELS, labelOfLenient } from '@/utils/fieldLabels'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import EipDetailDrawer from './components/EipDetailDrawer.vue'

/** 状态值 → 展示文案。Attached(华为云绑定态) 实测 39 条，与 InUse 同为已绑定族（2026-09-24 全量探查）；
 *  键值与 EipDetailDrawer 的 statusLabels 保持一致(键值勿改) */
const EIP_STATUS_LABELS: Record<string, string> = {
  InUse: '已绑定', inuse: '已绑定', '已绑定': '已绑定', Attached: '已绑定',
  Available: '未绑定', available: '未绑定', '未绑定': '未绑定',
  Bindable: '可绑定',
}

/** 状态族判定（状态点色调 + 全局统计共用口径） */
const isBoundStatus = (status?: string) => ['InUse', 'inuse', 'Attached', 'attached', '已绑定'].includes(status || '')
const isUnboundStatus = (status?: string) => ['Available', 'available', 'Bindable', 'bindable', '未绑定', '可绑定'].includes(status || '')

/** 状态 → 状态点色调类（绑定=绿 / 未绑定=灰 / 可绑定=黄 / 其余=红） */
const getStatusClass = (status?: string) => {
  if (isBoundStatus(status)) return 'running'
  if (isUnboundStatus(status)) return 'stopped'
  if (status === 'Bindable' || status === 'bindable') return 'pending'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源） */
const getStatusText = (status?: string) => labelOfLenient(EIP_STATUS_LABELS, status, status || '-')

/** 共享导出取值：原本地 ExportDialog.getFieldValue 逐字搬运（零漂移，不在迁移中优化；仅 EIP_STATUS_LABELS 补 Attached） */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return instance[key] || ''
  const attr = instance.attributes || {}
  if (key === 'provider') return getProviderLabel(instance.provider || '')
  if (key === 'region') return instance.region || ''
  if (key === 'status') return labelOfLenient(EIP_STATUS_LABELS, instance.status, '')
  if (key === 'bandwidth') return attr.bandwidth ? `${attr.bandwidth}Mbps` : ''
  if (key === 'charge_type') return labelOfLenient(CHARGE_TYPE_LABELS, attr.charge_type, '')
  return attr[key] || ''
}

/** 共享导出配置：字段/默认勾选沿用原本地 ExportDialog availableFields / exportForm.fields，文件名前缀原样保留 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'asset_id', label: 'EIP ID' }, { key: 'asset_name', label: '名称' }, { key: 'ip_address', label: 'IP地址' },
    { key: 'status', label: '状态' }, { key: 'bandwidth', label: '带宽' }, { key: 'charge_type', label: '计费方式' },
    { key: 'instance_id', label: '绑定实例' }, { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' },
  ],
  getValue: getExportValue,
  filename: 'EIP列表',
  defaultFields: ['asset_id', 'asset_name', 'ip_address', 'status', 'bandwidth', 'provider', 'region'],
}

const router = useRouter()

// 状态
const loading = ref(false)

// 筛选条件（字段搜索栏映射到后端实测有效参数）
const filters = reactive({
  keyword: '',
  provider: '' as CloudProvider | '',
  region: '',
  status: '',
  ip_address: '',
  instance_id: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const eipList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 导出和自定义列
const showExportDialog = ref(false)
const showColumnSettings = ref(false)

// 默认列配置：可见列按原型/AC 领域口径（公网IP/状态/带宽/计费/关联实例/平台/地域），
// 实例类型/云账号/创建时间 保留为可勾选列（col key 与历史 eip-column-settings 零漂移，无迁移）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'ip_address', label: '公网IP', width: 140, visible: true },
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'bandwidth', label: '带宽', width: 100, visible: true },
  { key: 'charge_type', label: '计费方式', width: 100, visible: true },
  { key: 'instance_id', label: '关联实例', width: 180, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 140, visible: true },
  { key: 'instance_type', label: '实例类型', width: 120, visible: false },
  { key: 'account_name', label: '云账号', width: 120, visible: false },
  { key: 'create_time', label: '创建时间', width: 160, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('eip-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        columnSettings.value = parsed
        return
      }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnsUpdate = (columns: ColumnConfig[]) => {
  columnSettings.value = columns
  localStorage.setItem('eip-column-settings', JSON.stringify(columns))
}

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({
  provider: '',
  regions: [] as string[],
})
const syncing = ref(false)

// ===== 全局领域统计（总数/已绑定/未绑定/带宽告警/异常） =====
// 状态标为全局口径（不受当前筛选影响），全量分页拉取后本地计数。
// 实测状态值域仅 InUse(239)/Attached(39)/Available(33) 三值（2026-09-24 全量 311 条探查），无异常态；
// Attached(华为云绑定态) 归已绑定族。带宽告警无数据源（attributes 无用量/告警字段，主机页同款置 0）。
const EIP_COUNTS_PAGE_SIZE = 1000
const EIP_COUNTS_MAX_PAGES = 10

const eipCounts = reactive({ total: 0, bound: 0, unbound: 0, error: 0 })

const fetchEipCounts = async () => {
  try {
    let bound = 0
    let unbound = 0
    let error = 0
    let total = 0
    for (let page = 1; page <= EIP_COUNTS_MAX_PAGES; page++) {
      const res = await listEIPAssetsApi({ limit: EIP_COUNTS_PAGE_SIZE, offset: (page - 1) * EIP_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        if (isBoundStatus(it.status)) bound++
        else if (isUnboundStatus(it.status)) unbound++
        else error++ // 未知状态计入异常（当前值域下恒为 0，防御未来新增异常态）
      }
      if (items.length < EIP_COUNTS_PAGE_SIZE) break
    }
    eipCounts.total = total
    eipCounts.bound = bound
    eipCounts.unbound = unbound
    eipCounts.error = error
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取EIP统计失败')
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
// name 实测同时匹配 asset_name/asset_id（不匹配 IP）；ip_address/instance_id 后端支持但为精确匹配；
// charge_type/account_name 实测后端忽略（传参 total 不变），不作搜索字段
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'ip_address', label: '公网IP', hasOptions: false },
  { key: 'instance_id', label: '关联实例', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  ip_address: '公网IP',
  instance_id: '关联实例',
  status: '状态',
  provider: '平台',
  region: '区域',
}

// 有固定选项的字段（status 选项值 = 后端实测值域；Attached 为华为云绑定态，归已绑定族）
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '已绑定', value: 'InUse' },
    { label: '未绑定', value: 'Available' },
    { label: '已绑定(Attached)', value: 'Attached' },
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
  filters.provider = ''
  filters.region = ''
  filters.status = ''
  filters.ip_address = ''
  filters.instance_id = ''

  // 应用所有搜索条件（映射到后端实测有效的筛选参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
        filters.keyword = cond.value
        break
      case 'ip_address':
        filters.ip_address = cond.value
        break
      case 'instance_id':
        filters.instance_id = cond.value
        break
      case 'status':
        filters.status = cond.value
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
  if (filters.keyword) params.name = filters.keyword
  if (filters.provider) params.provider = filters.provider
  if (filters.region) params.region = filters.region
  if (filters.status) params.status = filters.status
  if (filters.ip_address) params.ip_address = filters.ip_address
  if (filters.instance_id) params.instance_id = filters.instance_id
  return params
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listEIPAssetsApi(buildListParams(pagination.page, pagination.size))
    eipList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchEipCounts()
  } catch (error: any) {
    console.error('获取EIP列表失败:', error)
    ElMessage.error(error.message || '获取EIP列表失败')
    eipList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（原 fetchAllExportRows 保留），供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listEIPAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

// 行点击开详情（与主机/NAS 页一致）
const handleRowClick = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleViewDetail = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleSync = () => {
  syncForm.provider = ''
  syncForm.regions = []
  syncDialogVisible.value = true
}

const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: ['eip'],
      regions: syncForm.regions.length > 0 ? syncForm.regions : undefined,
    })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交同步任务失败')
  } finally {
    syncing.value = false
  }
}

/** 区域文案：按厂商 regions 配置映射（保留原页能力） */
const getRegionLabel = (provider: string, region: string) => {
  const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === region)
  return regionItem?.label || region || '-'
}

/** 实例类型文案：实测值域含 Nat/AlbInstance/ClbInstance/EVPN（原页缺 mapped 项，补齐） */
const getInstanceTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    EcsInstance: 'ECS实例',
    SlbInstance: '负载均衡',
    ClbInstance: '负载均衡',
    AlbInstance: '负载均衡',
    NatGateway: 'NAT网关',
    Nat: 'NAT网关',
    HaVip: '高可用VIP',
    NetworkInterface: '弹性网卡',
    EVPN: 'EVPN网关',
  }
  return map[type || ''] || type || '-'
}

// 计费方式:统一走 fieldLabels 单源(含 Prepaid/PrePaid/prepaid 三种大小写),
// 空值显示 -,不再把空值误报成「按量付费」
/** 计费方式 → 展示文案 */
const getChargeTypeLabel = (value: string | undefined | null): string => labelOfLenient(CHARGE_TYPE_LABELS, value)

const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  const ts = typeof time === 'number' ? time : parseInt(time)
  return new Date(ts).toLocaleString('zh-CN')
}

// H-03：实例详情「查看资产」带 query.search 跳入时，首载前预填名称条件（以 chip 呈现可移除，无 query 直达零改动）
const route = useRoute()

onMounted(() => {
  loadColumnSettings()
  const s = route.query.search
  if (typeof s === 'string' && s) {
    searchConditions.value.push({ field: 'asset_name', value: s, displayValue: s })
    applySearchConditions()
  } else {
    fetchData()
  }
})
</script>

<style lang="scss" scoped>
.eip-page {
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

.env-tag { padding: 2px 8px; background: var(--bg-hover); border-radius: 4px; font-size: 12px; color: var(--text-secondary); }
.platform-icon { font-size: 20px; }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; display: inline-block; }
.text-muted { color: var(--text-tertiary); }

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
