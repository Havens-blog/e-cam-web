<template>
  <div class="status-badge" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status: string }>()

const statusClass = computed(() => {
  const s = props.status?.toLowerCase()
  if (['online', 'deployed', 'active', 'started'].includes(s)) return 'active'
  if (['offline', 'stopped', 'disabled'].includes(s)) return 'inactive'
  if (['configuring', 'checking', 'inprogress', 'creating'].includes(s)) return 'pending'
  if (['check_failed', 'error', 'failed'].includes(s)) return 'error'
  return 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    online: '正常', Online: '正常',
    Deployed: '正常', deployed: '正常',
    active: '正常', Active: '正常',
    Started: '正常', started: '正常',
    offline: '已停用', Offline: '已停用',
    stopped: '已停用', Stopped: '已停用',
    disabled: '已停用',
    configuring: '配置中', Configuring: '配置中',
    checking: '审核中', Checking: '审核中',
    creating: '创建中',
    check_failed: '审核失败',
    InProgress: '部署中', inprogress: '部署中',
    error: '异常', failed: '失败',
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
