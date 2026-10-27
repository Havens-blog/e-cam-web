<template>
  <div class="tasks-page">
    <!-- 页面头部：标题 + 刷新（主机页紧凑标准，去 PageContainer/ManagerHeader 旧壳） -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">任务管理</h1>
        <div class="page-actions">
          <el-button size="small" circle @click="refreshAll" title="刷新">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <div class="tasks-content">
      <!-- 队列概览：全部/待执行/执行中/已完成/失败，点击即筛选 -->
      <div class="queue-summary" role="group" aria-label="队列概览">
        <button
          v-for="item in TASK_SUMMARY_STATUSES"
          :key="item.key"
          type="button"
          class="summary-chip"
          :class="{ active: activeSummaryKey === item.key }"
          :aria-pressed="activeSummaryKey === item.key"
          @click="applyStatusFilter(item.status)"
        >
          <span class="summary-label">{{ item.label }}</span>
          <span class="summary-count">{{ summary[item.key] }}</span>
        </button>
        <span v-if="backlog" class="backlog-hint">
          队列积压：待执行 {{ summary.pending }} · 执行中 {{ summary.running }}
          <span v-if="oldestPendingText && summary.pending > 0" class="oldest-wait"
            >· 最老等待 {{ oldestPendingText }}</span
          >
        </span>
        <el-button v-if="filtersActive" link type="primary" size="small" @click="clearFilters">
          清空筛选
        </el-button>
      </div>

      <!-- 筛选器 -->
      <div class="filters-container">
        <el-form :inline="true" class="filters-form">
          <el-form-item label="任务类型">
            <el-select
              v-model="filters.type"
              placeholder="全部类型"
              clearable
              @change="handleTypeChange"
            >
              <el-option
                v-for="opt in TASK_TYPE_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="任务状态">
            <el-select
              v-model="filters.status"
              placeholder="全部状态"
              clearable
              @change="handleStatusChange"
            >
              <el-option
                v-for="opt in TASK_STATUS_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <!-- 任务列表 -->
      <div v-loading="loading" class="tasks-list">
        <template v-if="tasks.length > 0">
          <TaskCard
            v-for="task in tasks"
            :key="task.id"
            :task="task"
            :action-task-id="actionTaskId"
            @view="handleView"
            @cancel="handleCancel"
            @delete="handleDelete"
          />
        </template>
        <el-empty v-else description="暂无任务" />
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" ref="paginationContainer" class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="paginationUi.layout"
          :pager-count="paginationUi.pagerCount"
          :size="paginationUi.small ? 'small' : 'default'"
          @size-change="handlePageSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cancelTaskApi, deleteTaskApi, listTasksApi } from '@/api'
import type { Task } from '@/api/types/task'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import TaskCard from './components/TaskCard.vue'
import { oldestPendingWaitText } from './queue'
import { paginationUiForContentWidth } from './pagination'
import {
  buildTaskQuery,
  EMPTY_TASK_SUMMARY,
  hasBacklog,
  TASK_STATUS_OPTIONS,
  TASK_SUMMARY_STATUSES,
  TASK_TYPE_OPTIONS,
  type TaskFilters,
  type TaskSummary,
} from './taskFilters'

const router = useRouter()

// 状态
const loading = ref(false)
const tasks = ref<Task[]>([])
// 防重复提交：正在执行取消/删除的任务 id（请求期间禁用所有卡片操作按钮）
const actionTaskId = ref<string>('')
const filters = reactive<TaskFilters>({
  type: undefined,
  status: undefined,
})
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})
/** 队列概览（全部/待执行/执行中/已完成/失败） */
const summary = reactive<TaskSummary>({ ...EMPTY_TASK_SUMMARY })
const activeSummaryKey = computed(() => filters.status || 'all')
const backlog = computed(() => hasBacklog(summary))
/** 最老待执行任务的等待时长（全局口径，帮助判断队列饿死程度） */
const oldestPendingText = ref('')
const filtersActive = computed(() => Boolean(filters.type || filters.status))

// 自动刷新
let refreshTimer: number | null = null
let summaryTick = 0
let disposed = false
let listSeq = 0
let summarySeq = 0

// 获取任务列表（silent：自动刷新时不显示整页 loading）
const fetchTasks = async (options: { silent?: boolean } = {}) => {
  const seq = ++listSeq
  if (!options.silent) loading.value = true
  try {
    const { data } = await listTasksApi(buildTaskQuery(filters, pagination.page, pagination.size))
    if (disposed || seq !== listSeq) return
    tasks.value = data.tasks || []
    pagination.total = data.total || 0
    void fetchOldestPending()
  } catch (error: any) {
    if (disposed || seq !== listSeq) return
    ElMessage.error(error.message || '获取任务列表失败')
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

// 获取队列概览：仅取各状态 total（limit=1，避免拉明细）
const fetchSummary = async () => {
  const seq = ++summarySeq
  // 概览跟随类型筛选：type 变化时 chip 计数与列表 total 语义一致
  const results = await Promise.allSettled(
    TASK_SUMMARY_STATUSES.map((item) =>
      listTasksApi({ type: filters.type, status: item.status, offset: 0, limit: 1 })
    )
  )
  if (disposed || seq !== summarySeq) return
  TASK_SUMMARY_STATUSES.forEach((item, idx) => {
    const r = results[idx]
    // 单个状态查询失败时保留上一次计数，避免概览突然归零
    if (r && r.status === 'fulfilled') summary[item.key] = r.value?.data?.total ?? 0
  })
}

let oldestFetchedAt = 0
let oldestSeq = 0
const fetchOldestPending = async (force = false) => {
  if (disposed) return
  if (!force && Date.now() - oldestFetchedAt < 60_000) return
  const seq = ++oldestSeq
  try {
    // 与概览同口径：跟随类型筛选；后端固定 created_at DESC，total 超过一页时补取最后一条（即最老）
    const first = await listTasksApi({ type: filters.type, status: 'pending', offset: 0, limit: 100 })
    if (disposed || seq !== oldestSeq) return
    let tasks = first.data.tasks || []
    const total = Number(first.data.total) || 0
    if (total > tasks.length) {
      const last = await listTasksApi({
        type: filters.type,
        status: 'pending',
        offset: Math.max(0, total - 1),
        limit: 1
      })
      if (disposed || seq !== oldestSeq) return
      tasks = [...tasks, ...(last.data.tasks || [])]
    }
    oldestPendingText.value = oldestPendingWaitText(tasks, Date.now()) || ''
  } catch {
    // 失败保留上次值，不影响列表主流程
  } finally {
    if (seq === oldestSeq) oldestFetchedAt = Date.now()
  }
}

// 手动刷新：概览 + 列表
const refreshAll = async () => {
  await Promise.all([fetchSummary(), fetchTasks()])
  void fetchOldestPending(true)
  syncAutoRefresh()
}

// 类型变化：概览与列表同口径刷新
const handleTypeChange = () => {
  pagination.page = 1
  fetchSummary()
  fetchTasks()
  void fetchOldestPending(true)
}

// 状态变化：只刷新列表，不重复统计
const handleStatusChange = () => {
  pagination.page = 1
  fetchTasks()
}

const handlePageChange = () => {
  fetchTasks()
}

const handlePageSizeChange = () => {
  pagination.page = 1
  fetchTasks()
}

// 点击概览条：按状态快速筛选（再次点击「全部」清除）
const applyStatusFilter = (status?: TaskFilters['status']) => {
  filters.status = status
  pagination.page = 1
  fetchTasks()
}

const clearFilters = () => {
  filters.type = undefined
  filters.status = undefined
  pagination.page = 1
  fetchSummary()
  fetchTasks()
  void fetchOldestPending(true)
}

// 查看任务详情
const handleView = (task: Task) => {
  router.push(`/tasks/${task.id}`)
}

// 取消任务
const handleCancel = async (task: Task) => {
  if (actionTaskId.value) return
  actionTaskId.value = task.id
  try {
    await ElMessageBox.confirm(`确定要取消任务"${task.id}"吗？`, '确认取消', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    await cancelTaskApi(task.id)
    ElMessage.success('任务已取消')
    refreshAll()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '取消任务失败')
    }
  } finally {
    actionTaskId.value = ''
  }
}

// 删除任务
const handleDelete = async (task: Task) => {
  if (actionTaskId.value) return
  actionTaskId.value = task.id
  try {
    await ElMessageBox.confirm(
      `确定要删除任务"${task.id}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deleteTaskApi(task.id)
    ElMessage.success('删除成功')
    refreshAll()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除任务失败')
    }
  } finally {
    actionTaskId.value = ''
  }
}

// 自动刷新：只要队列仍有积压（待执行/执行中）就每 5s 刷新列表，每 6 次补刷概览
const syncAutoRefresh = () => {
  if (disposed) return
  if (refreshTimer) return
  // 有积压：5s 刷列表，每 6 次补刷概览；空闲：30s 低频刷新，避免新积压永远不出现
  const delay = backlog.value ? 5000 : 30000
  refreshTimer = window.setTimeout(async () => {
    refreshTimer = null
    if (disposed) return
    await fetchTasks({ silent: true })
    if (disposed) return
    summaryTick += 1
    if (!backlog.value || summaryTick % 6 === 0) await fetchSummary()
    if (disposed) return
    syncAutoRefresh()
  }, delay)
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

// 窄屏（<=480）分页改用紧凑形态，避免完整 layout 折成 3 行
// 用容器实际宽度判断（769 起侧栏展开，视口变宽但内容区反而变窄）
const paginationContainer = ref<HTMLElement | null>(null)
const paginationContentWidth = ref(0)
const paginationUi = computed(() => paginationUiForContentWidth(paginationContentWidth.value))
let paginationObserver: ResizeObserver | null = null

watch(paginationContainer, (el) => {
  paginationObserver?.disconnect()
  if (!el || typeof ResizeObserver === 'undefined') return
  paginationObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0
    if (width > 0) paginationContentWidth.value = width
  })
  paginationObserver.observe(el)
})

// 初始化：先取概览再取列表，按积压状态决定是否轮询
onMounted(async () => {
  // 分页宽度由 ResizeObserver 监听容器，见 paginationObserver
  // 概览与列表并行，避免统计请求期间列表区长时间显示「暂无任务」；
  // 最老等待由 fetchTasks 成功路径按 60s 节流触发，这里不再重复请求
  await Promise.all([fetchSummary(), fetchTasks()])
  syncAutoRefresh()
})

// 清理
onUnmounted(() => {
  paginationObserver?.disconnect()
  disposed = true
  stopAutoRefresh()
  listSeq++
  summarySeq++
})
</script>


<style scoped lang="scss">
.tasks-page {
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px; // 抵消外层 padding
  height: calc(100% + 48px);

  // 窄屏外层 padding 为 12px，负 margin 同步收敛，避免 12px 横向滚动
  @media (max-width: 768px) {
    margin: -12px;
    height: calc(100% + 24px);
  }
}

// 页面顶部
.page-top {
  padding: 16px 20px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);

  // 窄屏与内容区左右内边距对齐（内容 8px），避免头部比卡片多缩进 12px
  @media (max-width: 768px) {
    padding: 16px 8px 12px;
  }
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

.page-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.queue-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  .summary-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;

    &:hover {
      color: var(--text-primary);
      border-color: var(--el-color-primary);
    }

    &.active {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }

    .summary-count {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
    }
  }

  .oldest-wait {
    white-space: nowrap;
  }

  .backlog-hint {
    margin-left: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
}

.tasks-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;

  @media (max-width: 768px) {
    // 收紧左右内边距，保证分页在 390 下仍能单容器放下
    padding: 12px 8px;
  }

  .filters-container {
    margin-bottom: 12px;
    padding: 12px 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    transition: background-color 0.3s ease, border-color 0.3s ease;

    .filters-form {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;

      :deep(.el-form-item) {
        margin-bottom: 0;
        margin-right: 0;
      }

      // el-select 默认宽度 100%，在 inline 表单里被压成 44px（只剩箭头）
      :deep(.el-select) {
        width: 160px;
      }

    }
  }

  .tasks-list {
    min-height: 200px;
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    padding: 16px;
    margin-top: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    transition: background-color 0.3s ease, border-color 0.3s ease;

    // 紧凑形态页码宽度以 Element 的 24px 为准，避免主题 32px 规则按加载顺序覆盖
    :deep(.el-pagination--small .el-pager li) {
      min-width: 24px;
    }

    // 分页控件允许换行：窄屏/侧栏展开但视口不足时自动折行，
    // 宽屏（可用宽度足够）仍保持单行，视觉无变化
    :deep(.el-pagination) {
      flex-wrap: wrap;
      justify-content: center;
      row-gap: 8px;
      width: 100%;
    }
  }
}
</style>