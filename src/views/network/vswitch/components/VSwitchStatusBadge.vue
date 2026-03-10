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
  if (s === 'available' || s === 'active') return 'available'
  if (s === 'pending' || s === 'creating') return 'pending'
  if (s === 'deleting') return 'deleting'
  return 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    Available: '可用', available: '可用', ACTIVE: '可用', active: '可用',
    Pending: '创建中', pending: '创建中', creating: '创建中',
    Deleting: '删除中', deleting: '删除中',
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
    .status-dot { background: var(--el-color-warning); }
    .status-text { color: var(--el-color-warning); }
  }
  &.deleting {
    .status-dot { background: var(--el-color-danger); }
    .status-text { color: var(--el-color-danger); }
  }
}
</style>
