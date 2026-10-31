<template>
  <div class="page-top">
    <div class="page-title-row">
      <h1 class="page-title">{{ pageTitle }}</h1>
      <div class="tab-nav">
        <span class="tab-item active">全部</span>
        <span class="tab-item">公有云</span>
      </div>
      <div class="stats-badges">
        <div class="stat-badge" :class="{ active: !activeStatFilter }" @click="emit('stat-click', '')">
          <span class="stat-label">总数</span>
          <span class="stat-num">{{ totalCount }}</span>
        </div>
        <div class="stat-badge" :class="{ active: activeStatFilter === 'running' }" @click="emit('stat-click', 'running')">
          <span class="stat-label">运行中</span>
          <span class="stat-num blue">{{ runningCount }}</span>
        </div>
        <div class="stat-badge" :class="{ active: activeStatFilter === 'stopped' }" @click="emit('stat-click', 'stopped')">
          <span class="stat-label">关机</span>
          <span class="stat-num">{{ stoppedCount }}</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">监控异常</span>
          <span class="stat-num orange">0</span>
        </div>
        <div class="stat-badge">
          <span class="stat-label">异常</span>
          <span class="stat-num red">0</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ECS 页面头部（标题 + 全部/公有云 Tab + 5 个状态统计卡片）。
 *
 * 【拆分来源 / 边界】
 *   模板来自原 `views/compute/ecs/index.vue` 第 3-34 行的 `.page-top` 区块，
 *   样式来自同文件 `<style scoped>` 第 1237-1324 行（`// 页面顶部` 注释起，
 *   到 `.stat-badge` 结束），均为**逐字搬迁**，结构与文案零改动。
 *
 * 【为什么用 emit 而不是把状态搬进来】
 *   统计数字（总数/运行中/关机）由页面层从后端独立拉取（fetchStatusCounts，
 *   口径是全局而非当前页），卡片点击又要联动筛选条件与搜索标签，
 *   因此本组件保持无状态：数字走 props，点击走 emit。
 *   「监控异常 / 异常」两张卡片在拆分前后都是写死的 0（无数据源），保持原样。
 */
defineProps<{
  /** 页面标题（含 uid 精确到模型名的分支，由页面层 computed 计算） */
  pageTitle: string
  totalCount: number
  runningCount: number
  stoppedCount: number
  /** 当前激活的状态筛选（'' = 全部），用于卡片高亮 */
  activeStatFilter: string
}>()

const emit = defineEmits<{
  /** 统计卡片点击；传 '' 表示「总数」（清除状态筛选） */
  'stat-click': [status: string]
}>()
</script>

<style scoped lang="scss">
// 页面顶部
.page-top {
  padding: 16px 20px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 24px;
  // 窄屏允许换行：否则标题被兄弟元素挤到几十像素宽，中文一字一行竖排（iter116）
  flex-wrap: wrap;
}

@media (max-width: 560px) {
  .page-title-row {
    gap: 12px;
  }

  /* 标题在窄屏独占一行且不参与压缩，避免中文一字一行竖排（iter116） */
  .page-title {
    flex: 1 0 100%;
  }
}


.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.tab-nav {
  display: flex;
  gap: 4px;

  .tab-item {
    padding: 6px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      color: color-mix(in srgb, var(--accent-blue) 72%, #fff);
      background: rgba(113, 112, 255, 0.1);
    }
  }
}

.stats-badges {
  display: flex;
  gap: 16px;
  margin-left: auto;
}

.stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  min-width: 60px;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: var(--accent-blue);
    background: rgba(113, 112, 255, 0.05);
  }

  &.active {
    border-color: var(--accent-blue);
    background: rgba(113, 112, 255, 0.1);
  }

  .stat-label {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .stat-num {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;

    &.blue { color: var(--accent-blue); }
    &.orange { color: var(--accent-yellow); }
    &.red { color: var(--accent-red); }
  }
}
</style>
