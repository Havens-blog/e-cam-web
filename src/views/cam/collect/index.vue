<template>
  <PageContainer>
    <ManagerHeader
      title="采集管理"
      subtitle="手动触发云账单数据采集"
      :show-add-button="false"
      @refresh="refreshLogs"
    />

    <!-- 触发采集 -->
    <div class="collect-trigger">
      <el-form :inline="true" :model="collectForm" class="collect-form">
        <el-form-item label="云账号" required>
          <el-select
            v-model="collectForm.account_id"
            placeholder="选择云账号"
            filterable
            style="width: 200px"
          >
            <el-option
              v-for="a in accountOptions"
              :key="a.value"
              :label="a.label"
              :value="a.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="账期范围" required>
          <el-date-picker
            v-model="collectDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :shortcuts="dateShortcuts"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="collecting" @click="handleCollect">
            触发采集
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 采集日志 -->
    <div class="logs-section">
      <div class="section-header">
        <div class="section-title-group">
          <span class="section-title">采集日志</span>
          <span class="logs-total">共 {{ total }} 条</span>
        </div>
        <div class="section-actions">
          <span v-if="lastLoadedAt" class="last-loaded">更新于 {{ formatDateTime(lastLoadedAt) }}</span>
          <el-button size="small" :loading="exporting" @click="exportLogs">导出 CSV</el-button>
          <el-button size="small" circle @click="refreshLogs" title="刷新">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>
      <div v-if="logsLoadFailed" class="logs-error" role="alert">
        <span>
          {{
            isPolling
              ? '采集日志刷新失败，已保留上次数据，将自动重试。'
              : '采集日志刷新失败，已保留上次数据，请点击「立即重试」。'
          }}
        </span>
        <el-button link type="primary" size="small" @click="fetchLogs()">立即重试</el-button>
      </div>
      <div v-if="runningSummary && runningSummary.count > 0" class="running-summary">
        <span role="status" aria-live="polite" aria-atomic="true"
          >运行中 <strong>{{ runningSummary.count }}</strong> 条<template
            v-if="runningSummary.maxElapsedText"
          >，最长已运行 <strong>{{ runningSummary.maxElapsedText }}</strong></template></span
        >
        <el-button
          v-if="filters.status !== 'running'"
          link
          type="primary"
          size="small"
          @click="showRunningOnly"
        >
          只看运行中
        </el-button>
      </div>

      <div class="logs-filters">
        <el-select
          v-model="filters.account_id"
          placeholder="全部账号"
          aria-label="按账号筛选"
          clearable
          filterable
          style="width: 200px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="a in accountOptions"
            :key="a.value"
            :label="a.label"
            :value="a.value"
          />
        </el-select>
        <el-select
          v-model="filters.status"
          placeholder="全部状态"
          aria-label="按状态筛选"
          clearable
          style="width: 140px"
          @change="handleFilterChange"
        >
          <el-option label="运行中" value="running" />
          <el-option label="成功" value="success" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-button v-if="filtersActive" link type="primary" @click="resetFilters">清空筛选</el-button>
      </div>
      <el-table :data="logs" v-loading="logsLoading" stripe style="width: 100%">
        <el-table-column label="账号" min-width="140">
          <template #default="{ row }">
            <div class="account-cell">
              <span class="account-name" :title="accountDisplayName(row.account_id, accountNames)">{{ accountDisplayName(row.account_id, accountNames) }}</span>
              <span class="account-id">#{{ row.account_id }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="provider" label="云厂商" width="100">
          <template #default="{ row }">
            {{ getProviderLabel(row.provider) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账期范围" width="220">
          <template #default="{ row }">
            {{ formatDate(row.bill_start) }} ~ {{ formatDate(row.bill_end) }}
          </template>
        </el-table-column>
        <el-table-column prop="record_count" label="记录数" width="100" />
        <el-table-column label="耗时" width="150">
          <template #default="{ row }">
            <span :class="{ 'elapsed-running': row.status === 'running' }">{{ formatElapsed(row, nowMs) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="error_msg" label="错误信息" min-width="150" show-overflow-tooltip />
        <el-table-column label="采集时间" width="180">
          <template #default="{ row }">
            {{ formatCollectStartedAt(row) }}
          </template>
        </el-table-column>
        <template #empty>
          <el-empty
            :description="logsLoadFailed ? '采集日志加载失败' : filtersActive ? '没有匹配的采集记录' : '暂无采集记录'"
            :image-size="60"
          >
            <el-button v-if="logsLoadFailed" size="small" @click="fetchLogs()">重试</el-button>
            <el-button v-else-if="filtersActive" size="small" @click="resetFilters">清空筛选</el-button>
          </el-empty>
        </template>
      </el-table>
      <div class="pagination-wrap" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import { listCollectLogsApi, triggerCollectApi } from '@/api/finops'
import type { CollectLogStatus } from '@/api/finops'
import type { CollectLog } from '@/api/types/finops'
import { ManagerHeader } from '@haven/ui/ManagerHeader'
import PageContainer from '@/components/PageContainer/index.vue'
import { getProviderLabel } from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { accountDisplayName, buildCollectLogQuery, clampPage, hasActiveFilters } from './filters'
import { formatCollectStartedAt, formatDateTime, formatElapsed, summarizeRunningLogs } from './format'
import { buildCollectLogCsv, exportFileName, EXPORT_MAX_ROWS } from './export'

const collectForm = reactive({ account_id: undefined as number | undefined })
const collectDateRange = ref<[string, string] | null>(null)
const collecting = ref(false)
const exporting = ref(false)

const accountOptions = ref<{ value: number; label: string }[]>([])
const accountNames = ref<Record<number, string>>({})

const logs = ref<CollectLog[]>([])
const logsLoading = ref(false)
const logsLoadFailed = ref(false)
const isPolling = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
/** 日志筛选：账号 / 状态（后端已支持，空值表示不过滤） */
const filters = reactive<{ account_id?: number; status?: CollectLogStatus }>({
  account_id: undefined,
  status: undefined
})
const filtersActive = computed(() => hasActiveFilters(filters))
/** 渲染用「当前时间」：每次日志拉取成功刷新，驱动「已运行 X分YY秒」更新 */
const nowMs = ref(Date.now())
const lastLoadedAt = ref(0)
/** 运行中任务汇总（全局口径，不随列表筛选变化） */
const runningSummary = ref<{ count: number; maxElapsedText: string } | null>(null)
let summaryFetchedAt = 0

let pollTimer: ReturnType<typeof setTimeout> | null = null
/** 手动触发采集后的轮询宽限期：任务排队期间还没有 running 日志也不能停轮询 */
let pollDeadline = 0
/** 请求序号：丢弃过期响应，避免翻页/刷新与轮询竞态 */
let fetchSeq = 0
let errorNotified = false
/** 轮询开启状态（与具体 timer 解耦，便于退避与卸载清理） */
let polling = false
/** 当前轮询间隔：连续失败时指数退避，避免每 5s 一次失败请求与弹窗 */
let pollDelay = 0
/** 组件已卸载标记：阻止在途响应/延时回调重建 timer */
let disposed = false
/** 手动触发后的一次性补拉，需在卸载时清理 */
let retryTimer: ReturnType<typeof setTimeout> | null = null
/** 轮询世代：start/stop 时自增，避免 await 后旧链路再排一条 timer */
let pollGeneration = 0

const POLL_INTERVAL_MS = 5000
const POLL_MAX_BACKOFF_MS = 60_000
const POLL_GRACE_MS = 3 * 60 * 1000

const dateShortcuts = [
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth(), 1), now]
    }
  },
  {
    text: '上月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)]
    }
  },
  {
    text: '近3个月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 3, 1), now]
    }
  }
]

const statusType = (s: string) => {
  if (s === 'success') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'running') return 'warning'
  return 'info'
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = { success: '成功', failed: '失败', running: '运行中' }
  return map[s] || s
}

/**
 * 账期按后端原样日期展示（保持既有行为，不做时区换算）。
 * bill_start/bill_end 的口径由写入方决定（定时采集为增量窗口、补采脚本为本地月边界），
 * 统一口径属后端后续事项，前端不在展示层猜测。
 */
const formatDate = (v: string) => {
  if (!v) return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10)
}

const handleCollect = async () => {
  if (!collectForm.account_id) {
    ElMessage.warning('请选择云账号')
    return
  }
  if (!collectDateRange.value) {
    ElMessage.warning('请选择账期范围')
    return
  }
  collecting.value = true
  try {
    const [start, end] = collectDateRange.value
    await triggerCollectApi({
      account_id: collectForm.account_id,
      start_date: start,
      end_date: end
    })
    ElMessage.success('采集任务已提交，后台执行中')
    // 任务由队列异步执行：立即进入轮询宽限期，避免任务尚未落日志时停止轮询
    pollDeadline = Date.now() + POLL_GRACE_MS
    startPolling()
    retryTimer = setTimeout(() => {
      retryTimer = null
      if (!disposed) fetchLogs({ silent: true })
    }, 1000)
  } catch (e: any) {
    ElMessage.error(e.message || '触发采集失败')
  } finally {
    collecting.value = false
  }
}

const fetchLogs = async (options: { silent?: boolean } = {}) => {
  if (disposed) return
  const seq = ++fetchSeq
  if (!options.silent) logsLoading.value = true
  try {
    const res = await listCollectLogsApi(
      buildCollectLogQuery(filters, currentPage.value, pageSize)
    )
    if (disposed || seq !== fetchSeq) return
    const data = (res as any).data || res
    logs.value = data.items || []
    total.value = data.total || 0
    nowMs.value = Date.now()
    lastLoadedAt.value = nowMs.value
    // 列表刷新后顺带刷新汇总（60s 节流，不额外打请求）
    void fetchRunningSummary()
    logsLoadFailed.value = false
    errorNotified = false
    pollDelay = POLL_INTERVAL_MS
    // 总数缩小（如 running 收敛）导致当前页越界时收敛页码并重取，避免空表 + 分页消失
    const clampedPage = clampPage(currentPage.value, total.value, pageSize)
    if (clampedPage !== currentPage.value) {
      currentPage.value = clampedPage
      void fetchLogs({ silent: options.silent })
      return
    }
    void syncPolling()
  } catch {
    if (disposed || seq !== fetchSeq) return
    // 轮询失败不清空已有日志，保留上一次成功结果并提示可恢复
    logsLoadFailed.value = true
    // 静默轮询失败时退避，避免持续故障下每 5s 一次的请求与弹窗
    if (options.silent) {
      pollDelay = Math.min(Math.max(pollDelay * 2, POLL_INTERVAL_MS * 2), POLL_MAX_BACKOFF_MS)
    }
    if (!errorNotified) {
      ElMessage.error('获取采集日志失败')
      errorNotified = true
    }
  } finally {
    if (seq === fetchSeq) logsLoading.value = false
  }
}

const hasRunningLog = () => logs.value.some((l) => l.status === 'running')

/**
 * 后端是否仍有运行中的采集任务。
 * 当前筛选/页码可能看不到 running 行（如筛「失败」或翻到第 2 页），
 * 不能据此停止轮询；用 status=running&limit=1 轻探针判断。
 * 探针失败时返回 true（宁可多轮询，也不静默停止）。
 */
const probeBackendRunning = async (): Promise<boolean> => {
  try {
    const query: { status: 'running'; offset: number; limit: number; account_id?: number } = {
      status: 'running',
      offset: 0,
      limit: 1
    }
    if (filters.account_id) query.account_id = filters.account_id
    const res = await listCollectLogsApi(query)
    const data = (res as any).data || res
    return Number(data.total || 0) > 0
  } catch {
    return true
  }
}

const syncPolling = async () => {
  if (Date.now() < pollDeadline || hasRunningLog()) {
    startPolling()
    return
  }
  if (disposed) return
  const at = fetchSeq
  const backendRunning = await probeBackendRunning()
  // 探针在途期间若发生新的 fetch（切筛选/翻页），丢弃旧结论，避免误停轮询
  if (disposed || at !== fetchSeq) return
  if (backendRunning) {
    startPolling()
  } else {
    stopPolling()
  }
}

const schedulePoll = () => {
  if (!polling || disposed) return
  const generation = pollGeneration
  pollTimer = setTimeout(async () => {
    pollTimer = null
    await fetchLogs({ silent: true })
    // 等待期间 start/stop 过（筛选切换、卸载等）则不再续排，避免形成第二条 timer 链
    if (generation !== pollGeneration) return
    schedulePoll()
  }, pollDelay || POLL_INTERVAL_MS)
}

/** 导出当前筛选下的采集日志（上限 EXPORT_MAX_ROWS 条，带 BOM） */
const exportLogs = async () => {
  if (exporting.value) return
  exporting.value = true
  try {
    const rows: CollectLog[] = []
    let offset = 0
    const limit = 200
    let totalCount = 0
    while (rows.length < EXPORT_MAX_ROWS) {
      const res = await listCollectLogsApi({
        ...buildCollectLogQuery(filters, 1, limit),
        offset,
        limit
      })
      const data = (res as any).data || res
      const items = data.items || []
      totalCount = Number(data.total ?? items.length)
      rows.push(...items)
      if (items.length < limit || rows.length >= totalCount) break
      offset += limit
    }
    const capped = rows.slice(0, EXPORT_MAX_ROWS)
    const csv = buildCollectLogCsv(capped, {
      accountNames: accountNames.value,
      providerLabel: getProviderLabel
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    if (totalCount > capped.length) {
      ElMessage.warning(`共 ${totalCount} 条，仅导出前 ${capped.length} 条`)
    } else {
      ElMessage.success(`已导出 ${capped.length} 条`)
    }
  } catch {
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

/** 全局运行中任务汇总：独立于列表筛选；默认 60s 内不重复请求（手动刷新强制） */
let summarySeq = 0
let summaryInflight: Promise<void> | null = null
const fetchRunningSummary = (force = false): Promise<void> => {
  if (disposed) return Promise.resolve()
  if (!force && Date.now() - summaryFetchedAt < 60_000) return Promise.resolve()
  // 在途复用：挂载/刷新/筛选可能同时触发，避免重复 GET
  if (summaryInflight) return summaryInflight
  const seq = ++summarySeq
  summaryInflight = (async () => {
    try {
      const res = await listCollectLogsApi({ status: 'running', offset: 0, limit: 200 })
      if (disposed || seq !== summarySeq) return
      const data = (res as any).data || res
      const s = summarizeRunningLogs(data.items || [])
      // 数量用后端 total（items 只是时长采样，limit=200 时可能不全）
      const total = Number(data.total)
      runningSummary.value = {
        count: Number.isFinite(total) && total >= 0 ? total : s.count,
        maxElapsedText: s.maxElapsedText
      }
    } catch {
      // 失败保留上次值；finally 仍推进尝试时间，避免轮询下每 5s 重试
    } finally {
      if (seq === summarySeq) summaryFetchedAt = Date.now()
      summaryInflight = null
    }
  })()
  return summaryInflight
}

/** 手动刷新：日志 + 运行中汇总 */
const refreshLogs = () => {
  fetchLogs()
  void fetchRunningSummary(true)
}

/** 只看运行中（复用既有筛选） */
const showRunningOnly = () => {
  filters.status = 'running'
  currentPage.value = 1
  void fetchLogs()
  void fetchRunningSummary(true)
}

const startPolling = () => {
  if (polling || disposed) return
  polling = true
  isPolling.value = true
  pollGeneration++
  if (!pollDelay) pollDelay = POLL_INTERVAL_MS
  schedulePoll()
}

const stopPolling = () => {
  polling = false
  isPolling.value = false
  pollGeneration++
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

const handlePageChange = () => {
  fetchLogs()
}

/** 筛选变化：回到第 1 页重新查询（轮询沿用同一筛选条件） */
const handleFilterChange = () => {
  currentPage.value = 1
  fetchLogs()
}

const resetFilters = () => {
  filters.account_id = undefined
  filters.status = undefined
  currentPage.value = 1
  fetchLogs()
}

// 账号下拉最多取 100 个（当前环境 5 个）；超出部分日志行会显示「未知账号」，后续按 total 分页加载
const fetchAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ limit: 100, offset: 0 })
    const data = (res as any).data || res
    const list = data.accounts || data.items || []
    const names: Record<number, string> = {}
    list.forEach((a: any) => {
      names[a.id] = a.name
    })
    accountNames.value = names
    accountOptions.value = list.map((a: any) => ({
      value: a.id,
      label: `${a.name} (${getProviderLabel(a.provider)})`
    }))
  } catch {
    ElMessage.error('获取云账号列表失败')
    accountOptions.value = []
  }
}

onMounted(() => {
  fetchAccounts()
  fetchLogs()
  void fetchRunningSummary(true)
})

onUnmounted(() => {
  disposed = true
  stopPolling()
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  // 卸载后让在途响应失效
  fetchSeq++
})
</script>

<style scoped lang="scss">
.collect-trigger {
  padding: 16px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  margin-bottom: 16px;

  .collect-form {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;

    :deep(.el-form-item) {
      margin-bottom: 0;
      margin-right: 0;
    }
  }
}

.logs-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .section-title-group {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .logs-total {
      font-size: 12px;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .section-actions {
      display: flex;
      align-items: center;
      gap: 12px;

      .last-loaded {
        font-size: 12px;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .running-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-color-warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--el-color-warning) 35%, transparent);
  color: var(--text-secondary);
  font-size: 13px;

  strong {
    color: var(--text-primary);
  }
}

.logs-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .account-cell {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;

    .account-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .account-id {
      flex: none;
      font-size: 12px;
      color: var(--text-tertiary);
      font-variant-numeric: tabular-nums;
    }
  }

  .logs-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border-subtle);
    border-left: 3px solid var(--el-color-danger);
    border-radius: 8px;
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-size: 13px;
  }
}

.elapsed-running {
  color: var(--el-color-warning);
  font-variant-numeric: tabular-nums;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
