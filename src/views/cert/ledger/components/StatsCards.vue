<template>
  <div class="stats-grid" role="group" aria-label="台账统计">
    <div v-if="statsError" class="stats-error" role="status">
      <span>统计暂不可用</span>
      <el-button v-if="retry" link type="primary" size="small" @click="retry">重试</el-button>
    </div>
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
    /** 统计请求失败标记：与「-」占位一并呈现行内错误提示，避免被误读为数据为零 */
    statsError?: boolean
    /**
     * 统计失败时的重试回调（由父组件传入 refreshAll）。
     * 此前文案写着「请刷新页面重试」但**没有任何重试入口**，用户只能手动刷新浏览器、
     * 丢掉筛选与滚动位置（iter134 实测：断 /api/v1/certs/stats 后全页 retryBtns 为空）。
     */
    retry?: () => void
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

.stats-error {
  grid-column: 1 / -1;
  font-size: 13px;
  color: var(--cert-error, #ee0000);
  /* 文案与重试按钮同行：窄屏允许换行，按钮不参与收缩 */
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-card {
  background: var(--bg-surface);
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
