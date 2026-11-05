<template>
  <div class="events-page">
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">统一审计事件</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ statText(pagination.total) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!errorInfo" class="filter-section">
      <div class="filter-row">
        <el-select v-model="filters.service" placeholder="全部服务" clearable class="filter-select" @change="handleFilterChange">
          <el-option label="云管服务" value="e-cam-service" />
          <!-- IAM 事件落 e-iam 自有库（e-iam#5/#6），联邦检索未接入前该选项必空；
               禁用以免运维误以为筛选失效。联邦方案定稿后移除 disabled。 -->
          <el-option label="IAM 服务（联邦待接入）" value="e-iam" disabled />
        </el-select>
        <el-select v-model="filters.domain" placeholder="全部业务域" clearable class="filter-select" @change="handleFilterChange">
          <el-option label="操作审计" value="audit" />
          <el-option label="管理操作" value="operation" />
          <el-option label="认证安全" value="auth" />
          <el-option label="资产变更" value="change" />
        </el-select>
        <el-select v-model="filters.result" placeholder="全部结果" clearable class="filter-select" @change="handleFilterChange">
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
          <el-option label="部分成功" value="partial" />
        </el-select>
        <el-input
          v-model="filters.action"
          placeholder="动作（create/update/delete…）"
          clearable
          class="filter-input"
          @change="handleFilterChange"
        />
        <el-input
          v-model="filters.actor_id"
          placeholder="操作者ID"
          clearable
          class="filter-input"
          @change="handleFilterChange"
        />
        <el-input
          v-model="filters.resource_type"
          placeholder="资源类型（api/ecs/change_order…）"
          clearable
          class="filter-input"
          @change="handleFilterChange"
        />
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="x"
          class="filter-date"
          @change="handleDateChange"
        />
        <el-button @click="handleReset">重置</el-button>
        <el-button :loading="loading" circle title="刷新" aria-label="刷新统一审计事件列表" @click="fetchEvents">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <ErrorDisplay v-if="errorInfo" :error-info="errorInfo" @retry="fetchEvents" />

    <div v-else class="table-wrapper">
      <el-table :data="events" v-loading="loading" empty-text="暂无审计事件">
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatMs(row.at) }}</template>
        </el-table-column>
        <el-table-column label="来源" width="150">
          <template #default="{ row }">
            <span class="mono">{{ row.service }} / {{ domainLabel(row.domain) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="动作" width="110">
          <template #default="{ row }"><span class="mono">{{ row.action }}</span></template>
        </el-table-column>
        <el-table-column label="操作者" width="140">
          <template #default="{ row }">{{ row.actor_name || row.actor_id || '-' }}</template>
        </el-table-column>
        <el-table-column label="资源" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="mono">{{ row.resource_type }}{{ row.resource_id ? ':' + row.resource_id : '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="resultTagType(row.result)" size="small">{{ resultLabel(row.result) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态码" width="80">
          <template #default="{ row }">{{ row.status_code || '-' }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="90">
          <template #default="{ row }">{{ row.duration_ms != null && row.duration_ms !== 0 ? row.duration_ms + 'ms' : '-' }}</template>
        </el-table-column>
      </el-table>

      <div v-if="pagination.total > 0" class="pagination-bar">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="fetchEvents"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AuditEvent, AuditEventParams } from '@/api/audit'
import { listAuditEventsApi } from '@/api/audit'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { useListError } from '@/composables/useListError'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { useStatText } from '@/composables/useStatText'
import { Refresh } from '@element-plus/icons-vue'
import { onMounted, reactive, ref, watch } from 'vue'

// 筛选与页码同步 URL（沿用项目既有 useUrlFilters；本页从第一版就接入）
const urlState = reactive<Record<string, string | undefined>>({
  service: undefined,
  domain: undefined,
  result: undefined,
  action: undefined,
  actor_id: undefined,
  resource_type: undefined,
  start: undefined,
  end: undefined,
  page: undefined,
})
useUrlFilters(urlState)

const loading = ref(false)
const events = ref<AuditEvent[]>([])
const pagination = reactive({ page: 1, size: 20, total: 0 })
const { errorInfo, run } = useListError()
const { statText } = useStatText()

const filters = reactive({
  service: '',
  domain: '',
  result: '',
  action: '',
  actor_id: '',
  resource_type: '',
})
// 时间范围在 URL 里是 start/end 毫秒字符串；dateRange 是控件态
const dateRange = ref<[string, string] | null>(null)

// URL 回填 → 控件态（dateRange 从 start/end 重建）
if (urlState.service) filters.service = urlState.service
if (urlState.domain) filters.domain = urlState.domain
if (urlState.result) filters.result = urlState.result
if (urlState.action) filters.action = urlState.action
if (urlState.actor_id) filters.actor_id = urlState.actor_id
if (urlState.resource_type) filters.resource_type = urlState.resource_type
if (urlState.start && urlState.end) dateRange.value = [urlState.start, urlState.end]
if (urlState.page && Number(urlState.page) > 0) pagination.page = Number(urlState.page)

// 状态变化 → 写回 URL（空值置 undefined，composable 会删 key）
watch(
  () => [
    filters.service, filters.domain, filters.result, filters.action, filters.actor_id,
    filters.resource_type,
    dateRange.value?.[0] ?? '', dateRange.value?.[1] ?? '', pagination.page,
  ].join('|'),
  () => {
    urlState.service = filters.service || undefined
    urlState.domain = filters.domain || undefined
    urlState.result = filters.result || undefined
    urlState.action = filters.action || undefined
    urlState.actor_id = filters.actor_id || undefined
    urlState.resource_type = filters.resource_type || undefined
    urlState.start = dateRange.value?.[0] || undefined
    urlState.end = dateRange.value?.[1] || undefined
    urlState.page = pagination.page > 1 ? String(pagination.page) : undefined
  },
)

const buildParams = (): AuditEventParams => {
  const p: AuditEventParams = {
    offset: (pagination.page - 1) * pagination.size,
    limit: pagination.size,
  }
  if (filters.service) p.service = filters.service
  if (filters.domain) p.domain = filters.domain
  if (filters.result) p.result = filters.result
  if (filters.action) p.action = filters.action
  if (filters.actor_id) p.actor_id = filters.actor_id
  if (filters.resource_type) p.resource_type = filters.resource_type
  if (dateRange.value?.[0]) p.start_time = Number(dateRange.value[0])
  if (dateRange.value?.[1]) p.end_time = Number(dateRange.value[1])
  return p
}

const fetchEvents = async () => {
  loading.value = true
  try {
    // 失败时由 useListError 置持久错误态（含重试），不再只靠瞬时 toast
    const res = await run(() => listAuditEventsApi(buildParams()), '获取统一审计事件失败')
    if (res === undefined) return
    events.value = res.data?.items || []
    pagination.total = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

const domainLabel = (d: string) =>
  ({ audit: '操作审计', operation: '管理操作', auth: '认证安全', change: '资产变更' })[d] || d
const resultLabel = (r: string) => ({ success: '成功', failed: '失败', partial: '部分成功' })[r] || r
const resultTagType = (r: string) => (r === 'success' ? 'success' : r === 'partial' ? 'warning' : 'danger')
const formatMs = (ms: number) => (ms ? new Date(ms).toLocaleString('zh-CN') : '-')

const handleFilterChange = () => {
  pagination.page = 1
  fetchEvents()
}
const handleDateChange = () => handleFilterChange()
const handleSizeChange = () => {
  pagination.page = 1
  fetchEvents()
}
const handleReset = () => {
  filters.service = ''
  filters.domain = ''
  filters.result = ''
  filters.action = ''
  filters.actor_id = ''
  filters.resource_type = ''
  dateRange.value = null
  pagination.page = 1
  fetchEvents()
}

onMounted(fetchEvents)
</script>

<style lang="scss" scoped>
.events-page {
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
  flex-wrap: wrap;
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
  .stat-num { font-size: 16px; font-weight: 600; color: var(--text-primary); }
}

.filter-section {
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-select { width: 150px; }
.filter-input { width: 190px; }
.filter-date { width: 340px; }

.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--bg-elevated);
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  position: sticky;
  bottom: 0;
}

.mono { font-family: var(--font-mono); font-size: 12px; }
</style>
