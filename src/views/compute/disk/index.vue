<template>
  <div class="vm-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">云盘</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ pagination.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">使用中</span>
            <span class="stat-num blue">{{ inUseCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">可用</span>
            <span class="stat-num">{{ availableCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 运营卡:数据来源 ecam_disk_metric 指标表(经 /assets/disk/top,disk_id 去重聚合,不跨账号求和/平均);
         判定顺序「采集失败→警示」优先于「无数据→0 占位」,失败计数以 disk:collect_metrics 任务 Result 为准。
         注:T1 探测定案指标表无容量字段,运营卡以「磁盘数」替代 proposal 的「总容量」(不回退资产表快照) -->
    <div class="ops-strip">
      <div class="ops-card" :class="opsState">
        <template v-if="opsState === 'warn'">
          <el-icon class="ops-warn-icon" :size="18"><WarningFilled /></el-icon>
          <div class="ops-warn-text">
            <div class="ops-warn-title">磁盘指标采集异常,使用率/IO 数据可能不完整</div>
            <div class="ops-warn-detail">{{ opsWarnDetail }}</div>
          </div>
          <el-button size="small" type="warning" plain @click="fetchOpsCard">重试</el-button>
        </template>
        <template v-else-if="opsState === 'empty'">
          <el-icon class="ops-empty-icon" :size="18"><DataLine /></el-icon>
          <span class="ops-empty-text">暂无磁盘指标数据(未采集或未启用指标采集)</span>
        </template>
        <template v-else>
          <div class="ops-metric">
            <span class="ops-metric-label">磁盘数</span>
            <span class="ops-metric-value">{{ opsSummary.diskCount }}</span>
          </div>
          <div class="ops-metric">
            <span class="ops-metric-label">平均使用率</span>
            <span class="ops-metric-value">{{ formatUsagePercent(opsSummary.avgUsagePercent) }}</span>
          </div>
          <div class="ops-metric">
            <span class="ops-metric-label">IO 繁忙盘数</span>
            <span class="ops-metric-value" :class="{ 'busy-warn': opsSummary.ioBusyCount > 0 }">{{ opsSummary.ioBusyCount }}</span>
          </div>
          <span class="ops-note">IO 繁忙:使用率 &gt;{{ DISK_USAGE_BUSY_PERCENT }}% 或 IOPS 超阈值 · 读采集指标表<template v-if="opsAsOf"> · 截至 {{ opsAsOf }}</template></span>
        </template>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-left">
        <el-input v-model="filters.keyword" placeholder="搜索云盘名称/ID" clearable style="width: 200px" @clear="handleSearch" @keyup.enter="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.provider" placeholder="云平台" clearable style="width: 120px" @change="handleSearch">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="AWS" value="aws" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px" @change="handleSearch">
          <el-option label="使用中" value="In_use" />
          <el-option label="可用" value="Available" />
          <el-option label="创建中" value="Creating" />
        </el-select>
        <el-select v-model="filters.disk_type" placeholder="磁盘类型" clearable style="width: 120px" @change="handleSearch">
          <el-option label="系统盘" value="system" />
          <el-option label="数据盘" value="data" />
        </el-select>
      </div>
      <div class="action-right">
        <el-button size="small" circle @click="handleRefresh" title="刷新"><el-icon><Refresh /></el-icon></el-button>
        <el-button size="small" circle @click="exportDialogVisible = true" title="导出"><el-icon><Download /></el-icon></el-button>
        <el-button size="small" circle @click="columnSettingsVisible = true" title="自定义列"><el-icon><Setting /></el-icon></el-button>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-checkbox"><el-checkbox v-model="selectAll" @change="handleSelectAll" /></th>
              <th class="col-name">云盘ID/名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>
      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in instances" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click="handleRowClick(item)">
              <td class="col-checkbox" @click.stop><el-checkbox :model-value="selectedIds.includes(item.id)" @change="handleSelect(item.id, $event)" /></td>
              <td class="col-name">
                <div class="name-cell">
                  <span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_id }}</span>
                  <span class="instance-sub">{{ item.asset_name || '-' }}</span>
                </div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.status)"></span>
                  <span class="status-text">{{ getStatusText(item.status) }}</span>
                </template>
                <template v-else-if="col.key === 'disk_type'">
                  <span class="env-tag" :class="item.attributes?.disk_type === 'system' ? 'warning' : ''">{{ item.attributes?.disk_type === 'system' ? '系统盘' : '数据盘' }}</span>
                </template>
                <template v-else-if="col.key === 'usage'">
                  <!-- S-Hard:使用率一律来自指标表(disk_id 去重代表行);无指标数据显示 "-",不回退资产表快照 -->
                  <span v-if="rowMetric(item)?.data_status === 'zero_exception'" class="cap-exception">
                    0
                    <el-tooltip content="使用率异常:口径缺失的 0 值采集异常行,不代表真实水位" placement="top">
                      <el-icon :size="12"><WarningFilled /></el-icon>
                    </el-tooltip>
                  </span>
                  <span v-else>
                    <el-tooltip :content="`使用率口径:${usageScopeLabel(rowMetric(item)?.usage_scope)}`" placement="top" :disabled="!rowMetric(item)">
                      <span>{{ formatUsagePercent(rowMetric(item)?.latest.usage_percent) }}</span>
                    </el-tooltip>
                  </span>
                </template>
                <template v-else-if="col.key === 'iops'">{{ formatIOPS(rowMetric(item)?.latest.iops) }}</template>
                <template v-else-if="col.key === 'throughput'">{{ formatThroughputMBps(rowMetric(item)?.latest.throughput) }}</template>
                <template v-else-if="col.key === 'category'">{{ getDiskCategory(item.attributes?.category) }}</template>
                <template v-else-if="col.key === 'instance'"><span class="text-ellipsis">{{ item.attributes?.instance_id || '-' }}</span></template>
                <template v-else-if="col.key === 'platform'"><IconFont :type="getPlatformIcon(item.provider)" class="platform-icon" /></template>
                <template v-else-if="col.key === 'region'">{{ item.region || '-' }}</template>
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
      <div class="pagination-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox>
        <span class="select-info">已选 {{ selectedIds.length }} 项</span>
      </div>
      <div class="pagination-right">
        <el-pagination :current-page="pagination.page" :page-size="pagination.size" :page-sizes="[20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next" @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
    </div>

    <DiskDetailDrawer v-model:visible="detailVisible" :instance="currentInstance" />
    <!-- 原本地导出弹窗无「已选中」范围（不接收 selectedIds），迁移时传 [] 保持「已选中」禁用（零漂移） -->
    <AssetExportDialog v-model:visible="exportDialogVisible" :instances="instances" :selected-ids="[]" :total="pagination.total" :fetch-all-rows="fetchAllExportRows" :config="exportConfig" />
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { getDiskTopApi, listDiskAssetsApi } from '@/api/asset'
import { listTasksApi } from '@/api'
import type { DiskTopItem } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import type { TaskType } from '@/api/types/task'
import { fetchAllRows } from '@/utils/exportAll'
import IconFont from '@/components/IconFont/index.vue'
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import { Box, DataLine, Download, Refresh, Search, Setting, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import {
  deriveDiskCardState,
  DISK_COLLECT_TASK_TYPE,
  DISK_USAGE_BUSY_PERCENT,
  extractDiskCollectFailures,
  formatIOPS,
  formatThroughputMBps,
  formatUsagePercent,
  summarizeDiskTop,
  usageScopeLabel,
  type DiskCardState,
  type DiskCardSummary,
} from './diskMetrics'
import ColumnSettingsDialog from './components/ColumnSettingsDialog.vue'
import DiskDetailDrawer from './components/DiskDetailDrawer.vue'


/** 共享导出取值:S-Hard 使用率/IOPS/吞吐一律来自指标表(disk_id 去重代表行);无指标数据导出空串,不回退资产表快照 */
const getExportValue: ExportFieldConfig['getValue'] = (i: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return i[key] || ''
  if (key === 'usage_percent' || key === 'iops' || key === 'throughput') {
    const m = diskMetricMap.value.get(String(i.asset_id || ''))
    const v = key === 'usage_percent' ? m?.latest?.usage_percent : key === 'iops' ? m?.latest?.iops : m?.latest?.throughput
    if (v === null || v === undefined || !Number.isFinite(v)) return ''
    if (key === 'usage_percent') return `${Math.round(v * 10) / 10}%`
    if (key === 'iops') return Math.round(v).toLocaleString()
    return `${Math.round(v * 10) / 10} MB/s`
  }
  return i.attributes?.[key] || ''
}

/** 共享导出配置:容量快照(资产表 size)不在导出列(指标表无容量字段,Hard Rule);使用率/IOPS/吞吐改由指标表取值 */
const exportConfig: ExportFieldConfig = {
  fields: [
    { key: 'asset_id', label: '云盘ID' }, { key: 'asset_name', label: '名称' }, { key: 'status', label: '状态' },
    { key: 'disk_type', label: '磁盘类型' }, { key: 'usage_percent', label: '使用率' }, { key: 'iops', label: 'IOPS' },
    { key: 'throughput', label: '吞吐量' }, { key: 'category', label: '云盘类型' },
    { key: 'instance_id', label: '挂载实例' }, { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' },
  ],
  getValue: getExportValue,
  filename: '云盘列表',
  defaultFields: ['asset_id', 'asset_name', 'status', 'disk_type', 'usage_percent', 'iops', 'throughput', 'category', 'instance_id', 'provider', 'region'],
}

const loading = ref(false)
const instances = ref<Asset[]>([])
const detailVisible = ref(false)
const currentInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)
const selectedIds = ref<number[]>([])
const selectAll = ref(false)

const filters = reactive({ keyword: '', provider: '', status: '', disk_type: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

const defaultColumnSettings = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'disk_type', label: '磁盘类型', width: 90, visible: true },
  { key: 'usage', label: '使用率', width: 90, visible: true },
  { key: 'iops', label: 'IOPS', width: 90, visible: true },
  { key: 'throughput', label: '吞吐量', width: 100, visible: true },
  { key: 'category', label: '云盘类型', width: 120, visible: true },
  { key: 'instance', label: '挂载实例', width: 180, visible: true },
  { key: 'platform', label: '云平台', width: 60, visible: true },
  { key: 'region', label: '地域', width: 120, visible: true },
]
const columnSettings = ref([...defaultColumnSettings])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const inUseCount = computed(() => instances.value.filter(i => i.status?.toLowerCase().includes('use')).length)
const availableCount = computed(() => instances.value.filter(i => i.status?.toLowerCase().includes('available')).length)

// ===== 运营卡(磁盘数/平均使用率/IO 繁忙盘数,数据来源 ecam_disk_metric 指标表) =====
// 采集凌晨补采,当日行仅含凌晨部分;days=2 读昨日全量+今日初态,保证全天有最新完整快照
const DISK_CARD_DAYS = 2
const DISK_TOP_PAGE_SIZE = 50
const DISK_TOP_MAX_PAGES = 20

const opsState = ref<DiskCardState>('empty')
const opsSummary = ref<DiskCardSummary>({ diskCount: 0, avgUsagePercent: null, ioBusyCount: 0 })
const opsWarnDetail = ref('')
const opsAsOf = ref('')
/** Top 全量项(供运营卡聚合 + 列表行使用率/IOPS/吞吐列取指标值) */
const opsTopItems = ref<DiskTopItem[]>([])

/** 分页拉全量 Top(page_size 上限 50,翻页直到取满 total) */
const fetchAllDiskTop = async (): Promise<DiskTopItem[]> => {
  const items: DiskTopItem[] = []
  let total = 0
  for (let page = 1; page <= DISK_TOP_MAX_PAGES; page++) {
    const { data } = await getDiskTopApi({ days: DISK_CARD_DAYS, sort: 'usage_percent', page, page_size: DISK_TOP_PAGE_SIZE })
    const batch = data?.items || []
    total = data?.total ?? total
    items.push(...batch)
    if (batch.length === 0 || items.length >= total) break
  }
  return items
}

const fetchOpsCard = async () => {
  const [topRes, taskRes] = await Promise.allSettled([
    fetchAllDiskTop(),
    listTasksApi({ type: DISK_COLLECT_TASK_TYPE as unknown as TaskType, status: 'completed', offset: 0, limit: 1 }),
  ])
  const topFailed = topRes.status === 'rejected'
  const items = topRes.status === 'fulfilled' ? topRes.value : []
  const latestTask = taskRes.status === 'fulfilled' ? ((taskRes.value as any).data?.tasks || [])[0] : null
  const failures = extractDiskCollectFailures(latestTask)

  opsTopItems.value = items
  opsState.value = deriveDiskCardState({ topFailed, itemCount: items.length, failures })
  opsSummary.value = summarizeDiskTop(items)
  opsAsOf.value = items.reduce((acc, it) => (it.latest?.date && it.latest.date > acc ? it.latest.date : acc), '')
  opsWarnDetail.value = failures
    .map(f => `${f.provider}(账号 ${f.account_id})失败 ${f.error_count} 次${f.last_error ? `:${f.last_error}` : ''}`)
    .join(';')
}

/** 列表行指标列取值来源:指标表 Top 项(disk_id = 实例 asset_id) */
const diskMetricMap = computed(() => {
  const map = new Map<string, DiskTopItem>()
  for (const it of opsTopItems.value) map.set(String(it.disk_id || ''), it)
  return map
})
const rowMetric = (item: Asset) => diskMetricMap.value.get(String(item?.asset_id || ''))

/** 组装列表查询参数（列表分页与导出全量拉取共用，保证筛选口径一致） */
const buildListParams = (page: number, size: number) => ({
  offset: (page - 1) * size,
  limit: size,
  provider: (filters.provider || undefined) as any,
  status: filters.status || undefined,
  name: filters.keyword || undefined,
  disk_type: filters.disk_type || undefined,
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listDiskAssetsApi(buildListParams(pagination.page, pagination.size))
    const data = res.data as any
    instances.value = data?.items || []
    pagination.total = data?.total || 0
  } catch (e) {
    console.error('获取云盘列表失败:', e)
    ElMessage.error('获取云盘列表失败')
    instances.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

/** 导出「全部数据」：按当前筛选分页拉取全量（主题A compute-1 F-H1），供 ExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<Asset[]> =>
  fetchAllRows<Asset>(async (page, pageSize) => {
    const res = await listDiskAssetsApi(buildListParams(page, pageSize))
    const data = res.data as any
    return { list: data?.items || [], total: data?.total || 0 }
  }, { onProgress })

const handleSearch = () => { pagination.page = 1; fetchData() }
const handleRefresh = () => { fetchData(); fetchOpsCard() }
const handlePageChange = (page: number) => { pagination.page = page; fetchData() }
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchData() }
const handleRowClick = (row: Asset) => { currentInstance.value = row; detailVisible.value = true }
const handleViewDetail = (row: Asset) => { currentInstance.value = row; detailVisible.value = true }
const handleColumnSettingsChange = (cols: any[]) => { columnSettings.value = cols; localStorage.setItem('disk-column-settings', JSON.stringify(cols)) }
const handleSelectAll = (val: boolean | string | number) => { selectedIds.value = val ? instances.value.map(i => i.id) : [] }
const handleSelect = (id: number, val: boolean | string | number) => { if (val) { selectedIds.value.push(id) } else { selectedIds.value = selectedIds.value.filter(i => i !== id) } }

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (s.includes('use')) return 'running'; if (s.includes('available')) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { in_use: '使用中', available: '可用', creating: '创建中', attaching: '挂载中', detaching: '卸载中' }; return map[status.toLowerCase()] || status }
const getDiskCategory = (category?: string) => { if (!category) return '-'; const map: Record<string, string> = { cloud_efficiency: '高效云盘', cloud_ssd: 'SSD云盘', cloud_essd: 'ESSD云盘', cloud: '普通云盘' }; return map[category] || category }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }

/** 自定义列初始化:历史保存设置迁移——剔除已下线列(如资产表快照 size),按默认标签回填,缺失的新列(使用率/IOPS/吞吐)按默认补齐 */
const initColumnSettings = () => {
  const saved = localStorage.getItem('disk-column-settings')
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
        columnSettings.value = [...kept, ...added] as typeof defaultColumnSettings
        return
      }
    } catch { /* ignore */ }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

onMounted(() => {
  initColumnSettings()
  fetchData()
  fetchOpsCard()
})
</script>

<style scoped lang="scss">
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px;
  height: calc(100% + 48px);
}

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

  .stat-label { font-size: 11px; color: var(--text-tertiary); }
  .stat-num { font-size: 16px; font-weight: 600; color: var(--text-primary); &.blue { color: var(--accent-blue); } }
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.action-left { display: flex; align-items: center; gap: 8px; }
.action-right { display: flex; align-items: center; gap: 12px; }

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

  th, td { padding: 10px 12px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  th { background: var(--bg-surface); color: var(--text-secondary); font-weight: 500; }
  td { border-bottom: 1px solid var(--border-subtle); }
  tbody tr { transition: background 150ms ease; cursor: pointer; &:hover { background: var(--bg-hover); } &.selected { background: rgba(113, 112, 255, 0.08); } }
}

.col-checkbox { width: 40px; }
.col-name { width: 220px; max-width: 220px; }
.col-actions { width: 80px; }

.name-cell {
  display: flex;
  flex-direction: column;
  max-width: 200px;

  .instance-name { color: var(--accent-blue); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; &:hover { text-decoration: underline; } }
  .instance-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
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
  &.pending { background: var(--accent-yellow); }
}

.status-text { color: var(--text-secondary); }
.platform-icon { font-size: 20px; }
.text-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; display: inline-block; }

.env-tag {
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  &.warning { background: rgba(230, 162, 60, 0.1); color: #e6a23c; }
}

.action-link { color: var(--accent-blue); cursor: pointer; &:hover { text-decoration: underline; } }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
  p { margin-top: 12px; }
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.pagination-left { display: flex; align-items: center; gap: 12px; .select-info { font-size: 13px; color: var(--text-tertiary); } }
.pagination-right { display: flex; align-items: center; gap: 16px; }

// 运营卡(数据来源:ecam_disk_metric 指标表)
.ops-strip {
  padding: 12px 20px;
  background: var(--bg-elevated);
}

.ops-card {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 14px 18px;
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
    .ops-metric-value { font-size: 18px; font-weight: 600; color: var(--text-primary); &.busy-warn { color: #d97706; } }
  }

  .ops-note { margin-left: auto; font-size: 12px; color: var(--text-tertiary); }
}

// 列表行 usage=0 口径缺失异常行标记(不当正常零使用率)
.cap-exception {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #d97706;
}
</style>
