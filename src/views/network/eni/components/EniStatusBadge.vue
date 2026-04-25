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
  if (['in_use', 'inuse', 'bindbound', 'associated'].includes(s)) return 'active'
  if (['available', 'down', 'bindunbound'].includes(s)) return 'available'
  if (['attaching', 'detaching', 'creating', 'pending'].includes(s)) return 'pending'
  if (['deleting'].includes(s)) return 'warning'
  if (['error'].includes(s)) return 'error'
  return 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    in_use: '使用中', InUse: '使用中', inuse: '使用中',
    available: '可用', Available: '可用',
    attaching: '绑定中', Attaching: '绑定中',
    detaching: '解绑中', Detaching: '解绑中',
    creating: '创建中', Creating: '创建中',
    deleting: '删除中', Deleting: '删除中',
    error: '异常', Error: '异常',
    ACTIVE: '使用中', DOWN: '可用',
    BINDBOUND: '使用中', BINDUNBOUND: '可用',
    PENDING: '创建中',
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

  &.available {
    .status-dot { background: var(--el-color-warning); }
    .status-text { color: var(--el-color-warning); }
  }

  &.pending {
    .status-dot { background: var(--el-color-primary); animation: pulse 1.5s infinite; }
    .status-text { color: var(--el-color-primary); }
  }

  &.warning {
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
