<template>
  <div class="stats-grid">
    <div class="stat-card" v-for="(stat, index) in stats" :key="index">
      <div class="stat-label">{{ stat.label }}</div>
      <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
      <div class="stat-change" :class="stat.changeType">{{ stat.change }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  total: number
  activeCount: number
}>()

const stats = computed(() => [
  {
    label: 'WAF 实例',
    value: props.total,
    change: '',
    changeType: '',
    color: 'var(--el-color-primary)',
  },
  {
    label: '防护域名',
    value: '—',
    change: '暂无数据',
    changeType: 'neutral',
    color: 'var(--el-color-success)',
  },
  {
    label: '今日拦截',
    value: '—',
    change: '暂无数据',
    changeType: 'neutral',
    color: 'var(--el-color-danger)',
  },
  {
    label: '今日请求',
    value: '—',
    change: '暂无数据',
    changeType: 'neutral',
    color: '#22d3ee',
  },
  {
    label: '月费用',
    value: '—',
    change: '暂无数据',
    changeType: 'neutral',
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
  position: relative;
  overflow: hidden;
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
  color: var(--text-tertiary);

  &.up {
    color: var(--el-color-success);
  }

  &.down {
    color: var(--el-color-danger);
  }

  &.neutral {
    color: var(--text-tertiary);
  }
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
