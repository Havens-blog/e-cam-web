<template>
  <div class="audit-page">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon total"><el-icon :size="20"><Document /></el-icon></div>
        <div class="stat-info">
          <span class="stat-num">{{ total }}</span>
          <span class="stat-label">总记录</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success"><el-icon :size="20"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <span class="stat-num success">{{ successCount }}</span>
          <span class="stat-label">成功</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon fail"><el-icon :size="20"><CircleClose /></el-icon></div>
        <div class="stat-info">
          <span class="stat-num fail">{{ failCount }}</span>
          <span class="stat-label">失败</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon slow"><el-icon :size="20"><Timer /></el-icon></div>
        <div class="stat-info">
          <span class="stat-num slow">{{ slowCount }}</span>
          <span class="stat-label">慢请求</span>
        </div>
      </div>
    </div>
    <div class="filter-bar">
      <div class="filter-left">
        <el-input v-model="filters.api_path" placeholder="搜索 API 路径" clearable size="default" style="width: 220px" @keyup.enter="fetchLogs" />
        <el-select v-model="filters.http_method" placeholder="请求方法" clearable size="default" style="width: 120px" @change="fetchLogs">
          <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
        </el-select>
        <el-select v-model="filters.operation_type" placeholder="操作类型" clearable size="default" style="width: 130px" @change="fetchLogs">
          <el-option v-for="op in opTypes" :key="op.value" :label="op.label" :value="op.value" />
        </el-select>
        <el-select v-model="resultFilter" placeholder="结果" clearable size="default" style="width: 100px" @change="fetchLogs">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="fail" />
        </el-select>
        <el-date-picker v-model="dateRange" type="datetimerange" range-separator="—" start-placeholder="开始时间" end-placeholder="结束时间" size="default" style="width: 360px" value-format="x" @change="handleDateChange" />
      </div>
      <div class="filter-right">
        <el-button @click="handleReset" plain>重置</el-button>
        <el-button type="primary" @click="fetchLogs">查询</el-button>
        <el-divider direction="vertical" />
        <el-tooltip content="导出 CSV"><el-button :icon="Download" circle @click="handleExport" /></el-tooltip>
        <el-tooltip content="刷新"><el-button :icon="Refresh" circle @click="handleRefresh" /></el-tooltip>
      </div>
    </div>
    <div class="table-card">
      <el-table :data="logList" v-loading="loading" style="width: 100%" row-key="id" :row-class-name="rowClassName" @row-click="handleRowClick" :header-cell-style="{ background: 'var(--bg-secondary, #fafafa)', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)' }">
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
import { CircleCheck, CircleClose, Document, Download, Refresh, Timer } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

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
const opTypes = [
  { label: '查询', value: 'query' },
  { label: '创建', value: 'create' },
  { label: '更新', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '同步', value: 'sync' },
  { label: '导入', value: 'import' },
  { label: '导出', value: 'export' },
]

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

function handleDateChange() {
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
  const found = opTypes.find(o => o.value === type)
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
  fetchLogs()
})
</script>

<style lang="scss" scoped>
.audit-page { height: 100%; display: flex; flex-direction: column; gap: 16px; }
.stats-row { display: flex; gap: 16px; }
.stat-card {
  flex: 1; display: flex; align-items: center; gap: 12px; padding: 16px 20px;
  background: var(--glass-bg, #fff); border: 1px solid var(--glass-border, #e4e7ed); border-radius: 12px;
}
.stat-icon {
  width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
  &.total { background: rgba(59,130,246,0.1); color: #3b82f6; }
  &.success { background: rgba(16,185,129,0.1); color: #10b981; }
  &.fail { background: rgba(239,68,68,0.1); color: #ef4444; }
  &.slow { background: rgba(245,158,11,0.1); color: #f59e0b; }
}
.stat-info { display: flex; flex-direction: column; }
.stat-num {
  font-size: 20px; font-weight: 700; color: var(--text-primary, #303133);
  &.success { color: #10b981; }
  &.fail { color: #ef4444; }
  &.slow { color: #f59e0b; }
}
.stat-label { font-size: 12px; color: var(--text-secondary, #909399); }
.filter-bar {
  display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;
  background: var(--glass-bg, #fff); border: 1px solid var(--glass-border, #e4e7ed); border-radius: 10px; flex-wrap: wrap; gap: 8px;
}
.filter-left, .filter-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.table-card {
  flex: 1; background: var(--glass-bg, #fff); border: 1px solid var(--glass-border, #e4e7ed); border-radius: 10px; overflow: hidden;
  :deep(.row-error) { background-color: rgba(239,68,68,0.04) !important; }
}
.cell-time { font-size: 13px; color: var(--text-secondary, #606266); font-variant-numeric: tabular-nums; }
.cell-operator { display: flex; align-items: center; gap: 6px; }
.operator-avatar {
  width: 24px; height: 24px; border-radius: 50%; background: var(--el-color-primary-light-7, #c6e2ff);
  color: var(--el-color-primary, #409eff); display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; flex-shrink: 0;
}
.cell-request { display: flex; align-items: center; gap: 8px; min-width: 0; }
.api-path {
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; color: var(--text-secondary, #606266);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.method-badge {
  display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', monospace; flex-shrink: 0;
  &.get { background: rgba(16,185,129,0.15); color: #10b981; }
  &.post { background: rgba(59,130,246,0.15); color: #3b82f6; }
  &.put { background: rgba(245,158,11,0.15); color: #f59e0b; }
  &.delete { background: rgba(239,68,68,0.15); color: #ef4444; }
  &.patch { background: rgba(139,92,246,0.15); color: #8b5cf6; }
}
.status-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px;
  &.ok { background: #10b981; }
  &.error { background: #ef4444; }
}
.status-code {
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; font-weight: 600;
  &.ok { color: #10b981; }
  &.error { color: #ef4444; }
}
.duration {
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
  &.slow { color: #ef4444; font-weight: 600; }
  &.warn { color: #f59e0b; }
}
.result-icon { font-size: 18px; &.success { color: #10b981; } &.fail { color: #ef4444; } }
.pagination-bar { display: flex; justify-content: flex-end; padding: 8px 0; }
.detail-content { display: flex; flex-direction: column; gap: 16px; }
.detail-row {
  display: flex; gap: 12px;
  .detail-label { width: 80px; flex-shrink: 0; font-size: 13px; color: var(--text-secondary, #909399); text-align: right; line-height: 22px; }
  .detail-value {
    font-size: 13px; color: var(--text-primary, #303133); word-break: break-all;
    &.ua { font-size: 12px; color: var(--text-secondary, #909399); }
  }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
    background: var(--bg-secondary, #f5f7fa); padding: 2px 6px; border-radius: 4px;
  }
}
.detail-json {
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; background: var(--bg-secondary, #f5f7fa);
  padding: 12px; border-radius: 6px; overflow-x: auto; max-height: 300px; margin: 0; white-space: pre-wrap; word-break: break-all;
}
</style>
