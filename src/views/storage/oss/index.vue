<template>
  <div class="oss-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">对象存储 OSS</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ pagination.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">标准存储</span>
            <span class="stat-num blue">{{ standardCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">低频存储</span>
            <span class="stat-num">{{ iaCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">归档存储</span>
            <span class="stat-num">{{ archiveCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 运营卡:数据来源 ecam_oss_metric 指标表(经 /assets/oss/top,bucket_name 去重聚合,不跨账号求和/平均);
         判定顺序「采集失败→警示」优先于「无数据→0 占位」,失败计数以 oss:collect_metrics 任务 Result 为准 -->
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

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-left">
        <!-- S-C6：批量操作无处理器（选中后点击零反馈），按主题 B 决策禁用 + tooltip；实现时危险动作须二次确认 -->
        <el-tooltip content="功能开发中" placement="top">
          <el-button size="small" disabled>批量操作</el-button>
        </el-tooltip>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ ossList.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
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

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-row">
        <div class="search-input-wrap">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索存储桶名称"
            size="small"
            clearable
            :prefix-icon="Search"
            @keyup.enter="handleSearch"
            @clear="handleSearch"
          />
        </div>
        <el-select v-model="filters.provider" placeholder="云平台" size="small" clearable @change="handleFilterChange">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="AWS" value="aws" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
        <el-select v-model="filters.storage_class" placeholder="存储类型" size="small" clearable @change="handleFilterChange">
          <el-option label="标准存储" value="Standard" />
          <el-option label="低频存储" value="IA" />
          <el-option label="归档存储" value="Archive" />
        </el-select>
        <el-select v-model="filters.acl" placeholder="访问权限" size="small" clearable @change="handleFilterChange">
          <el-option label="私有" value="private" />
          <el-option label="公共读" value="public-read" />
          <el-option label="公共读写" value="public-read-write" />
        </el-select>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-checkbox"><el-checkbox v-model="selectAll" @change="handleSelectAll" /></th>
              <th class="col-name">存储桶名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in ossList" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click="handleRowClick(item)">
              <td class="col-checkbox" @click.stop>
                <el-checkbox :model-value="selectedIds.includes(item.id)" @change="handleSelect(item.id, $event)" />
              </td>
              <td class="col-name">
                <div class="name-cell">
                  <el-icon class="bucket-icon"><Folder /></el-icon>
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id }}</span>
                </div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'storage_class'">
                  <el-tag size="small" :type="getStorageClassType(item.attributes?.storage_class)">{{ getStorageClassText(item.attributes?.storage_class) }}</el-tag>
                </template>
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
                  <IconFont :type="getPlatformIcon(item.attributes?.provider)" class="platform-icon" />
                </template>
                <template v-else-if="col.key === 'region'">{{ item.attributes?.region || '-' }}</template>
                <template v-else-if="col.key === 'create_time'">{{ formatDateTime(item.attributes?.creation_time) }}</template>
                <template v-else>-</template>
              </td>
              <td class="col-actions" @click.stop>
                <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, item)">
                  <span class="action-link">更多</span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <!-- S-C8：handleAction 无 files/settings 分支，按主题 B 决策禁用 + title -->
                      <el-dropdown-item command="files" disabled title="功能开发中">文件管理</el-dropdown-item>
                      <el-dropdown-item command="settings" disabled title="功能开发中">基础设置</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && ossList.length === 0" class="empty-state">
          <el-icon :size="48"><Box /></el-icon>
          <p>暂无数据</p>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <div class="pagination-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox>
        <span class="select-info">已选 {{ selectedIds.length }} 项</span>
      </div>
      <div class="pagination-right">
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
    </div>

    <!-- 详情抽屉 -->
    <OssDetailDrawer v-model:visible="detailDrawerVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <AssetExportDialog v-model:visible="exportDialogVisible" :instances="ossList" :selected-ids="selectedIds" :total="pagination.total" :fetch-all-rows="fetchAllExportRows" :config="exportConfig" />
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
import IconFont from '@/components/IconFont/index.vue'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import type { TagType } from '@/utils/constants'
import { getProviderLabel } from '@/utils/constants'
import { fetchAllRows } from '@/utils/exportAll'
import { Box, DataLine, Download, Folder, Refresh, Search, Setting, WarningFilled } from '@element-plus/icons-vue'
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


/** 共享导出取值：原本地 ExportDialog.getFieldValue 逐字搬运（零漂移，不在迁移中优化）；
 *  S-Hard：存储量/对象数一律来自指标表(bucket_name 去重代表行),无指标数据导出空串,不回退资产表快照 */
const getExportValue: ExportFieldConfig['getValue'] = (instance: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return instance[key] || ''
  const attr = instance.attributes || {}
  if (key === 'storage_class') { const map: Record<string, string> = { Standard: '标准存储', IA: '低频存储', Archive: '归档存储' }; return map[attr.storage_class] || attr.storage_class || '' }
  if (key === 'acl') { const map: Record<string, string> = { private: '私有', 'public-read': '公共读', 'public-read-write': '公共读写' }; return map[attr.acl] || attr.acl || '' }
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
const ossList = ref<Asset[]>([])
const selectedIds = ref<number[]>([])
const selectAll = ref(false)
const searchKeyword = ref('')
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive({ provider: '', storage_class: '', acl: '', region: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

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

const standardCount = computed(() => ossList.value.filter(i => i.attributes?.storage_class === 'Standard').length)
const iaCount = computed(() => ossList.value.filter(i => i.attributes?.storage_class === 'IA').length)
const archiveCount = computed(() => ossList.value.filter(i => i.attributes?.storage_class === 'Archive').length)

// ===== 运营卡(总容量/对象数/近 7 天增速,数据来源 ecam_oss_metric 指标表) =====
// 采集凌晨补采,当日行仅含凌晨部分;days=8 读昨日及前 6 天全量+今日初态,保证均值覆盖完整 7 天窗口
const OSS_CARD_DAYS = 8
const OSS_TOP_PAGE_SIZE = 50
const OSS_TOP_MAX_PAGES = 20

const opsState = ref<OssCardState>('empty')
const opsSummary = ref<OssCardSummary>({ totalStorageSize: 0, totalObjectCount: 0, bucketCount: 0 })
const opsWarnDetail = ref('')
const opsAsOf = ref('')
/** Top 全量项(供运营卡聚合 + 列表行存储量/对象数列取指标值) */
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

const initColumnSettings = () => {
  const saved = localStorage.getItem('oss-column-settings')
  if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return } } catch { /* ignore */ } }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnSettingsChange = (columns: ColumnConfig[]) => { columnSettings.value = columns }

/** 组装列表查询参数（列表分页与导出全量拉取共用，保证筛选口径一致） */
const buildListParams = (page: number, size: number) => ({
  offset: (page - 1) * size,
  limit: size,
  name: searchKeyword.value || undefined,
  provider: filters.provider || undefined,
  storage_class: filters.storage_class || undefined,
  acl: filters.acl || undefined,
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listOSSAssetsApi(buildListParams(pagination.page, pagination.size))
    ossList.value = res.data?.items || []
    pagination.total = res.data?.total || 0
  } catch (e) {
    console.error('获取OSS列表失败:', e)
    ElMessage.error('获取OSS列表失败，请稍后重试')
    ossList.value = []
    pagination.total = 0
  }
  finally { loading.value = false }
}

const handleRefresh = () => { fetchData(); fetchOpsCard() }
/** 导出「全部数据」：按当前筛选分页拉取全量（主题A storage S-H2），供 ExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listOSSAssetsApi(buildListParams(page, pageSize))
    return { list: res.data?.items || [], total: res.data?.total || 0 }
  }, { onProgress })

const handleSearch = () => { pagination.page = 1; fetchData() }
const handleFilterChange = () => { pagination.page = 1; fetchData() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handleCurrentChange = (page: number) => { pagination.page = page; fetchData() }

const handleSelectAll = (val: boolean | string | number) => { selectedIds.value = val ? ossList.value.map(i => i.id) : [] }
const handleSelect = (id: number, val: boolean | string | number) => {
  if (val) { if (!selectedIds.value.includes(id)) selectedIds.value.push(id) }
  else { selectedIds.value = selectedIds.value.filter(i => i !== id) }
  selectAll.value = selectedIds.value.length === ossList.value.length
}
const handleRowClick = (item: Asset) => { handleSelect(item.id, !selectedIds.value.includes(item.id)) }
const handleViewDetail = (item: Asset) => { detailInstance.value = item; detailDrawerVisible.value = true }
const handleAction = (cmd: string, item: Asset) => { if (cmd === 'view') handleViewDetail(item) }

const getStorageClassText = (type?: string) => {
  if (!type) return '-'
  const map: Record<string, string> = { Standard: '标准存储', IA: '低频存储', Archive: '归档存储', ColdArchive: '冷归档存储' }
  return map[type] || type
}
const getStorageClassType = (type?: string): TagType => {
  if (!type) return 'info'
  const map: Record<string, TagType> = { Standard: 'primary', IA: 'warning', Archive: 'info', ColdArchive: 'info' }
  return map[type] || 'info'
}
const getAclText = (acl?: string) => {
  if (!acl) return '-'
  const map: Record<string, string> = { private: '私有', 'public-read': '公共读', 'public-read-write': '公共读写' }
  return map[acl] || acl
}
const getPlatformIcon = (provider?: string) => {
  if (!provider) return 'Alibaba_Cloud'
  const p = provider.toLowerCase()
  if (p.includes('aliyun')) return 'Alibaba_Cloud'
  if (p.includes('tencent')) return 'Tencent_Cloud'
  if (p.includes('huawei')) return 'Huawei_Cloud'
  if (p.includes('aws')) return 'AWS'
  if (p.includes('volcano')) return 'Bytecloud'
  return 'Alibaba_Cloud'
}
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }

// H-03：实例详情「查看资产」带 query.search 跳入时，首载前预填搜索关键词（无 query 直达零改动）
const route = useRoute()

onMounted(() => {
  initColumnSettings()
  const s = route.query.search
  if (typeof s === 'string' && s) searchKeyword.value = s
  fetchData()
  fetchOpsCard()
})
</script>

<style scoped lang="scss">
@import '../styles/storage.scss';

.bucket-icon {
  color: #f0a020;
  margin-right: 8px;
}

// 运营卡(数据来源:ecam_oss_metric 指标表;与 NAS 列表页同构)
.ops-card {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 14px 18px;
  margin-bottom: 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
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

// 列表行 storage_size=0 异常行标记(不当正常空桶)
.cap-exception {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #d97706;
}
</style>
