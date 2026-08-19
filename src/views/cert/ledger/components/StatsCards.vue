<template>
  <div class="stats-grid" role="group" aria-label="台账统计">
    <div class="stat-card">
      <div class="stat-label">完整托管</div>
      <div class="stat-value">{{ stats?.complete ?? '—' }}</div>
      <div class="stat-sub">含私钥加密托管，可发起更换</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">仅指纹登记</div>
      <div class="stat-value">
        {{ stats?.fingerprintOnly ?? '—' }}
        <span class="stat-inline-sub">· 占比 {{ formatPercent(stats?.fingerprintOnlyRate ?? Number.NaN) }}</span>
      </div>
      <div class="stat-sub">私钥未托管，需补传后可更换</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">覆盖率</div>
      <div class="stat-value">
        {{ formatPercent(stats?.registrationRate ?? Number.NaN) }}
        <span class="stat-inline-sub">登记 ≥90% 目标</span>
      </div>
      <div class="stat-sub">
        <span class="stat-accent">可更换托管 {{ formatPercent(stats?.replaceableRate ?? Number.NaN) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 台账统计卡行（3 列）：完整托管 / 仅指纹登记（含占比）/ 覆盖率（登记率 + 可更换托管率）。
 * 数据绑定 GET /api/v1/certs/stats（ui-design Data Binding「统计卡」行）。
 * loading 骨架由父级渲染（页面 loading 态整块替换，见 index.vue）。
 */
import type { CertStats } from '@/api/cert'
import { formatPercent } from '../format'

defineProps<{
    stats: CertStats | null
}>()
</script>

<style lang="scss" scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
  transition: border-color 150ms ease;

  &:hover {
    border-color: var(--border-strong);
  }
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.stat-inline-sub {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
}

.stat-sub {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.stat-accent {
  color: var(--cert-accent);
}
</style>
