<template>
  <el-card class="task-card" :class="{ 'is-running': task.status === 'running' }">
    <div class="card-header">
      <div class="task-info">
        <div class="task-title">
          <el-icon class="task-icon">
            <component :is="taskTypeIcon" />
          </el-icon>
          <span class="task-type-label">{{ taskTypeLabel }}</span>
        </div>
        <TaskStatusBadge :status="task.status" />
      </div>
      <div class="task-meta">
        <span class="task-id">ID: {{ task.id }}</span>
        <span class="task-time">{{ formatTime(task.created_at) }}</span>
      </div>
    </div>

    <div class="card-body">
      <TaskProgress
        v-if="task.status === 'running' && task.progress !== undefined"
        :progress="task.progress"
        :status="task.status"
        :start-time="task.started_at"
        :show-details="true"
      />

      <div v-if="task.error || task.error_message" class="error-message">
        <el-icon class="error-icon"><WarningFilled /></el-icon>
        <span>{{ task.error || task.error_message }}</span>
      </div>

      <div class="task-details">
        <div class="detail-item">
          <span class="label">创建者:</span>
          <span class="value">{{ task.created_by }}</span>
        </div>
        <div v-if="waited" class="detail-item">
          <span class="label">已等待:</span>
          <span class="value">{{ waited }}</span>
        </div>
        <div v-if="showExecutionTiming && task.started_at" class="detail-item">
          <span class="label">开始时间:</span>
          <span class="value">{{ formatTime(task.started_at) }}</span>
        </div>
        <div v-if="showExecutionTiming && task.completed_at" class="detail-item">
          <span class="label">完成时间:</span>
          <span class="value">{{ formatTime(task.completed_at) }}</span>
        </div>
        <div v-if="duration" class="detail-item">
          <span class="label">耗时:</span>
          <span class="value">{{ duration }}</span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <el-button size="small" @click="$emit('view', task)">查看详情</el-button>
      <el-button
        v-if="task.status === 'running' || task.status === 'pending'"
        size="small"
        type="warning"
        :loading="isCardActioning"
        :disabled="isActionLocked"
        @click="$emit('cancel', task)"
      >
        取消任务
      </el-button>
      <el-button
        v-if="
          task.status === 'completed' ||
          task.status === 'failed' ||
          task.status === 'cancelled'
        "
        size="small"
        type="danger"
        :loading="isCardActioning"
        :disabled="isActionLocked"
        @click="$emit('delete', task)"
      >
        删除
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { Task } from '@/api/types/task'
import { formatRelativeTime } from '@/utils/formatters'
import { formatDurationMs, pendingWaitDurationText, shouldUseExecutionTiming } from '../timing'
import { Document, Monitor, Refresh, Search, WarningFilled } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { taskTypeLabel as formatTaskType } from '../taskFilters'
import TaskProgress from './TaskProgress.vue'
import TaskStatusBadge from './TaskStatusBadge.vue'

interface Props {
  task: Task
  /** 父组件正在执行取消/删除的任务 id；非空表示有操作进行中 */
  actionTaskId?: string
}

const props = defineProps<Props>()

defineEmits<{
  view: [task: Task]
  cancel: [task: Task]
  delete: [task: Task]
}>()

// 本卡片正在执行操作：目标按钮置 loading
const isCardActioning = computed(() => !!props.actionTaskId && props.actionTaskId === props.task.id)
// 任意卡片有操作进行中：禁用其余操作按钮，防止并发第二个请求
const isActionLocked = computed(() => !!props.actionTaskId)

const taskTypeIcon = computed(() => {
  switch (props.task.type) {
    case 'cam:sync_assets':
      return Refresh
    case 'cam:discover_assets':
      return Search
    case 'cam:sync_billing':
      return Document
    case 'cam:create_ecs':
      return Monitor
    default:
      return Refresh
  }
})

const taskTypeLabel = computed(() => formatTaskType(props.task.type))

const formatTime = (time?: string) => {
  if (!time) return '-'
  return formatRelativeTime(time)
}

const showExecutionTiming = computed(() => shouldUseExecutionTiming(props.task.status))

const waited = computed(() =>
  props.task.status === 'pending' ? pendingWaitDurationText(props.task.created_at, Date.now()) : null
)

const duration = computed(() => {
  if (!showExecutionTiming.value || !props.task.started_at) return null
  // 非运行中但没有完成时间（如取消/重排残留）不展示耗时，避免持续增长
  if (props.task.status !== 'running' && !props.task.completed_at) return null
  const start = new Date(props.task.started_at).getTime()
  const end = props.task.completed_at ? new Date(props.task.completed_at).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return formatDurationMs(end - start)
})
</script>

<style scoped lang="scss">
.task-card {
  margin-bottom: 16px;
  transition: all 200ms ease;
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-subtle) !important;
  border-radius: 8px !important;

  &.is-running {
    border-color: rgba(245, 158, 11, 0.5) !important;
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
  }

  &:hover {
    background: var(--bg-hover) !important;
    border-color: var(--border-strong) !important;
  }

  .card-header {
    margin-bottom: 12px;

    .task-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .task-title {
        display: flex;
        align-items: center;
        gap: 8px;

        .task-icon {
          font-size: 20px;
          color: var(--accent-blue);
        }

        .task-type-label {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }
      }
    }

    .task-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-tertiary);

      .task-id {
        font-family: var(--font-mono);
      }
    }
  }

  .card-body {
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      margin-bottom: 12px;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 8px;
      color: var(--accent-red);
      font-size: 13px;

      .error-icon {
        flex-shrink: 0;
      }
    }

    .task-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
      margin-top: 12px;

      .detail-item {
        display: flex;
        gap: 8px;
        font-size: 13px;

        .label {
          color: var(--text-tertiary);
          font-weight: 500;
        }

        .value {
          color: var(--text-primary);
        }
      }
    }
  }

  .card-footer {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-subtle);
  }
}

@media (max-width: 768px) {
  .task-card {
    .card-header {
      .task-info {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .task-meta {
        flex-direction: column;
        gap: 4px;
      }
    }

    .card-body {
      .task-details {
        grid-template-columns: 1fr;
      }
    }

    .card-footer {
      flex-wrap: wrap;
    }
  }
}
</style>
