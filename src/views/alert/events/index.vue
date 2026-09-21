<template>
  <PageContainer class="events-page">
    <template #header>
      <div class="page-header">
        <h2 class="page-title">告警事件</h2>
        <div class="stat-badge">
          <span class="stat-label">总数</span>
          <span class="stat-num">{{ total }}</span>
        </div>
      </div>
    </template>

    <!-- 筛选区（三下拉等价旧页 action-bar 左侧，@change 重拉不重置页码） -->
    <template #filters>
      <div class="filters-bar">
        <div class="filters-bar__fields">
          <el-select
            v-model="filters.type"
            placeholder="全部类型"
            clearable
            size="small"
            style="width: 140px"
            @change="refresh"
          >
            <el-option label="资源变更" value="resource_change" />
            <el-option label="同步失败" value="sync_failure" />
            <el-option label="资源过期" value="expiration" />
            <el-option label="安全组变更" value="security_group" />
          </el-select>
          <el-select
            v-model="filters.severity"
            placeholder="全部级别"
            clearable
            size="small"
            style="width: 120px"
            @change="refresh"
          >
            <el-option label="信息" value="info" />
            <el-option label="警告" value="warning" />
            <el-option label="严重" value="critical" />
          </el-select>
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            size="small"
            style="width: 120px"
            @change="refresh"
          >
            <el-option label="待发送" value="pending" />
            <el-option label="已发送" value="sent" />
            <el-option label="发送失败" value="failed" />
            <el-option label="已静默" value="silenced" />
          </el-select>
        </div>
        <el-button size="small" circle title="刷新" @click="refresh">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </template>

    <!-- 密度切换（规格指定增强） -->
    <div class="table-toolbar">
      <span class="table-toolbar__label">密度</span>
      <el-button
        size="small"
        :type="density === 'default' ? 'primary' : undefined"
        @click="density = 'default'"
      >
        默认
      </el-button>
      <el-button
        size="small"
        :type="density === 'compact' ? 'primary' : undefined"
        @click="density = 'compact'"
      >
        紧凑
      </el-button>
    </div>

    <!-- 事件表格（DataTable fetch 模式：三态/展开行由组件内置承载） -->
    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchEvents"
      expandable
      :density="density"
      max-height="calc(100vh - 24rem)"
      stripe
      row-key="id"
    >
      <template #type="{ row }">
        <el-tag size="small">{{ ruleTypeLabel(row.type) }}</el-tag>
      </template>
      <template #severity="{ row }">
        <el-tag size="small" :type="severityTagType(row.severity)">
          {{ severityLabel(row.severity) }}
        </el-tag>
      </template>
      <template #status="{ row }">
        <el-tag size="small" :type="statusTagType(row.status)">
          {{ statusLabel(row.status) }}
        </el-tag>
      </template>
      <template #expand="{ row }">
        <div class="event-detail">
          <pre class="event-content">{{ JSON.stringify(row.content, null, 2) }}</pre>
        </div>
      </template>
    </DataTable>

    <!-- 底部分页（等价旧页 total/prev/pager/next，page-size 固定 20） -->
    <template #footer>
      <el-pagination
        v-model:current-page="page"
        :page-size="PAGE_SIZE"
        :total="total"
        layout="total, prev, pager, next"
        small
        @current-change="refresh"
      />
    </template>
  </PageContainer>
</template>

<script setup lang="ts">
import type { AlertEvent, AlertEventStatus, AlertRuleType, AlertSeverity } from '@/api/alert'
import { listEventsApi } from '@/api/alert'
import DataTable from '@/components/DataTable/index.vue'
import type { DataTableColumn, DataTableDensity } from '@/components/DataTable/types'
import PageContainer from '@/components/PageContainer/index.vue'
import { Refresh } from '@element-plus/icons-vue'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const PAGE_SIZE = 20

// ==================== 筛选（等价旧页三下拉，@change 重拉不重置页码） ====================

interface EventFilters {
  type: '' | AlertRuleType
  severity: '' | AlertSeverity
  status: '' | AlertEventStatus
}

const filters = reactive<EventFilters>({ type: '', severity: '', status: '' })

// ==================== 列表（DataTable fetch 模式：三态由组件内置承载） ====================

const tableRef = ref<{ refresh: () => Promise<void> } | null>(null)

/** 表格密度（规格指定增强：default=默认行高 / compact=紧凑） */
const density = ref<DataTableDensity>('default')

const page = ref(1)
const total = ref(0)

/** 列配置：与旧页列结构逐列等价（expand 列由 DataTable expandable 承载） */
const columns: DataTableColumn<AlertEvent>[] = [
  { prop: 'title', label: '标题', minWidth: 240, showOverflowTooltip: true },
  { prop: 'type', label: '类型', width: 120, slot: 'type' },
  { prop: 'severity', label: '级别', width: 90, slot: 'severity' },
  { prop: 'status', label: '状态', width: 100, slot: 'status' },
  { prop: 'source', label: '来源', width: 200, showOverflowTooltip: true },
  {
    prop: 'create_time',
    label: '时间',
    width: 180,
    formatter: (_row, _column, cellValue) => formatTime(cellValue as string),
  },
]

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
  const m: Record<string, string> = { info: 'info', warning: 'warning', critical: 'danger' }
  return (m[s] || 'info') as 'info' | 'warning' | 'danger'
}
const statusLabel = (s: string) => {
  const m: Record<string, string> = { pending: '待发送', sent: '已发送', failed: '发送失败', silenced: '已静默' }
  return m[s] || s
}
const statusTagType = (s: string) => {
  const m: Record<string, string> = { pending: 'info', sent: 'success', failed: 'danger', silenced: 'warning' }
  return (m[s] || 'info') as 'info' | 'success' | 'danger' | 'warning'
}
const formatTime = (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '-')

/** 事件拉取（挂载即由 DataTable 调起；分页与筛选在调用时读取最新值） */
const fetchEvents = async (): Promise<AlertEvent[]> => {
  const params: {
    offset: number
    limit: number
    type?: AlertRuleType
    severity?: AlertSeverity
    status?: AlertEventStatus
  } = { offset: (page.value - 1) * PAGE_SIZE, limit: PAGE_SIZE }
  if (filters.type) params.type = filters.type
  if (filters.severity) params.severity = filters.severity
  if (filters.status) params.status = filters.status
  const { data } = await listEventsApi(params)
  total.value = data.total || 0
  return data.items || []
}

/** 重拉当前页（筛选变更/刷新/翻页/轮询共用；等价旧页 fetchData） */
const refresh = () => {
  void tableRef.value?.refresh()
}

// ==================== 30s 轮询（等价旧页 pollTimer） ====================

let pollTimer: number | null = null

onMounted(() => {
  pollTimer = window.setInterval(refresh, 30000)
})
onUnmounted(() => {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  .page-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--text-primary);
  }
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 13px;
  background: var(--glass-bg);
  border-radius: 20px;

  .stat-label { color: var(--text-secondary); }
  .stat-num { font-weight: 600; color: var(--text-primary); }
}

.filters-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  &__fields {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  &__label { font-size: 12px; color: var(--text-tertiary); }
}

.event-detail {
  padding: 16px 24px;
}

.event-content {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--glass-bg);
  border-radius: 8px;
}
</style>
