<template>
  <el-row :gutter="16" class="summary-cards">
    <el-col :span="8">
      <div class="summary-card">
        <div class="card-icon" style="background: #3B82F6">
          <el-icon :size="24"><Money /></el-icon>
        </div>
        <div class="card-info">
          <div class="card-title">当月成本（截至第{{ summary.elapsed_days || new Date().getDate() }}天）</div>
          <div class="card-value">{{ formatCost(summary.current_month_amount) }}</div>
        </div>
      </div>
    </el-col>
    <el-col :span="8">
      <div class="summary-card">
        <div class="card-icon" style="background: #8B5CF6">
          <el-icon :size="24"><Clock /></el-icon>
        </div>
        <div class="card-info">
          <div class="card-title">上月总成本</div>
          <div class="card-value">{{ formatCost(summary.last_month_amount) }}</div>
        </div>
      </div>
    </el-col>
    <el-col :span="8">
      <div class="summary-card">
        <div class="card-icon" :style="{ background: changeColor }">
          <el-icon :size="24"><TrendCharts /></el-icon>
        </div>
        <div class="card-info">
          <div class="card-title">环比变化（同期对比）</div>
          <div class="card-value" :style="{ color: changeColor }">
            <span v-if="summary.mom_change_percent > 0">+</span>
            {{ summary.mom_change_percent.toFixed(1) }}%
            <el-icon v-if="summary.mom_change_percent > 0" class="change-icon"><Top /></el-icon>
            <el-icon v-else-if="summary.mom_change_percent < 0" class="change-icon"><Bottom /></el-icon>
          </div>
        </div>
      </div>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import type { CostSummary } from '@/api/types/finops';
import { formatCost } from '@/utils/formatters';
import { Bottom, Clock, Money, Top, TrendCharts } from '@element-plus/icons-vue';
import { computed } from 'vue';

const props = defineProps<{
  summary: CostSummary
}>()

const changeColor = computed(() => {
  if (props.summary.mom_change_percent > 0) return '#EF4444'
  if (props.summary.mom_change_percent < 0) return '#10B981'
  return 'var(--text-secondary)'
})
</script>

<style scoped lang="scss">
.summary-cards {
  margin-bottom: 16px;
}

.summary-card {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  box-shadow: var(--shadow-base);
  transition: all 200ms ease;

  &:hover {
    background: var(--glass-bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    color: white;
    flex-shrink: 0;
  }

  .card-info {
    flex: 1;
    min-width: 0;

    .card-title {
      font-size: 13px;
      color: var(--text-tertiary);
      margin-bottom: 4px;
      font-weight: 500;
    }

    .card-value {
      font-size: 26px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 4px;

      .change-icon {
        font-size: 18px;
      }
    }
  }
}
</style>
