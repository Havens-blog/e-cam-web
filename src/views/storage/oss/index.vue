<template>
  <div class="oss-page">
    <!-- 页面头部：标题 + tab + 内联状态标（主机页紧凑标准，无大统计卡）；
         OSS 资产无 status 属性（ListOSSParams 亦无 status 参数），状态标按领域以存储类型分布派生 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">对象存储 OSS</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">公有云</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ classCounts.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">标准存储</span>
            <span class="stat-num blue">{{ classCounts.standard }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">低频存储</span>
            <span class="stat-num">{{ classCounts.ia }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">归档存储</span>
            <span class="stat-num">{{ classCounts.archive }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">冷归档存储</span>
            <span class="stat-num">{{ classCounts.coldArchive }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 运营指标条（紧凑横条）:数据来源 ecam_oss_metric 指标表(经 /assets/oss/top,bucket_name 去重聚合,不跨账号求和/平均);
         判定顺序「采集失败→警示」优先于「无数据→0 占位」,失败计数以 oss:collect_metrics 任务 Result 为准 -->
    <div class="ops-strip">
      <div class="ops-card" :class="opsState">
        <template v-if="opsState === 'warn'">
          <el-icon class="ops-warn-icon" :size="18"><WarningFilled /></el-icon>
          <div class="ops-warn-text">
            <div class="ops-warn-title">OSS 指标采集异常,存储量数据可能不完整</div>
            <div class="ops-warn-detail">{{ opsWarnDetail }}</div>
          </div>
          <el-button size="small" type="warning" plain @click="fetchOpsCard">重试</el-button>
        </template>
        <template v-else-if="opsState === 'empty'">
          <el-icon class="ops-empty-icon" :size="18"><DataLine /></el-icon>
          <span class="ops-empty-text">暂无存储量指标数据(未采集或未启用指标采集)</span>
        </template>
        <template v-else>
          <div class="ops-metric">
            <span class="ops-metric-label">总容量</span>
            <span class="ops-metric-value">{{ formatCapacityGB(opsSummary.totalStorageSize) }}</span>
          </div>
          <div class="ops-metric">
            <span class="ops-metric-label">对象数量</span>
            <span class="ops-metric-value">{{ formatObjectCount(opsSummary.totalObjectCount) }}</span>
          </div>
          <div class="ops-metric">
            <span class="ops-metric-label">近 7 天增速</span>
            <span class="ops-metric-value">{{ opsGrowthText }}</span>
          </div>
          <div class="ops-metric">
            <span class="ops-metric-label">存储桶</span>
            <span class="ops-metric-value">{{ opsSummary.bucketCount }}</span>
          </div>
          <span class="ops-note">读采集指标表<template v-if="opsAsOf"> · 截至 {{ opsAsOf }}</template></span>
        </template>
      </div>
    </div>

    <!-- 操作栏：OSS 领域动作（不照搬主机电源操作） -->
    <div class="action-bar">
      <div class="action-left">
        <!-- 主题 B 决策（RDS/Disk/NAS 批同款）：新建无实现、文件管理/生命周期/标签佐证=详情抽屉「文件列表」「生命周期」「标签」tab，统一禁用 + tooltip -->
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>
            <el-icon><Plus /></el-icon>
            新建
          </el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>文件管理</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>生命周期</el-button>
        </el-tooltip>
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>标签</el-button>
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
                  <el-icon class="bucket-icon"><Folder /></el-icon>
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id }}</span>
                </div>
                <div class="cell-sub">{{ item.asset_id }}</div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'storage_class'">{{ getStorageClassText(item.attributes?.storage_class) }}</template>
                <template v-else-if="col.key === 'acl'">{{ getAclText(item.attributes?.acl) }}</template>
                <template v-else-if="col.key === 'versioning'">{{ item.attributes?.versioning ? '已开启' : '未开启' }}</template>
                <!-- S-Hard：存储量/对象数一律来自指标表(bucket_name 去重代表行);无指标数据显示 "-",不再回退资产表快照 -->
                <template v-else-if="col.key === 'object_count'">{{ formatObjectCount(rowMetric(item)?.latest.object_count) }}</template>
                <template v-else-if="col.key === 'storage_size'">
                  <span v-if="rowMetric(item)?.data_status === 'zero_exception'" class="cap-exception">
                    0
                    <el-tooltip content="容量异常:storage_size=0(采集异常行,不代表真实空桶)" placement="top">
                      <el-icon :size="12"><WarningFilled /></el-icon>
                    </el-tooltip>
                  </span>
                  <span v-else>{{ formatCapacityGB(rowMetric(item)?.latest.storage_size) }}</span>
                </template>
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.attributes?.provider)" class="platform-icon" :title="getProviderName(item.attributes?.provider)" />
                </template>
                <template v-else-if="col.key === 'region'">{{ item.attributes?.region || '-' }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatDateTime(item.attributes?.creation_time) }}</template>
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
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 详情抽屉 -->
    <OssDetailDrawer v-model:visible="detailDrawerVisible" :instance="detailInstance" />
    <!-- 原本地导出弹窗的「已选中」随多选列移除而失去来源，传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog v-model:visible="exportDialogVisible" :instances="instances" :selected-ids="[]" :total="pagination.total" :fetch-all-rows="fetchAllExportRows" :config="exportConfig" />
    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { getOssTopApi, listOSSAssetsApi } from '@/api/asset'
import { listTasksApi } from '@/api'
import type { OSSTopItem } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import type { TaskType } from '@/api/types/task'
import { fetchAllRows } from '@/utils/exportAll'
import IconFont from '@/components/IconFont/index.vue'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import { getProviderLabel } from '@/utils/constants'
import { ArrowLeft, ArrowRight, Box, DataLine, Download, Folder, Plus, Refresh, Search, Setting, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  computeStorageGrowth,
  deriveOssCardState,
  extractOssCollectFailures,
  formatCapacityGB,
  formatObjectCount,
  OSS_COLLECT_TASK_TYPE,
  summarizeOssTop,
  type OssCardState,
  type OssCardSummary,
} from './ossMetrics'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import OssDetailDrawer from './components/OssDetailDrawer.vue'
import { getProviderIcon } from '@/utils/icon-mapping'
import { OSS_ACL_LABELS, OSS_STORAGE_CLASS_LABELS, labelOfLenient } from '@/utils/fieldLabels'

/** 共享导出取值：原本地 ExportDialog.getFieldValue 逐字搬运（零漂移，不在迁移中优化）；
 *  S-Hard：存储量/对象数一律来自指标表(bucket_name 去重代表行),无指标数据导出空串,不回退资产表快照 */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return instance[key] || ''
  const attr = instance.attributes || {}
  // 存储类型/ACL 文案走 fieldLabels 单源，小写键归一（aliyun=Standard、tencent/aws=STANDARD 同词），补齐原导出 map 缺失的 ColdArchive
  if (key === 'storage_class') return labelOfLenient(OSS_STORAGE_CLASS_LABELS, (attr.storage_class || '').toLowerCase(), '')
  if (key === 'acl') return labelOfLenient(OSS_ACL_LABELS, attr.acl, '')
  if (key === 'versioning') return attr.versioning ? '已开启' : '未开启'
  if (key === 'provider') return getProviderLabel(attr.provider || '')
  if (key === 'storage_size' || key === 'object_count') {
    const m = bucketMetricMap.value?.get(String(instance.asset_id || ''))
    const v = key === 'storage_size' ? m?.latest?.storage_size : m?.latest?.object_count
    if (v === null || v === undefined || !Number.isFinite(v)) return ''
    return key === 'storage_size' ? formatCapacityGB(v) : formatObjectCount(v)
  }
  return attr[key] || ''
}

/** 共享导出配置：字段/默认勾选沿用原本地 ExportDialog availableFields / exportForm.fields，文件名前缀原样保留 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'asset_id', label: '存储桶ID' }, { key: 'asset_name', label: '存储桶名称' }, { key: 'storage_class', label: '存储类型' },
    { key: 'acl', label: '访问权限' }, { key: 'versioning', label: '版本控制' }, { key: 'object_count', label: '对象数量' },
    { key: 'storage_size', label: '存储量' }, { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' },
    { key: 'endpoint', label: 'Endpoint' }, { key: 'creation_time', label: '创建时间' },
  ],
  getValue: getExportValue,
  filename: 'OSS存储桶',
  defaultFields: ['asset_id', 'asset_name', 'storage_class', 'acl', 'object_count', 'storage_size', 'provider', 'region'],
}

const loading = ref(false)
const instances = ref<Asset[]>([])
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive({
  keyword: '',
  provider: '',
  storage_class: '',
  acl: '',
  region: '',
})

const pagination = reactive({ page: 1, size: 20, total: 0 })

// 全局存储类型统计（从后端获取，非当前页；主机页同款口径；OSS 无 status 属性/ListOSSParams 无 status 参数，
// 按领域以存储类型分布派生，storage_class 为后端精确匹配筛选——实测 Standard=374/IA=80/Archive=145/ColdArchive=3）
const classCounts = reactive({ total: 0, standard: 0, ia: 0, archive: 0, coldArchive: 0 })

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

// ===== 运营指标条(总容量/对象数/近 7 天增速/存储桶数,数据来源 ecam_oss_metric 指标表) =====
// 采集凌晨补采,当日行仅含凌晨部分;days=8 读昨日及前 6 天全量+今日初态,保证均值覆盖完整 7 天窗口
const OSS_CARD_DAYS = 8
const OSS_TOP_PAGE_SIZE = 50
const OSS_TOP_MAX_PAGES = 20

const opsState = ref<OssCardState>('empty')
const opsSummary = ref<OssCardSummary>({ totalStorageSize: 0, totalObjectCount: 0, bucketCount: 0 })
const opsWarnDetail = ref('')
const opsAsOf = ref('')
/** Top 全量项(供运营条聚合 + 列表行存储量/对象数列取指标值) */
const opsTopItems = ref<OSSTopItem[]>([])

/** 分页拉全量 Top(page_size 上限 50,翻页直到取满 total) */
const fetchAllOssTop = async (): Promise<OSSTopItem[]> => {
  const items: OSSTopItem[] = []
  let total = 0
  for (let page = 1; page <= OSS_TOP_MAX_PAGES; page++) {
    const { data } = await getOssTopApi({ days: OSS_CARD_DAYS, sort: 'storage_size', page, page_size: OSS_TOP_PAGE_SIZE })
    const batch = data?.items || []
    total = data?.total ?? total
    items.push(...batch)
    if (batch.length === 0 || items.length >= total) break
  }
  return items
}

const fetchOpsCard = async () => {
  const [topRes, taskRes] = await Promise.allSettled([
    fetchAllOssTop(),
    listTasksApi({ type: OSS_COLLECT_TASK_TYPE as unknown as TaskType, status: 'completed', offset: 0, limit: 1 }),
  ])
  const topFailed = topRes.status === 'rejected'
  const items = topRes.status === 'fulfilled' ? topRes.value : []
  const latestTask = taskRes.status === 'fulfilled' ? ((taskRes.value as any).data?.tasks || [])[0] : null
  const failures = extractOssCollectFailures(latestTask)

  opsTopItems.value = items
  opsState.value = deriveOssCardState({ topFailed, itemCount: items.length, failures })
  opsSummary.value = summarizeOssTop(items)
  opsAsOf.value = items.reduce((acc, it) => (it.latest?.date && it.latest.date > acc ? it.latest.date : acc), '')
  opsWarnDetail.value = failures
    .map(f => `${f.provider}(账号 ${f.account_id})失败 ${f.error_count} 次${f.last_error ? `:${f.last_error}` : ''}`)
    .join(';')
}

/** 近 7 天增速(%):总最新容量 vs 总近 7 天均值(比率口径,合计后再相比,不逐桶平均) */
const opsGrowth = computed(() => {
  let totalAvg = 0
  for (const it of opsTopItems.value) {
    const avg = it.average?.storage_size
    if (typeof avg === 'number' && Number.isFinite(avg)) totalAvg += avg
  }
  return computeStorageGrowth(opsSummary.value.totalStorageSize, totalAvg)
})
const opsGrowthText = computed(() => {
  if (opsGrowth.value === null) return '—'
  return `${opsGrowth.value > 0 ? '+' : ''}${opsGrowth.value}%`
})

/** 列表行存储量/对象数列取值来源:指标表 Top 项(bucket_name = 实例 asset_id) */
const bucketMetricMap = computed(() => {
  const map = new Map<string, OSSTopItem>()
  for (const it of opsTopItems.value) map.set(String(it.bucket_name || ''), it)
  return map
})
const rowMetric = (item: Asset) => bucketMetricMap.value.get(String(item?.asset_id || ''))

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

// 搜索字段配置（从本页实际数据派生：仅覆盖 ListOSSParams 支持的筛选维度；OSS 无 status 参数，不设状态条件）
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'storage_class', label: '存储类型', hasOptions: true },
  { key: 'acl', label: '访问权限', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  provider: '平台',
  storage_class: '存储类型',
  acl: '访问权限',
  region: '区域',
}

// 有固定选项的字段（存储类型选项含实测真实值域 ColdArchive；OSS asset_id 即 bucket_name，云上ID 与名称同走 name 参数）
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  provider: [
    { label: '阿里云', value: 'aliyun' },
    { label: '腾讯云', value: 'tencent' },
    { label: '华为云', value: 'huawei' },
    { label: 'AWS', value: 'aws' },
    { label: '火山引擎', value: 'volcano' },
  ],
  storage_class: [
    { label: '标准存储', value: 'Standard' },
    { label: '低频存储', value: 'IA' },
    { label: '归档存储', value: 'Archive' },
    { label: '冷归档存储', value: 'ColdArchive' },
  ],
  acl: [
    { label: '私有', value: 'private' },
    { label: '公共读', value: 'public-read' },
    { label: '公共读写', value: 'public-read-write' },
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
  filters.storage_class = ''
  filters.acl = ''
  filters.region = ''

  // 应用所有搜索条件（映射到 ListOSSParams 支持的参数）
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
        filters.keyword = cond.value
        break
      case 'provider':
        filters.provider = cond.value
        break
      case 'storage_class':
        filters.storage_class = cond.value
        break
      case 'acl':
        filters.acl = cond.value
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

/** 组装列表查询参数（仅 ListOSSParams 支持的筛选维度；列表分页与导出全量拉取共用，保证筛选口径一致） */
const buildListParams = (page: number, size: number) => ({
  offset: (page - 1) * size,
  limit: size,
  name: filters.keyword || undefined,
  provider: filters.provider || undefined,
  storage_class: filters.storage_class || undefined,
  acl: filters.acl || undefined,
  region: filters.region || undefined,
})

const fetchInstances = async () => {
  loading.value = true
  try {
    const res = await listOSSAssetsApi(buildListParams(pagination.page, pagination.size))
    instances.value = res.data?.items || []
    pagination.total = res.data?.total || 0
    // 同步刷新全局存储类型统计
    fetchClassCounts()
  } catch (e) {
    console.error('获取OSS列表失败:', e)
    ElMessage.error('获取OSS列表失败，请稍后重试')
    instances.value = []
    pagination.total = 0
  }
  finally { loading.value = false }
}

const fetchClassCounts = async () => {
  try {
    // 全局口径（主机页同款）：后端 storage_class 为精确匹配，选项为实测真实值域
    // （883 条：Standard=374/IA=80/Archive=145/ColdArchive=3，另有厂商大写 STANDARD 与未采集值不计入分类标）
    const [totalRes, standardRes, iaRes, archiveRes, coldArchiveRes] = await Promise.all([
      listOSSAssetsApi({ limit: 1, offset: 0 }),
      listOSSAssetsApi({ storage_class: 'Standard', limit: 1, offset: 0 }),
      listOSSAssetsApi({ storage_class: 'IA', limit: 1, offset: 0 }),
      listOSSAssetsApi({ storage_class: 'Archive', limit: 1, offset: 0 }),
      listOSSAssetsApi({ storage_class: 'ColdArchive', limit: 1, offset: 0 }),
    ])
    classCounts.total = totalRes.data?.total || 0
    classCounts.standard = standardRes.data?.total || 0
    classCounts.ia = iaRes.data?.total || 0
    classCounts.archive = archiveRes.data?.total || 0
    classCounts.coldArchive = coldArchiveRes.data?.total || 0
  } catch {
    // 统计请求失败不影响主流程，但需向用户明示（避免误导为真实为 0）
    ElMessage.error('获取OSS存储类型统计失败')
  }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（主题A storage S-H2），供 ExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listOSSAssetsApi(buildListParams(page, pageSize))
    return { list: res.data?.items || [], total: res.data?.total || 0 }
  }, { onProgress })

const handleRefresh = () => { fetchInstances(); fetchOpsCard() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchInstances() }
const handleCurrentChange = (page: number) => { pagination.page = page; fetchInstances() }
// 行点击开详情（与主机/Disk/NAS 页一致）
const handleRowClick = (item: Asset) => { handleViewDetail(item) }
const handleViewDetail = (item: Asset) => { detailInstance.value = item; detailDrawerVisible.value = true }
const handleColumnSettingsChange = (columns: ColumnConfig[]) => { columnSettings.value = columns }

/** 存储类型/ACL 文案走 fieldLabels 单源（与导出、详情抽屉同口径） */
const getStorageClassText = (type?: string) => labelOfLenient(OSS_STORAGE_CLASS_LABELS, (type || '').toLowerCase(), '-')
const getAclText = (acl?: string) => labelOfLenient(OSS_ACL_LABELS, acl, '-')
const getPlatformIcon = (provider?: string) => getProviderIcon(provider || '')

/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider?: string): string => (provider ? getProviderLabel(provider) : '-')

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-'
  try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr }
}

/** 自定义列初始化:历史保存设置迁移——剔除已下线列,按默认标签回填(修复历史保存的错位标签),缺失列按默认补齐,保留用户的显隐/宽度设置 */
const initColumnSettings = () => {
  const saved = localStorage.getItem('oss-column-settings')
  if (saved) {
    try {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const labelByKey = new Map<string, string>(defaultColumnSettings.map(c => [c.key, c.label]))
        type SavedCol = { key: string; label: string; width?: number; visible?: boolean }
        const kept = (parsed as unknown[])
          .filter((c): c is SavedCol => !!c && typeof (c as SavedCol).key === 'string' && labelByKey.has((c as SavedCol).key))
          .map(c => ({ ...c, label: labelByKey.get(c.key) ?? c.label }))
        const keptKeys = new Set(kept.map(c => c.key))
        const added = defaultColumnSettings.filter(c => !keptKeys.has(c.key))
        columnSettings.value = [...kept, ...added] as ColumnConfig[]
        return
      }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

// H-03：实例详情「查看资产」带 query.search 跳入时，首载前预填搜索关键词（无 query 直达零改动）
const route = useRoute()

onMounted(() => {
  initColumnSettings()
  const s = route.query.search
  if (typeof s === 'string' && s) filters.keyword = s
  fetchInstances()
  fetchOpsCard()
})
</script>

<style lang="scss" scoped>
.oss-page {
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

// 运营指标条(数据来源:ecam_oss_metric 指标表;紧凑横条,纵向 padding ≤16px,横向与页头 20px 同节奏)
.ops-strip {
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.ops-card {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 14px 18px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;

  &.warn {
    gap: 12px;
    border-color: rgba(217, 119, 6, 0.45);

    .ops-warn-icon { color: #d97706; }
    .ops-warn-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
    .ops-warn-detail { font-size: 12px; color: var(--text-tertiary); word-break: break-all; }
  }

  &.empty {
    gap: 10px;
    .ops-empty-icon { color: var(--text-tertiary); }
    .ops-empty-text { font-size: 13px; color: var(--text-tertiary); }
  }

  .ops-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .ops-metric-label { font-size: 12px; color: var(--text-tertiary); }
    .ops-metric-value { font-size: 18px; font-weight: 600; color: var(--text-primary); }
  }

  .ops-note { margin-left: auto; font-size: 12px; color: var(--text-tertiary); }
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

.bucket-icon {
  color: #f0a020;
  flex-shrink: 0;
}

.cell-sub {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

// 列表行 storage_size=0 异常行标记(不当正常空桶)
.cap-exception {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #d97706;
}
</style>
