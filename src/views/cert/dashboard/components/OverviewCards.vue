<template>
  <div class="overview-cards" role="group" aria-label="到期分级总览卡">
    <div class="level-grid">
      <button
        v-for="(card, idx) in DASHBOARD_LEVEL_CARDS"
        :key="card.tier"
        type="button"
        class="stat-card hoverable"
        @click="emit('navigate-level', card.tier)"
      >
        <div class="stat-label">{{ card.label }}</div>
        <!-- 任务 1 载荷：countsByLevel 升级为 {total,visible,hidden} 双口径（卡值取 total；页内筛选/可见 N·隐藏 M 为任务 3 范围） -->
        <div class="stat-value">{{ summary?.countsByLevel[idx]?.total ?? '—' }}</div>
        <div class="stat-sub">点击跳转台账按档过滤</div>
      </button>
    </div>
    <div class="special-grid">
      <button
        type="button"
        class="stat-card hoverable"
        :class="{ selected: selectedSpecial === 'diff' }"
        :aria-pressed="selectedSpecial === 'diff'"
        @click="emit('select-special', 'diff')"
      >
        <div class="stat-label">差异告警数（线上≠台账）</div>
        <div class="stat-value tone-error">{{ summary?.diffAlertCount ?? '—' }}</div>
        <div class="stat-sub">仅常规差异计数；不可达 / 豁免 / 通配符不计</div>
      </button>
      <button
        type="button"
        class="stat-card hoverable"
        :class="{ selected: selectedSpecial === 'exempt' }"
        :aria-pressed="selectedSpecial === 'exempt'"
        @click="emit('select-special', 'exempt')"
      >
        <div class="stat-label">探测豁免数</div>
        <div class="stat-value">{{ summary?.exemptCount ?? '—' }}</div>
        <div class="stat-sub">人工排除，不参与告警</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 到期看板总览卡（AC1）：5 级互斥分桶卡（countsByLevel 数组序）+ 次行差异告警数 /
 * 探测豁免数卡。**分级卡跳转台账按档过滤**（证书粒度计数 → 台账 daysLeft 服务端
 * 过滤，能看到具体证书）——因看板表格是域名粒度（同域多证取 notAfter 最新者独占
 * 行），过期/临期证书常被同名新证掩盖，卡内过滤会空；差异告警/豁免卡仍页内过滤
 * （域名行可表达）。summary 为 null（刷新中）时计数显示「—」，卡片保持可点。
 */
import type { DashboardSummary, DaysLeftTier } from '@/api/cert'
import { DASHBOARD_LEVEL_CARDS } from '../format'

defineProps<{
    summary: DashboardSummary | null
    selectedSpecial: '' | 'diff' | 'exempt'
}>()

const emit = defineEmits<{
    (e: 'navigate-level', tier: DaysLeftTier): void
    (e: 'select-special', kind: 'diff' | 'exempt'): void
}>()
</script>

<style lang="scss" scoped>
.overview-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.level-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;

  // 1024~1200px：5 列折行 3+2（ui-design 响应式）
  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.special-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 20px 24px;
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: border-color 150ms ease;

  &:hover {
    border-color: var(--border-strong);
  }

  &.hoverable:hover {
    border-color: var(--cert-accent-hover);
  }

  // 选中卡 Accent 高亮（ui-design Interactions）
  &.selected {
    border-color: var(--cert-accent);
    box-shadow: inset 0 0 0 1px var(--cert-accent);
  }
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);

  &.tone-error {
    color: var(--cert-error);
  }
}

.stat-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .stat-card {
    transition: none;
  }
}
</style>
