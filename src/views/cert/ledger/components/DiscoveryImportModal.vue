<template>
  <el-dialog
    v-model="visible"
    width="760px"
    align-center
    class="cert-modal discovery-modal"
    :close-on-click-modal="false"
    aria-labelledby="discovery-import-title"
    @closed="onClosed"
  >
    <template #header>
      <h3 id="discovery-import-title" class="modal-title">从云端导入</h3>
    </template>

    <!-- 加载中 -->
    <div v-if="state === 'loading'" class="ds-loading" aria-label="正在加载云端发现预览">
      <div class="ds-loading-line" />
      <div class="ds-loading-line ds-loading-line-short" />
      <div class="ds-loading-line" />
    </div>

    <!-- 无 done 快照引导占位（任务 8 接管：触发扫描 → 轮询 snapshot-status → 重进预览） -->
    <div v-else-if="state === 'no-snapshot'" class="ds-state" data-testid="discovery-no-snapshot">
      <div class="ds-state-icon" aria-hidden="true">📡</div>
      <div class="ds-state-title">暂无可用的扫描快照</div>
      <div class="ds-state-desc">
        云端发现导入基于最近一次完成的证书引用扫描结果生成清单。请先执行一次引用扫描并等待完成，再返回此处预览可导入证书。
      </div>
      <div class="ds-state-hint">「触发扫描并进入预览」引导即将上线。</div>
      <!-- 任务 8 引导流程触发点：将替换为触发扫描 + 轮询快照状态交互 -->
      <el-button type="primary" disabled data-testid="discovery-trigger-scan-placeholder">
        触发扫描并进入预览（即将上线）
      </el-button>
      <el-button data-testid="discovery-reload" @click="loadPreview">重新检查</el-button>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="state === 'error'" class="ds-state" data-testid="discovery-error">
      <div class="ds-state-icon ds-state-icon-error" aria-hidden="true">⚠</div>
      <div class="ds-state-title">预览加载失败</div>
      <div class="ds-state-desc">{{ errorMsg }}</div>
      <el-button @click="loadPreview">重试</el-button>
    </div>

    <!-- 预览清单 -->
    <template v-else-if="state === 'loaded'">
      <el-alert
        v-if="stale"
        type="warning"
        :closable="false"
        show-icon
        class="ds-stale-alert"
        data-testid="discovery-stale-alert"
      >
        快照已超过 {{ SNAPSHOT_STALE_DAYS }} 天（{{ snapshotTimeText }}），清单可能与云端现状存在漂移，建议先重新执行引用扫描。
      </el-alert>

      <div class="ds-meta" aria-live="polite">
        <span>共 {{ summary.total }} 张证书</span>
        <span class="ds-meta-dot" aria-hidden="true">·</span>
        <span>待登记 {{ summary.selectable }}</span>
        <span class="ds-meta-dot" aria-hidden="true">·</span>
        <span>已在台账 {{ summary.inLedger }}</span>
        <span class="ds-meta-dot" aria-hidden="true">·</span>
        <span>暂不支持 {{ summary.unsupported }}</span>
        <span class="ds-meta-spacer" />
        <span class="ds-meta-time">快照时间：{{ snapshotTimeText || '—' }}</span>
      </div>

      <div v-if="groups.length === 0" class="ds-state" data-testid="discovery-empty-list">
        <div class="ds-state-title">快照内未发现可展示的云端证书</div>
        <div class="ds-state-desc">可重新执行引用扫描后再次预览。</div>
      </div>

      <!-- 按云分组（大清单分组折叠即可，无需虚拟滚动） -->
      <div v-else class="ds-groups">
        <div
          v-for="g in groups"
          :key="g.cloud"
          class="ds-group"
          :class="{ 'ds-group-unsupported': g.unsupported }"
          data-testid="discovery-group"
        >
          <div
            class="ds-group-head"
            role="button"
            tabindex="0"
            :aria-expanded="!isCollapsed(g.cloud)"
            :aria-label="`分组 ${g.label}（${g.entries.length} 张）`"
            @click="toggleCollapse(g.cloud)"
            @keydown.enter.prevent="toggleCollapse(g.cloud)"
          >
            <span class="ds-chevron" :class="{ 'ds-chevron-open': !isCollapsed(g.cloud) }" aria-hidden="true">▸</span>
            <span
              v-if="!g.unsupported"
              class="ds-group-check"
              data-testid="discovery-group-check"
              @click.stop
              @keydown.stop
            >
              <el-checkbox
                :model-value="groupChecked(g)"
                :indeterminate="groupIndeterminate(g)"
                :aria-label="`全选 ${g.label} 待登记证书`"
                @change="() => toggleGroup(g)"
              />
            </span>
            <span v-else class="ds-group-lock" aria-hidden="true">🔒</span>
            <span class="ds-group-title">{{ g.label }}</span>
            <span class="ds-group-count">{{ g.entries.length }} 张</span>
            <span v-if="g.unsupported" class="ds-group-hint" data-testid="discovery-unsupported-hint">
              {{ g.unsupportedHint }}
            </span>
            <span v-else-if="groupSelectableCount(g) === 0" class="ds-group-hint">全部已在台账</span>
          </div>
          <div v-show="!isCollapsed(g.cloud)" class="ds-rows">
            <div
              v-for="e in g.entries"
              :key="discoveryEntryKey(e)"
              class="ds-row"
              :class="{ 'ds-row-muted': !isEntrySelectable(e) }"
              data-testid="discovery-row"
            >
              <el-checkbox
                :model-value="selected.has(discoveryEntryKey(e))"
                :disabled="!isEntrySelectable(e)"
                :aria-label="`选择 ${e.cloudCertId}`"
                data-testid="discovery-row-check"
                @change="() => toggleEntry(e)"
              />
              <span class="ds-cert-id" :title="e.cloudCertId">{{ e.cloudCertId }}</span>
              <span class="ds-account" :title="e.accountKey">{{ e.accountKey }}</span>
              <span class="ds-refcount">{{ e.refCount }} 个引用</span>
              <span class="ds-notafter" :class="{ 'ds-notafter-pending': e.notAfter === NOT_AFTER_PENDING }">
                {{ formatNotAfter(e.notAfter) }}
              </span>
              <span v-if="e.inLedger" class="ds-tag ds-tag-muted" data-testid="discovery-inledger-tag">已在台账</span>
              <span v-else-if="e.parseReason" class="ds-tag" data-testid="discovery-reason-tag">
                {{ parseReasonHint(e.parseReason) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <el-button :disabled="state === 'loading'" @click="visible = false">关闭</el-button>
      <!-- 任务 7 接入点：确认后 POST /discovery/import 并切换进度视图轮询 -->
      <el-button
        type="primary"
        :disabled="true"
        :title="'导入所选（' + selectedCount + ' 张）：确认导入交互即将上线'"
        data-testid="discovery-import-submit"
      >
        导入所选（{{ selectedCount }} 张）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 从云端导入预览 Modal（cert-cloud-discovery-import 任务 6）。
 *
 * 数据源：最近 done 扫描快照的纯 DB 聚合（GET /certs/discovery/preview），
 * 无 done 快照 → 409 NO_SNAPSHOT 进入引导占位分支（触发扫描/轮询引导在
 * 任务 8 接管，本组件暴露 data-testid 触发点与占位按钮）。
 * 交互：按云分组（组折叠承载大清单）、已在台账灰选不可勾、不可解析组
 * （华为云/AWS IAM-hosted）整组不可选并提示、默认全选未登记可选项、
 * 快照超 7 天显著提示建议重扫、未登记 notAfter 占位「—（导入后补全）」。
 * 独立新组件：不修改 BatchImportModal/进度组件内部实现（Hard Rule）；
 * 确认导入与进度轮询在任务 7 接入（footer 触发点预留）。
 * 视图逻辑收敛在 ../discovery.ts 纯函数层（分组/判定/过期计算）。
 */
import type { DiscoveryPreviewEntry, DiscoveryPreviewResponse } from '@/api/cert'
import { getDiscoveryPreviewApi } from '@/api/cert'
import { ElAlert, ElButton, ElCheckbox, ElDialog } from 'element-plus'
import { computed, ref } from 'vue'
import {
    DISCOVERY_NOT_AFTER_PENDING,
    DISCOVERY_SNAPSHOT_STALE_DAYS,
    defaultSelection,
    discoveryEntryKey,
    formatNotAfter,
    formatSnapshotTime,
    groupPreviewEntries,
    groupSelectableKeys,
    isEntrySelectable,
    isNoSnapshotError,
    isSnapshotStale,
    parseReasonHint,
    summarizePreview,
} from '../discovery'

/** 模板直接使用的常量（script setup 模板作用域） */
const SNAPSHOT_STALE_DAYS = DISCOVERY_SNAPSHOT_STALE_DAYS
const NOT_AFTER_PENDING = DISCOVERY_NOT_AFTER_PENDING

type ModalState = 'loading' | 'loaded' | 'no-snapshot' | 'error'

const visible = ref(false)
const state = ref<ModalState>('loading')
const errorMsg = ref('')
const preview = ref<DiscoveryPreviewResponse | null>(null)
/** 勾选键集（cloud|accountKey|cloudCertId）；整体替换保持不可变更新 */
const selected = ref<Set<string>>(new Set())
/** 折叠的分组 cloud 键集（默认全展开） */
const collapsed = ref<Set<string>>(new Set())

const groups = computed(() => (preview.value ? groupPreviewEntries(preview.value.items) : []))
const summary = computed(() => summarizePreview(preview.value?.items ?? []))
const stale = computed(() => isSnapshotStale(preview.value?.snapshotStartedAt))
const snapshotTimeText = computed(() => formatSnapshotTime(preview.value?.snapshotStartedAt))
const selectedCount = computed(() => selected.value.size)

/** 打开 Modal 并加载预览（台账页空态 CTA / 工具栏按钮双入口调用） */
function open() {
    visible.value = true
    loadPreview()
}

async function loadPreview() {
    state.value = 'loading'
    errorMsg.value = ''
    selected.value = new Set()
    preview.value = null
    try {
        const res = await getDiscoveryPreviewApi()
        preview.value = res
        // 默认勾选全部未登记可选项（已在台账灰选、不可解析组不可选）
        selected.value = defaultSelection(res.items)
        state.value = 'loaded'
    } catch (err) {
        if (isNoSnapshotError(err)) {
            // 409 NO_SNAPSHOT → 引导占位（任务 8 接管触发扫描/轮询流程）
            state.value = 'no-snapshot'
        } else {
            state.value = 'error'
            errorMsg.value = err instanceof Error ? err.message : '云端发现预览加载失败'
        }
    }
}

function onClosed() {
    // 重开时 loadPreview 会整体重置；关闭即丢弃当前预览态（快照时点数据不跨会话驻留）
    preview.value = null
    selected.value = new Set()
    collapsed.value = new Set()
    state.value = 'loading'
    errorMsg.value = ''
}

// ===== 分组折叠（大清单性能：分组折叠即可，无需虚拟滚动） =====

function isCollapsed(cloud: string): boolean {
    return collapsed.value.has(cloud)
}

function toggleCollapse(cloud: string) {
    const next = new Set(collapsed.value)
    if (next.has(cloud)) {
        next.delete(cloud)
    } else {
        next.add(cloud)
    }
    collapsed.value = next
}

// ===== 勾选交互 =====

function groupSelectableCount(g: { entries: DiscoveryPreviewEntry[] }): number {
    return groupSelectableKeys(g).length
}

function groupChecked(g: { entries: DiscoveryPreviewEntry[] }): boolean {
    const keys = groupSelectableKeys(g)
    return keys.length > 0 && keys.every((k) => selected.value.has(k))
}

function groupIndeterminate(g: { entries: DiscoveryPreviewEntry[] }): boolean {
    const keys = groupSelectableKeys(g)
    const hit = keys.filter((k) => selected.value.has(k)).length
    return hit > 0 && hit < keys.length
}

/** 组头复选框：全选/清空本组待登记项（不可选条目不受影响） */
function toggleGroup(g: { entries: DiscoveryPreviewEntry[] }) {
    const keys = groupSelectableKeys(g)
    if (keys.length === 0) return
    const allSelected = keys.every((k) => selected.value.has(k))
    const next = new Set(selected.value)
    for (const k of keys) {
        if (allSelected) {
            next.delete(k)
        } else {
            next.add(k)
        }
    }
    selected.value = next
}

/** 行复选框切换（disabled 行不会触发 change，无需二次防御） */
function toggleEntry(e: DiscoveryPreviewEntry) {
    const key = discoveryEntryKey(e)
    const next = new Set(selected.value)
    if (next.has(key)) {
        next.delete(key)
    } else {
        next.add(key)
    }
    selected.value = next
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

// ===== 加载骨架 =====
.ds-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0 16px;
}

.ds-loading-line {
  height: 14px;
  border-radius: 6px;
  background: var(--cert-surface-alt, rgba(255, 255, 255, 0.05));
  animation: ds-loading-wave 1.2s ease-in-out infinite;

  &.ds-loading-line-short {
    width: 60%;
  }
}

@keyframes ds-loading-wave {
  0% {
    opacity: 0.4;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ds-loading-line {
    animation: none;
  }
}

// ===== 状态分支（无快照引导占位 / 错误 / 空清单） =====
.ds-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 24px;
  text-align: center;
}

.ds-state-icon {
  font-size: 32px;
  line-height: 1;
}

.ds-state-icon-error {
  color: var(--cert-error, #ee0000);
}

.ds-state-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.ds-state-desc {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 480px;
}

.ds-state-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

// ===== 快照过期提示 =====
.ds-stale-alert {
  margin-bottom: 12px;
}

// ===== 摘要行 =====
.ds-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 0 0 10px;
  flex-wrap: wrap;
}

.ds-meta-spacer {
  flex: 1;
}

.ds-meta-time {
  font-size: 12px;
}

// ===== 分组 =====
.ds-groups {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.ds-group {
  & + & {
    border-top: 1px solid var(--border-base);
  }
}

.ds-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--cert-surface-alt, rgba(255, 255, 255, 0.05));
  font-size: 13px;
  user-select: none;

  &:hover {
    background: color-mix(in srgb, var(--cert-accent, #0070f3) 6%, transparent);
  }
}

.ds-chevron {
  display: inline-block;
  transition: transform 150ms ease;
  color: var(--text-secondary);
  font-size: 12px;

  &.ds-chevron-open {
    transform: rotate(90deg);
  }
}

.ds-group-check {
  display: inline-flex;
}

.ds-group-lock {
  font-size: 13px;
}

.ds-group-title {
  font-weight: 600;
  color: var(--text-primary);
}

.ds-group-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.ds-group-hint {
  font-size: 12px;
  color: var(--cert-warning-deep, #d98c0a);
}

.ds-group-unsupported .ds-group-title {
  color: var(--text-secondary);
}

// ===== 条目行 =====
.ds-rows {
  display: flex;
  flex-direction: column;
}

.ds-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 28px;
  font-size: 13px;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }
}

.ds-row-muted {
  opacity: 0.55;
}

.ds-cert-id {
  font-family: var(--cert-font-mono, monospace);
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.ds-account {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.ds-refcount {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ds-notafter {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
}

.ds-notafter-pending {
  color: var(--text-secondary);
}

.ds-tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--cert-accent, #0070f3) 40%, transparent);
  color: var(--cert-accent, #0070f3);
  white-space: nowrap;

  &.ds-tag-muted {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }
}
</style>
