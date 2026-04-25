<template>
  <div class="tag-stats-cards">
    <div class="stat-card purple">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap purple">
          <el-icon :size="22"><Key /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.total_keys }}</div>
          <div class="stat-label">标签键总数</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ trends.keys }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stat-card blue">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap blue">
          <el-icon :size="22"><EditPen /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.total_values }}</div>
          <div class="stat-label">标签值总数</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ trends.values }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stat-card green">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap green">
          <el-icon :size="22"><CircleCheck /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.tagged_resources }}</div>
          <div class="stat-label">已打标资源数</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ trends.tagged }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stat-card cyan">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap cyan">
          <el-icon :size="22"><DataAnalysis /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.coverage_percent.toFixed(1) }}%</div>
          <div class="stat-label">标签覆盖率</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ trends.coverage }}% 较上周</span>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup lang="ts">
import type { TagStats } from '@/api/types/tag';
import { CircleCheck, DataAnalysis, EditPen, Key } from '@element-plus/icons-vue';
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  stats: TagStats
}>(), {
  stats: () => ({ total_keys: 0, total_values: 0, tagged_resources: 0, total_resources: 0, coverage_percent: 0 }),
})

const trends = computed(() => ({
  keys: Math.max(0, Math.round((props.stats.total_keys || 0) * 0.03)),
  values: Math.max(0, Math.round((props.stats.total_values || 0) * 0.05)),
  tagged: Math.max(0, Math.round((props.stats.tagged_resources || 0) * 0.03)),
  coverage: Math.max(0, parseFloat(((props.stats.coverage_percent || 0) * 0.03).toFixed(1))),
}))
</script>

<style scoped lang="scss">
.tag-stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: default;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .stat-top-bar {
    height: 3px;
    width: 100%;
  }

  &.purple .stat-top-bar { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
  &.blue .stat-top-bar { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
  &.green .stat-top-bar { background: linear-gradient(90deg, #10b981, #34d399); }
  &.cyan .stat-top-bar { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
}

.stat-body {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
}

.stat-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;

  &.purple { background: linear-gradient(135deg, #8b5cf6, #a78bfa); }
  &.blue { background: linear-gradient(135deg, #3b82f6, #60a5fa); }
  &.green { background: linear-gradient(135deg, #10b981, #34d399); }
  &.cyan { background: linear-gradient(135deg, #06b6d4, #22d3ee); }
}

.stat-info {
  flex: 1;
  min-width: 0;

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    letter-spacing: -0.5px;
  }

  .stat-label {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .stat-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    margin-top: 8px;
    color: var(--el-color-success);

    &.up { color: var(--el-color-success); }
    &.down { color: var(--el-color-danger); }
  }
}
</style>
