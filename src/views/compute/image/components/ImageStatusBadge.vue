<template>
  <div class="status-badge" :class="statusClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ statusLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
}>()

const statusClass = computed(() => {
  const s = props.status?.toLowerCase()
  if (s === 'available') return 'active'
  if (s === 'creating') return 'pending'
  if (s === 'waiting') return 'pending'
  if (s === 'unavailable') return 'error'
  return 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    Available: '可用',
    available: '可用',
    Creating: '创建中',
    creating: '创建中',
    Waiting: '等待中',
    waiting: '等待中',
    UnAvailable: '不可用',
    unavailable: '不可用',
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
    box-shadow: 0 0 0 3px rgba(144, 147, 153, 0.15);
    transition: all 0.3s;
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }

  &.active {
    .status-dot {
      background: var(--el-color-success);
      box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.2), 0 0 8px rgba(103, 194, 58, 0.3);
    }
    .status-text { color: var(--el-color-success); }
  }

  &.pending {
    .status-dot {
      background: var(--el-color-warning);
      box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.2), 0 0 8px rgba(230, 162, 60, 0.3);
      animation: pulse-glow 1.5s ease-in-out infinite;
    }
    .status-text { color: var(--el-color-warning); }
  }

  &.error {
    .status-dot {
      background: var(--el-color-danger);
      box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.2), 0 0 8px rgba(245, 108, 108, 0.3);
    }
    .status-text { color: var(--el-color-danger); }
  }
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 3px rgba(230, 162, 60, 0.2), 0 0 8px rgba(230, 162, 60, 0.3);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 6px rgba(230, 162, 60, 0.1), 0 0 16px rgba(230, 162, 60, 0.4);
  }
}
</style>
