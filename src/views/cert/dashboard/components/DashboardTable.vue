<template>
  <div class="dashboard-table-card">
    <div class="table-toolbar" aria-label="看板筛选工具栏">
      <el-select
        :model-value="filter.level"
        class="toolbar-select"
        aria-label="筛选状态分级"
        :disabled="disabled"
        @update:model-value="onLevelChange"
      >
        <el-option label="状态分级：全部" value="" />
        <el-option v-for="c in DASHBOARD_LEVEL_CARDS" :key="c.tier" :label="c.label" :value="c.tier" />
      </el-select>
      <el-select
        :model-value="filter.clouds"
        class="toolbar-select toolbar-clouds"
        multiple
        collapse-tags
        aria-label="按云筛选（多选）"
        placeholder="云：全部"
        :disabled="disabled"
        @update:model-value="onCloudsChange"
      >
        <el-option v-for="c in cloudOptions" :key="c" :label="cloudLabel(c)" :value="c" />
      </el-select>
      <el-select
        :model-value="filter.hosting"
        class="toolbar-select"
        aria-label="筛选托管类型"
        :disabled="disabled"
        @update:model-value="onHostingChange"
      >
        <el-option label="托管类型：全部" value="" />
        <el-option label="完整托管" value="complete" />
        <el-option label="仅指纹登记" value="fingerprint_only" />
      </el-select>
      <div class="toolbar-spacer" />
      <el-tooltip
        v-if="wildcardSkippedCount > 0"
        content="通配符 SAN 无法直接拨测且未配置替代子域名，跳过计数（探测覆盖显式缺口，不参与差异告警）"
        placement="top"
      >
        <span class="meta-item wildcard-meta" tabindex="0">通配符跳过拨测 {{ wildcardSkippedCount }}</span>
      </el-tooltip>
      <span class="meta-item">最近巡检：{{ lastInspectionAt ? relativeTimeDash(lastInspectionAt) : '—' }}</span>
    </div>

    <el-table
      class="dashboard-table"
      :data="rows"
      row-key="domain"
      tabindex="0"
      aria-label="证书到期与探测列表"
      :row-class-name="rowClassName"
      @row-click="onRowClick"
    >
      <el-table-column label="子域名" min-width="260">
        <template #default="{ row }">
          <div class="cell-domain">
            <span class="domain-main">{{ row.domain }}</span>
            <div v-if="row.referencedClouds.length > 0" class="domain-clouds">
              <span v-for="c in row.referencedClouds" :key="c" class="cloud-chip">{{ cloudLabel(c) }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="剩余天数" width="130">
        <template #default="{ row }">
          <span class="dash-badge" :class="`tone-${daysLeftBadge(row.daysLeft).tone}`">
            <span class="badge-icon" aria-hidden="true">{{ daysLeftBadge(row.daysLeft).icon }}</span>
            {{ daysLeftBadge(row.daysLeft).text }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="托管类型" width="120" class-name="hide-sm">
        <template #default="{ row }">{{ hostingStatusMeta(row.hostingType).label }}</template>
      </el-table-column>
      <el-table-column label="线上探测" min-width="150">
        <template #default="{ row }">
          <el-tooltip :content="probeTooltip(row)" placement="top">
            <span
              class="dash-badge"
              :class="`tone-${probeBadge(row.probeStatus).tone}`"
              :aria-label="`线上探测：${probeBadge(row.probeStatus).label}。${probeBadge(row.probeStatus).tooltip}`"
              tabindex="0"
            >
              <span class="badge-icon" aria-hidden="true">{{ probeBadge(row.probeStatus).icon }}</span>
              {{ probeBadge(row.probeStatus).label }}
            </span>
          </el-tooltip>
          <div v-if="probeSubline(row)" class="probe-subline">{{ probeSubline(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="豁免" width="80" class-name="hide-sm">
        <template #default="{ row }">
          <span v-if="isExemptRow(row)" class="exempt-check" aria-label="探测豁免">✓</span>
          <span v-else class="cell-dash" aria-label="未豁免">—</span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="rows.length === 0" class="no-match" role="status">
      <el-empty description="无匹配证书，请调整筛选条件" :image-size="72" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 看板表格卡（AC2/AC3）：工具栏三维筛选（状态分级 / 云多选命中其一 / 托管类型，
 * 客户端过滤——filter 状态由父级持有并联动总览卡）+ 最近巡检与通配符跳过计数 meta。
 * 列：子域名（下行云 chips）/ 剩余天数（状态色徽章 + 图标双通道）/ 托管类型 /
 * 线上探测（四态徽章 + 补充枚举，tooltip 说明；差异行附最近探测时间）/ 豁免（✓/—）。
 * 行点击 → 父级打开探测详情抽屉。小屏隐藏托管类型/豁免列（ui-design 响应式列优先级）。
 */
import type { DashboardItem, DaysLeftTier, HostingStatus } from '@/api/cert'
import { cloudLabel } from '../../detail/format'
import { daysLeftBadge, hostingStatusMeta } from '../../ledger/format'
import { DASHBOARD_LEVEL_CARDS, isExemptRow, probeBadge, relativeTimeDash, type DashboardFilter } from '../format'

defineProps<{
    rows: DashboardItem[]
    cloudOptions: string[]
    filter: DashboardFilter
    /** 云多选选项（referencedClouds 去重） */
    disabled?: boolean
    lastInspectionAt: string | null
    wildcardSkippedCount: number
}>()

const emit = defineEmits<{
    (e: 'filter-change', patch: Partial<DashboardFilter>): void
    (e: 'row-click', row: DashboardItem): void
}>()

function onLevelChange(v: DaysLeftTier | '') {
    emit('filter-change', { level: v || '' })
}

function onCloudsChange(v: string[]) {
    emit('filter-change', { clouds: v })
}

function onHostingChange(v: HostingStatus | '') {
    emit('filter-change', { hosting: v || '' })
}

/** 差异/变更关联态 tooltip 追加最近探测时间（ui-design 差异行角标口径） */
function probeTooltip(row: DashboardItem): string {
    const base = probeBadge(row.probeStatus).tooltip
    if (row.probeStatus === 'diff' || row.probeStatus === 'change_linked_diff') {
        const at = row.lastProbeAt ? relativeTimeDash(row.lastProbeAt) : '尚未探测'
        return `${base}（最近探测：${at}）`
    }
    return base
}

/** 徽章下行小字：差异/变更关联显示最近探测时间，不可达显示端口不通口径提示 */
function probeSubline(row: DashboardItem): string {
    if (row.probeStatus === 'diff' || row.probeStatus === 'change_linked_diff') {
        return row.lastProbeAt ? relativeTimeDash(row.lastProbeAt) : ''
    }
    if (row.probeStatus === 'unreachable') return '端口不通 / 超时'
    return ''
}

function rowClassName({ row }: { row: DashboardItem }) {
    return row.probeStatus === 'diff' ? 'row-diff' : ''
}

function onRowClick(row: DashboardItem) {
    emit('row-click', row)
}
</script>

<style lang="scss" scoped>
.dashboard-table-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px 0;
  flex-wrap: wrap;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-select {
  width: 170px;
}

.toolbar-clouds {
  width: 200px;
}

.meta-item {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.wildcard-meta {
  cursor: help;
  border-bottom: 1px dotted var(--border-strong);
}

.dashboard-table {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: var(--cert-surface-alt);
  --el-table-row-hover-bg-color: var(--cert-surface-alt);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-primary);

  margin-top: 16px;

  :deep(.el-table__row) {
    cursor: pointer;
  }

  :deep(th.el-table__cell) {
    font-weight: 500;
  }
}

.cell-domain {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.domain-main {
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.domain-clouds {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cloud-chip {
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.dash-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;

  .badge-icon {
    font-size: 11px;
  }

  &.tone-success {
    color: var(--cert-success);
    border-color: color-mix(in srgb, var(--cert-success) 40%, transparent);
  }

  &.tone-warning {
    color: var(--cert-warning);
    border-color: color-mix(in srgb, var(--cert-warning) 40%, transparent);
  }

  &.tone-error {
    color: var(--cert-error);
    border-color: color-mix(in srgb, var(--cert-error) 40%, transparent);
  }

  &.tone-secondary {
    color: #a1a1a1; // Text Secondary 对 Surface Alt #171717 提升对比度（无障碍规范）
    border-color: var(--border-base);
  }
}

.probe-subline {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-secondary);
}

.exempt-check {
  color: var(--cert-success);
}

.cell-dash {
  color: var(--text-secondary);
}

.no-match {
  padding: 8px 0 16px;
}

@media (max-width: 1023px) {
  :deep(.hide-sm) {
    display: none;
  }
}
</style>
