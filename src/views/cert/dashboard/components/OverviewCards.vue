<template>
  <div class="overview-cards" role="group" aria-label="到期分级总览卡">
    <div class="level-grid">
      <button
        v-for="(card, idx) in DASHBOARD_LEVEL_CARDS"
        :key="card.tier"
        type="button"
        class="stat-card hoverable"
        :class="{ selected: selectedLevel === card.tier }"
        :aria-pressed="selectedLevel === card.tier"
        @click="emit('select-level', card.tier)"
      >
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value">{{ summary?.countsByLevel[idx]?.total ?? '—' }}</div>
        <!-- 任务 3：未激活双口径「可见 N · 隐藏 M」；激活提示筛选态与总计数 -->
        <div class="stat-sub">{{ levelCardSubtitle(selectedLevel === card.tier, summary?.countsByLevel[idx]) }}</div>
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
        <div class="stat-sub">域名计数；仅常规差异，不可达 / 豁免 / 通配符不计</div>
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
        <div class="stat-sub">域名计数；人工排除，不参与告警</div>
      </button>
      <!-- 线上证书已过期（安全事件级）：纯展示（无筛选语义），Critical 红突出 -->
      <div class="stat-card static" data-test="online-expired-card">
        <div class="stat-label">线上证书已过期</div>
        <div class="stat-value tone-error">{{ summary?.onlineExpiredCount ?? '—' }}</div>
        <div class="stat-sub">域名计数；浏览器会直接拒绝这些域名，按 Critical 告警</div>
      </div>
    </div>
    <!-- 探测口径行（T3 新口径 + T1 跳过分项）：分母已剔除内网域/协议记录，
         因此「拨通率」高于旧口径（旧口径含约 25% 永不达的内网域）。 -->
    <div class="probe-grid" role="group" aria-label="探测口径统计">
      <div class="stat-card static">
        <div class="stat-label">可拨测域数</div>
        <div class="stat-value">{{ summary?.probeableCount ?? '—' }}</div>
        <div class="stat-sub">
          探测总数 {{ summary?.probeTotalCount ?? '—' }}；已剔除内网域
          {{ summary?.internalCount ?? '—' }} / 协议记录 {{ summary?.protocolSkippedCount ?? '—' }}
          / 验证别名 {{ summary?.verificationSkippedCount ?? '—' }}
          / 通配符 {{ summary?.wildcardSkippedCount ?? '—' }}
        </div>
      </div>
      <div class="stat-card static">
        <div class="stat-label">拨通率（可拨测域分母）</div>
        <div class="stat-value">{{ percent(summary?.reachableRateOnProbeable) }}</div>
        <div class="stat-sub">判定完成域 / 可拨测域；内网域不再稀释</div>
      </div>
      <div class="stat-card static">
        <div class="stat-label">差异率（可拨测域分母）</div>
        <div class="stat-value tone-error">{{ percent(summary?.diffRateOnProbeable) }}</div>
        <div class="stat-sub">常规差异域 / 可拨测域</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 到期看板总览卡：5 级互斥分桶卡（countsByLevel 数组序）+ 次行差异告警数 /
 * 探测豁免数卡。**分级卡点击 = 页内筛选**（dashboard-cert-granularity 任务 3：
 * 选中高亮、再点取消、aria-pressed 两态；激活即按总规则豁免孤儿隐藏——经
 * filter 单一状态源上抛父级，主表行数 == 该档 countsByLevel 总计数；未激活
 * 副文案「可见 N · 隐藏 M」双口径）。特殊卡计数保持**域名级**（副标题标注
 * 「域名计数」，卡值小于筛出行数——一个 diff 域名挂 2 张证 → 卡 1 行 2——
 * 为预期，逐 SAN 谓词筛出证书行）。summary 为 null（刷新中）时计数显示「—」，
 * 卡片保持可点。
 */
import type { DashboardSummary, DaysLeftTier } from '@/api/cert'
import { DASHBOARD_LEVEL_CARDS, levelCardSubtitle } from '../format'

defineProps<{
    summary: DashboardSummary | null
    /** 状态分级页内筛选选中档（filter.level 单一状态源，与工具栏下拉联动） */
    selectedLevel: DaysLeftTier | ''
    selectedSpecial: '' | 'diff' | 'exempt'
}>()

const emit = defineEmits<{
    (e: 'select-level', tier: DaysLeftTier): void
    (e: 'select-special', kind: 'diff' | 'exempt'): void
}>()

/** 比率 → 百分比文本（保留 1 位；null/undefined 显示「—」，不显示 NaN%）。 */
function percent(rate: number | null | undefined): string {
    if (rate === null || rate === undefined || Number.isNaN(rate)) return '—'
    return `${(rate * 100).toFixed(1)}%`
}
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
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.probe-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
  background: var(--bg-surface);
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

  // 探测口径卡为纯展示（无筛选语义）：默认光标，无 hover 高亮
  &.static {
    cursor: default;
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
