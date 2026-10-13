<template>
  <!--
    统计卡片行：4 张指标卡（用户总数 / 活跃用户 / 已分组 / 已禁用）。
    拆分来源：src/views/iam/users/index.vue 原模板 27-65 行，
    以及原 style 中的 `.stats-row` / `.stat-card` 块（逐字搬迁）。

    边界：本组件纯展示，不持有任何状态。四个数值均由父组件的 computed
    （activeUserCount / groupedUserCount / disabledUserCount + pagination.total）
    以 props 传入，父组件计算逻辑保持原样未动。
  -->
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-icon blue">
        <el-icon :size="20"><User /></el-icon>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ total }}</div>
        <div class="stat-label">用户总数</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">
        <el-icon :size="20"><CircleCheck /></el-icon>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ activeCount }}</div>
        <div class="stat-label">活跃用户</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple">
        <el-icon :size="20"><UserFilled /></el-icon>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ groupedCount }}</div>
        <div class="stat-label">已分组</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">
        <el-icon :size="20"><Warning /></el-icon>
      </div>
      <div class="stat-body">
        <div class="stat-value">{{ disabledCount }}</div>
        <div class="stat-label">已禁用</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheck, User, UserFilled, Warning } from '@element-plus/icons-vue'

defineProps<{
  /** 用户总数：父组件 pagination.total */
  total: number
  /** 活跃用户数：父组件 activeUserCount */
  activeCount: number
  /** 已分组用户数：父组件 groupedUserCount */
  groupedCount: number
  /** 已禁用用户数：父组件 disabledUserCount */
  disabledCount: number
}>()
</script>

<style scoped lang="scss">
// 统计卡片（CSS 逐字搬迁自 index.vue 原 style 的 `.stats-row` / `.stat-card`）
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 200ms ease;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.blue {
      background: rgba(113, 112, 255, 0.15);
      color: var(--accent-blue);
    }

    &.green {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);
    }

    &.purple {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
    }

    &.orange {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-yellow);
    }
  }

  .stat-body {
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 4px;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      font-size: 13px;
      color: var(--text-tertiary);
    }
  }
}
</style>
