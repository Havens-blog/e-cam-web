<template>
  <div class="audit-page">
    <!-- 页面头部：标题 + 内联状态标（主机页紧凑标准，无大统计卡） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">操作审计</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总记录</span>
            <span class="stat-num">{{ total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">成功</span>
            <span class="stat-num green">{{ successCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">失败</span>
            <span class="stat-num red">{{ failCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">慢请求</span>
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
          <el-option v-for="op in opTypes" :key="op.value" :label="op.label" :value="op.value" />
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
        <el-tooltip content="导出 CSV"><el-button :icon="Download" circle @click="handleExport" /></el-tooltip>
        <el-tooltip content="刷新"><el-button :icon="Refresh" circle @click="handleRefresh" /></el-tooltip>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-card">
      <el-table :data="logList" v-loading="loading" style="width: 100%" row-key="id" :row-class-name="rowClassName" @row-click="handleRowClick" :header-cell-style="{ background: 'var(--bg-elevated)', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }">
        <el-table-column prop="ctime" label="时间" width="170" sortable>
          <template #default="{ row }"><span class="cell-time">{{ formatTs(row.ctime) }}</span></template>
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
        <el-table-column prop="duration_ms" label="耗时" width="90" align="right" sortable>
          <template #default="{ row }"><span :class="['duration', durationLevel(row.duration_ms)]">{{ formatDuration(row.duration_ms) }}</span></template>
        </el-table-column>
        <el-table-column prop="client_ip" label="来源IP" width="130" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="70" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.result === 'success'" class="result-icon success"><CircleCheck /></el-icon>
            <el-icon v-else class="result-icon fail"><CircleClose /></el-icon>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next, jumper" @current-change="fetchLogs" @size-change="fetchLogs" />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="审计日志详情" size="520px" :close-on-click-modal="true">
      <div v-if="currentLog" class="detail-content">
        <div class="detail-row"><span class="detail-label">请求ID</span><span class="detail-value"><code>{{ currentLog.request_id }}</code></span></div>
        <div class="detail-row"><span class="detail-label">时间</span><span class="detail-value">{{ formatTs(currentLog.ctime) }}</span></div>
        <div class="detail-row"><span class="detail-label">操作人</span><span class="detail-value">{{ currentLog.operator_name }} ({{ currentLog.operator_id }})</span></div>
        <div class="detail-row"><span class="detail-label">操作类型</span><span class="detail-value">{{ opTypeLabel(currentLog.operation_type) }}</span></div>
        <div class="detail-row"><span class="detail-label">请求</span><span class="detail-value"><code>{{ currentLog.http_method }} {{ currentLog.api_path }}</code></span></div>
        <div class="detail-row"><span class="detail-label">状态码</span><span class="detail-value"><code>{{ currentLog.status_code }}</code></span></div>
        <div class="detail-row"><span class="detail-label">耗时</span><span class="detail-value">{{ formatDuration(currentLog.duration_ms) }}</span></div>
        <div class="detail-row"><span class="detail-label">结果</span><span class="detail-value">{{ currentLog.result === 'success' ? '成功' : '失败' }}</span></div>
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
import { CircleCheck, CircleClose, Download, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

const { loadDict, getDictOptions } = useDictionary()

const loading = ref(false)
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

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const opTypes = getDictOptions('operation_type')

const successCount = computed(() => logList.value.filter(l => l.result === 'success').length)
const failCount = computed(() => logList.value.filter(l => l.result !== 'success').length)
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
  } catch (e: any) {
    ElMessage.error(e.message || '加载审计日志失败')
  } finally {
    loading.value = false
  }
}

// 筛选条件变更/点击查询：重置页码到第 1 页，避免新结果集从旧页码的 offset 开始
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
    ElMessage.error(e.message || '导出失败')
  }
}

function handleRowClick(row: AuditLog) {
  currentLog.value = row
  drawerVisible.value = true
}

function rowClassName({ row }: { row: AuditLog }) {
  return row.status_code >= 400 ? 'row-error' : ''
}

function formatTs(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
  const map: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'info'> = { create: 'success', update: 'warning', delete: 'danger', sync: 'info', import: 'info', export: 'info' }
  return map[type] || ''
}

function opTypeLabel(type: string) {
  const found = opTypes.value.find(o => o.value === type)
  return found ? found.label : type
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
  background: rgba(113, 112, 255, 0.12); color: var(--accent-blue);
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
  &.get { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
  &.post { background: rgba(113, 112, 255, 0.15); color: var(--accent-blue); }
  &.put { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
  &.delete { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
  &.patch { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
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
.result-icon { font-size: 18px; &.success { color: var(--accent-green); } &.fail { color: var(--accent-red); } }

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