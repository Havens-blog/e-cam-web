<template>
  <div class="cert-table-card">
    <div class="table-toolbar" aria-label="表格筛选工具栏">
      <el-input
        v-model="searchText"
        class="table-search"
        type="search"
        placeholder="按域名 / SAN / 指纹片段搜索"
        aria-label="搜索证书（域名 / SAN / 指纹片段）"
        clearable
        :disabled="disabled"
        @input="onSearchInput"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <div class="toolbar-spacer" />
      <el-select
        v-model="hostingFilter"
        class="toolbar-select"
        aria-label="筛选托管状态"
        :disabled="disabled"
        @change="emitFilters"
      >
        <el-option label="托管状态：全部" value="" />
        <el-option label="完整托管" value="complete" />
        <el-option label="仅指纹登记" value="fingerprint_only" />
      </el-select>
      <el-select
        v-model="daysFilter"
        class="toolbar-select"
        aria-label="筛选剩余天数"
        :disabled="disabled"
        @change="emitFilters"
      >
        <el-option label="剩余天数：全部" value="" />
        <el-option label="≤7 天" value="le7" />
        <el-option label="≤14 天" value="le14" />
        <el-option label="≤30 天" value="le30" />
        <el-option label=">30 天" value="gt30" />
        <el-option label="已过期" value="expired" />
      </el-select>
    </div>

    <el-table
      class="cert-table"
      :data="rows"
      row-key="id"
      :row-class-name="rowClassName"
      tabindex="0"
      aria-label="证书台账列表"
      @row-click="onRowClick"
    >
      <el-table-column label="域名 / SAN" min-width="280">
        <template #default="{ row }">
          <div class="cell-domain">
            <span class="domain-main">{{ row.commonName }}</span>
            <div class="domain-sans">
              <span v-for="san in sansView(row).visible" :key="san" class="san-chip">{{ san }}</span>
              <el-tooltip
                v-if="sansView(row).folded"
                :content="sansView(row).hiddenList.join(' · ')"
                placement="top"
              >
                <span class="san-chip san-more" tabindex="0">+{{ sansView(row).hiddenCount }} SAN</span>
              </el-tooltip>
            </div>
            <div class="domain-fp">
              <span class="fp-mono">{{ truncateFingerprint(row.fingerprint) }}</span>
              <el-tooltip content="复制完整指纹" placement="top">
                <button
                  type="button"
                  class="copy-btn"
                  :aria-label="`复制证书 ${row.commonName} 的完整指纹`"
                  @click.stop="onCopyFingerprint(row)"
                >
                  <el-icon><CopyDocument /></el-icon>
                </button>
              </el-tooltip>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="issuer" label="签发者" min-width="120" show-overflow-tooltip class-name="hide-sm" />
      <el-table-column label="有效期至" width="110" class-name="hide-sm">
        <template #default="{ row }">{{ formatDate(row.notAfter) }}</template>
      </el-table-column>
      <el-table-column label="剩余" width="120">
        <template #default="{ row }">
          <span class="ledger-badge" :class="`tone-${daysLeftBadge(row.daysLeft).tone}`">
            <span class="badge-icon" aria-hidden="true">{{ daysLeftBadge(row.daysLeft).icon }}</span>
            {{ daysLeftBadge(row.daysLeft).text }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="托管状态" width="110">
        <template #default="{ row }">
          <span class="ledger-badge" :class="`tone-${hostingStatusMeta(row.hostingStatus).tone}`">
            {{ hostingStatusMeta(row.hostingStatus).label }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="保护期" width="130">
        <template #default="{ row }">
          <span
            v-if="protectDaysLeft(row.protectUntil) > 0"
            class="ledger-badge tone-protect"
          >
            <span class="badge-icon" aria-hidden="true">🔒</span>保护期 {{ protectDaysLeft(row.protectUntil) }} 天
          </span>
          <span v-else class="cell-dash" aria-label="不在保护期">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="refCount" label="引用数" width="80" class-name="hide-sm" />
      <el-table-column label="操作" width="200" fixed="right" class-name="col-actions">
        <template #default="{ row }">
          <button type="button" class="row-link" @click.stop="emit('view', row)">详情</button>
          <button
            v-if="row.hostingStatus === 'complete'"
            type="button"
            class="row-link"
            @click.stop="emit('initiate-change', row)"
          >
            发起更换
          </button>
          <el-dropdown trigger="click" @command="(cmd: string) => onCommand(cmd, row)">
            <button type="button" class="row-more" aria-label="更多操作" @click.stop>
              <el-icon><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="row.hostingStatus === 'fingerprint_only'" command="supply-key">
                  补传私钥
                </el-dropdown-item>
                <el-dropdown-item command="delete" class="dropdown-danger">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-pagination" aria-live="polite">
      <span class="page-info">共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</span>
      <div>
        <el-button size="small" :disabled="page <= 1 || disabled" @click="changePage(page - 1)">上一页</el-button>
        <el-button size="small" :disabled="page >= totalPages || disabled" @click="changePage(page + 1)">下一页</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 证书表格卡：搜索 + 托管状态/剩余天数筛选 + 服务端分页（20/页）+ 行点击进详情。
 * 列：域名/SAN（指纹 mono 截断+复制）、签发者、有效期、剩余（状态色）、托管状态、
 * 保护期（锁徽章）、引用数、操作（详情/发起更换[完整托管]/⋯ 补传私钥[仅指纹]/删除）。
 * 查询状态由父级持有（服务端过滤：listCertsApi search/hostingStatus/daysLeft），
 * 本组件负责输入防抖与变更上抛（AC2）。
 */
import type { CertListItem, DaysLeftTier, HostingStatus } from '@/api/cert'
import { CopyDocument, MoreFilled, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import { copyText, daysLeftBadge, foldSans, hostingStatusMeta, protectDaysLeft, truncateFingerprint } from '../format'

const props = defineProps<{
    rows: CertListItem[]
    total: number
    page: number
    pageSize: number
    /** 服务端查询进行中（筛选控件仍可操作，防抖输入不丢失） */
    disabled?: boolean
    /** 新导入证书行高亮（导入成功后置顶提示） */
    highlightId?: string | null
}>()

const emit = defineEmits<{
    (e: 'query-change', q: { search?: string; hostingStatus?: HostingStatus | ''; daysLeft?: DaysLeftTier | '' }): void
    (e: 'page-change', page: number): void
    (e: 'row-click', row: CertListItem): void
    (e: 'view', row: CertListItem): void
    (e: 'initiate-change', row: CertListItem): void
    (e: 'supply-key', row: CertListItem): void
    (e: 'delete', row: CertListItem): void
}>()

const searchText = ref('')
const hostingFilter = ref<HostingStatus | ''>('')
const daysFilter = ref<DaysLeftTier | ''>('')

let searchTimer: ReturnType<typeof setTimeout> | null = null

/** 搜索 300ms 防抖（输入即查的体感 + 避免逐键打服务端） */
function onSearchInput() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(emitFilters, 300)
}

function emitFilters() {
    emit('query-change', {
        search: searchText.value.trim(),
        hostingStatus: hostingFilter.value,
        daysLeft: daysFilter.value,
    })
}

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

function changePage(p: number) {
    if (p < 1 || p > totalPages.value) return
    emit('page-change', p)
}

function sansView(row: CertListItem) {
    // 域名主列已展示 commonName，chips 展示其余 SAN；>3 折叠 +N（悬浮/键盘焦点展开全部）
    return foldSans(row.sans.filter((s) => s !== row.commonName))
}

function formatDate(iso: string) {
    const d = dayjs(iso)
    return d.isValid() ? d.format('YYYY-MM-DD') : '—'
}

async function onCopyFingerprint(row: CertListItem) {
    const ok = await copyText(row.fingerprint)
    if (ok) ElMessage.success('已复制')
    else ElMessage.error('复制失败，请手动复制')
}

function onCommand(cmd: string, row: CertListItem) {
    if (cmd === 'supply-key') emit('supply-key', row)
    else if (cmd === 'delete') emit('delete', row)
}

function rowClassName({ row }: { row: CertListItem }) {
    return row.id === props.highlightId ? 'row-highlight' : ''
}

function onRowClick(row: CertListItem) {
    emit('row-click', row)
}
</script>

<style lang="scss" scoped>
.cert-table-card {
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

.table-search {
  width: 320px;
  max-width: 100%;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-select {
  width: 170px;
}

.cert-table {
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

    &.row-highlight td {
      background: var(--cert-highlight-bg);
      box-shadow: inset 3px 0 0 var(--cert-accent);
    }
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
}

.domain-sans {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.san-chip {
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-secondary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.san-more {
  color: var(--text-primary);
  cursor: default;
}

.domain-fp {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fp-mono {
  font-family: var(--cert-font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--cert-accent);
    background: var(--cert-surface-alt);
  }
}

.ledger-badge {
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

  &.tone-warning.tone-deep {
    color: var(--cert-warning-deep);
  }

  &.tone-error {
    color: var(--cert-error);
    border-color: color-mix(in srgb, var(--cert-error) 40%, transparent);
  }

  &.tone-accent {
    color: var(--cert-accent);
    border-color: color-mix(in srgb, var(--cert-accent) 40%, transparent);
  }

  &.tone-secondary {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }

  &.tone-protect {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }
}

.cell-dash {
  color: var(--text-secondary);
}

.row-link {
  border: none;
  background: transparent;
  color: var(--cert-accent);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;

  &:hover {
    color: var(--cert-accent-hover);
  }
}

.row-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    color: var(--text-primary);
    background: var(--cert-surface-alt);
  }
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--border-base);
}

.page-info {
  font-size: 13px;
  color: var(--text-secondary);
}

@media (max-width: 1023px) {
  :deep(.hide-sm) {
    display: none;
  }
}
</style>
