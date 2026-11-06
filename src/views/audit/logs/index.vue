<template>
  <div class="audit-page">
    <!-- 页面头部：标题 + 内联状态标（主机页紧凑标准，无大统计卡） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">操作审计</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总记录</span>
            <!-- 总记录是全局口径（响应 total），下面四项是当前页 20 行的分布，标签已注明「本页」 -->
            <span class="stat-num">{{ total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">本页成功</span>
            <span class="stat-num green">{{ successCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">本页部分成功</span>
            <span class="stat-num orange">{{ partialCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">本页失败</span>
            <span class="stat-num red">{{ failCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">本页慢请求</span>
            <span class="stat-num orange">{{ slowCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-left">
        <el-input v-model="filters.api_path" placeholder="搜索 API 路径" clearable size="default" style="width: 220px" @keyup.enter="handleFilterChange" />
        <el-select v-model="filters.http_method" placeholder="请求方法" clearable size="default" style="width: 120px" @change="handleFilterChange">
          <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
        </el-select>
        <el-select v-model="filters.operation_type" placeholder="操作类型" clearable size="default" style="width: 130px" @change="handleFilterChange">
          <el-option v-for="op in opTypeOptions" :key="op.value" :label="op.label" :value="op.value" />
        </el-select>
        <el-select v-model="resultFilter" placeholder="结果" clearable size="default" style="width: 100px" @change="handleFilterChange">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="fail" />
        </el-select>
        <el-date-picker v-model="dateRange" type="datetimerange" range-separator="—" start-placeholder="开始时间" end-placeholder="结束时间" size="default" style="width: 360px" value-format="x" @change="handleDateChange" />
      </div>
      <div class="filter-right">
        <el-button @click="handleReset" plain>重置</el-button>
        <el-button type="primary" @click="handleFilterChange">查询</el-button>
        <el-divider direction="vertical" />
        <el-tooltip content="导出 CSV"><el-button :icon="Download" circle title="导出 CSV" aria-label="导出审计日志 CSV" :loading="exporting" :disabled="exporting" @click="handleExport" /></el-tooltip>
          <el-tooltip content="刷新"><el-button :icon="Refresh" circle title="刷新" aria-label="刷新列表" :loading="loading" :disabled="loading" @click="handleRefresh" /></el-tooltip>
      </div>
    </div>

    <!-- 错误态：请求失败时给持久说明 + 重试，而不是让 el-table 自带空态显示成「暂无数据」 -->
    <ErrorDisplay v-if="errorInfo" :error-info="errorInfo" @retry="fetchLogs()" />

    <!-- 表格 -->
    <div v-else class="table-card">
      <!-- 加载中把 el-table 自带空态文案清掉：否则「暂无数据」会与 loading 圈同时出现，
           用户会误读成「确实没有审计日志」（iter114 实测截图已确认） -->
      <el-table :data="logList" :default-sort="defaultSort" :empty-text="loading ? ' ' : emptyText" v-loading="loading" style="width: 100%" row-key="id" :row-class-name="rowClassName" @sort-change="handleSortChange" @row-click="handleRowClick" :header-cell-style="{ background: 'var(--bg-elevated)', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }">
        <el-table-column prop="ctime" label="时间" width="170" sortable="custom">
          <template #default="{ row }"><span class="cell-time">{{ formatAuditTime(row.ctime) }}</span></template>
        </el-table-column>
        <el-table-column prop="operator_name" label="操作人" width="100">
          <template #default="{ row }">
            <div class="cell-operator">
              <span class="operator-avatar">{{ (row.operator_name || '?')[0].toUpperCase() }}</span>
              <span>{{ row.operator_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="operation_type" label="操作类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="opTypeTag(row.operation_type) || undefined" effect="light" round>{{ opTypeLabel(row.operation_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="请求" min-width="280">
          <template #default="{ row }">
            <div class="cell-request">
              <span :class="['method-badge', row.http_method?.toLowerCase()]">{{ row.http_method }}</span>
              <span class="api-path" :title="row.api_path">{{ row.api_path }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status_code" label="状态" width="90" align="center">
          <template #default="{ row }">
            <span :class="['status-dot', row.status_code >= 400 ? 'error' : 'ok']"></span>
            <span :class="['status-code', row.status_code >= 400 ? 'error' : 'ok']">{{ row.status_code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="duration_ms" label="耗时" width="90" align="right" sortable="custom">
          <template #default="{ row }"><span :class="['duration', durationLevel(row.duration_ms)]">{{ formatDuration(row.duration_ms) }}</span></template>
        </el-table-column>
        <el-table-column prop="client_ip" label="来源IP" width="130" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="70" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.result === 'success'" class="result-icon success"><CircleCheck /></el-icon>
            <el-icon v-else-if="row.result === 'partial'" class="result-icon partial"><WarningFilled /></el-icon>
            <el-icon v-else class="result-icon fail"><CircleClose /></el-icon>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div v-if="!errorInfo" class="pagination-bar">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next, jumper" @current-change="fetchLogs" @size-change="fetchLogs" />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="审计日志详情" size="520px" :close-on-click-modal="true">
      <div v-if="currentLog" class="detail-content">
        <div class="detail-row"><span class="detail-label">请求ID</span><span class="detail-value"><code>{{ currentLog.request_id }}</code></span></div>
        <div class="detail-row"><span class="detail-label">时间</span><span class="detail-value">{{ formatAuditTime(currentLog.ctime) }}</span></div>
        <div class="detail-row"><span class="detail-label">操作人</span><span class="detail-value">{{ currentLog.operator_name }} ({{ currentLog.operator_id }})</span></div>
        <div class="detail-row"><span class="detail-label">操作类型</span><span class="detail-value">{{ opTypeLabel(currentLog.operation_type) }}</span></div>
        <div class="detail-row"><span class="detail-label">请求</span><span class="detail-value"><code>{{ currentLog.http_method }} {{ currentLog.api_path }}</code></span></div>
        <div class="detail-row"><span class="detail-label">状态码</span><span class="detail-value"><code>{{ currentLog.status_code }}</code></span></div>
        <div class="detail-row"><span class="detail-label">耗时</span><span class="detail-value">{{ formatDuration(currentLog.duration_ms) }}</span></div>
        <div class="detail-row"><span class="detail-label">结果</span><span class="detail-value">{{ resultLabel(currentLog.result) }}</span></div>
        <div class="detail-row"><span class="detail-label">来源IP</span><span class="detail-value"><code>{{ currentLog.client_ip }}</code></span></div>
        <div class="detail-row"><span class="detail-label">User-Agent</span><span class="detail-value ua">{{ currentLog.user_agent }}</span></div>
        <template v-if="currentLog.request_body">
          <div class="detail-row"><span class="detail-label">请求体</span></div>
          <pre class="detail-json">{{ formatJson(currentLog.request_body) }}</pre>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import type { AuditLog, AuditLogParams } from '@/api/audit'
import { exportAuditLogsApi, listAuditLogsApi } from '@/api/audit'
import { useDictionary } from '@/composables/useDictionary'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { parseError, type ErrorInfo } from '@/utils/error-handler'
import { formatAuditTime } from './format'
import { CircleCheck, CircleClose, Download, Refresh, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { showApiError } from '@/api/request'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { opTypeLabel as presentOpTypeLabel, opTypeTag as presentOpTypeTag, resultLabel as presentResultLabel } from './presenters'

const { loadDict, getDictOptions } = useDictionary()

const loading = ref(false)
// 导出是长操作（实测 7582 行约 1MB）：无加载态时连点会重复拉全量，
// 实测三次点击 = 三个 export 请求。故加独立状态并在在途时忽略重复点击。
const exporting = ref(false)
// 服务端排序：审计日志共 7000+ 条，客户端排序只会排当前页 20 行（会误导用户），
// 故两列改为 sortable="custom"，由后端按白名单字段排序。
const sortBy = ref<'' | 'ctime' | 'duration_ms'>('')
const sortOrder = ref<'' | 'asc' | 'desc'>('')

// el-table 的排序箭头由组件内部状态驱动：URL 恢复 sortBy/sortOrder 后必须
// 同步给 default-sort，否则数据是排过序的、表头却没有任何标记（用户看不出来，
// 且再点一次会按"未排序"的假定走 asc→desc，与预期不符）。
// el-table 的排序箭头由组件内部状态驱动：URL 恢复 sortBy/sortOrder 后必须
// 同步给 default-sort，否则数据排过序、表头却没有标记（用户看不出来，
// 且再点一次会按"未排序"的假定走 asc→desc，与预期不符）。
// 注意 TableSort.order 只接受 ascending/descending，无排序时必须给 {} 而非 null。
// 无排序时返回 undefined —— Element Plus 的 Sort 要求 prop/order 都非空，
// 不能用一个"空对象"表达未排序，否则类型与运行时都不对。
const defaultSort = computed<{ prop: string; order: 'ascending' | 'descending' } | undefined>(() => {
  if (!sortBy.value) return undefined
  return {
    prop: sortBy.value,
    order: sortOrder.value === 'asc' ? 'ascending' : 'descending',
  }
})
// 请求失败时置 ErrorInfo，由 <ErrorDisplay> 渲染持久错误态 + 重试（BACKLOG §二 T1）。
// 此前 catch 只弹 3 秒 toast，表格保持空 → el-table 自带空态会把「请求失败」显示成「暂无数据」。
const errorInfo = ref<ErrorInfo | null>(null)
const logList = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const drawerVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)
const dateRange = ref<[number, number] | null>(null)
const resultFilter = ref('')

const filters = reactive<AuditLogParams>({
  api_path: '',
  http_method: '',
  operation_type: '',
})

/**
 * 是否处于「有筛选」状态（iter227）。
 * 筛选分两处：filters（api_path / http_method / operation_type）与 urlState 里的
 * result / start / end（时间范围与结果由筛选栏直接写 URL 状态）。
 * 此前空态固定「暂无数据」，用户筛了条件没命中也看到「暂无数据」，会以为一条审计日志都没有。
 */
const hasFilters = computed<boolean>(() =>
    Object.values(filters).some((v) => String(v ?? '').trim() !== '')
    || Boolean(urlState.result)
    || (Boolean(urlState.start) && Boolean(urlState.end)),
)

/** 空态文案：区分「筛选无结果」与「本来无数据」 */
const emptyText = computed<string>(() =>
    hasFilters.value ? '没有符合条件的审计日志，试试调整筛选或清空搜索' : '暂无审计日志',
)

// 筛选/排序/页码同步 URL（沿用项目既有 useUrlFilters，alert/* 与 audit/changes 已采用）：
// 此前它们只存在内存里，刷新页面、分享链接、从详情返回都会丢，运维得重输一遍。
const urlState = reactive<Record<string, string | undefined>>({
  api_path: undefined,
  http_method: undefined,
  operation_type: undefined,
  result: undefined,
  start: undefined,
  end: undefined,
  sort_by: undefined,
  order: undefined,
  page: undefined,
})
useUrlFilters(urlState)

// URL 回填 → 落到各自的 ref/对象（先落状态再取数，否则页面显示与数据不一致）
if (urlState.api_path) filters.api_path = urlState.api_path
if (urlState.http_method) filters.http_method = urlState.http_method
if (urlState.operation_type) filters.operation_type = urlState.operation_type
if (urlState.result) resultFilter.value = urlState.result
if (urlState.start && urlState.end) dateRange.value = [Number(urlState.start), Number(urlState.end)]
if (urlState.sort_by === 'ctime' || urlState.sort_by === 'duration_ms') sortBy.value = urlState.sort_by
if (urlState.order === 'asc' || urlState.order === 'desc') sortOrder.value = urlState.order
if (urlState.page && Number(urlState.page) > 0) page.value = Number(urlState.page)

// 状态变化 → 写回 URL（空值置 undefined，composable 会删掉对应 key）
watch(
  () => [
    filters.api_path, filters.http_method, filters.operation_type,
    resultFilter.value,
    dateRange.value ? dateRange.value[0] : '',
    dateRange.value ? dateRange.value[1] : '',
    sortBy.value, sortOrder.value, page.value,
  ].join('|'),
  () => {
    urlState.api_path = filters.api_path || undefined
    urlState.http_method = filters.http_method || undefined
    urlState.operation_type = filters.operation_type || undefined
    urlState.result = resultFilter.value || undefined
    urlState.start = dateRange.value && dateRange.value[0] != null ? String(dateRange.value[0]) : undefined
    urlState.end = dateRange.value && dateRange.value[1] != null ? String(dateRange.value[1]) : undefined
    urlState.sort_by = sortBy.value || undefined
    urlState.order = sortOrder.value || undefined
    urlState.page = page.value > 1 ? String(page.value) : undefined
  },
)

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const opTypes = getDictOptions('operation_type')

// 日志检索审计是 logquery 域写入的结构化类型,尚未进 operation_type 字典,
// 这里补一个可选项,保证审计页可按「日志查询」过滤。
const opTypeOptions = computed(() => {
  const list = [...opTypes.value]
  if (!list.some(o => o.value === 'log_search')) {
    list.push({ value: 'log_search', label: '日志查询' })
  }
  return list
})

// 以下四项统计的是「当前页 20 行」的分布，不是全局 —— 因此卡片标签必须写「本页」；
// 与「总记录」（全局 total）同排时，不加限定会被读成「7411 条里只有 7 条成功」。
const successCount = computed(() => logList.value.filter(l => l.result === 'success').length)
const partialCount = computed(() => logList.value.filter(l => l.result === 'partial').length)
const failCount = computed(() => logList.value.filter(l => l.result === 'failed').length)
const slowCount = computed(() => logList.value.filter(l => l.duration_ms > 1000).length)

async function fetchLogs() {
  loading.value = true
  try {
    const params: AuditLogParams = {
      offset: (page.value - 1) * pageSize.value,
      limit: pageSize.value,
    }
    if (filters.api_path) params.api_path = filters.api_path
    if (filters.http_method) params.http_method = filters.http_method
    if (filters.operation_type) params.operation_type = filters.operation_type
if (sortBy.value) {
      params.sort_by = sortBy.value
      params.order = sortOrder.value || 'desc'
    }
    if (resultFilter.value === 'success') params.status_code = 200
    if (resultFilter.value === 'fail') params.status_code = 500
    if (dateRange.value) {
      params.start_time = Number(dateRange.value[0])
      params.end_time = Number(dateRange.value[1])
    }
    const res = await listAuditLogsApi(params)
    const data = (res as any).data || res
    logList.value = data.items || []
    total.value = data.total || 0
    errorInfo.value = null
  } catch (e: any) {
    // 保留 showApiError 的去重（跳过「已提示 / 请求被取消」的情况，避免重复 toast），
    // 另用 parseError 构造**持久**错误态 —— 注意不能用 handleApiError：它内部会再弹一次
    // toast，与 showApiError 叠加就是双重提示。
    showApiError(e, '加载审计日志失败')
    errorInfo.value = { ...parseError(e), message: '加载审计日志失败' }
  } finally {
    loading.value = false
  }
}

// 筛选条件变更/点击查询：重置页码到第 1 页，避免新结果集从旧页码的 offset 开始
/** 表头排序：写回 sortBy/sortOrder 并回到第 1 页（否则会从旧页码的 offset 开始，结果错位） */
function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  const allowed = ['ctime', 'duration_ms']
  if (!order || !allowed.includes(prop)) {
    sortBy.value = ''
    sortOrder.value = ''
  } else {
    sortBy.value = prop as 'ctime' | 'duration_ms'
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
  page.value = 1
  fetchLogs()
}

function handleFilterChange() {
  page.value = 1
  fetchLogs()
}

function handleDateChange() {
  page.value = 1
  fetchLogs()
}

function handleReset() {
  filters.api_path = ''
  filters.http_method = ''
  filters.operation_type = ''
  resultFilter.value = ''
  dateRange.value = null
  page.value = 1
  fetchLogs()
}

function handleRefresh() {
  fetchLogs()
}

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    const params: AuditLogParams & { format?: 'csv' | 'json' } = { format: 'csv' }
    if (filters.api_path) params.api_path = filters.api_path
    if (filters.http_method) params.http_method = filters.http_method
    if (filters.operation_type) params.operation_type = filters.operation_type
    if (dateRange.value) {
      params.start_time = Number(dateRange.value[0])
      params.end_time = Number(dateRange.value[1])
    }
    const res = await exportAuditLogsApi(params)
    const blob = new Blob([res as any], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e: any) {
    // 导出失败：toast 提示（导出是一次性动作，无需持久错误块），
    // 但必须复位 exporting —— 否则按钮会永久卡在 loading。
    showApiError(e, '导出失败')
  } finally {
    exporting.value = false
  }
}

function handleRowClick(row: AuditLog) {
  currentLog.value = row
  drawerVisible.value = true
}

function rowClassName({ row }: { row: AuditLog }) {
  return row.status_code >= 400 ? 'row-error' : ''
}

function formatDuration(ms: number) {
  if (ms == null) return '-'
  if (ms < 1) return '<1ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function durationLevel(ms: number) {
  if (ms > 1000) return 'slow'
  if (ms > 500) return 'warn'
  return ''
}

function opTypeTag(type: string): 'success' | 'primary' | 'warning' | 'danger' | 'info' | '' {
  return presentOpTypeTag(type)
}

function opTypeLabel(type: string) {
  return presentOpTypeLabel(type, opTypes.value)
}

function resultLabel(result: string) {
  return presentResultLabel(result)
}

function formatJson(str: string) {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

onMounted(() => {
  loadDict('operation_type')
  fetchLogs()
})
</script>

<style lang="scss" scoped>
.audit-page {
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px; // 抵消外层 padding
  height: calc(100% + 48px);
}

/* 移动端外层 padding 为 12px：-24px 会横向溢出；筛选行也要能收缩（实测 360 下 -12 + 收缩后归零） */
@media (max-width: 768px) {
  .audit-page {
    margin: -12px;
    height: calc(100% + 24px);
  }

  .filter-left,
  .filter-right {
    min-width: 0;
  }

  .filter-left :deep(.el-select) {
    flex: 1 1 130px;
    min-width: 0;
  }
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
  // 窄屏允许换行：否则标题被兄弟元素挤到几十像素宽，中文一字一行竖排（iter116）
  flex-wrap: wrap;
}

@media (max-width: 560px) {
  .page-title-row {
    gap: 12px;
  }

  /* 标题在窄屏独占一行且不参与压缩，避免中文一字一行竖排（iter116） */
  .page-title {
    flex: 1 0 100%;
  }
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
  flex-wrap: wrap;
}

/* 小屏（≤480）：统计徽章右对齐会把整行撑出容器，改为换行并左对齐 */
@media (max-width: 480px) {
  .stats-badges {
    margin-left: 0;
    gap: 8px;
  }
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

  .stat-label {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .stat-num {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;

    &.green { color: var(--accent-green); }
    &.orange { color: var(--accent-yellow); }
    &.red { color: var(--accent-red); }
  }
}

// 筛选栏
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  flex-wrap: wrap;
  gap: 8px;
}

.filter-left,
.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

// 表格区
.table-card {
  flex: 1;
  background: var(--bg-surface);
  overflow: hidden;

  :deep(.row-error) { background-color: rgba(239, 68, 68, 0.04) !important; }
}

.cell-time { font-size: 13px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.cell-operator { display: flex; align-items: center; gap: 6px; }
.operator-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(113, 112, 255, 0.12); color: color-mix(in srgb, var(--accent-blue) 72%, #fff);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
}
.cell-request { display: flex; align-items: center; gap: 8px; min-width: 0; }
.api-path {
  font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.method-badge {
  display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
  font-family: var(--font-mono); flex-shrink: 0;
  &.get { background: rgba(16, 185, 129, 0.15); color: color-mix(in srgb, var(--accent-green) 72%, #fff); }
  &.post { background: rgba(113, 112, 255, 0.15); color: color-mix(in srgb, var(--accent-blue) 72%, #fff); }
  &.put { background: rgba(245, 158, 11, 0.15); color: color-mix(in srgb, var(--accent-yellow) 72%, #fff); }
  &.delete { background: rgba(239, 68, 68, 0.15); color: color-mix(in srgb, var(--accent-red) 72%, #fff); }
  &.patch { background: rgba(139, 92, 246, 0.15); color: color-mix(in srgb, var(--accent-purple) 72%, #fff); }
}
.status-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px;
  &.ok { background: var(--accent-green); }
  &.error { background: var(--accent-red); }
}
.status-code {
  font-family: var(--font-mono); font-size: 12px; font-weight: 600;
  &.ok { color: var(--accent-green); }
  &.error { color: var(--accent-red); }
}
.duration {
  font-family: var(--font-mono); font-size: 12px;
  &.slow { color: var(--accent-red); font-weight: 600; }
  &.warn { color: var(--accent-yellow); }
}
.result-icon { font-size: 18px; &.success { color: var(--accent-green); } &.partial { color: var(--accent-yellow); } &.fail { color: var(--accent-red); } }

// 分页
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
}

// 详情抽屉
.detail-content { display: flex; flex-direction: column; gap: 16px; }
.detail-row {
  display: flex; gap: 12px;
  .detail-label { width: 80px; flex-shrink: 0; font-size: 13px; color: var(--text-secondary); text-align: right; line-height: 22px; }
  .detail-value {
    font-size: 13px; color: var(--text-primary); word-break: break-all;
    &.ua { font-size: 12px; color: var(--text-secondary); }
  }
  code {
    font-family: var(--font-mono); font-size: 12px;
    background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;
  }
}
.detail-json {
  font-family: var(--font-mono); font-size: 12px; background: var(--bg-elevated);
  padding: 12px; border-radius: 6px; overflow-x: auto; max-height: 300px; margin: 0; white-space: pre-wrap; word-break: break-all;
}
</style>