<template>
  <div class="vm-page">
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">操作审计</h1>
        <div class="stats-badges">
          <div class="stat-badge" v-if="total > 0">
            <span class="stat-label">总记录</span>
            <span class="stat-num">{{ total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="action-bar">
      <div class="action-left">
        <el-input v-model="filters.api_path" placeholder="API路径" clearable size="small" style="width: 180px" @keyup.enter="fetchLogs" />
        <el-select v-model="filters.http_method" placeholder="请求方法" clearable size="small" style="width: 120px" @change="fetchLogs">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
          <el-option label="PATCH" value="PATCH" />
        </el-select>
        <el-select v-model="filters.operation_type" placeholder="操作类型" clearable size="small" style="width: 140px" @change="fetchLogs">
          <el-option label="创建" value="create" />
          <el-option label="更新" value="update" />
          <el-option label="删除" value="delete" />
          <el-option label="查询" value="query" />
          <el-option label="同步" value="sync" />
          <el-option label="登录" value="login" />
        </el-select>
        <el-input v-model="filters.request_id" placeholder="请求ID" clearable size="small" style="width: 200px" @keyup.enter="fetchLogs" />
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          size="small"
          style="width: 340px"
          value-format="x"
          @change="handleDateChange"
        />
      </div>
      <div class="action-right">
        <el-button size="small" @click="fetchLogs">
          <el-icon><Search /></el-icon> 查询
        </el-button>
        <el-button size="small" @click="handleExport">
          <el-icon><Download /></el-icon> 导出
        </el-button>
        <el-button size="small" circle @click="handleRefresh" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 审计日志表格 -->
    <div class="table-wrapper">
      <el-table :data="logList" v-loading="loading" stripe style="width: 100%" row-key="id" @row-click="handleRowClick">
        <el-table-column prop="ctime" label="时间" width="170">
          <template #default="{ row }">{{ formatTs(row.ctime) }}</template>
        </el-table-column>
        <el-table-column prop="operator_name" label="操作人" width="110" show-overflow-tooltip />
        <el-table-column prop="operation_type" label="操作类型" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="opTypeTag(row.operation_type)">{{ opTypeLabel(row.operation_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="http_method" label="方法" width="80">
          <template #default="{ row }">
            <span :class="['method-badge', row.http_method?.toLowerCase()]">{{ row.http_method }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="api_path" label="API路径" min-width="220" show-overflow-tooltip />
        <el-table-column prop="status_code" label="状态码" width="80" align="center">
          <template #default="{ row }">
            <span :class="['status-code', row.status_code >= 400 ? 'error' : 'ok']">{{ row.status_code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="duration_ms" label="耗时" width="80" align="right">
          <template #default="{ row }">
            <span :class="['duration', row.duration_ms > 1000 ? 'slow' : '']">{{ row.duration_ms }}ms</span>
          </template>
        </el-table-column>
        <el-table-column prop="client_ip" label="客户端IP" width="130" show-overflow-tooltip />
        <el-table-column prop="result" label="结果" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="row.result === 'success' ? 'success' : 'danger'">
              {{ row.result === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        small
        @current-change="fetchLogs"
      />
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="审计日志详情" size="520px">
      <div class="detail-content" v-if="currentLog">
        <div class="detail-row">
          <span class="detail-label">请求ID</span>
          <code class="detail-value">{{ currentLog.request_id }}</code>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作时间</span>
          <span class="detail-value">{{ formatTs(currentLog.ctime) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作人</span>
          <span class="detail-value">{{ currentLog.operator_name }} ({{ currentLog.operator_id }})</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作类型</span>
          <el-tag size="small" :type="opTypeTag(currentLog.operation_type)">{{ opTypeLabel(currentLog.operation_type) }}</el-tag>
        </div>
        <div class="detail-row">
          <span class="detail-label">请求方法</span>
          <span :class="['method-badge', currentLog.http_method?.toLowerCase()]">{{ currentLog.http_method }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">API路径</span>
          <code class="detail-value">{{ currentLog.api_path }}</code>
        </div>
        <div class="detail-row">
          <span class="detail-label">状态码</span>
          <span :class="['status-code', currentLog.status_code >= 400 ? 'error' : 'ok']">{{ currentLog.status_code }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">耗时</span>
          <span>{{ currentLog.duration_ms }}ms</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">客户端IP</span>
          <span class="detail-value">{{ currentLog.client_ip }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">User-Agent</span>
          <span class="detail-value ua">{{ currentLog.user_agent }}</span>
        </div>
        <div class="detail-row" v-if="currentLog.request_body">
          <span class="detail-label">请求体</span>
          <pre class="detail-json">{{ formatJson(currentLog.request_body) }}</pre>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import type { AuditLog, AuditLogParams } from '@/api/audit'
import { exportAuditLogsApi, listAuditLogsApi } from '@/api/audit'
import { Download, Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

const loading = ref(false)
const logList = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const dateRange = ref<[number, number] | null>(null)

const filters = reactive<AuditLogParams>({
  operation_type: '',
  http_method: '',
  api_path: '',
  request_id: '',
})

const detailVisible = ref(false)
const currentLog = ref<AuditLog | null>(null)

const opTypeLabel = (t: string) => {
  const m: Record<string, string> = {
    create: '创建', update: '更新', delete: '删除',
    query: '查询', sync: '同步', login: '登录', export: '导出',
  }
  return m[t] || t
}

const opTypeTag = (t: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
  const m: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    create: 'success', update: 'warning', delete: 'danger',
    query: 'info', sync: 'primary', login: 'primary',
  }
  return m[t] || 'info'
}

const formatTs = (ts: number) => ts ? new Date(ts).toLocaleString('zh-CN') : '-'

const formatJson = (str: string) => {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

const handleDateChange = (val: [number, number] | null) => {
  if (val) {
    filters.start_time = val[0]
    filters.end_time = val[1]
  } else {
    filters.start_time = undefined
    filters.end_time = undefined
  }
  fetchLogs()
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const params: AuditLogParams = {
      offset: (page.value - 1) * pageSize,
      limit: pageSize,
    }
    if (filters.operation_type) params.operation_type = filters.operation_type
    if (filters.http_method) params.http_method = filters.http_method
    if (filters.api_path) params.api_path = filters.api_path
    if (filters.request_id) params.request_id = filters.request_id
    if (filters.start_time) params.start_time = filters.start_time
    if (filters.end_time) params.end_time = filters.end_time

    const res = await listAuditLogsApi(params)
    const data = (res as any).data
    logList.value = data?.items || data?.data?.items || []
    total.value = data?.total || data?.data?.total || 0
  } catch (e: any) {
    ElMessage.error(e.message || '查询审计日志失败')
  } finally {
    loading.value = false
  }
}

const handleExport = async () => {
  try {
    const params: any = { format: 'csv' }
    if (filters.operation_type) params.operation_type = filters.operation_type
    if (filters.http_method) params.http_method = filters.http_method
    if (filters.start_time) params.start_time = filters.start_time
    if (filters.end_time) params.end_time = filters.end_time

    const res = await exportAuditLogsApi(params)
    const blob = new Blob([res as any], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e: any) {
    ElMessage.error(e.message || '导出失败')
  }
}

const handleRefresh = () => fetchLogs()

const handleRowClick = (row: AuditLog) => {
  currentLog.value = row
  detailVisible.value = true
}

onMounted(() => fetchLogs())
</script>

<style lang="scss" scoped>
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-top {
  background: var(--glass-bg, #fff);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 12px;
  padding: 16px 20px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  margin: 0;
}
.stats-badges {
  display: flex;
  gap: 12px;
}
.stat-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 20px;
  font-size: 13px;
}
.stat-label { color: var(--text-secondary, #909399); }
.stat-num { font-weight: 600; color: var(--text-primary, #303133); }
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--glass-bg, #fff);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 8px;
  flex-wrap: wrap;
  gap: 8px;
}
.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.table-wrapper {
  flex: 1;
  background: var(--glass-bg, #fff);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}
.method-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', 'Fira Code', monospace;
  &.get { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  &.post { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
  &.put { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
  &.delete { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
  &.patch { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
}
.status-code {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  font-weight: 600;
  &.ok { color: #10b981; }
  &.error { color: #ef4444; }
}
.duration {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  &.slow { color: #f59e0b; font-weight: 600; }
}
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.detail-row {
  display: flex;
  gap: 12px;
  .detail-label {
    width: 80px;
    flex-shrink: 0;
    font-size: 13px;
    color: var(--text-secondary, #909399);
    text-align: right;
    line-height: 22px;
  }
  .detail-value {
    font-size: 13px;
    color: var(--text-primary, #303133);
    word-break: break-all;
    &.ua { font-size: 12px; color: var(--text-secondary, #909399); }
  }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    background: var(--bg-secondary, #f5f7fa);
    padding: 2px 6px;
    border-radius: 4px;
  }
}
.detail-json {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  background: var(--bg-secondary, #f5f7fa);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  max-height: 300px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>