<template>
  <section class="step6" aria-labelledby="step6-title">
    <div class="sr-only" aria-live="polite">{{ announce }}</div>

    <div class="card window-card">
      <div class="window-head">
        <h2 id="step6-title">验证窗口</h2>
        <!-- 倒计时：静态 aria-label；跨小时档/归零才发一次 polite 通告 -->
        <span
          class="countdown mono"
          :aria-label="countdownAriaLabel(parts)"
          role="timer"
        >{{ countdownText(parts, reducedMotion) }}</span>
      </div>
      <div class="window-meta">
        <span class="text-secondary text-sm">窗口关闭后未达标项转常规差异告警并记入报告「未达标清单」</span>
        <span v-if="windowClosed" class="chg-badge tone-warning">
          <span class="badge-icon" aria-hidden="true">⏱</span>窗口已关闭，等待终局判定
        </span>
      </div>

      <!-- 执行剩余批入口（存在剩余批且首批验证通过；位于验证窗口行下方） -->
      <div v-if="remainingEntryVisible" class="remaining-row">
        <el-button class="btn-secondary" @click="remainingVisible = true">执行剩余批</el-button>
        <span class="text-secondary text-sm">
          首批验证通过（批间暂停），剩余 {{ remainingItems.length }} 项需人工确认后执行
        </span>
      </div>
    </div>

    <div class="card flush-card">
      <el-table :data="rows" class="mini-table" aria-label="逐项验证状态">
        <el-table-column label="资源" min-width="180">
          <template #default="{ row }">
            <span class="mono">{{ row.resourceId }}</span>
          </template>
        </el-table-column>
        <el-table-column label="云 / 产品" min-width="150">
          <template #default="{ row }">{{ row.location }}</template>
        </el-table-column>
        <el-table-column label="预期终态" min-width="140">
          <template #default>
            <span class="mono">{{ expectedShort }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实际" min-width="140">
          <template #default="{ row }">
            <span class="text-secondary">{{ row.status === 'success' ? '待探测/达标' : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="判定" min-width="150">
          <template #default="{ row }">
            <span
              v-if="row.status === 'success'"
              class="chg-badge tone-accent"
            ><span class="badge-icon" aria-hidden="true">◐</span>验证中</span>
            <span
              v-else-if="itemStatusBadge(row.status).tone === 'success'"
              class="chg-badge tone-secondary"
            >{{ itemStatusBadge(row.status).label }}</span>
            <span v-else class="chg-badge" :class="`tone-${itemStatusBadge(row.status).tone}`">
              <span class="badge-icon" aria-hidden="true">{{ itemStatusBadge(row.status).icon }}</span>
              {{ itemStatusBadge(row.status).label }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="actions-row">
      <!-- Hard Rule：验证中回滚入口可见（范围仅成功项） -->
      <el-button class="btn-secondary" @click="rollbackVisible = true">回滚成功项</el-button>
      <el-button
        v-if="!windowClosed"
        class="btn-ghost"
        @click="$emit('early-finish')"
      >
        提前完成（二次确认）
      </el-button>
    </div>

    <RollbackModal
      v-model:visible="rollbackVisible"
      :order-id="orderId"
      :scope-items="scopeRows"
      @rolled-back="refreshNow"
    />

    <RemainingBatchModal
      v-model:visible="remainingVisible"
      :order-id="orderId"
      :remaining-items="remainingItems"
      @resumed="refreshNow"
    />
  </section>
</template>

<script setup lang="ts">
/**
 * Step6 验证窗口（AC5，向导与报告页只读恢复视图共用组件）：
 * 倒计时（verifyWindowUntil 秒级显示，reduced-motion 隐秒；aria 静态标签 +
 * 跨小时档/归零 polite 一次通告）+ 逐项验证徽章（API 无逐项探测结论端点，
 * 以执行状态+verify 汇总承载，见 ../format.ts 头注适配说明）+ 成功项回滚入口
 * （Hard Rule 三态之一）+ 执行剩余批入口（存在剩余批且首批验证通过=批间暂停，
 * 人工确认）。窗口关闭/状态迁移经 2s 轮询 status-change 上抛父级自动进 Step7。
 */
import type { ChangeBatchInfo, ChangeDetailItem, ChangeStatus } from '@/api/cert'
import { getChangeProgressApi } from '@/api/cert'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import RemainingBatchModal from '../../components/RemainingBatchModal.vue'
import RollbackModal from '../../components/RollbackModal.vue'
import {
    countdownAriaLabel,
    countdownHourBucket,
    countdownParts,
    countdownText,
    itemStatusBadge,
    rollbackScopeItems,
    shouldAnnounceCountdown,
    targetLocationLabel,
    truncateMiddle,
    type RollbackScopeRow,
} from '../../format'

const props = defineProps<{
    orderId: string
    items: ChangeDetailItem[]
    verifyWindowUntil: string | null
    batchInfo: ChangeBatchInfo | null
    initialStatus?: ChangeStatus
    /** 预期终态指纹（新证书指纹；恢复视图缺省时显示 —） */
    expectedFingerprint?: string
}>()

const emit = defineEmits<{
    (e: 'status-change', status: ChangeStatus): void
    (e: 'early-finish'): void
}>()

/** 进度 2s 轮询 + 倒计时 1s 本地 tick */
const POLL_MS = 2_000
const TICK_MS = 1_000
let pollTimer: ReturnType<typeof setInterval> | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null

const status = ref<ChangeStatus>(props.initialStatus ?? 'verifying')
const paused = ref(props.batchInfo?.paused ?? false)
const currentBatch = ref(props.batchInfo?.currentBatch ?? 1)
const totalBatches = ref(props.batchInfo?.totalBatches ?? 1)
const nowMs = ref(Date.now())
const rollbackVisible = ref(false)
const remainingVisible = ref(false)
const announce = ref('')

const reducedMotion = computed(() =>
    typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
)

const parts = computed(() => countdownParts(props.verifyWindowUntil, new Date(nowMs.value)))
const windowClosed = computed(() => parts.value.expired)

/** 预期终态指纹短显（新证书指纹；缺省 — 兜底） */
const expectedShort = computed(() =>
    props.expectedFingerprint ? truncateMiddle(props.expectedFingerprint) : '—',
)

const rows = computed(() =>
    props.items.map((it) => ({
        itemId: it.itemId,
        resourceId: it.target.resourceId,
        location: targetLocationLabel(it.target),
        status: it.status,
    })),
)

/** 回滚范围行（仅成功项；Hard Rule） */
const scopeRows = computed<RollbackScopeRow[]>(() => rollbackScopeItems(rows.value))

/** 剩余批清单（batchNo > currentBatch；快照固定，仅整批推进） */
const remainingItems = computed(() =>
    props.items.filter((it) => it.batchNo > currentBatch.value),
)

/** 执行剩余批入口：存在剩余批且首批验证通过（批间暂停） */
const remainingEntryVisible = computed(
    () => totalBatches.value > 1 && currentBatch.value < totalBatches.value && paused.value,
)

let lastBucket: number | null = null

function tickCountdown() {
    nowMs.value = Date.now()
    const bucket = countdownHourBucket(parts.value)
    if (shouldAnnounceCountdown(lastBucket, bucket)) {
        announce.value = countdownAriaLabel(parts.value)
    }
    lastBucket = bucket
}

async function poll() {
    try {
        const p = await getChangeProgressApi(props.orderId)
        status.value = p.status
        currentBatch.value = p.currentBatch
        // paused 只能从详情 batchInfo 获得；轮询到 executing 且非关闭态视为等待续批
        if (p.status !== 'verifying') {
            emit('status-change', p.status)
            stopPolling()
        }
    } catch {
        /* 轮询失败静默 */
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
    tickTimer = setInterval(tickCountdown, TICK_MS)
    tickCountdown()
})

onUnmounted(() => {
    stopPolling()
    if (tickTimer) {
        clearInterval(tickTimer)
        tickTimer = null
    }
})
</script>

<style lang="scss" scoped>
.step6 {
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

.window-card {
  padding: 24px;
}

.window-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.countdown {
  font-size: 22px;
  font-weight: 600;
  color: #8b5cf6; // Verifying 紫仅用于验证窗口态（ui-design 色板约束）
  font-variant-numeric: tabular-nums;
}

.window-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.remaining-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-base);
  flex-wrap: wrap;
}

.flush-card {
  padding: 0;
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
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
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
    color: #0070f3;
    border-color: color-mix(in srgb, #0070f3 40%, transparent);
  }

  &.tone-warning {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
  }

  &.tone-secondary {
    color: #a1a1a1;
    border-color: var(--border-base);
  }
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 13px;
}
</style>
