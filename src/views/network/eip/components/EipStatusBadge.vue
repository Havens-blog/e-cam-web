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
  const map: Record<string, string> = {
    InUse: 'inuse', inuse: 'inuse', '已绑定': 'inuse',
    Available: 'available', available: 'available', '未绑定': 'available',
    Bindable: 'available',
  }
  return map[props.status] || 'default'
})

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    InUse: '已绑定', inuse: '已绑定', '已绑定': '已绑定',
    Available: '未绑定', available: '未绑定', '未绑定': '未绑定',
    Bindable: '可绑定',
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
  
  &.inuse {
    .status-dot { background: var(--el-color-success); }
    .status-text { color: var(--el-color-success); }
  }
  
  &.available {
    .status-dot { background: var(--text-tertiary); }
  }
}
</style>
