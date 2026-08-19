<template>
  <div class="change-table-card">
    <el-table
      class="change-table"
      :data="rows"
      row-key="id"
      aria-label="变更单列表"
      @row-click="onRowClick"
    >
      <el-table-column label="变更单号" width="140">
        <template #default="{ row }">
          <span class="mono cell-id">{{ row.id }}</span>
        </template>
      </el-table-column>
      <el-table-column label="旧证书 → 新证书" min-width="280">
        <template #default="{ row }">
          <div class="cell-pair">
            <el-tooltip :content="row.oldFingerprint" placement="top">
              <span class="mono">{{ truncateMiddle(row.oldFingerprint) }}</span>
            </el-tooltip>
            <span
              v-if="rowProtectDaysLeft(row.protectUntil) > 0"
              class="badge-protect"
            >
              <span class="badge-icon" aria-hidden="true">🔒</span>保护期
              {{ rowProtectDaysLeft(row.protectUntil) }} 天
            </span>
            <span class="arrow" aria-hidden="true">→</span>
            <el-tooltip :content="row.newCertId" placement="top">
              <span class="mono">{{ truncateMiddle(row.newCertId) }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="130">
        <template #default="{ row }">
          <span
            class="chg-badge"
            :class="`tone-${changeStatusMeta(row.status).tone}`"
            :aria-label="`状态：${changeStatusMeta(row.status).label}`"
          >
            <span v-if="changeStatusMeta(row.status).spinner" class="spinner sm" aria-hidden="true" />
            <span v-else class="badge-icon" aria-hidden="true">{{ changeStatusMeta(row.status).icon }}</span>
            {{ changeStatusMeta(row.status).label }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="进度" min-width="150" class-name="hide-sm">
        <template #default="{ row }">
          <span class="cell-progress">
            <template v-if="progressMap[row.id]">{{ progressText(progressMap[row.id]!) }}</template>
            <template v-else>{{ batchText(row) || '—' }}</template>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="发起人" width="130" class-name="hide-sm">
        <template #default="{ row }">{{ row.creator }}</template>
      </el-table-column>
      <el-table-column label="时间" width="150" class-name="hide-sm">
        <template #default="{ row }">
          <span class="cell-time">{{ formatDateTime(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" class-name="col-actions">
        <template #default="{ row }">
          <router-link
            class="btn-link"
            :to="rowActionTarget(row)"
            @click.stop
          >
            {{ isEditableRow(row.status) ? '继续编辑' : '详情' }}
          </router-link>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
/**
 * 变更单表格（AC1）：列 = 单号(mono)/旧→新(旧侧保护期徽章)/状态徽章/
 * 进度(活跃行由 10s 轮询派生，非活跃行显示批次或 —)/发起人/时间/操作。
 * 行点击 → 草稿·待确认进向导恢复编辑，其余进报告详情页。
 * 小屏隐藏 进度/发起人/时间 列（ui-design 表格列优先级：变更列表保留
 * 单号·旧→新·状态·操作）。
 */
import type { ChangeOrder } from '@/api/cert'
import type { ExecProgress } from '../format'
import { batchText, isEditableRow, progressText, rowProtectDaysLeft, truncateMiddle } from '../format'
import { changeStatusMeta, relativeTime } from '../../detail/format'

defineProps<{
    rows: ChangeOrder[]
    /** 活跃行 10s 轮询派生的进度汇总（id → summarizeProgress 结果） */
    progressMap: Record<string, ExecProgress>
}>()

const emit = defineEmits<{ (e: 'row-click', row: ChangeOrder): void }>()

function onRowClick(row: ChangeOrder) {
    emit('row-click', row)
}

/** 行操作目标：草稿/待确认 → 向导恢复；其余 → 报告详情 */
function rowActionTarget(row: ChangeOrder): string {
    return isEditableRow(row.status) ? `/certs/changes/new?orderId=${encodeURIComponent(row.id)}` : `/certs/changes/${row.id}`
}

function formatDateTime(iso: string): string {
    const rel = relativeTime(iso)
    return rel === '—' ? rel : iso.slice(0, 16).replace('T', ' ')
}
</script>

<style lang="scss" scoped>
.change-table-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  overflow: hidden;
}

.change-table {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: var(--cert-surface-alt);
  --el-table-row-hover-bg-color: var(--cert-surface-alt);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-primary);

  :deep(.el-table__row) {
    cursor: pointer;
  }

  :deep(th.el-table__cell) {
    font-weight: 500;
  }
}

.mono {
  font-family: var(--cert-font-mono);
  font-size: 13px;
}

.cell-id {
  color: var(--text-primary);
}

.cell-pair {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.arrow {
  color: var(--text-secondary);
}

.badge-protect {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: #a1a1a1; // 表体/hover 行�� Text Secondary 对比度提升（无障碍规范）
  border: 1px solid var(--border-base);
  border-radius: 999px;
  padding: 0 8px;
  white-space: nowrap;

  .badge-icon {
    font-size: 11px;
  }
}

.chg-badge {
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

  &.tone-accent {
    color: var(--cert-accent);
    border-color: color-mix(in srgb, var(--cert-accent) 40%, transparent);
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

  &.tone-verifying {
    color: #8b5cf6;
    border-color: color-mix(in srgb, #8b5cf6 40%, transparent);
  }

  &.tone-secondary {
    color: #a1a1a1;
    border-color: var(--border-base);
  }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--cert-accent) 30%, transparent);
  border-top-color: var(--cert-accent);
  border-radius: 50%;
  animation: chg-spin 0.8s linear infinite;
}

@keyframes chg-spin {
  to {
    transform: rotate(360deg);
  }
}

.cell-progress {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.cell-time {
  color: var(--text-secondary);
  font-size: 12px;
}

.btn-link {
  color: var(--cert-accent);
  font-size: 13px;
  text-decoration: none;

  &:hover {
    color: var(--cert-accent-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: 2px;
  }
}

@media (max-width: 1023px) {
  :deep(.hide-sm) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
