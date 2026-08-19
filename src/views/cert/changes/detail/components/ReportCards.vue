<template>
  <div class="report-cards">
    <!-- 卡1 变更清单 -->
    <section class="card" aria-labelledby="card-list-title">
      <h2 id="card-list-title">变更清单</h2>
      <el-table :data="items" class="mini-table" aria-label="变更清单">
        <el-table-column label="资源" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.target.resourceId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="云 / 产品" min-width="150">
          <template #default="{ row }">{{ targetLocationLabel(row.target) }}</template>
        </el-table-column>
        <el-table-column label="计划动作" width="140">
          <template #default="{ row }">
            <span v-if="row.autoChangeable">{{ actionLabel(row.action) }}</span>
            <span v-else class="text-secondary">—</span>
          </template>
        </el-table-column>
        <el-table-column label="原证书 ID" min-width="140" class-name="hide-sm">
          <template #default>
            <span class="text-secondary">—</span>
          </template>
        </el-table-column>
        <el-table-column label="可执行性" min-width="200">
          <template #default="{ row }">
            <span v-if="row.autoChangeable" class="chg-badge tone-success">
              <span class="badge-icon" aria-hidden="true">✓</span>可执行
            </span>
            <template v-else>
              <span class="chg-badge tone-warning">
                <span class="badge-icon" aria-hidden="true">⚠</span>不可执行
              </span>
              <div class="text-secondary text-sm block-reason">
                {{ row.reason || '不可自动变更' }} · {{ blockedExit(row.reason) }}
              </div>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <!-- 卡2 逐项执行结果（批次 + 结果筛选） -->
    <section class="card" aria-labelledby="card-results-title">
      <div class="card-head">
        <h2 id="card-results-title">逐项执行结果</h2>
        <div class="filters">
          <div class="segmented" role="group" aria-label="结果筛选">
            <button
              v-for="opt in RESULT_FILTER_OPTIONS"
              :key="opt.value"
              type="button"
              class="seg-btn"
              :class="{ active: resultFilter === opt.value }"
              :aria-pressed="resultFilter === opt.value"
              @click="resultFilter = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <el-select
            v-model="batchFilter"
            class="batch-select"
            aria-label="按批次筛选"
            placeholder="批次：全部"
            clearable
            size="small"
          >
            <el-option v-for="b in batchOptions(items)" :key="b" :label="`批次 ${b}`" :value="b" />
          </el-select>
        </div>
      </div>
      <el-table
        :data="filteredResultItems"
        class="mini-table"
        :row-class-name="resultRowClass"
        aria-label="逐项执行结果"
      >
        <el-table-column label="资源" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.target.resourceId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="结果" width="150">
          <template #default="{ row }">
            <span
              class="chg-badge"
              :class="`tone-${itemStatusBadge(row.status).tone}`"
              :aria-label="`结果：${itemStatusBadge(row.status).label}`"
            >
              <span v-if="itemStatusBadge(row.status).spinner" class="spinner" aria-hidden="true" />
              <span v-else class="badge-icon" aria-hidden="true">{{ itemStatusBadge(row.status).icon }}</span>
              {{ itemStatusBadge(row.status).label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="200" class-name="hide-sm">
          <template #default="{ row }">
            <span :class="row.error ? 'error-text' : 'text-secondary'">{{ row.error || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="批次" width="90" class-name="hide-sm">
          <template #default="{ row }">{{ row.batchNo > 0 ? row.batchNo : '—' }}</template>
        </el-table-column>
      </el-table>
      <div v-if="filteredResultItems.length === 0" class="no-match">无匹配结果，请调整筛选条件</div>
    </section>

    <!-- 卡3 回滚状态 -->
    <section class="card" aria-labelledby="card-rollback-title">
      <h2 id="card-rollback-title">回滚状态</h2>
      <template v-if="rolledItems.length > 0">
        <el-table :data="rolledItems" class="mini-table" aria-label="回滚状态">
          <el-table-column label="资源" min-width="180">
            <template #default="{ row }">
              <span class="mono">{{ row.target.resourceId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="回滚结果" width="150">
            <template #default="{ row }">
              <span
                class="chg-badge"
                :class="`tone-${itemStatusBadge(row.status).tone}`"
              >
                <span class="badge-icon" aria-hidden="true">{{ itemStatusBadge(row.status).icon }}</span>
                {{ itemStatusBadge(row.status).label }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="错误信息" min-width="220">
            <template #default="{ row }">
              <span :class="row.error ? 'error-text' : 'text-secondary'">
                {{ row.error || (row.status === 'rollback_failed' ? '回滚目标无效或云侧失败，已转人工' : '已恢复旧证书引用') }}
              </span>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <p v-else class="text-secondary empty-note">未执行回滚</p>
    </section>

    <!-- 卡4 验证结论（未达标清单 + 窗口结论） -->
    <section class="card" aria-labelledby="card-verify-title">
      <h2 id="card-verify-title">验证结论</h2>
      <p class="text-secondary verify-summary">{{ verifyConclusion(report?.verify) }}</p>
      <template v-if="unmetDomains.length > 0">
        <h3 class="sub-title">未达标清单</h3>
        <div class="unmet-list">
          <span v-for="d in unmetDomains" :key="d" class="unmet-chip mono">
            <span class="badge-icon" aria-hidden="true">✗</span>{{ d }}
          </span>
        </div>
      </template>
      <el-table :data="items" class="mini-table" aria-label="逐项验证结论">
        <el-table-column label="资源" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.target.resourceId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="预期终态" min-width="140">
          <template #default>
            <span class="mono">{{ expectedShort }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实际" min-width="140">
          <template #default="{ row }">
            <span class="text-secondary">{{ verifyActualText(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="判定" min-width="140">
          <template #default="{ row }">
            <span class="chg-badge" :class="`tone-${verifyVerdict(row).tone}`">
              <span class="badge-icon" aria-hidden="true">{{ verifyVerdict(row).icon }}</span>
              {{ verifyVerdict(row).label }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <!-- 卡5 孤儿证书补偿清理 -->
    <section class="card" aria-labelledby="card-orphan-title">
      <h2 id="card-orphan-title">孤���证书补偿清理</h2>
      <el-table
        v-if="orphanCleanup.length > 0"
        :data="orphanCleanup"
        class="mini-table"
        aria-label="孤儿证书补偿清理结果"
      >
        <el-table-column label="云 / 资源" min-width="220">
          <template #default="{ row }">
            {{ cloudLabel(row.cloud) }} · <span class="mono">{{ row.cloudCertId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="清理动作" min-width="160">
          <template #default="{ row }">{{ orphanActionLabel(row.action) }}</template>
        </el-table-column>
        <el-table-column label="结果" min-width="160">
          <template #default="{ row }">
            <span v-if="row.success" class="chg-badge tone-success">
              <span class="badge-icon" aria-hidden="true">✓</span>成功
            </span>
            <span v-else class="chg-badge tone-error">
              <span class="badge-icon" aria-hidden="true">✗</span>失败
            </span>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="text-secondary empty-note">无孤儿证书</p>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 变更报告 5 卡（AC6）：变更清单（可执行性分区 Warning 底色+原因+出路）/
 * 逐项执行结果（结果 segmented + 批次筛选）/ 回滚状态（未回滚 →「未执行回滚」）/
 * 验证结论（窗口结论摘要 + 未达标清单；逐项判定以执行状态为代理——API 无逐项
 * 探测结论端点，见 ../../format.ts 头注适配说明）/ 孤儿证书补偿清理（逐项
 * 成功/失败）。卡标题 h2 建立标题层级供读屏标题导航，卡内表头语义列名。
 */
import type { ChangeDetailItem, ChangeReport, OrphanCleanupResult } from '@/api/cert'
import { computed, ref } from 'vue'
import { cloudLabel } from '../../../detail/format'
import {
    RESULT_FILTER_OPTIONS,
    actionLabel,
    batchOptions,
    blockedExit,
    filterReportItems,
    itemStatusBadge,
    orphanActionLabel,
    rollbackReportItems,
    targetLocationLabel,
    truncateMiddle,
    verifyConclusion,
    type ResultFilter,
} from '../../format'

const props = defineProps<{
    items: ChangeDetailItem[]
    report: ChangeReport | null
    orphanCleanup: OrphanCleanupResult[]
    /** 预期终态指纹（新证书；详情缺省时显示 —） */
    expectedFingerprint?: string
}>()

const resultFilter = ref<ResultFilter>('')
const batchFilter = ref<number | null>(null)

const filteredResultItems = computed(() =>
    filterReportItems(props.items, resultFilter.value, batchFilter.value),
)

const rolledItems = computed(() => rollbackReportItems(props.items))

const unmetDomains = computed(() => props.report?.unmetDomains ?? [])

const expectedShort = computed(() =>
    props.expectedFingerprint ? truncateMiddle(props.expectedFingerprint) : '—',
)

/** 不可执行行 Warning 底色（卡1） */
function resultRowClass({ row }: { row: ChangeDetailItem }): string {
    return row.status === 'failed' || row.status === 'rollback_failed' ? 'row-error' : ''
}

/** 卡4 逐项判定代理（无逐项探测端点）：成功=达标、失败/回滚=差异、其余待验证 */
function verifyVerdict(row: ChangeDetailItem): { label: string; tone: string; icon: string } {
    if (row.status === 'success') return { label: '达标', tone: 'success', icon: '✓' }
    if (row.status === 'failed' || row.status === 'rollback_failed' || row.status === 'rolled_back')
        return { label: '差异', tone: 'error', icon: '✗' }
    return { label: '待验证', tone: 'secondary', icon: '○' }
}

function verifyActualText(row: ChangeDetailItem): string {
    if (row.status === 'success') return expectedShort.value
    if (row.status === 'failed' || row.status === 'rollback_failed') return '—'
    return '待探测'
}
</script>

<style lang="scss" scoped>
.report-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;

  h2 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;

  h2 {
    margin: 0;
  }
}

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  overflow: hidden;
}

.seg-btn {
  appearance: none;
  background: transparent;
  border: none;
  border-right: 1px solid var(--border-base);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 4px 12px;
  cursor: pointer;

  &:last-child {
    border-right: none;
  }

  &.active {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.06);
  }

  &:focus-visible {
    outline: 2px solid #0070f3;
    outline-offset: -2px;
  }
}

.batch-select {
  width: 130px;
}

.mini-table {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: rgba(255, 255, 255, 0.05);
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-primary);

  :deep(th.el-table__cell) {
    font-weight: 500;
  }

  :deep(.row-error) {
    td {
      background: color-mix(in srgb, #ee0000 5%, transparent);
    }
  }
}

.block-reason {
  margin-top: 2px;
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

  &.tone-success {
    color: #50e3c2;
    border-color: color-mix(in srgb, #50e3c2 40%, transparent);
  }

  &.tone-error {
    color: #ee0000;
    border-color: color-mix(in srgb, #ee0000 40%, transparent);
  }

  &.tone-warning {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
  }

  &.tone-accent {
    color: #0070f3;
    border-color: color-mix(in srgb, #0070f3 40%, transparent);
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
  border: 2px solid color-mix(in srgb, #0070f3 30%, transparent);
  border-top-color: #0070f3;
  border-radius: 50%;
  animation: card-spin 0.8s linear infinite;
}

@keyframes card-spin {
  to {
    transform: rotate(360deg);
  }
}

.verify-summary {
  margin: 0 0 12px;
  font-size: 13px;
}

.sub-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.unmet-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.unmet-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #ee0000;
  border: 1px solid color-mix(in srgb, #ee0000 40%, transparent);
  border-radius: 999px;
  padding: 2px 10px;
  word-break: break-all;
}

.empty-note {
  margin: 0;
  font-size: 13px;
}

.no-match {
  padding: 8px 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.error-text {
  color: #ee0000;
  font-size: 13px;
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 12px;
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
