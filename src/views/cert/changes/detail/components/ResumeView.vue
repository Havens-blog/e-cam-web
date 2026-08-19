<template>
  <div class="resume-view">
    <!-- 执行中 → 内嵌 Step5 组件（逐项状态实时刷新 2s 轮询 + 失败横幅 + 回滚入口） -->
    <template v-if="mode === 'step5'">
      <div class="resume-head">
        <h2>只读恢复视图 · 执行进度</h2>
        <span class="text-secondary text-sm">
          断网/关闭浏览器后重入不丢进度，轮询自动恢复（2s，失败退避 2s→10s）
        </span>
      </div>
      <Step5Progress
        :order-id="orderId"
        :items="detail.items"
        :initial-status="detail.status"
        @status-change="onStatusChange"
      />
    </template>

    <!-- 验证中 → 内嵌 Step6 组件（倒计时 + 逐项验证状态 + 回滚/执行剩余批入口） -->
    <template v-else-if="mode === 'step6'">
      <div class="resume-head">
        <h2>只读恢复视图 · 验证窗口</h2>
        <span class="text-secondary text-sm">窗口倒计时与验证状态实时恢复（2s 轮询）</span>
      </div>
      <Step6Verify
        :order-id="orderId"
        :items="detail.items"
        :verify-window-until="detail.verifyWindowUntil ?? null"
        :batch-info="detail.batchInfo ?? null"
        :initial-status="detail.status"
        @status-change="onStatusChange"
        @early-finish="onEarlyFinish"
      />
    </template>

    <!-- 部分完成（保护期内）→ 成功项回滚入口 + 保护期剩余徽章（无轮询，窗口已关闭） -->
    <div v-else-if="mode === 'partial'" class="partial-card">
      <div class="resume-head">
        <h2>回滚保护期内</h2>
        <span class="badge-protect">
          <span class="badge-icon" aria-hidden="true">🔒</span>保护期剩余 {{ protectDays }} 天
        </span>
      </div>
      <p class="text-secondary text-sm">
        验证窗口已关闭且存在未达标/失败项，仍在回滚保护期内，可回滚本次执行成功项。
      </p>
      <div class="partial-actions">
        <el-button class="btn-secondary" @click="rollbackVisible = true">回滚成功项</el-button>
      </div>
      <RollbackModal
        v-model:visible="rollbackVisible"
        :order-id="orderId"
        :scope-items="scopeItems"
        @rolled-back="refreshNow"
      />
    </div>

    <!-- 草稿/待确认 → 提示条 + 继续编辑跳向导 -->
    <div v-else-if="mode === 'edit'" class="edit-bar">
      <span class="text-secondary text-sm">该单尚未执行（{{ changeStatusMeta(detail.status).label }}），清单与选配可继续编辑。</span>
      <el-button type="primary" @click="onContinueEdit">继续编辑</el-button>
    </div>

    <!-- 恢复态轮询错误整卡重试 -->
    <div v-if="pollError" class="poll-error" role="alert">
      <span class="text-secondary text-sm">恢复态轮询异常，已自动退避重试（2s→10s）不中断。</span>
      <el-button size="small" class="btn-secondary" @click="refreshNow">立即重试</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 只读恢复视图（AC6，报告详情页置顶区）：执行中内嵌 Step5 / 验证中内嵌 Step6
 * （重入轮询自动恢复，断网/关闭浏览器不丢进度）；部分完成[保护期内] → 回滚
 * 入口 + 保护期徽章（无轮询）；草稿/待确认 → 「继续编辑」跳向导。
 * 详情轮询 2s，连续失败退避 2s→10s（nextPollDelay）不中断；卸载清理。
 * Hard Rule：回滚入口三态门控由 resumeMode + RollbackModal 范围（仅成功项）承载。
 */
import type { ChangeDetail } from '@/api/cert'
import { getChangeApi } from '@/api/cert'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import RollbackModal from '../../components/RollbackModal.vue'
import Step5Progress from '../../new/steps/Step5Progress.vue'
import Step6Verify from '../../new/steps/Step6Verify.vue'
import { changeStatusMeta } from '../../../detail/format'
import { nextPollDelay, resumeMode, rollbackScopeRows, rowProtectDaysLeft } from '../../format'

const props = defineProps<{
    orderId: string
    detail: ChangeDetail
}>()

const emit = defineEmits<{ (e: 'detail-refresh', detail: ChangeDetail): void }>()

const router = useRouter()

const rollbackVisible = ref(false)
const pollError = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let failures = 0

const mode = computed(() => resumeMode(props.detail.status, props.detail.protectUntil))
const protectDays = computed(() => rowProtectDaysLeft(props.detail.protectUntil))

/** 部分完成回滚范围：仅成功项 */
const scopeItems = computed(() => rollbackScopeRows(props.detail.items))

function onStatusChange(): void {
    refreshNow()
}

async function pollDetail() {
    try {
        const d = await getChangeApi(props.orderId)
        emit('detail-refresh', d)
        failures = 0
        pollError.value = false
        schedule()
    } catch {
        failures += 1
        pollError.value = true
        schedule()
    }
}

/** 活跃态（执行中/验证中）持续轮询；失败退避；其余态停表 */
function schedule() {
    stopPolling()
    if (mode.value !== 'step5' && mode.value !== 'step6') return
    pollTimer = setTimeout(() => void pollDetail(), nextPollDelay(failures))
}

function refreshNow() {
    stopPolling()
    void pollDetail()
}

function stopPolling() {
    if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
    }
}

function onContinueEdit() {
    void router.push(`/certs/changes/new?orderId=${encodeURIComponent(props.orderId)}`)
}

/** 提前完成（验证窗口未关闭，二次确认）：跳过提前关闭走报告刷新 */
function onEarlyFinish() {
    refreshNow()
}

onMounted(() => {
    if (mode.value === 'step5' || mode.value === 'step6') schedule()
})

onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
.resume-view {
  background: color-mix(in srgb, #0070f3 6%, var(--glass-bg, #111111));
  border: 1px solid color-mix(in srgb, #0070f3 35%, transparent);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.resume-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.partial-card,
.edit-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edit-bar {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.partial-actions {
  display: flex;
  gap: 8px;
}

.badge-protect {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #a1a1a1;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  padding: 2px 8px;
}

.poll-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid color-mix(in srgb, #f5a623 35%, transparent);
  border-radius: 8px;
  padding: 8px 16px;
  background: color-mix(in srgb, #f5a623 8%, transparent);
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 13px;
}
</style>
