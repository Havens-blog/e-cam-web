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

      <div v-if="task.error_message" class="error-message">
        <el-icon class="error-icon"><WarningFilled /></el-icon>
        <span>{{ task.error_message }}</span>
      </div>

      <div class="task-details">
        <div class="detail-item">
          <span class="label">创建者:</span>
          <span class="value">{{ task.created_by }}</span>
        </div>
        <div v-if="task.started_at" class="detail-item">
          <span class="label">开始时间:</span>
          <span class="value">{{ formatTime(task.started_at) }}</span>
        </div>
        <div v-if="task.completed_at" class="detail-item">
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
import { Refresh, Search, WarningFilled } from '@element-plus/icons-vue'
import { computed } from 'vue'
import TaskProgress from './TaskProgress.vue'
import TaskStatusBadge from './TaskStatusBadge.vue'

interface Props {
  task: Task
}

const props = defineProps<Props>()

defineEmits<{
  view: [task: Task]
  cancel: [task: Task]
  delete: [task: Task]
}>()

const taskTypeIcon = computed(() => {
  return props.task.type === 'sync_assets' ? Refresh : Search
})

const taskTypeLabel = computed(() => {
  const labels = {
    sync_assets: '同步资产',
    discover_assets: '发现资产',
  }
  return labels[props.task.type] || props.task.type
})

const formatTime = (time?: string) => {
  if (!time) return '-'
  return formatRelativeTime(time)
}

const duration = computed(() => {
  if (!props.task.started_at) return null

  const start = new Date(props.task.started_at).getTime()
  const end = props.task.completed_at
    ? new Date(props.task.completed_at).getTime()
    : Date.now()
  const diff = end - start

  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  if (minutes > 0) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
})
</script>

<style scoped lang="scss">
.task-card {
  margin-bottom: 16px;
  transition: all 200ms ease;
  background: var(--glass-bg) !important;
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border) !important;
  border-radius: 12px !important;

  &.is-running {
    border-color: rgba(245, 158, 11, 0.5) !important;
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
  }

  &:hover {
    background: var(--glass-bg-hover) !important;
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
        font-family: 'JetBrains Mono', monospace;
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
