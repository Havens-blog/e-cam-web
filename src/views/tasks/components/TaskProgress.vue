<template>
  <div class="task-progress">
    <el-progress
      :percentage="progress"
      :status="progressStatus"
      :stroke-width="strokeWidth"
      :show-text="showText"
    />
    <div v-if="showDetails" class="progress-details">
      <span class="progress-text">{{ progressText }}</span>
      <span v-if="estimatedTime" class="estimated-time">
        预计剩余: {{ estimatedTime }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TaskStatus } from '@/api/types/task'
import { computed } from 'vue'

interface Props {
  progress: number
  status: TaskStatus
  strokeWidth?: number
  showText?: boolean
  showDetails?: boolean
  startTime?: string
}

const props = withDefaults(defineProps<Props>(), {
  strokeWidth: 8,
  showText: true,
  showDetails: false,
})

const progressStatus = computed(() => {
  if (props.status === 'completed') return 'success'
  if (props.status === 'failed') return 'exception'
  return undefined
})

const progressText = computed(() => {
  if (props.progress === 0) return '准备中...'
  if (props.progress === 100) return '完成'
  return `${props.progress}%`
})

const estimatedTime = computed(() => {
  if (!props.startTime || props.progress === 0) return null

  const elapsed = Date.now() - new Date(props.startTime).getTime()
  const remaining = (elapsed / props.progress) * (100 - props.progress)

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  if (minutes > 0) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
})
</script>

<style scoped lang="scss">
.task-progress {
  .progress-details {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    .estimated-time {
      color: var(--el-color-primary);
    }
  }
}
</style>
