<template>
  <div class="waf-page">
    <!-- 页面顶部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡）；
         原「正常运行」StatCard 口径并入「正常」状态标（全局计数）；
         tab 保留原页 4 视图（实例列表/防护域名/安全报表/攻击日志，攻击日志入口 2e65651 接线保留） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">WAF 防火墙</h1>
        <div class="tab-nav">
          <span
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
            <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
          </span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ wafCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">正常</span>
            <span class="stat-num blue">{{ wafCounts.active }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">已暂停</span>
            <span class="stat-num">{{ wafCounts.suspended }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">待接入</span>
            <span class="stat-num orange">{{ wafCounts.pending }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">{{ wafCounts.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 实例列表 Tab -->
    <template v-if="activeTab === 'instances'">
      <!-- 操作栏：WAF 领域动作。创建实例/防护配置无后端接线能力（原页接线动作仅同步/导出），
           按 eip/cdn 先例禁用 + tooltip；同步为已接线动作，主色落在同步上 -->
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
          <span class="page-info">本页{{ wafList.length }}条 / 共{{ pagination.total }}条</span>
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
              <tr v-for="item in wafList" :key="item.id" @click="handleRowClick(item)">
                <td class="col-name">
                  <div class="name-cell">
                    <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id || '-' }}</span>
                  </div>
                  <div class="cell-sub">{{ item.asset_id }}</div>
                </td>
                <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                  <template v-if="col.key === 'status'">
                    <span class="status-dot" :class="getStatusClass(item.status)"></span>
                    <span class="status-text">{{ getStatusText(item.status) }}</span>
                  </template>
                  <template v-else-if="col.key === 'edition'">
                    <span class="cell-text">{{ getEditionLabel(item.attributes?.edition) }}</span>
                  </template>
                  <template v-else-if="col.key === 'domain_count'">
                    <span class="domain-count">{{ item.attributes?.domain_count || 0 }}</span>
                  </template>
                  <template v-else-if="col.key === 'protection_mode'">
                    <el-tag
                      v-if="item.attributes?.protection_mode"
                      size="small"
                      :type="getProtectionModeType(item.attributes?.protection_mode)"
                      effect="plain"
                    >
                      {{ getProtectionModeLabel(item.attributes?.protection_mode) }}
                    </el-tag>
                    <span v-else class="cell-muted">-</span>
                  </template>
                  <template v-else-if="col.key === 'rule_count'">{{ item.attributes?.rule_count || 0 }}</template>
                  <template v-else-if="col.key === 'platform'">
                    <IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" :title="getProviderName(item.provider)" />
                  </template>
                  <template v-else-if="col.key === 'region'">
                    <span class="cell-text">{{ item.region || '-' }}</span>
                  </template>
                  <template v-else-if="col.key === 'cloud_account_name'">{{ item.attributes?.cloud_account_name || '-' }}</template>
                  <template v-else-if="col.key === 'qps'">{{ item.attributes?.qps || '-' }}</template>
                  <template v-else-if="col.key === 'expired_time'">
                    <span class="mono" :class="{ 'expiring-text': isExpiringSoon(item.attributes?.expired_time) }">
                      {{ item.attributes?.expired_time || '-' }}
                    </span>
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
          <div v-if="!loading && wafList.length === 0" class="empty-state">
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
    </template>

    <!-- 防护域名 Tab -->
    <template v-else-if="activeTab === 'domains'">
      <div class="empty-tab-content">
        <el-empty description="防护域名管理功能开发中..." />
      </div>
    </template>

    <!-- 安全报表 Tab -->
    <template v-else-if="activeTab === 'reports'">
      <div class="empty-tab-content">
        <el-empty description="安全报表功能开发中..." />
      </div>
    </template>

    <!-- 攻击日志 Tab -->
    <template v-else-if="activeTab === 'logs'">
      <div class="empty-tab-content">
        <el-empty description="WAF 攻击/拦截日志已接入多云日志查询">
          <el-button type="primary" @click="openAttackLogs">
            <el-icon><DataAnalysis /></el-icon>
            打开攻击日志
          </el-button>
        </el-empty>
      </div>
    </template>

    <!-- 同步对话框（原页同步实例能力保留） -->
    <el-dialog v-model="syncDialogVisible" title="同步WAF实例" width="600px">
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
    <WafDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 原多选列随紧凑标准删除（AC 口径），传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog
      v-model:visible="exportDialogVisible"
      :instances="wafList"
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
import { listWAFAssetsApi } from '@/api/asset'
import type { Asset, CloudProvider } from '@/api/types/asset'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import IconFont from '@/components/IconFont/index.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { ASSET_STATUS_LABELS } from '@/utils/fieldLabels'
import { fetchAllRows } from '@/utils/exportAll'
import { ArrowLeft, ArrowRight, Box, DataAnalysis, Download, Plus, Refresh, Search, Setting } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import WafDetailDrawer from './components/WafDetailDrawer.vue'

/** 状态族判定（状态点色调 + 全局统计共用口径）。
 *  实测值域仅 active(160)/suspended(252)/pending(13) 三值（2026-09-24 全量 425 条探查，全小写）；
 *  家族按大小写变体 + WAF 域原生近义态（paused/bypass 等，见 fieldLabels WAF 域注释）防御性扩展，
 *  未知值防御性计入异常 */
const ACTIVE_FAMILY = ['active', 'Active', 'running', 'Running', 'online', 'Online', 'normal', 'serving']
const SUSPENDED_FAMILY = ['suspended', 'Suspended', 'paused', 'Paused', 'bypass', 'Bypass', 'inactive', 'disabled']
const PENDING_FAMILY = ['pending', 'Pending', 'creating', 'Creating', 'configuring', 'Configuring', 'checking', 'Checking', 'starting', 'upgrading', 'rebooting']

/** 状态 → 状态点色调类（正常=绿 / 已暂停=灰 / 待接入=黄 / 其余=红） */
const getStatusClass = (status?: string) => {
  if (ACTIVE_FAMILY.includes(status || '')) return 'running'
  if (SUSPENDED_FAMILY.includes(status || '')) return 'stopped'
  if (PENDING_FAMILY.includes(status || '')) return 'pending'
  return 'error'
}

/** 状态 → 展示文案（列表口径与导出同源；实测值域按 WAF 领域文案，未知值回退全局单源 lenient 透出） */
const WAF_STATUS_LABELS: Record<string, string> = { active: '正常', suspended: '已暂停', pending: '待接入' }
const getStatusText = (status?: string) => {
  if (!status) return '-'
  return WAF_STATUS_LABELS[status] || ASSET_STATUS_LABELS[status] || status
}

/** 版本映射：实测值域 EdgeOne(13)/sparta-waf(100)/空(312)（原 basic/pro 等键与真实值不符，保留作历史兼容） */
const editionMap: Record<string, string> = {
  'sparta-waf': 'Sparta WAF',
  'EdgeOne': 'EdgeOne',
  basic: '基础版',
  pro: '专业版',
  business: '商业版',
  enterprise: '企业版',
}

const getEditionLabel = (edition: string | undefined) => {
  if (!edition) return '-'
  return editionMap[edition] || edition
}

/** 防护模式（实测 block 99/observe 11/空 315；protection_mode 非有效后端筛参，仅展示） */
const getProtectionModeLabel = (mode: string | undefined) => {
  const map: Record<string, string> = { block: '拦截', observe: '观察', off: '关闭' }
  if (!mode) return '-'
  return map[mode] || mode
}

const getProtectionModeType = (mode: string | undefined): any => {
  const map: Record<string, string> = { block: 'danger', observe: 'warning', off: 'info' }
  if (!mode) return 'info'
  return map[mode] || 'info'
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

/** 共享导出取值：原本地 getExportValue 逐字搬运（字段零漂移），status/edition 改按实测值域出文案 */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  const attr = instance.attributes || {}
  if (key === 'instance_name') return instance.asset_name || ''
  if (key === 'instance_id') return instance.asset_id || ''
  if (key === 'status') return getStatusText(instance.status)
  if (key === 'edition') return getEditionLabel(attr.edition)
  if (key === 'provider') return getProviderLabel(instance.provider || '')
  if (key === 'domain_count') return String(attr.domain_count || 0)
  if (key === 'region') return instance.region || ''
  if (key === 'expired_time') return attr.expired_time || ''
  return attr[key] || ''
}

/** 共享导出配置：字段/默认勾选沿用原 exportConfig，文件名前缀原样保留 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'instance_name', label: '实例名称' },
    { key: 'instance_id', label: '实例ID' },
    { key: 'status', label: '状态' },
    { key: 'edition', label: '版本' },
    { key: 'provider', label: '云平台' },
    { key: 'domain_count', label: '防护域名' },
    { key: 'region', label: '区域' },
    { key: 'expired_time', label: '到期时间' },
  ],
  getValue: getExportValue,
  filename: 'WAF防火墙',
  defaultFields: ['instance_name', 'instance_id', 'status', 'edition', 'provider', 'domain_count', 'region'],
}

const router = useRouter()

// 状态
const loading = ref(false)
const activeTab = ref('instances')

// 筛选条件（字段搜索栏映射到后端实测有效参数：
// name LIKE 匹配 asset_name+asset_id；status/edition/provider/region 精确区分大小写；
// protection_mode/domain_count/qps/waf_enabled/cloud_account_name 实测后端忽略，不作搜索字段）
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
const wafList = ref<Asset[]>([])

// 详情抽屉
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)

// 导出和自定义列
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

// 默认列配置：可见列按 AC 领域口径（状态/版本/防护域名/防护模式/规则数/平台/地域），
// QPS 实测 425 行全 0、到期时间实测全空 → 保留为可勾选列不进默认视图
// （col key 新键 waf-column-settings 无历史漂移，无迁移）
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'edition', label: '版本', width: 110, visible: true },
  { key: 'domain_count', label: '防护域名', width: 90, visible: true },
  { key: 'protection_mode', label: '防护模式', width: 90, visible: true },
  { key: 'rule_count', label: '规则数', width: 90, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 130, visible: true },
  { key: 'cloud_account_name', label: '云账号', width: 150, visible: false },
  { key: 'qps', label: 'QPS', width: 80, visible: false },
  { key: 'expired_time', label: '到期时间', width: 130, visible: false },
  { key: 'creation_time', label: '创建时间', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const loadColumnSettings = () => {
  const saved = localStorage.getItem('waf-column-settings')
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

const tabs = computed(() => [
  { key: 'instances', label: '实例列表', count: pagination.total },
  { key: 'domains', label: '防护域名', count: undefined },
  { key: 'reports', label: '安全报表', count: undefined },
  { key: 'logs', label: '攻击日志', count: undefined },
])

// ===== 全局领域统计（总数/正常/已暂停/待接入/异常） =====
// 状态标为全局口径（不受当前筛选影响），全量分页拉取后本地计数（eip/cdn 同款）。
// 实测状态值域仅 active/suspended/pending 三值（全小写）；异常 = 未知状态族防御性计数；
// 原「正常运行」StatCard（当前页口径）并入「正常」标（全局口径）
const WAF_COUNTS_PAGE_SIZE = 1000
const WAF_COUNTS_MAX_PAGES = 10

const wafCounts = reactive({ total: 0, active: 0, suspended: 0, pending: 0, error: 0 })

const fetchWafCounts = async () => {
  try {
    let active = 0
    let suspended = 0
    let pending = 0
    let error = 0
    let total = 0
    const regionCounts: Record<string, number> = {}
    for (let page = 1; page <= WAF_COUNTS_MAX_PAGES; page++) {
      const res = await listWAFAssetsApi({ limit: WAF_COUNTS_PAGE_SIZE, offset: (page - 1) * WAF_COUNTS_PAGE_SIZE })
      const items = res.data?.items || []
      total = res.data?.total ?? total
      for (const it of items) {
        if (ACTIVE_FAMILY.includes(it.status || '')) active++
        else if (SUSPENDED_FAMILY.includes(it.status || '')) suspended++
        else if (PENDING_FAMILY.includes(it.status || '')) pending++
        else error++
        // 区域选项动态派生（区域值域会被采集任务实时改写，静态枚举会漂移）
        if (it.region) regionCounts[it.region] = (regionCounts[it.region] || 0) + 1
      }
      if (items.length < WAF_COUNTS_PAGE_SIZE) break
    }
    wafCounts.total = total
    wafCounts.active = active
    wafCounts.suspended = suspended
    wafCounts.pending = pending
    wafCounts.error = error
    regionOptions.value = Object.entries(regionCounts)
      .map(([value, count]) => ({ label: value, value, count }))
      .sort((a, b) => b.count - a.count)
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取WAF统计失败')
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

// 搜索字段配置（5 个后端实测有效参数；实测值域选项逐值列出）
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

// 有固定选项的字段（选项值 = 后端实测值域：精确匹配区分大小写）。
// region 例外：实测区域值域会被采集任务实时改写（2026-09-24 十分钟内 195 条区域
// cn-shanghai → cn-hongkong → cn-chengdu 三变），静态枚举必漂移 → 从统计全量拉取动态派生
const staticFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '正常', value: 'active' },
    { label: '已暂停', value: 'suspended' },
    { label: '待接入', value: 'pending' },
  ],
  edition: [
    { label: 'Sparta WAF', value: 'sparta-waf' },
    { label: 'EdgeOne', value: 'EdgeOne' },
  ],
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

  // 应用所有搜索条件（映射到后端实测有效的筛选参数）
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
    const res = await listWAFAssetsApi(buildListParams(pagination.page, pagination.size))
    wafList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局领域统计
    fetchWafCounts()
  } catch (error: any) {
    console.error('获取WAF列表失败:', error)
    ElMessage.error(error.message || '获取WAF列表失败')
    wafList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（原 fetchAllExportRows 保留），供 AssetExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listWAFAssetsApi(buildListParams(page, pageSize))
    const responseData = (res as any).data || res
    return { list: responseData.items || [], total: responseData.total || 0 }
  }, { onProgress })

const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }

// 行点击开详情（与 eip/cdn 页一致）
const handleRowClick = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

const handleViewDetail = (row: Asset) => {
  detailInstance.value = row
  detailVisible.value = true
}

/** 攻击日志跳转到多云日志查询(WAF 域),复用 logquery 联邦查询（原接线保留） */
const openAttackLogs = () => { router.push('/logs?t=waf') }

const handleSync = () => { syncForm.provider = ''; syncDialogVisible.value = true }

const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['waf'] })
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

const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

onMounted(() => {
  loadColumnSettings()
  fetchData()
})
</script>

<style lang="scss" scoped>
.waf-page {
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

    .tab-count {
      margin-left: 6px;
      font-size: 10px;
      background: rgba(113, 112, 255, 0.12);
      color: var(--accent-blue);
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 600;
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

// 占位 tab 内容（防护域名/安全报表/攻击日志）
.empty-tab-content {
  margin: 16px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 60px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
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
