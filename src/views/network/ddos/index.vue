<template>
  <div class="ddos-page">
    <!-- 页面顶部：标题 + 内联状态标（WAF 页紧凑标准，无大统计卡）。
         DDoS 单视图（无 WAF 的 4 tab：实例列表/防护域名/安全报表/攻击日志），
         仅「实例列表」一体页；状态标为全局口径（全量分页计数，不受当前筛选影响） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">DDoS 防护</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ ddosCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">正常</span>
            <span class="stat-num blue">{{ ddosCounts.normal }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">攻击中</span>
            <span class="stat-num orange">{{ ddosCounts.attacking }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">封堵隔离</span>
            <span class="stat-num">{{ ddosCounts.blocked }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">{{ ddosCounts.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏：DDoS 领域动作。创建实例/防护配置无后端接线能力（原页接线动作仅同步/导出），
         按 eip/cdn/waf 先例禁用 + tooltip；同步为已接线动作，主色落在同步上 -->
    <div class="action-bar">
      <div class="action-left">
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            创建实例
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>防护配置</el-button>
        </el-tooltip>
        <el-button type="primary" size="small" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ ddosList.length }}条 / 共{{ pagination.total }}条</span>
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

    <!-- 字段搜索栏（回车加条件 + 条件 chips，WAF 同款交互） -->
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
                  placeholder="输入搜索内容，回车添加条件（实例名称 / ID…）"
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

    <!-- 表格区域（无多选列；首列实例名 + 等宽 ID 副行） -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-name">实例</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in ddosList" :key="item.id" @click="openDdosDetailDrawer(item)">
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="openDdosDetailDrawer(item)">{{ item.asset_name || item.asset_id || '-' }}</span>
                </div>
                <div class="cell-sub">{{ item.asset_id }}</div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.status)"></span>
                  <span class="status-text">{{ getStatusText(item.status) }}</span>
                </template>
                <template v-else-if="col.key === 'edition'">
                  <span class="cell-text">{{ item.attributes?.edition || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'basic_bandwidth'">
                  <span class="mono">{{ getBandwidthText(item.attributes?.basic_bandwidth, item.attributes?.bandwidth_unit) }}</span>
                </template>
                <template v-else-if="col.key === 'elastic_bandwidth'">
                  <span class="mono">{{ getBandwidthText(item.attributes?.elastic_bandwidth, item.attributes?.bandwidth_unit) }}</span>
                </template>
                <template v-else-if="col.key === 'service_bandwidth'">
                  <span class="mono">{{ getBandwidthText(item.attributes?.service_bandwidth, item.attributes?.bandwidth_unit) }}</span>
                </template>
                <template v-else-if="col.key === 'cc_qps'">
                  <span class="cell-text">{{ item.attributes?.cc_qps || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">
                  <span class="cell-text">{{ item.region || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'protected_ip_count'">
                  <span class="domain-count">{{ item.attributes?.protected_ip_count ?? '-' }}</span>
                </template>
                <template v-else-if="col.key === 'cloud_account_name'">{{ item.attributes?.cloud_account_name || '-' }}</template>
                <template v-else-if="col.key === 'resource_group_id'">{{ item.attributes?.resource_group_id || '-' }}</template>
                <template v-else-if="col.key === 'expired_time'">
                  <span class="mono" :class="{ 'expiring-text': isExpiringSoon(item.attributes?.expired_time) }">
                    {{ item.attributes?.expired_time || '-' }}
                  </span>
                </template>
                <template v-else-if="col.key === 'creation_time'">{{ formatTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <span class="action-link" @click="openDdosDetailDrawer(item)">详情</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && ddosList.length === 0" class="empty-state">
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

    <!-- 同步对话框（WAF 同款同步实例能力，asset_types 切 ddos） -->
    <el-dialog v-model="syncDialogVisible" title="同步DDoS实例" width="600px">
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
    <DdosDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 无多选列（WAF AC 口径），传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog
      v-model:visible="exportDialogVisible"
      :instances="ddosList"
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
import { listDDOSAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { DDOS_STATUS_LABELS } from '@/utils/fieldLabels'
import { fetchAllRows } from '@/utils/exportAll'
import { ArrowLeft, ArrowRight, Box, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProviderIcon } from '@/utils/icon-mapping'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import DdosDetailDrawer from './components/DdosDetailDrawer.vue'

/**
 * DDoS 状态族判定（状态点色调 + 全局统计共用同一函数，family 口径单源）。
 * 按 DDoS 词表（DDOS_STATUS_LABELS，键值以腾讯云 DDoS 实例状态注释实证）定义状态族：
 *   正常 = idle；
 *   攻击中（进行中） = attacking / creating / deblocking；
 *   封堵隔离 = blocking / isolate；
 *   未知/其他 = 异常（阿里/华为为各自厂商原值，可能中文，未收录值一律计入异常）。
 * 统计标「攻击中」计数 = 攻击中族合计（含创建中/解封中，任务口径：进行中=attacking/creating/deblocking）。
 */
const DDOS_NORMAL_FAMILY = ['idle']
const DDOS_ATTACKING_FAMILY = ['attacking', 'creating', 'deblocking']
const DDOS_BLOCKED_FAMILY = ['blocking', 'isolate']

type DdosStatusFamily = 'normal' | 'attacking' | 'blocked' | 'error'

const getDdosStatusFamily = (status?: string): DdosStatusFamily => {
  const s = status || ''
  if (DDOS_NORMAL_FAMILY.includes(s)) return 'normal'
  if (DDOS_ATTACKING_FAMILY.includes(s)) return 'attacking'
  if (DDOS_BLOCKED_FAMILY.includes(s)) return 'blocked'
  return 'error'
}

/** 状态 → 状态点色调类（正常=绿 / 攻击中·进行中=黄 / 封堵隔离=灰（服务被封停） / 其余=红） */
const getStatusClass = (status?: string) => {
  const family = getDdosStatusFamily(status)
  if (family === 'normal') return 'running'
  if (family === 'attacking') return 'pending'
  if (family === 'blocked') return 'stopped'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源；直查 DDOS_STATUS_LABELS 单源，未知值原样透出，
 *  不回退全局 ASSET_STATUS_LABELS——厂商原生值（阿里/华为可能中文）不得被全局通用词误译） */
const getStatusText = (status?: string) => {
  if (!status) return '-'
  return DDOS_STATUS_LABELS[status] || status
}

/** 带宽口径：数值与 bandwidth_unit 拼接（如 100 Gbps），空值 '-'
 *  （防护带宽/弹性带宽/业务带宽三列与导出 getValue 共用，详情抽屉同口径） */
const getBandwidthText = (value: any, unit?: string) => {
  if (value === null || value === undefined || value === '') return '-'
  return unit ? `${value} ${unit}` : String(value)
}

const isExpiringSoon = (expiredTime: string | undefined) => {
  if (!expiredTime) return false
  try {
    const expDate = new Date(expiredTime)
    const now = new Date()
    const diffDays = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays > 0 && diffDays <= 90
  } catch {
    return false
  }
}

/** 共享导出取值：与列展示同口径（status 走 DDoS 词表、防护带宽走 getBandwidthText、空值 '-'） */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  const attr = instance.attributes || {}
  if (key === 'instance_name') return instance.asset_name || ''
  if (key === 'instance_id') return instance.asset_id || ''
  if (key === 'status') return getStatusText(instance.status)
  if (key === 'edition') return attr.edition || ''
  if (key === 'provider') return getProviderLabel(instance.provider || '')
  if (key === 'basic_bandwidth') return getBandwidthText(attr.basic_bandwidth, attr.bandwidth_unit)
  if (key === 'cc_qps') return String(attr.cc_qps || '-')
  if (key === 'region') return instance.region || ''
  if (key === 'expired_time') return attr.expired_time || ''
  return attr[key] || ''
}

/** 共享导出配置：字段/默认勾选按 DDoS 域口径（默认不勾到期时间，与 WAF 页 exportConfig 同构） */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'instance_name', label: '实例名称' },
    { key: 'instance_id', label: '实例ID' },
    { key: 'status', label: '状态' },
    { key: 'edition', label: '版本' },
    { key: 'provider', label: '云平台' },
    { key: 'basic_bandwidth', label: '防护带宽' },
    { key: 'cc_qps', label: 'CC峰值' },
    { key: 'region', label: '地域' },
    { key: 'expired_time', label: '到期时间' },
  ],
  getValue: getExportValue,
  filename: 'DDoS防护',
  defaultFields: ['instance_name', 'instance_id', 'status', 'edition', 'provider', 'basic_bandwidth', 'cc_qps', 'region'],
}

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)

// 筛选条件（字段搜索栏映射到后端筛选参数：
// name LIKE 匹配 asset_name+asset_id；status/edition/provider/region 精确匹配）
const filters = reactive({
  name: '',
  provider: '' as CloudProvider | '',
  status: '',
  edition: '',
  region: '',
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 数据列表
const ddosList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 导出和自定义列
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

/**
 * 默认列配置：可见列按 DDoS 领域口径（状态/版本/防护带宽/弹性带宽/CC QPS/平台/地域/到期时间/防IP数），
 * 业务带宽/创建时间/账号/资源组为可勾选隐藏列不进默认视图；
 * col key 新键 ddos-column-settings 无历史漂移，无迁移
 */
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'edition', label: '版本', width: 120, visible: true },
  { key: 'basic_bandwidth', label: '防护带宽', width: 100, visible: true },
  { key: 'elastic_bandwidth', label: '弹性带宽', width: 100, visible: true },
  { key: 'cc_qps', label: 'CC QPS', width: 90, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 130, visible: true },
  { key: 'expired_time', label: '到期时间', width: 130, visible: true },
  { key: 'protected_ip_count', label: '防IP数', width: 90, visible: true },
  { key: 'service_bandwidth', label: '业务带宽', width: 100, visible: false },
  { key: 'creation_time', label: '创建时间', width: 150, visible: false },
  { key: 'cloud_account_name', label: '账号', width: 150, visible: false },
  { key: 'resource_group_id', label: '资源组', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('ddos-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 合并默认配置中新增的列：用户既有列的可见性原样保留，新列按默认 visible 状态追加到末尾
        const merged = [...parsed]
        for (const d of defaultColumnSettings) {
          if (!merged.some((c: ColumnConfig) => c.key === d.key)) merged.push({ ...d })
        }
        columnSettings.value = merged
        return
      }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnsUpdate = (columns: ColumnConfig[]) => { columnSettings.value = columns }

// 同步对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)

// ===== 全局领域统计（总数/正常/攻击中/封堵隔离/异常） =====
// 状态标为全局口径（不受当前筛选影响），全量分页拉取后本地计数（eip/cdn/waf 同款）。
// 状态族判定与状态点色调共用 getDdosStatusFamily（同一函数）；异常 = 未知/其他状态族防御性计数；
// 区域值域会被采集任务实时改写，同时从全量统计派生 region 搜索选项（静态枚举会漂移）
const DDOS_COUNTS_PAGE_SIZE = 1000
const DDOS_COUNTS_MAX_PAGES = 10

const ddosCounts = reactive({ total: 0, normal: 0, attacking: 0, blocked: 0, error: 0 })

const fetchDdosCounts = async () => {
  try {
    let normal = 0
    let attacking = 0
    let blocked = 0
    let error = 0
    let total = 0
    const regionCounts: Record<string, number> = {}
    for (let page = 1; page <= DDOS_COUNTS_MAX_PAGES; page++) {
      const res = await listDDOSAssetsApi({ limit: DDOS_COUNTS_PAGE_SIZE, offset: (page - 1) * DDOS_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        switch (getDdosStatusFamily(it.status)) {
          case 'normal': normal++; break
          case 'attacking': attacking++; break
          case 'blocked': blocked++; break
          default: error++
        }
        if (it.region) regionCounts[it.region] = (regionCounts[it.region] || 0) + 1
      }
      if (items.length < DDOS_COUNTS_PAGE_SIZE) break
    }
    ddosCounts.total = total
    ddosCounts.normal = normal
    ddosCounts.attacking = attacking
    ddosCounts.blocked = blocked
    ddosCounts.error = error
    regionOptions.value = Object.entries(regionCounts)
      .map(([value, count]) => ({ label: value, value, count }))
      .sort((a, b) => b.count - a.count)
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取DDoS统计失败')
  }
}

// ==================== 字段搜索栏（WAF 同款：回车加条件 + 条件 chips） ====================

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

// 搜索字段配置（5 个后端有效筛选参数）
const searchFields = [
  { key: 'name', label: '实例名称/ID', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'edition', label: '版本', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '地域', hasOptions: true },
]

const searchFieldLabels: Record<string, string> = {
  name: '实例名称/ID',
  status: '状态',
  edition: '版本',
  provider: '平台',
  region: '地域',
}

/** DDoS 版本(edition)固定展示选项：取值域尚未实测，选项值=文案原样下发给后端精确匹配（未知值列展示时原样透出） */
const DDOS_EDITION_OPTIONS = ['高防IP', '高防包', 'DDoS原生防护', 'DDoS高防', 'Anti-DDoS', 'Standard', 'Advanced']

// 有固定选项的字段（选项值 = 后端精确匹配值域）：
// status 选项从 DDOS_STATUS_LABELS 词表生成（词表单源，包含腾讯取值域 6 值）；
// region 例外：区域值域被采集任务实时改写，从全局统计全量拉取动态派生（WAF 同款方法）
const staticFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: Object.entries(DDOS_STATUS_LABELS).map(([value, label]) => ({ label, value })),
  edition: DDOS_EDITION_OPTIONS.map(v => ({ label: v, value: v })),
  provider: CLOUD_PROVIDERS.map(p => ({ label: p.label, value: p.value })),
}

const regionOptions = ref<{ label: string; value: string }[]>([])

const searchFieldOptions = computed<Record<string, { label: string; value: string }[]>>(() => ({
  ...staticFieldOptions,
  region: regionOptions.value,
}))

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
  // 先清除所有搜索相关的筛选
  filters.name = ''
  filters.provider = ''
  filters.status = ''
  filters.edition = ''
  filters.region = ''

  // 应用所有搜索条件（映射到后端筛选参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'name':
        filters.name = cond.value
        break
      case 'status':
        filters.status = cond.value
        break
      case 'edition':
        filters.edition = cond.value
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
  if (filters.provider) params.provider = filters.provider
  if (filters.status) params.status = filters.status
  if (filters.edition) params.edition = filters.edition
  if (filters.region) params.region = filters.region
  return params
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listDDOSAssetsApi(buildListParams(pagination.page, pagination.size))
    ddosList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchDdosCounts()
  } catch (error: any) {
    console.error('获取DDoS列表失败:', error)
    ElMessage.error(error.message || '获取DDoS列表失败')
    ddosList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（WAF 同款），供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listDDOSAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

/** 打开详情抽屉（行点击/实例名/操作列共用；与 eip/cdn/waf 页一致，行数据直接进抽屉） */
const openDdosDetailDrawer = (row: Asset) => {
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
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['ddos'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交同步任务失败')
  } finally {
    syncing.value = false
  }
}

/** 格式化时间：实测 ISO 带 Z（如 2026-09-24T03:37:17Z），dayjs 可解析 */
const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(time)
}

const getPlatformIcon = (provider?: string) => getProviderIcon(provider || '')
/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

onMounted(() => {
  loadColumnSettings()
  // 全局搜索/实例详情「查看资产」带 query.search 跳入时预填关键词（WAF 同款）
  const s = route.query.search
  if (typeof s === 'string' && s) {
    filters.name = s
    searchKeyword.value = s
  }
  fetchData()
})
</script>

<style lang="scss" scoped>
.ddos-page {
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

  // 首/末列对齐页面 20px 横向节奏（去多选列后首列实例不再贴边错位）
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

.cell-muted {
  color: var(--text-muted);
}

.domain-count {
  color: var(--accent-blue);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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

.expiring-text {
  color: var(--accent-yellow);
}

.platform-icon { font-size: 20px; }

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