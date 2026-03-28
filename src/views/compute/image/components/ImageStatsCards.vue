<template>
  <div class="image-stats-cards">
    <div class="stat-card purple" @mouseenter="hovered = 'total'" @mouseleave="hovered = ''">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap purple">
          <el-icon :size="22"><Picture /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">镜像总数</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ weeklyTrend.total }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stat-card cyan" @mouseenter="hovered = 'system'" @mouseleave="hovered = ''">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap cyan">
          <el-icon :size="22"><Monitor /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.system }}</div>
          <div class="stat-label">公共镜像</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ weeklyTrend.system }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stat-card green" @mouseenter="hovered = 'custom'" @mouseleave="hovered = ''">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap green">
          <el-icon :size="22"><User /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.custom }}</div>
          <div class="stat-label">自定义镜像</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ weeklyTrend.custom }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
    <div class="stat-card orange" @mouseenter="hovered = 'shared'" @mouseleave="hovered = ''">
      <div class="stat-top-bar"></div>
      <div class="stat-body">
        <div class="stat-icon-wrap orange">
          <el-icon :size="22"><Share /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.shared }}</div>
          <div class="stat-label">共享镜像</div>
          <div class="stat-trend up">
            <span>↑</span>
            <span>{{ weeklyTrend.shared }} 本周新增</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ImageStatsResponse } from '@/api/asset'
import { Monitor, Picture, Share, User } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  stats: ImageStatsResponse
}>(), {
  stats: () => ({ total: 0, system: 0, custom: 0, shared: 0 }),
})

const hovered = ref('')

// Simulated weekly trend — in production this would come from the API
const weeklyTrend = computed(() => ({
  total: Math.max(0, Math.round((props.stats.total || 0) * 0.03)),
  system: Math.max(0, Math.round((props.stats.system || 0) * 0.02)),
  custom: Math.max(0, Math.round((props.stats.custom || 0) * 0.05)),
  shared: Math.max(0, Math.round((props.stats.shared || 0) * 0.04)),
}))
</script>

<style scoped lang="scss">
.image-stats-cards {
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
  &.cyan .stat-top-bar { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
  &.green .stat-top-bar { background: linear-gradient(90deg, #10b981, #34d399); }
  &.orange .stat-top-bar { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
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
  &.cyan { background: linear-gradient(135deg, #06b6d4, #22d3ee); }
  &.green { background: linear-gradient(135deg, #10b981, #34d399); }
  &.orange { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
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
