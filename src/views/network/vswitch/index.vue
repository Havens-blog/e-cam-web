<template>
  <div class="vswitch-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">交换机/子网 (VSwitch)</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">默认子网</span>
          <span class="tab-item">非默认子网</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ vswitchCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">可用</span>
            <span class="stat-num blue">{{ vswitchCounts.available }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">默认子网</span>
            <span class="stat-num">{{ vswitchCounts.default }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">创建中</span>
            <span class="stat-num orange">{{ vswitchCounts.pending }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">{{ vswitchCounts.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：子网领域动作（创建子网未实现，禁用 + tooltip，佐证=asset.ts 仅 list/get 无写入端点）；
         同步为唯一已接线动作（原 ManagerHeader 同步实例保留），故主色落在同步上 -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            创建子网
          </el-button>
        </el-tooltip>
        <el-button type="primary" size="small" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ vswitchList.length }}条 / 共{{ pagination.total }}条</span>
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
                  placeholder="输入搜索内容，回车添加条件（名称 / 云上ID / 所属VPC…）"
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
            <tr v-for="item in vswitchList" :key="item.id" @click="handleRowClick(item)">
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
                <template v-else-if="col.key === 'cidr_block'"><span class="mono">{{ item.attributes?.cidr_block || '-' }}</span></template>
                <template v-else-if="col.key === 'vpc_id'">
                  <span
                    v-if="item.attributes?.vpc_id"
                    class="mono vpc-link"
                    @click.stop="handleVpcClick(item.attributes.vpc_id, item.provider)"
                  >{{ item.attributes.vpc_id }}</span>
                  <span v-else>-</span>
                </template>
                <template v-else-if="col.key === 'zone'">{{ item.attributes?.zone || '-' }}</template>
                <template v-else-if="col.key === 'instance_count'">
                  <!-- 实测 860 行均无 instance_count 属性：按 AC 保留领域列位，缺值显示 -（不伪造 0） -->
                  <span v-if="isAttrAbsent(item.attributes?.instance_count)">-</span>
                  <span v-else>{{ item.attributes.instance_count }}</span>
                </template>
                <template v-else-if="col.key === 'available_ip_count'">{{ item.attributes?.available_ip_count ?? '-' }}</template>
                <template v-else-if="col.key === 'total_ip_count'">{{ item.attributes?.total_ip_count ?? '-' }}</template>
                <template v-else-if="col.key === 'gateway_ip'"><span class="mono">{{ item.attributes?.gateway_ip || '-' }}</span></template>
                <template v-else-if="col.key === 'ipv6_cidr_block'"><span class="mono">{{ item.attributes?.ipv6_cidr_block || '-' }}</span></template>
                <template v-else-if="col.key === 'is_default'">{{ item.attributes?.is_default ? '是' : '-' }}</template>
                <template v-else-if="col.key === 'route_table_id'"><span class="mono">{{ item.attributes?.route_table_id || '-' }}</span></template>
                <template v-else-if="col.key === 'account_name'">{{ item.attributes?.cloud_account_name || '-' }}</template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">{{ getRegionLabel(item.provider, item.region) }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatTime(item.attributes?.creation_time || item.create_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="handleViewDetail(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && vswitchList.length === 0" class="empty-state">
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
    <el-dialog v-model="syncDialogVisible" title="同步交换机/子网" width="600px">
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

    <!-- 详情抽屉（保留现有能力：详情/标签 + VPC 跳转） -->
    <VSwitchDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" @vpc-click="handleVpcClick" />
    <!-- VPC 详情抽屉（所属 VPC 点击跳转，原页交互保留） -->
    <VpcDetailDrawer v-model:visible="vpcDetailVisible" :instance="vpcDetailInstance" />
    <!-- 原页无导出（VSwitchFilters 无此能力），按 proposal 风险缓解条款以 action-right 图标按钮新增；selectedIds 传 [] 与各页同口径 -->
    <AssetExportDialog
      v-model:visible="showExportDialog"
      :instances="vswitchList"
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
import { getVPCAssetApi, listVSwitchAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel, PROVIDER_CONFIGS } from '@/utils/constants'
import { fetchAllRows } from '@/utils/exportAll'
import { labelOfLenient } from '@/utils/fieldLabels'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import VSwitchDetailDrawer from './components/VSwitchDetailDrawer.vue'
import VpcDetailDrawer from '../vpc/components/VpcDetailDrawer.vue'

/** 状态值 → 展示文案。实测值域仅 Available(613)/available(130)/ACTIVE(117) 三个大小写变体（2026-09-24 全量 860 条探查），
 *  全为成功族；Pending/creating/Deleting 保留防御键。键族与 VSwitchDetailDrawer 的 statusLabels 同源（键值勿改） */
const VSWITCH_STATUS_LABELS: Record<string, string> = {
  Available: '可用', available: '可用', ACTIVE: '可用', active: '可用', '可用': '可用',
  Pending: '创建中', pending: '创建中', creating: '创建中',
  Deleting: '删除中', deleting: '删除中',
}

/** 状态族判定（状态点色调 + 全局统计共用口径）。实测值域 Available/available/ACTIVE 全为成功族 */
const isAvailableStatus = (status?: string) => ['Available', 'available', 'ACTIVE', 'active', '可用'].includes(status || '')
const isPendingStatus = (status?: string) => ['Pending', 'pending', 'creating', 'Deleting', 'deleting', '创建中', '删除中'].includes(status || '')

/** 状态 → 状态点色调类（可用=绿 / 创建中=黄 / 其余=红） */
const getStatusClass = (status?: string) => {
  if (isAvailableStatus(status)) return 'running'
  if (isPendingStatus(status)) return 'pending'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源） */
const getStatusText = (status?: string) => labelOfLenient(VSWITCH_STATUS_LABELS, status, status || '-')

/** 属性缺值判定（undefined/null 均视为无数据，与 0/false 区分） */
const isAttrAbsent = (v: unknown) => v === undefined || v === null

/** 共享导出取值：状态/平台/默认域走单源，其余取 attributes 同名键（创建时间实测键为 creation_time ISO 串） */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return instance[key] || ''
  const attr = instance.attributes || {}
  if (key === 'provider') return getProviderLabel(instance.provider || '')
  if (key === 'region') return instance.region || ''
  if (key === 'status') return labelOfLenient(VSWITCH_STATUS_LABELS, instance.status, '')
  if (key === 'is_default') return attr.is_default ? '是' : '否'
  if (key === 'create_time') return attr.creation_time || String(instance.create_time || '')
  return attr[key] || ''
}

/** 共享导出配置：本页原无导出能力，字段按本页列/实测属性新建，文件名前缀沿领域命名 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'asset_id', label: '交换机ID' },
    { key: 'asset_name', label: '名称' },
    { key: 'cidr_block', label: 'CIDR' },
    { key: 'vpc_id', label: '所属VPC' },
    { key: 'zone', label: '可用区' },
    { key: 'instance_count', label: '实例数' },
    { key: 'status', label: '状态' },
    { key: 'available_ip_count', label: '可用IP数' },
    { key: 'total_ip_count', label: '总IP数' },
    { key: 'provider', label: '云平台' },
    { key: 'region', label: '区域' },
    { key: 'is_default', label: '默认子网' },
    { key: 'cloud_account_name', label: '云账号' },
    { key: 'create_time', label: '创建时间' },
  ],
  getValue: getExportValue,
  filename: '交换机子网列表',
  defaultFields: ['asset_id', 'asset_name', 'cidr_block', 'vpc_id', 'status', 'provider', 'region'],
}

const router = useRouter()

// 状态
const loading = ref(false)

// 筛选条件（字段搜索栏映射到后端实测有效参数）
const filters = reactive({
  keyword: '',
  provider: '' as CloudProvider | '',
  region: '',
  vpc_id: '',
  zone: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const vswitchList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// VPC 详情抽屉（所属 VPC 点击跳转）
const vpcDetailVisible = ref(false)
const vpcDetailInstance = ref<Asset | null>(null)

// 导出和自定义列
const showExportDialog = ref(false)
const showColumnSettings = ref(false)

// 默认列配置：可见列按 AC 领域口径（CIDR/所属VPC/可用区/实例数/状态/平台/地域），
// 可用IP数/总IP数/网关IP/IPv6网段/默认子网/路由表/云账号/创建时间 保留为可勾选列。
// 实测 instance_count 属性 860 行均缺失（按 AC 保留领域列位，缺值显 -）；
// vpc_name/project_name 实测 0 行有值（死属性不建列）；存储键 vswitch-column-settings 为新建（本页原无列设置能力）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'cidr_block', label: 'CIDR', width: 150, visible: true },
  { key: 'vpc_id', label: '所属VPC', width: 180, visible: true },
  { key: 'zone', label: '可用区', width: 120, visible: true },
  { key: 'instance_count', label: '实例数', width: 80, visible: true },
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 140, visible: true },
  { key: 'available_ip_count', label: '可用IP数', width: 100, visible: false },
  { key: 'total_ip_count', label: '总IP数', width: 90, visible: false },
  { key: 'gateway_ip', label: '网关IP', width: 130, visible: false },
  { key: 'ipv6_cidr_block', label: 'IPv6网段', width: 150, visible: false },
  { key: 'is_default', label: '默认子网', width: 90, visible: false },
  { key: 'route_table_id', label: '路由表', width: 160, visible: false },
  { key: 'account_name', label: '云账号', width: 120, visible: false },
  { key: 'create_time', label: '创建时间', width: 160, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('vswitch-column-settings')
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
  localStorage.setItem('vswitch-column-settings', JSON.stringify(columns))
}

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({
  provider: '',
  regions: [] as string[],
})
const syncing = ref(false)

// ===== 全局领域统计（总数/可用/默认子网/创建中/异常） =====
// 状态标为全局口径（不受当前筛选影响），全量分页拉取后本地计数。
// 实测状态值域仅 Available(613)/available(130)/ACTIVE(117) 三个大小写变体、全为成功族（2026-09-24 全量 860 条探查），
// 无 pending/异常态 → 两标为防御性计数（未知状态归异常）；默认域按 attributes.is_default 派生（实测 true 72 条）。
const VSWITCH_COUNTS_PAGE_SIZE = 1000
const VSWITCH_COUNTS_MAX_PAGES = 10

const vswitchCounts = reactive({ total: 0, available: 0, default: 0, pending: 0, error: 0 })

const fetchVSwitchCounts = async () => {
  try {
    let available = 0
    let defaultCount = 0
    let pending = 0
    let error = 0
    let total = 0
    for (let page = 1; page <= VSWITCH_COUNTS_MAX_PAGES; page++) {
      const res = await listVSwitchAssetsApi({ limit: VSWITCH_COUNTS_PAGE_SIZE, offset: (page - 1) * VSWITCH_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        if (isAvailableStatus(it.status)) available++
        else if (isPendingStatus(it.status)) pending++
        else error++ // 未知状态计入异常（当前值域下恒为 0，防御未来新增异常态）
        if (it.attributes?.is_default) defaultCount++
      }
      if (items.length < VSWITCH_COUNTS_PAGE_SIZE) break
    }
    vswitchCounts.total = total
    vswitchCounts.available = available
    vswitchCounts.default = defaultCount
    vswitchCounts.pending = pending
    vswitchCounts.error = error
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取交换机统计失败')
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

// 搜索字段配置（后端实测有效参数，2026-09-24）：name 实测 LIKE 同时匹配 asset_name/asset_id（中段子串均命中）；
// vpc_id/zone 实测精确匹配有效（zone 后端支持但不在 TS ListAssetsParams 类型里，实测为准）；
// status 参数有效但值域 Available/available/ACTIVE 三变体同为「可用」语义、无区分度（选中其一反而漏另两变体），按排除判据不作搜索字段
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'vpc_id', label: '所属VPC', hasOptions: false },
  { key: 'zone', label: '可用区', hasOptions: false },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  vpc_id: '所属VPC',
  zone: '可用区',
  provider: '平台',
  region: '区域',
}

// 有固定选项的字段（provider 选项值 = 后端实测值域）
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
  filters.vpc_id = ''
  filters.zone = ''

  // 应用所有搜索条件（映射到后端实测有效的筛选参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
        // 后端 name 参数同时 LIKE 匹配 asset_name/asset_id
        filters.keyword = cond.value
        break
      case 'vpc_id':
        filters.vpc_id = cond.value
        break
      case 'zone':
        filters.zone = cond.value
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
  if (filters.vpc_id) params.vpc_id = filters.vpc_id
  if (filters.zone) params.zone = filters.zone
  return params
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listVSwitchAssetsApi(buildListParams(pagination.page, pagination.size))
    vswitchList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchVSwitchCounts()
  } catch (error: any) {
    console.error('获取交换机列表失败:', error)
    ElMessage.error(error.message || '获取交换机列表失败')
    vswitchList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量，供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listVSwitchAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

// 行点击开详情（与主机/EIP/VPC 页一致）
const handleRowClick = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleViewDetail = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

/** 所属 VPC 点击 → VPC 详情抽屉（原页交互保留，逐字搬运） */
const handleVpcClick = async (vpcId: string, provider?: string) => {
  if (!vpcId) return
  try {
    const params: Record<string, string> = {}
    if (provider) params.provider = provider
    const res = await getVPCAssetApi(vpcId, params)
    const data = (res as unknown as { data: Asset }).data || res
    vpcDetailInstance.value = data as Asset
    vpcDetailVisible.value = true
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '获取 VPC 详情失败'
    ElMessage.error(msg)
  }
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
      asset_types: ['vswitch'],
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

/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }

/** 创建时间：attributes.creation_time 为 ISO 串（原样展示），顶层 create_time 为毫秒时间戳（格式化） */
const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  if (typeof time === 'string' && time.includes('-')) return time
  const ts = typeof time === 'number' ? time : parseInt(time)
  if (Number.isNaN(ts)) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

const route = useRoute()

onMounted(() => {
  loadColumnSettings()
  // VPC 详情「子网管理」跳入：带 query.vpc_id 时预填所属VPC条件（以 chip 呈现可移除，无 query 直达零改动）
  const queryVpcId = route.query.vpc_id
  if (typeof queryVpcId === 'string' && queryVpcId) {
    searchConditions.value.push({ field: 'vpc_id', value: queryVpcId, displayValue: queryVpcId })
  }
  // H-03：全局搜索/实例详情「查看资产」带 query.search 跳入时预填资源ID条件
  const s = route.query.search
  if (typeof s === 'string' && s) {
    searchConditions.value.push({ field: 'asset_id', value: s, displayValue: s })
  }
  if (searchConditions.value.length > 0) {
    applySearchConditions()
  } else {
    fetchData()
  }
})
</script>

<style lang="scss" scoped>
.vswitch-page {
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

.vpc-link {
  color: var(--accent-blue);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.platform-icon { font-size: 20px; }
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
