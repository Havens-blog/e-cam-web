<template>
  <div class="vm-page">
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">告警事件</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ total }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <div class="action-left">
        <el-select v-model="filters.type" placeholder="全部类型" clearable size="small" style="width: 140px" @change="fetchData">
          <el-option label="资源变更" value="resource_change" />
          <el-option label="同步失败" value="sync_failure" />
          <el-option label="资源过期" value="expiration" />
          <el-option label="安全组变更" value="security_group" />
        </el-select>
        <el-select v-model="filters.severity" placeholder="全部级别" clearable size="small" style="width: 120px" @change="fetchData">
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warning" />
          <el-option label="严重" value="critical" />
        </el-select>
        <el-select v-model="filters.status" placeholder="全部状态" clearable size="small" style="width: 120px" @change="fetchData">
          <el-option label="待发送" value="pending" />
          <el-option label="已发送" value="sent" />
          <el-option label="发送失败" value="failed" />
          <el-option label="已静默" value="silenced" />
        </el-select>
      </div>
      <div class="action-right">
        <el-button size="small" circle @click="fetchData" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="table-wrapper">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%" row-key="id" @expand-change="handleExpand">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="event-detail">
              <pre class="event-content">{{ JSON.stringify(row.content, null, 2) }}</pre>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="240" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ ruleTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="severity" label="级别" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="severityTagType(row.severity)">{{ severityLabel(row.severity) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="200" show-overflow-tooltip />
        <el-table-column prop="create_time" label="时间" width="180">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
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
        @current-change="fetchData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AlertEvent } from '@/api/alert'
import { listEventsApi } from '@/api/alert'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const list = ref<AlertEvent[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filters = reactive({ type: '', severity: '', status: '' })
let pollTimer: number | null = null

const ruleTypeLabel = (t: string) => {
  const m: Record<string, string> = {
    resource_change: '资源变更', sync_failure: '同步失败',
    expiration: '资源过期', security_group: '安全组变更',
  }
  return m[t] || t
}
const severityLabel = (s: string) => {
  const m: Record<string, string> = { info: '信息', warning: '警告', critical: '严重' }
  return m[s] || s
}
const severityTagType = (s: string) => {
  const m: Record<string, string> = { info: '', warning: 'warning', critical: 'danger' }
  return (m[s] || '') as any
}
const statusLabel = (s: string) => {
  const m: Record<string, string> = { pending: '待发送', sent: '已发送', failed: '发送失败', silenced: '已静默' }
  return m[s] || s
}
const statusTagType = (s: string) => {
  const m: Record<string, string> = { pending: 'info', sent: 'success', failed: 'danger', silenced: 'warning' }
  return (m[s] || '') as any
}
const formatTime = (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-'

const fetchData = async () => {
  loading.value = true
  try {
    const params: any = { offset: (page.value - 1) * pageSize, limit: pageSize }
    if (filters.type) params.type = filters.type
    if (filters.severity) params.severity = filters.severity
    if (filters.status) params.status = filters.status
    const res = await listEventsApi(params)
    list.value = (res as any).data?.items || []
    total.value = (res as any).data?.total || 0
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const handleExpand = () => { /* expand handled by el-table */ }

onMounted(() => {
  fetchData()
  // 30秒轮询
  pollTimer = window.setInterval(fetchData, 30000)
})
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
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
  margin-left: auto;
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
}
.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 8px;
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
.event-detail {
  padding: 16px 24px;
}
.event-content {
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 8px;
  padding: 16px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary, #303133);
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
