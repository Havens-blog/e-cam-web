<template>
  <div class="status-badge" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  status: string
}>()

const statusClass = computed(() => {
  const s = props.status?.toLowerCase()
  if (s === 'active' || s === 'running' || s === 'available') return 'active'
  if (s === 'inactive' || s === 'stopped') return 'inactive'
  if (s === 'creating' || s === 'configuring' || s === 'pending') return 'pending'
  if (s === 'locked' || s === 'error') return 'error'
  return 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    active: '运行中',
    Active: '运行中',
    running: '运行中',
    Running: '运行中',
    available: '可用',
    Available: '可用',
    inactive: '已停止',
    Inactive: '已停止',
    stopped: '已停止',
    Stopped: '已停止',
    creating: '创建中',
    Creating: '创建中',
    configuring: '配置中',
    Configuring: '配置中',
    pending: '等待中',
    Pending: '等待中',
    locked: '已锁定',
    Locked: '已锁定',
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

  &.active {
    .status-dot { background: var(--el-color-success); }
    .status-text { color: var(--el-color-success); }
  }

  &.inactive {
    .status-dot { background: var(--text-muted); }
    .status-text { color: var(--text-muted); }
  }

  &.pending {
    .status-dot { background: var(--el-color-warning); animation: pulse 1.5s infinite; }
    .status-text { color: var(--el-color-warning); }
  }

  &.error {
    .status-dot { background: var(--el-color-danger); }
    .status-text { color: var(--el-color-danger); }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
