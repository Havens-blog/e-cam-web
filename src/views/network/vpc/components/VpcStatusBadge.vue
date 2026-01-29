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
  const map: Record<string, string> = {
    Available: 'available',
    available: 'available',
    '正常': 'available',
    Pending: 'pending',
    pending: 'pending',
    error: 'error',
    Error: 'error',
  }
  return map[props.status] || 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    Available: '正常',
    available: '正常',
    '正常': '正常',
    Pending: '创建中',
    pending: '创建中',
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
  
  &.available {
    .status-dot { background: var(--el-color-success); }
    .status-text { color: var(--el-color-success); }
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
