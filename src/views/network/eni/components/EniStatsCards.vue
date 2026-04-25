<template>
  <div class="stats-grid">
    <div class="stat-card" v-for="(stat, index) in stats" :key="index">
      <div class="stat-label">{{ stat.label }}</div>
      <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
      <div class="stat-change neutral">{{ stat.change }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  total: number
  inUseCount: number
  availableCount: number
  primaryCount: number
  secondaryCount: number
}>()

const stats = computed(() => [
  {
    label: '弹性网卡',
    value: props.total,
    change: '',
    color: 'var(--el-color-primary)',
  },
  {
    label: '使用中',
    value: props.inUseCount,
    change: `${props.total > 0 ? Math.round((props.inUseCount / props.total) * 100) : 0}% 绑定率`,
    color: 'var(--el-color-success)',
  },
  {
    label: '可用',
    value: props.availableCount,
    change: '未绑定实例',
    color: 'var(--el-color-warning)',
  },
  {
    label: '主网卡',
    value: props.primaryCount,
    change: `${props.total > 0 ? Math.round((props.primaryCount / props.total) * 100) : 0}%`,
    color: '#22d3ee',
  },
  {
    label: '辅助网卡',
    value: props.secondaryCount,
    change: `${props.total > 0 ? Math.round((props.secondaryCount / props.total) * 100) : 0}%`,
    color: '#a78bfa',
  },
])
</script>

<style scoped lang="scss">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 16px 18px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 6px;
  font-weight: 500;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}

.stat-change {
  font-size: 11px;
  margin-top: 4px;

  &.neutral { color: var(--text-tertiary); }
}

@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
