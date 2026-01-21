<template>
  <PageContainer>
    <ManagerHeader
      title="任务详情"
      :subtitle="task?.id || ''"
      :show-refresh-button="true"
      :show-back-button="true"
      @back="router.back()"
      @refresh="fetchTaskDetail"
    />

    <div v-loading="loading" class="task-detail-content">
      <template v-if="task">
        <!-- 基本信息卡片 -->
        <el-card class="info-card">
          <template #header>
            <div class="card-header">
              <span>基本信息</span>
              <TaskStatusBadge :status="task.status" />
            </div>
          </template>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">任务ID:</span>
              <span class="value">{{ task.id }}</span>
            </div>
            <div class="info-item">
              <span class="label">任务类型:</span>
              <span class="value">{{ taskTypeLabel }}</span>
            </div>
            <div class="info-item">
              <span class="label">创建者:</span>
              <span class="value">{{ task.created_by }}</span>
            </div>
            <div class="info-item">
              <span class="label">创建时间:</span>
              <span class="value">{{ formatTime(task.created_at) }}</span>
            </div>
            <div v-if="task.started_at" class="info-item">
              <span class="label">开始时间:</span>
              <span class="value">{{ formatTime(task.started_at) }}</span>
            </div>
            <div v-if="task.completed_at" class="info-item">
              <span class="label">完成时间:</span>
              <span class="value">{{ formatTime(task.completed_at) }}</span>
            </div>
            <div v-if="duration" class="info-item">
              <span class="label">耗时:</span>
              <span class="value">{{ duration }}</span>
            </div>
          </div>
        </el-card>

        <!-- 进度卡片 -->
        <el-card
          v-if="task.status === 'running' && task.progress !== undefined"
          class="info-card"
        >
          <template #header>
            <span>执行进度</span>
          </template>
          <TaskProgress
            :progress="task.progress"
            :status="task.status"
            :start-time="task.started_at"
            :show-details="true"
            :stroke-width="12"
          />
        </el-card>

        <!-- 错误信息卡片 -->
        <el-card v-if="task.error_message" class="info-card error-card">
          <template #header>
            <span>错误信息</span>
          </template>
          <div class="error-content">
            <el-icon class="error-icon"><WarningFilled /></el-icon>
            <pre class="error-text">{{ task.error_message }}</pre>
          </div>
        </el-card>

        <!-- 结果卡片 -->
        <el-card v-if="task.result" class="info-card">
          <template #header>
            <span>执行结果</span>
          </template>
          <pre class="result-content">{{ JSON.stringify(task.result, null, 2) }}</pre>
        </el-card>

        <!-- 操作按钮 -->
        <div class="actions-container">
          <el-button
            v-if="task.status === 'running' || task.status === 'pending'"
            type="warning"
            :loading="cancelling"
            @click="handleCancel"
          >
            取消任务
          </el-button>
          <el-button
            v-if="
              task.status === 'completed' ||
              task.status === 'failed' ||
              task.status === 'cancelled'
            "
            type="danger"
            :loading="deleting"
            @click="handleDelete"
          >
            删除任务
          </el-button>
          <el-button @click="router.back()">返回列表</el-button>
        </div>
      </template>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { cancelTaskApi, deleteTaskApi, getTaskDetailApi } from '@/api'
import type { Task } from '@/api/types/task'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { formatRelativeTime } from '@/utils/formatters'
import { WarningFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TaskProgress from './components/TaskProgress.vue'
import TaskStatusBadge from './components/TaskStatusBadge.vue'

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)
const cancelling = ref(false)
const deleting = ref(false)
const task = ref<Task | null>(null)

// 自动刷新
let refreshTimer: number | null = null

// 计算属性
const taskTypeLabel = computed(() => {
  if (!task.value) return ''
  const labels = {
    sync_assets: '同步资产',
    discover_assets: '发现资产',
  }
  return labels[task.value.type] || task.value.type
})

const duration = computed(() => {
  if (!task.value?.started_at) return null

  const start = new Date(task.value.started_at).getTime()
  const end = task.value.completed_at
    ? new Date(task.value.completed_at).getTime()
    : Date.now()
  const diff = end - start

  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  if (hours > 0) return `${hours}小时${minutes}分${seconds}秒`
  if (minutes > 0) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
})

// 格式化时间
const formatTime = (time?: string): string => {
  if (!time) return '-'
  return formatRelativeTime(time) || '-'
}

// 获取任务详情
const fetchTaskDetail = async () => {
  const taskId = route.params.id as string
  if (!taskId) {
    ElMessage.error('任务ID不存在')
    router.back()
    return
  }

  loading.value = true
  try {
    const { data } = await getTaskDetailApi(taskId)
    task.value = data
  } catch (error: any) {
    ElMessage.error(error.message || '获取任务详情失败')
    router.back()
  } finally {
    loading.value = false
  }
}

// 取消任务
const handleCancel = async () => {
  if (!task.value) return

  try {
    await ElMessageBox.confirm(`确定要取消任务"${task.value.id}"吗？`, '确认取消', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    cancelling.value = true
    await cancelTaskApi(task.value.id)
    ElMessage.success('任务已取消')
    fetchTaskDetail()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '取消任务失败')
    }
  } finally {
    cancelling.value = false
  }
}

// 删除任务
const handleDelete = async () => {
  if (!task.value) return

  try {
    await ElMessageBox.confirm(
      `确定要删除任务"${task.value.id}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    deleting.value = true
    await deleteTaskApi(task.value.id)
    ElMessage.success('删除成功')
    router.back()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  } finally {
    deleting.value = false
  }
}

// 启动自动刷新
const startAutoRefresh = () => {
  // 如果任务正在运行,每5秒刷新一次
  if (
    task.value &&
    (task.value.status === 'running' || task.value.status === 'pending')
  ) {
    refreshTimer = window.setTimeout(() => {
      fetchTaskDetail().then(() => {
        startAutoRefresh()
      })
    }, 5000)
  }
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

// 初始化
onMounted(() => {
  fetchTaskDetail().then(() => {
    startAutoRefresh()
  })
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.task-detail-content {
  .info-card {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;

      .info-item {
        display: flex;
        gap: 8px;
        font-size: 14px;

        .label {
          color: var(--text-secondary);
          font-weight: 500;
          white-space: nowrap;
        }

        .value {
          color: var(--text-primary);
          word-break: break-all;
        }
      }
    }

    &.error-card {
      border-color: var(--accent-red);

      .error-content {
        display: flex;
        gap: 8px;

        .error-icon {
          flex-shrink: 0;
          font-size: 20px;
          color: var(--accent-red);
        }

        .error-text {
          flex: 1;
          margin: 0;
          padding: 12px;
          background-color: rgba(239, 68, 68, 0.1);
          border-radius: 8px;
          color: var(--accent-red);
          font-size: 13px;
          white-space: pre-wrap;
          word-break: break-word;
        }
      }
    }

    .result-content {
      margin: 0;
      padding: 16px;
      background-color: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      font-size: 13px;
      overflow-x: auto;
      color: var(--text-secondary);
    }
  }

  .actions-container {
    display: flex;
    gap: 12px;
    padding: 16px;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    transition: background-color 0.3s ease, border-color 0.3s ease;
  }
}

@media (max-width: 768px) {
  .task-detail-content {
    .info-card {
      .info-grid {
        grid-template-columns: 1fr;
      }
    }

    .actions-container {
      flex-direction: column;
    }
  }
}
</style>
