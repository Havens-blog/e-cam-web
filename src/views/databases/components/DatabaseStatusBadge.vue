<template>
  <div class="status-badge" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  status: string
}

const props = defineProps<Props>()

const statusClass = computed(() => {
  const map: Record<string, string> = {
    running: 'running',
    Running: 'running',
    stopped: 'stopped',
    Stopped: 'stopped',
    creating: 'creating',
    Creating: 'creating',
    deleting: 'deleting',
    Deleting: 'deleting',
    error: 'error',
    Error: 'error',
  }
  return map[props.status] || 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    running: '运行中',
    Running: '运行中',
    stopped: '已停止',
    Stopped: '已停止',
    creating: '创建中',
    Creating: '创建中',
    deleting: '删除中',
    Deleting: '删除中',
    error: '异常',
    Error: '异常',
  }
  return map[props.status] || props.status || '-'
})
</script>

<style scoped lang="scss">
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }
  
  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }
  
  &.running {
    .status-dot {
      background: var(--el-color-success);
    }
    .status-text {
      color: var(--el-color-success);
    }
  }
  
  &.stopped {
    .status-dot {
      background: var(--text-tertiary);
    }
  }
  
  &.creating {
    .status-dot {
      background: var(--el-color-warning);
      animation: pulse 1.5s infinite;
    }
    .status-text {
      color: var(--el-color-warning);
    }
  }
  
  &.deleting {
    .status-dot {
      background: var(--el-color-danger);
      animation: pulse 1.5s infinite;
    }
    .status-text {
      color: var(--el-color-danger);
    }
  }
  
  &.error {
    .status-dot {
      background: var(--el-color-danger);
    }
    .status-text {
      color: var(--el-color-danger);
    }
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
