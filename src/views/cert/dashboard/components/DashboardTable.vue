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

    <!-- 孤儿隐藏横幅（同台账模式）：非静默吞行，空态下仍保留；豁免态强制开启并禁用 -->
    <div v-if="viewState.showBanner" class="hidden-banner" role="status">
      <span class="hidden-banner-text">{{ bannerText }}</span>
      <el-switch
        :model-value="viewState.showAll"
        :disabled="viewState.switchDisabled || disabled"
        :aria-label="`查看全部证书（当前${viewState.showAll ? '含' : '不含'}被隐藏的无引用过期证书）`"
        @change="onToggleShowAll"
      />
    </div>

    <el-table
      class="dashboard-table"
      :data="rows"
      row-key="certId"
      tabindex="0"
      aria-label="证书到期与探测列表"
      :row-class-name="rowClassName"
      @row-click="onRowClick"
    >
      <el-table-column label="证书" min-width="240">
        <template #default="{ row }">
          <div class="cell-domain">
            <span class="domain-main">{{ row.commonName }}</span>
            <div class="domain-clouds">
              <el-tooltip
                v-if="row.sans.length > 1"
                :content="`共 ${row.sans.length} 个 SAN：${row.sans.join('、')}`"
                placement="top"
              >
                <span class="sans-chip" tabindex="0">SAN ×{{ row.sans.length }}</span>
              </el-tooltip>
              <el-tooltip
                v-if="row.hidden"
                content="服务端隐藏谓词命中（已过期且未发现引用），当前处于豁免/查看全部视图"
                placement="top"
              >
                <span class="sans-chip hidden-chip" tabindex="0">无引用过期</span>
              </el-tooltip>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="引用云" min-width="130">
        <template #default="{ row }">
          <div v-if="row.referencedClouds.length > 0" class="domain-clouds">
            <span v-for="c in row.referencedClouds" :key="c" class="cloud-chip">{{ cloudLabel(c) }}</span>
          </div>
          <span v-else class="cell-dash">—</span>
        </template>
      </el-table-column>
      <el-table-column label="剩余天数" width="120">
        <template #default="{ row }">
          <span class="dash-badge" :class="`tone-${daysLeftBadge(row.daysLeft).tone}`">
            <span class="badge-icon" aria-hidden="true">{{ daysLeftBadge(row.daysLeft).icon }}</span>
            {{ daysLeftBadge(row.daysLeft).text }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="托管类型" width="110" class-name="hide-sm">
        <template #default="{ row }">{{ hostingStatusMeta(row.hostingType).label }}</template>
      </el-table-column>
      <el-table-column label="签发者" min-width="140" class-name="hide-sm" show-overflow-tooltip>
        <template #default="{ row }">{{ row.issuer || '—' }}</template>
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
      <el-table-column label="豁免" width="70" class-name="hide-sm">
        <template #default="{ row }">
          <span v-if="isExemptRow(row)" class="exempt-check" aria-label="探测豁免">✓</span>
          <span v-else class="cell-dash" aria-label="未豁免">—</span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="rows.length === 0" class="no-match" role="status">
      <el-empty description="无匹配证书，请调整筛选条件" :image-size="72">
        <el-button v-if="hiddenCount > 0 && !viewState.showAll" class="show-all-cta" @click="setShowAll(true)">
          查看全部证书（含已隐藏 {{ hiddenCount }} 张）
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 看板表格卡（证书粒度，dashboard-cert-granularity 任务 2）：
 * - 证书行渲染：CN + SAN 折叠计数 + 引用云 chips + 剩余天数 + 托管类型 + 签发者 +
 *   线上探测聚合徽标 + 豁免；Hard Rule：row-key=certId（证书粒度下域名不唯一，
 *   域名 key 会导致 Vue 行复用错乱）。
 * - 孤儿默认隐藏（服务端执行，前端不重写三态）：工具栏横幅开关「查看全部」，
 *   开关态持久化 localStorage（cert.dashboard.hiddenExpanded，按用户对账刷新不丢）；
 *   风险维度卡激活（分级/diff/exempt，总规则）时强制开启并禁用，清除恢复原态。
 * - 云筛选选项由当前可见行派生（非 hidden 行；隐藏态不含孤儿所属云，选中即空态反例）。
 * - 豁免接线：showAll 变化经 show-all-change 上抛，父级以 includeHidden=true 重拉全量。
 * - 行点击 → 父级打开证书多 SAN 探测抽屉。本卡无任何变更类操作入口（只读边界）。
 */
import type { DashboardItem, DaysLeftTier, HostingStatus } from '@/api/cert'
import { computed, ref, watch } from 'vue'
import { cloudLabel } from '../../detail/format'
import { HIDDEN_EXPANDED_BANNER_TEXT, daysLeftBadge, hiddenBannerText, hostingStatusMeta } from '../../ledger/format'
import {
    DASHBOARD_LEVEL_CARDS,
    cloudFilterOptions,
    isExemptRow,
    isRiskFilterActive,
    loadHiddenExpanded,
    probeBadge,
    relativeTimeDash,
    resolveDashboardHiddenViewState,
    saveHiddenExpanded,
    type DashboardFilter,
} from '../format'

const props = defineProps<{
    /** 展示行（父级客户端过滤后的可见行集） */
    rows: DashboardItem[]
    /** 服务端行全集（云选项派生源；隐藏态下 hidden 行不入选项） */
    items: DashboardItem[]
    filter: DashboardFilter
    disabled?: boolean
    /** 服务端双口径全局隐藏数（同一快照；前端不推算） */
    hiddenCount: number
    lastInspectionAt: string | null
    wildcardSkippedCount: number
}>()

const emit = defineEmits<{
    (e: 'filter-change', patch: Partial<DashboardFilter>): void
    (e: 'row-click', row: DashboardItem): void
    /** 生效 showAll（含豁免强制）变化 → 父级以 includeHidden 重拉 */
    (e: 'show-all-change', showAll: boolean): void
}>()

function safeLocalStorage(): Storage | null {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null
    } catch {
        return null
    }
}

/** 开关持久化态（localStorage 按「1」标记；旧版本无记录 → false 默认隐藏） */
const hiddenExpanded = ref(loadHiddenExpanded(safeLocalStorage()))

const viewState = computed(() =>
    resolveDashboardHiddenViewState({
        expanded: hiddenExpanded.value,
        exemptActive: isRiskFilterActive(props.filter),
        hiddenCount: props.hiddenCount,
    }),
)

/** 云筛选选项：由当前可见行（服务端全集去 hidden 行）派生 */
const cloudOptions = computed(() => cloudFilterOptions(props.items))

const bannerText = computed(() =>
    viewState.value.showAll
        ? props.filter.level !== '' || props.filter.special !== ''
            ? '已按风险筛选显示全部（含无引用过期证书）'
            : HIDDEN_EXPANDED_BANNER_TEXT
        : hiddenBannerText(props.hiddenCount),
)

// 生效 showAll 变化 → 上抛父级（includeHidden 重拉）；豁免强制开启/清除恢复亦经此通知
watch(
    () => viewState.value.showAll,
    (v) => emit('show-all-change', v),
    { immediate: true },
)

function setShowAll(v: boolean) {
    hiddenExpanded.value = v
    saveHiddenExpanded(v, safeLocalStorage())
}

function onToggleShowAll(v: boolean | string | number) {
    setShowAll(Boolean(v))
}

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

// 组件测试锚点：云选项派生与隐藏视图状态机（不引内部实现细节之外的契约）
defineExpose({ cloudOptions, viewState, hiddenExpanded })
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

.hidden-banner {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin: 12px 24px 0;
  padding: 6px 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--cert-surface-alt);
}

.hidden-banner-text {
  font-size: 13px;
  color: var(--text-secondary);
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

.sans-chip,
.cloud-chip {
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.hidden-chip {
  color: var(--cert-warning);
  border-color: color-mix(in srgb, var(--cert-warning) 40%, transparent);
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
