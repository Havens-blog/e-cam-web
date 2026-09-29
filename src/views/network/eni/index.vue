<template>
  <div class="eni-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡；
         原「使用中/绑定率」StatCard 内联统计并入 5 状态标：使用中计数 + 绑定率百分比） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">弹性网卡 (ENI)</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">使用中</span>
          <span class="tab-item">可用</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ eniCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">使用中</span>
            <span class="stat-num blue">{{ eniCounts.use }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">可用</span>
            <span class="stat-num">{{ eniCounts.available }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">绑定率</span>
            <span class="stat-num">{{ eniCounts.total > 0 ? Math.round((eniCounts.use / eniCounts.total) * 100) : 0 }}%</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">{{ eniCounts.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：ENI 领域动作（创建网卡/绑定实例/解绑均未实现，禁用 + tooltip）；
         同步为唯一已接线动作（原 ManagerHeader 同步实例保留），故主色落在同步上 -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            创建网卡
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>绑定实例</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>解绑</el-button>
        </el-tooltip>
        <el-button type="primary" size="small" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ eniList.length }}条 / 共{{ pagination.total }}条</span>
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
                  placeholder="输入搜索内容，回车添加条件（名称 / VPC / 绑定实例…）"
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
              <th class="col-name">网卡ID/名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in eniList" :key="item.id" @click="handleRowClick(item)">
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
                <template v-else-if="col.key === 'primary_private_ip'"><span class="mono">{{ item.attributes?.primary_private_ip || '-' }}</span></template>
                <template v-else-if="col.key === 'instance_id'">
                  <span v-if="item.attributes?.instance_id" class="mono text-ellipsis">{{ item.attributes.instance_id }}</span>
                  <span v-else class="text-muted">未绑定</span>
                </template>
                <template v-else-if="col.key === 'mac_address'"><span class="mono">{{ item.attributes?.mac_address || '-' }}</span></template>
                <template v-else-if="col.key === 'type'">
                  <span v-if="item.attributes?.type" class="env-tag">{{ getTypeText(item.attributes.type) }}</span>
                  <span v-else>-</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">{{ getRegionLabel(item.provider, item.region) }}</template>
                <template v-else-if="col.key === 'vpc_id'"><span class="mono">{{ item.attributes?.vpc_id || '-' }}</span></template>
                <template v-else-if="col.key === 'cloud_account_name'">{{ item.attributes?.cloud_account_name || '-' }}</template>
                <template v-else-if="col.key === 'security_group_count'">
                  <span v-if="Array.isArray(item.attributes?.security_group_ids)">{{ item.attributes.security_group_ids.length }}</span>
                  <span v-else>-</span>
                </template>
                <template v-else-if="col.key === 'create_time'">{{ formatTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="handleViewDetail(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && eniList.length === 0" class="empty-state">
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
    <el-dialog v-model="syncDialogVisible" title="同步弹性网卡" width="600px">
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
    <EniDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 原多选列未接线（selectedIds 恒空）随列删除，传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog
      v-model:visible="showExportDialog"
      :instances="eniList"
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
import { listENIAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel, PROVIDER_CONFIGS } from '@/utils/constants'
import { fetchAllRows } from '@/utils/exportAll'
import { labelOfLenient } from '@/utils/fieldLabels'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import EniDetailDrawer from './components/EniDetailDrawer.vue'

/** 状态值 → 展示文案。键值与 EniDetailDrawer 的 statusLabels 保持一致(键值勿改)；
 *  2026-09-24 全量 5814 条实测值域仅 in_use(4799)/available(1014)/deleting(1) 三值，
 *  其余键为历史映射保留（防御其他厂商接入后出现新变体裸显英文） */
const ENI_STATUS_LABELS: Record<string, string> = {
  in_use: '使用中', InUse: '使用中', inuse: '使用中',
  available: '可用', Available: '可用',
  attaching: '绑定中', Attaching: '绑定中',
  detaching: '解绑中', Detaching: '解绑中',
  creating: '创建中', Creating: '创建中',
  deleting: '删除中', Deleting: '删除中',
  error: '异常', Error: '异常',
  ACTIVE: '使用中', DOWN: '可用',
  BINDBOUND: '使用中', BINDUNBOUND: '可用',
  PENDING: '创建中',
}

/** 网卡类型 → 展示文案。2026-09-24 全量实测值域 11 个（厂商分区：huawei=Secondary、
 *  aliyun=Primary/Secondary/Bond/Trunk/Member、volcano=primary/secondary/branch/nlb/vpclink/transit_router），
 *  原页仅二元判断（Primary→主网卡，其余一律辅助网卡）会误标 Bond/Trunk/Member 等，补齐映射；
 *  未知值由 labelOfLenient 原样透出 */
const ENI_TYPE_LABELS: Record<string, string> = {
  Primary: '主网卡', primary: '主网卡',
  Secondary: '辅助网卡', secondary: '辅助网卡',
  Bond: 'Bond网卡', Trunk: 'Trunk网卡', Member: '成员网卡',
  branch: '分支网卡', nlb: 'NLB网卡', vpclink: 'VPC Link', transit_router: '中转路由',
}

/** 状态族判定（状态点色调 + 全局统计共用口径）。
 *  实测值域 in_use/available/deleting 全覆盖；其余变体为历史映射族防御 */
const USE_STATUSES = ['in_use', 'InUse', 'inuse', 'ACTIVE', 'BINDBOUND']
const AVAILABLE_STATUSES = ['available', 'Available', 'DOWN', 'BINDUNBOUND']
const PENDING_STATUSES = ['deleting', 'Deleting', 'attaching', 'Attaching', 'detaching', 'Detaching', 'creating', 'Creating', 'PENDING']

const isUseStatus = (status?: string) => USE_STATUSES.includes(status || '')
const isAvailableStatus = (status?: string) => AVAILABLE_STATUSES.includes(status || '')
const isPendingStatus = (status?: string) => PENDING_STATUSES.includes(status || '')

/** 状态 → 状态点色调类（使用中=绿 / 可用=灰 / 过渡态=黄 / 其余=红） */
const getStatusClass = (status?: string) => {
  if (isUseStatus(status)) return 'running'
  if (isAvailableStatus(status)) return 'stopped'
  if (isPendingStatus(status)) return 'pending'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源） */
const getStatusText = (status?: string) => labelOfLenient(ENI_STATUS_LABELS, status, status || '-')

/** 类型 → 展示文案（未知值原样透出） */
const getTypeText = (type?: string) => labelOfLenient(ENI_TYPE_LABELS, type, type || '-')

/** 共享导出取值：原本地 EniExportDialog.getFieldValue 逐字搬运（零漂移，不在迁移中优化；
 *  仅 type 取值对齐全量实测值域映射——原二元判断会把 Bond/Trunk 等误标为「辅助网卡」） */
const getExportValue: ExportFieldConfig['getValue'] = (inst: Asset, key: string): string => {
  const attr = inst.attributes || {}
  if (key === 'eni_id') return inst.asset_id || ''
  if (key === 'eni_name') return inst.asset_name || ''
  if (key === 'status') return labelOfLenient(ENI_STATUS_LABELS, inst.status, '')
  if (key === 'type') return attr.type ? labelOfLenient(ENI_TYPE_LABELS, attr.type, '') : ''
  if (key === 'primary_private_ip') return attr.primary_private_ip || ''
  if (key === 'mac_address') return attr.mac_address || ''
  if (key === 'provider') return getProviderLabel(inst.provider || '')
  if (key === 'instance_id') return attr.instance_id || '未绑定'
  if (key === 'vpc_id') return attr.vpc_id || ''
  if (key === 'creation_time') return attr.creation_time || ''
  return ''
}

/** 共享导出配置：字段/默认勾选沿用原本地 EniExportDialog availableFields / exportForm.fields，文件名前缀原样保留 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'eni_id', label: '网卡ID' }, { key: 'eni_name', label: '名称' }, { key: 'status', label: '状态' },
    { key: 'type', label: '类型' }, { key: 'primary_private_ip', label: '主私网IP' }, { key: 'mac_address', label: 'MAC地址' },
    { key: 'provider', label: '云平台' }, { key: 'instance_id', label: '绑定实例' }, { key: 'vpc_id', label: 'VPC' },
    { key: 'creation_time', label: '创建时间' },
  ],
  getValue: getExportValue,
  filename: '弹性网卡',
  defaultFields: ['eni_id', 'eni_name', 'status', 'type', 'primary_private_ip', 'provider', 'instance_id', 'vpc_id'],
}

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)

// 筛选条件（字段搜索栏映射到后端实测有效参数）
const filters = reactive({
  keyword: '',
  provider: '' as CloudProvider | '',
  status: '',
  type: '',
  vpc_id: '',
  instance_id: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const eniList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 导出和自定义列
const showExportDialog = ref(false)
const showColumnSettings = ref(false)

// 默认列配置：可见列按 AC/领域口径（私有IP/状态/绑定实例/MAC/类型/平台/地域），
// VPC/云账号/安全组数/创建时间 保留为可勾选列（本页新增列设置，键 eni-column-settings 无历史漂移）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'primary_private_ip', label: '私有IP', width: 150, visible: true },
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'instance_id', label: '绑定实例', width: 190, visible: true },
  { key: 'mac_address', label: 'MAC地址', width: 170, visible: true },
  { key: 'type', label: '类型', width: 110, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 140, visible: true },
  { key: 'vpc_id', label: 'VPC', width: 160, visible: false },
  { key: 'cloud_account_name', label: '云账号', width: 130, visible: false },
  { key: 'security_group_count', label: '安全组数', width: 90, visible: false },
  { key: 'create_time', label: '创建时间', width: 160, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('eni-column-settings')
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
  localStorage.setItem('eni-column-settings', JSON.stringify(columns))
}

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)

// ===== 全局领域统计（总数/使用中/可用/绑定率/异常） =====
// 状态标为全局口径（不受当前筛选影响），全量分页拉取后本地计数。
// 实测状态值域仅 in_use(4799)/available(1014)/deleting(1) 三值（2026-09-24 全量 5814 条探查），无异常态；
// deleting 为过渡态（删除中），不计入使用中/可用/异常任一状态标，列表内以状态点如实呈现；
// 异常标 = 未知状态族防御性计数（当前值域下恒为 0）。绑定率 = 使用中/总数（原 StatCard 副标题口径并入）。
const ENI_COUNTS_PAGE_SIZE = 1000
const ENI_COUNTS_MAX_PAGES = 10

const eniCounts = reactive({ total: 0, use: 0, available: 0, error: 0 })

const fetchEniCounts = async () => {
  try {
    let use = 0
    let available = 0
    let error = 0
    let total = 0
    for (let page = 1; page <= ENI_COUNTS_MAX_PAGES; page++) {
      const res = await listENIAssetsApi({ limit: ENI_COUNTS_PAGE_SIZE, offset: (page - 1) * ENI_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        if (isUseStatus(it.status)) use++
        else if (isAvailableStatus(it.status)) available++
        else if (!isPendingStatus(it.status)) error++ // 未知状态计入异常（当前值域下恒为 0，防御未来新增异常态）
      }
      if (items.length < ENI_COUNTS_PAGE_SIZE) break
    }
    eniCounts.total = total
    eniCounts.use = use
    eniCounts.available = available
    eniCounts.error = error
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取弹性网卡统计失败')
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

// 搜索字段配置（按本页现有 col.key 派生 + 后端实测有效性筛除，2026-09-24 传参探查）：
// name 实测同时 LIKE 匹配 asset_name/asset_id；instance_id/vpc_id 精确有效；status/type/provider 精确且区分大小写；
// ip_address/mac_address/zone 实测后端忽略（传参 total 不变），不作搜索字段
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'instance_id', label: '绑定实例', hasOptions: false },
  { key: 'vpc_id', label: 'VPC', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'type', label: '类型', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  instance_id: '绑定实例',
  vpc_id: 'VPC',
  status: '状态',
  type: '类型',
  provider: '平台',
}

// 有固定选项的字段（选项值 = 后端实测值域；status/type 均精确区分大小写，选项逐变体列出）
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '使用中 (in_use)', value: 'in_use' },
    { label: '可用 (available)', value: 'available' },
    { label: '删除中 (deleting)', value: 'deleting' },
  ],
  type: [
    { label: '主网卡 (Primary)', value: 'Primary' },
    { label: '主网卡 (primary)', value: 'primary' },
    { label: '辅助网卡 (Secondary)', value: 'Secondary' },
    { label: '辅助网卡 (secondary)', value: 'secondary' },
    { label: 'Bond网卡 (Bond)', value: 'Bond' },
    { label: 'Trunk网卡 (Trunk)', value: 'Trunk' },
    { label: '成员网卡 (Member)', value: 'Member' },
    { label: '分支网卡 (branch)', value: 'branch' },
    { label: 'NLB网卡 (nlb)', value: 'nlb' },
    { label: 'VPC Link (vpclink)', value: 'vpclink' },
    { label: '中转路由 (transit_router)', value: 'transit_router' },
  ],
  provider: [
    { label: '阿里云', value: 'aliyun' },
    { label: '华为云', value: 'huawei' },
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
  filters.status = ''
  filters.type = ''
  filters.vpc_id = ''
  filters.instance_id = ''

  // 应用所有搜索条件（映射到后端实测有效的筛选参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
        filters.keyword = cond.value
        break
      case 'instance_id':
        filters.instance_id = cond.value
        break
      case 'vpc_id':
        filters.vpc_id = cond.value
        break
      case 'status':
        filters.status = cond.value
        break
      case 'type':
        filters.type = cond.value
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
  if (filters.keyword) params.name = filters.keyword
  if (filters.provider) params.provider = filters.provider
  if (filters.status) params.status = filters.status
  if (filters.type) params.type = filters.type
  if (filters.vpc_id) params.vpc_id = filters.vpc_id
  if (filters.instance_id) params.instance_id = filters.instance_id
  return params
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listENIAssetsApi(buildListParams(pagination.page, pagination.size))
    eniList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchEniCounts()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取弹性网卡列表失败'
    ElMessage.error(msg)
    eniList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（原 fetchAllExportRows 保留），供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listENIAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

// 行点击开详情（与主机/EIP 页一致）
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
  syncDialogVisible.value = true
}

const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['eni'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '提交同步任务失败'
    ElMessage.error(msg)
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

const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

/** creation_time 实测为 ISO 字符串（仅 aliyun 有值，huawei 缺失显 -），dayjs 直解析 */
const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(time)
}

onMounted(() => {
  loadColumnSettings()
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
.eni-page {
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
