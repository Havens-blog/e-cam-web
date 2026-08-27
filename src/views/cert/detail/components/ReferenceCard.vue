<template>
  <div class="ref-card">
    <div class="card-header">
      <h2 class="card-title">引用关系</h2>
    </div>

    <div aria-live="polite">
      <!-- Loading：引用区骨架（要素卡独立加载不受影响） -->
      <template v-if="refsLoading">
        <div class="skeleton-line" aria-hidden="true" />
        <div class="skeleton-block" aria-hidden="true" />
        <div class="skeleton-block" aria-hidden="true" />
      </template>

      <!-- Error：引用卡内错误 + 重试（不影响上方要素卡） -->
      <div v-else-if="refsError" class="error-state">
        <div class="state-icon" aria-hidden="true">⚠</div>
        <div class="state-title">引用扫描结果加载失败</div>
        <div class="state-desc">扫描结果服务暂时不可用，请稍后重试。</div>
        <el-button class="state-cta" @click="loadReferences">重试</el-button>
      </div>

      <el-tabs v-else-if="view" v-model="activeTab" class="ref-tabs">
        <el-tab-pane label="正向引用" name="forward">
          <ForwardReferences
            :view="view"
            :scanning="scanning"
            :readonly="readonly"
            @trigger-scan="onTriggerScan"
            @open-resource="openDrawer"
          />
        </el-tab-pane>
        <el-tab-pane label="反向查询" name="reverse" lazy>
          <ReverseQuery />
        </el-tab-pane>
      </el-tabs>
    </div>

    <ResourceDrawer v-model:visible="drawerVisible" :item="drawerItem" :group="drawerGroup" />
  </div>
</template>

<script setup lang="ts">
/**
 * 引用关系卡（UF-2）：正向|反向 Tab 容器 + 引用视图加载（错误独立于要素卡）+
 * 立即扫描防重状态机（AC3）：
 * - 进行中：按钮 disabled +「扫描中」，轮询 GET /:id/references 直至
 *   lastScanAt >= 会话 startedAt（新成功快照落库，服务端口径 lastScanAt=快照 startedAt），
 *   完成后刷新元数据 + Toast；
 * - 重入/刷新：sessionStorage 按证书恢复「扫描中」态并续轮询（30min 上限自动放弃）；
 * - 服务端 409 SCAN_IN_PROGRESS：不新建任务，按 meta.snapshotId/startedAt 进入轮询。
 */
import type { CertReferenceGroup, CertReferenceItem, CertReferencesView } from '@/api/cert'
import { CertRequestError, getCertReferencesApi, triggerCertScanApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { onMounted, onUnmounted, ref } from 'vue'
import {
    SCAN_POLL_INTERVAL_MS,
    clearScanSession,
    isScanComplete,
    loadScanSession,
    parseScanConflict,
    saveScanSession,
    type ScanSession,
} from '../format'
import ForwardReferences from './ForwardReferences.vue'
import ResourceDrawer from './ResourceDrawer.vue'
import ReverseQuery from './ReverseQuery.vue'

const props = defineProps<{
    certId: string
    /** 只读模式：隐藏「立即扫描」操作入口 */
    readonly?: boolean
}>()

const view = ref<CertReferencesView | null>(null)
const refsLoading = ref(true)
const refsError = ref(false)
const activeTab = ref<'forward' | 'reverse'>('forward')
const scanning = ref(false)

const drawerVisible = ref(false)
const drawerItem = ref<CertReferenceItem | null>(null)
const drawerGroup = ref<CertReferenceGroup | null>(null)

let pollTimer: ReturnType<typeof setTimeout> | null = null
/** 连续轮询失败计数（超过阈值放弃恢复态，避免永久「扫描中」） */
let pollFailures = 0
const MAX_POLL_FAILURES = 5
/** 轮询总时长上限（ms）：异步扫描后台收敛可能较久，超限停止自动刷新并提示手动查看 */
const MAX_POLL_DURATION_MS = 10 * 60_000
let pollStartedAt = 0

async function loadReferences() {
    refsLoading.value = !view.value
    refsError.value = false
    try {
        view.value = await getCertReferencesApi(props.certId)
    } catch (err) {
        // 已有数据的静默刷新失败不塌陷视图，Toast 提示（同台账页口径）
        if (view.value) {
            ElMessage.error(err instanceof Error ? err.message : '引用视图刷新失败')
        } else {
            refsError.value = true
        }
    } finally {
        refsLoading.value = false
    }
}

function openDrawer(payload: { group: CertReferenceGroup; item: CertReferenceItem }) {
    drawerGroup.value = payload.group
    drawerItem.value = payload.item
    drawerVisible.value = true
}

// ==================== 立即扫描（防重 + 轮询 + 会话恢复） ====================

function stopPolling() {
    if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
    }
}

function finishScan(success: boolean, message: string) {
    stopPolling()
    clearScanSession(props.certId)
    scanning.value = false
    pollFailures = 0
    pollStartedAt = 0
    if (success) ElMessage.success(message)
    else ElMessage.error(message)
}

/** 轮询引用视图：新成功快照落库（lastScanAt >= startedAt）即完成并刷新元数据 */
function startPolling(session: ScanSession) {
    stopPolling()
    pollStartedAt = Date.now()
    const tick = async () => {
        // 总时长兜底：异步扫描后台收敛超限，停止自动刷新，避免永久「扫描中」
        if (Date.now() - pollStartedAt > MAX_POLL_DURATION_MS) {
            finishScan(false, '扫描仍在后台进行，已停止自动刷新，请稍后手动刷新查看结果')
            return
        }
        try {
            const v = await getCertReferencesApi(props.certId)
            pollFailures = 0
            view.value = v
            if (isScanComplete(v.lastScanAt, session.startedAt)) {
                finishScan(true, '引用扫描完成，元数据已刷新')
                return
            }
        } catch {
            pollFailures++
            if (pollFailures >= MAX_POLL_FAILURES) {
                finishScan(false, '扫描状态轮询失败，请稍后刷新页面查看结果')
                return
            }
        }
        pollTimer = setTimeout(tick, SCAN_POLL_INTERVAL_MS)
    }
    pollTimer = setTimeout(tick, SCAN_POLL_INTERVAL_MS)
}

async function onTriggerScan() {
    if (scanning.value || props.readonly) return
    scanning.value = true
    pollFailures = 0
    try {
        const res = await triggerCertScanApi(props.certId)
        // 异步触发：服务端已建 running 快照、后台收敛，据 startedAt 轮询 /references
        if (res.status === 'running') {
            const startedAt = res.startedAt ? Date.parse(res.startedAt) : Date.now()
            const session: ScanSession = {
                certId: props.certId,
                snapshotId: res.snapshotId,
                startedAt: Number.isNaN(startedAt) ? Date.now() : startedAt,
            }
            saveScanSession(session)
            startPolling(session)
            return
        }
        if (res.status === 'failed') {
            finishScan(false, `引用扫描失败：${res.failReason || '未知原因'}`)
        } else {
            finishScan(true, '引用扫描完成，元数据已刷新')
        }
        await loadReferences()
    } catch (err) {
        const conflict = parseScanConflict(err)
        if (conflict) {
            // 服务端防重：不新建任务，携带进行中快照信息恢复「扫描中」态轮询
            const session: ScanSession = {
                certId: props.certId,
                snapshotId: conflict.snapshotId,
                startedAt: conflict.startedAt,
            }
            saveScanSession(session)
            startPolling(session)
            return
        }
        finishScan(
            false,
            err instanceof CertRequestError || err instanceof Error ? err.message : '触发扫描失败，请重试',
        )
    }
}

onMounted(() => {
    void loadReferences()
    // 重入/刷新恢复：存在进行中扫描会话 → 直接恢复「扫描中」态续轮询（AC3）
    const session = loadScanSession(props.certId)
    if (session) {
        scanning.value = true
        startPolling(session)
    }
})

onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
.ref-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.card-header {
  margin-bottom: 8px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.ref-tabs {
  margin-top: 8px;
}

// ===== 引用区骨架 =====
.skeleton-line {
  height: 14px;
  width: 40%;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  margin: 12px 0;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: cert-skeleton-wave 1.2s ease-in-out infinite;
  }
}

.skeleton-block {
  height: 88px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  margin-top: 8px;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: cert-skeleton-wave 1.2s ease-in-out infinite;
  }
}

@keyframes cert-skeleton-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

// ===== 引用区错误态 =====
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}

.state-icon {
  font-size: 32px;
  color: #ee0000;
}

.state-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.state-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.state-cta {
  margin-top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line::after,
  .skeleton-block::after {
    animation: none;
  }
}
</style>
