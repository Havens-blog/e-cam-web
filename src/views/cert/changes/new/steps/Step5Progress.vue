<template>
  <section class="step5" aria-labelledby="step5-title">
    <div class="sr-only" aria-live="polite">{{ announce }}</div>

    <!-- 出现失败项 → 顶部横幅 + 回滚成功项入口（Hard Rule 三态门控） -->
    <div v-if="failedPresent" class="banner banner-error" role="alert">
      <span class="banner-icon" aria-hidden="true">⚠</span>
      <div>
        <div class="banner-title">出现失败项，已成功项可回滚</div>
        <div class="banner-body">失败项引用未被改动，无需回滚。</div>
      </div>
      <div class="banner-actions">
        <el-button size="small" class="btn-secondary" @click="rollbackVisible = true">回滚成功项</el-button>
      </div>
    </div>

    <!-- 批间等待提示（存在剩余批且首批验证未开始/批级验证中 → 停留 Step5） -->
    <div v-if="waitingBatchVerify" class="banner banner-info">
      <span class="banner-icon" aria-hidden="true">⏳</span>
      <div>
        <div class="banner-title">等待首批验证</div>
        <div class="banner-body">
          本批执行完成，批级验证通过后订单转批间暂停，可执行剩余批（入口见验证窗口行下方）。
        </div>
      </div>
    </div>

    <div class="card flush-card">
      <div class="card-head">
        <h2 id="step5-title">执行进度</h2>
        <span class="text-secondary text-sm">逐项状态 2s 轮询实时刷新；失败不中断其他项</span>
      </div>
      <el-table :data="rows" class="mini-table" aria-label="逐项执行进度">
        <el-table-column label="资源" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.resourceId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="云 / 产品" min-width="150">
          <template #default="{ row }">{{ row.location }}</template>
        </el-table-column>
        <el-table-column label="状态" width="150">
          <template #default="{ row }">
            <span
              class="chg-badge"
              :class="`tone-${itemStatusBadge(row.status).tone}`"
              :aria-label="`状态：${itemStatusBadge(row.status).label}`"
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
      </el-table>

      <!-- 进度条 + 终态事件计数（reduced-motion 改静态文本） -->
      <div class="progress-row">
        <span class="page-info">{{ progressText(summary) }}</span>
        <div v-if="!reducedMotion" class="progress" aria-hidden="true">
          <div class="progress-bar" :style="{ width: `${progressPercent}%` }" />
        </div>
        <span v-else class="text-secondary text-sm">处理中：{{ summary.terminal }}/{{ summary.total }}</span>
      </div>
    </div>

    <!-- 回滚成功项 Modal（范围=仅成功项；含目标有效性预检与转人工提示） -->
    <RollbackModal
      v-model:visible="rollbackVisible"
      :order-id="orderId"
      :scope-items="scopeRows"
      @rolled-back="refreshNow"
    />
  </section>
</template>

<script setup lang="ts">
/**
 * Step5 执行进度（AC5，向导与报告页只读恢复视图共用组件）：
 * 2s 轮询 getChangeProgressApi 逐项状态（成功✓/失败✗/执行中 spinner/
 * 限流重试中[Warning]），itemStates 与详情 items 按 itemId 关联渲染资源要素。
 * 出现失败项 → 顶部横幅 + 回滚成功项入口（Hard Rule 三态门控 canRollbackNow，
 * 范围仅成功项）。批间等待（剩余批 + 验证未开始）→ 停留本步提示。
 * a11y：终态事件才 aria-live 通告「已完成 N/总数，失败 M」；reduced-motion
 * 下进度条改静态文本。组件卸载清理轮询。
 */
import type { ChangeDetailItem, ChangeStatus } from '@/api/cert'
import { getChangeProgressApi } from '@/api/cert'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import RollbackModal from '../../components/RollbackModal.vue'
import {
    hasFailedItem,
    itemStatusBadge,
    progressAnnouncement,
    progressText,
    rollbackScopeItems,
    summarizeProgress,
    targetLocationLabel,
    type ExecProgress,
    type RollbackScopeRow,
} from '../../format'

const props = defineProps<{
    orderId: string
    /** 详情清单项（itemId → 资源要素关联） */
    items: ChangeDetailItem[]
    initialStatus: ChangeStatus
}>()

const emit = defineEmits<{ (e: 'status-change', status: ChangeStatus, progress: ExecProgress | null): void }>()

/** 执行进度 2s 轮询（Implementation Notes） */
const POLL_MS = 2_000
let pollTimer: ReturnType<typeof setInterval> | null = null

const itemStates = ref<{ itemId: string; status: string; error?: string }[]>([])
const status = ref<ChangeStatus>(props.initialStatus)
const currentBatch = ref(1)
const totalBatches = ref(1)
const rollbackVisible = ref(false)
const announce = ref('')

const reducedMotion = computed(() =>
    typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
)

/** 行视图：进度状态优先，缺失回退详情项初始状态 */
const rows = computed(() =>
    props.items.map((it) => {
        const live = itemStates.value.find((s) => s.itemId === it.itemId)
        return {
            itemId: it.itemId,
            resourceId: it.target.resourceId,
            location: targetLocationLabel(it.target),
            status: live?.status ?? it.status,
            error: live?.error ?? it.error,
        }
    }),
)

const summary = computed(() => summarizeProgress(rows.value))

const failedPresent = computed(() => hasFailedItem(rows.value))

/** 回滚范围行（仅成功项；Hard Rule） */
const scopeRows = computed<RollbackScopeRow[]>(() => rollbackScopeItems(rows.value))

/** 批间等待：本批终态 + 存在剩余批 + 未进入验证 */
const waitingBatchVerify = computed(
    () =>
        totalBatches.value > 1 &&
        currentBatch.value < totalBatches.value &&
        status.value === 'executing' &&
        summary.value.terminal >= summary.value.total &&
        summary.value.total > 0,
)

const progressPercent = computed(() =>
    summary.value.total === 0 ? 0 : Math.round((summary.value.terminal / summary.value.total) * 100),
)

let lastAnnounced: string | null = null

function announceProgress() {
    const text = progressAnnouncement(summary.value)
    if (text !== lastAnnounced) {
        announce.value = text
        lastAnnounced = text
    }
}

async function poll() {
    try {
        const p = await getChangeProgressApi(props.orderId)
        itemStates.value = p.itemStates
        status.value = p.status
        currentBatch.value = p.currentBatch
        emit('status-change', p.status, summarizeProgress(p.itemStates))
        announceProgress()
        // 离开执行态（进入验证/终态）停止本组件轮询（后续步接管）
        if (p.status !== 'executing') stopPolling()
    } catch {
        /* 轮询失败静默，下个 tick 重��� */
    }
}

function refreshNow() {
    void poll()
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
}

onMounted(() => {
    void poll()
    pollTimer = setInterval(() => void poll(), POLL_MS)
})

onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
.step5 {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  overflow: hidden;
}

.flush-card {
  padding: 0;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px 0;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.mini-table {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: rgba(255, 255, 255, 0.05);
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-primary);
  margin-top: 8px;

  :deep(th.el-table__cell) {
    font-weight: 500;
  }
}

.banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  border-radius: 8px;
  padding: 12px 16px;
  border: 1px solid var(--border-base);

  .banner-icon {
    font-size: 16px;
    line-height: 1.4;
  }
}

.banner-error {
  border-color: color-mix(in srgb, #ee0000 40%, transparent);
  background: color-mix(in srgb, #ee0000 8%, transparent);

  .banner-icon {
    color: #ee0000;
  }
}

.banner-info {
  border-color: color-mix(in srgb, #0070f3 35%, transparent);
  background: color-mix(in srgb, #0070f3 8%, transparent);

  .banner-icon {
    color: #0070f3;
  }
}

.banner-title {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
}

.banner-body {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 2px;
}

.banner-actions {
  margin-left: auto;
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
  animation: step5-spin 0.8s linear infinite;
}

@keyframes step5-spin {
  to {
    transform: rotate(360deg);
  }
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px 16px;
}

.page-info {
  font-size: 13px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.progress {
  flex: 1;
  max-width: 220px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 999px;
  background: #0070f3;
  transition: width 150ms ease;
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

  .progress-bar {
    transition: none;
  }
}
</style>
