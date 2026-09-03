<template>
  <div class="cert-wizard-page" aria-labelledby="cert-wizard-title">
    <!-- a11y：步进/状态关键事件通告（终态事件才通告，高频 tick 不通告） -->
    <div class="sr-only" aria-live="polite">{{ announcement }}</div>

    <nav class="breadcrumb" aria-label="面包屑">
      <router-link :to="entryPath">{{ entryLabel }}</router-link>
      <span class="sep" aria-hidden="true">/</span>
      <span class="current" aria-current="page">{{ orderId ? orderId : '新建变更' }}</span>
    </nav>

    <div class="page-header">
      <div>
        <h1 id="cert-wizard-title" class="page-title">变更向导</h1>
        <div class="header-meta">
          <span class="text-secondary text-sm">
            变更单 <span class="mono">{{ orderId || 'CHG-NEW（未生成）' }}</span>
          </span>
          <span v-if="lookback" class="chg-badge tone-secondary">
            <span class="badge-icon" aria-hidden="true">👁</span>只读回看
          </span>
        </div>
      </div>
      <div class="header-actions">
        <el-button v-if="canSaveDraft(stepViewing)" class="btn-secondary" @click="onSaveDraft">
          存为草稿
        </el-button>
        <el-button class="btn-ghost" @click="cancelVisible = true">取消</el-button>
      </div>
    </div>

    <!-- 步骤条：当前步高亮 / 已完成步可回点（只读回看）/ 未到达不可点 -->
    <div class="stepbar-card">
      <div class="stepbar" role="list" aria-label="变更向导步骤">
        <button
          v-for="s in WIZARD_STEPS"
          :key="s.n"
          ref="stepRefs"
          type="button"
          role="listitem"
          :data-n="s.n"
          class="step"
          :class="{
            active: s.n === stepViewing,
            done: s.n < stepViewing,
            locked: s.n > maxVisitedStep,
          }"
          :aria-current="s.n === stepViewing ? 'step' : undefined"
          :disabled="s.n > maxVisitedStep"
          :tabindex="s.n === stepViewing ? 0 : -1"
          @click="onStepClick(s.n)"
          @keydown="onStepbarKeydown"
        >
          <span class="step-num" aria-hidden="true">{{ s.n }}</span>{{ s.title }}
        </button>
      </div>
    </div>

    <!-- 只读回看模式：返回当前步骤 -->
    <div v-if="lookback" class="lookback-bar">
      <span class="text-secondary text-sm">正在回看已完成步骤（只读，不可修改已提交内容）</span>
      <el-button size="small" class="btn-secondary" @click="stepViewing = currentStep">
        返回当前步骤
      </el-button>
    </div>

    <!-- 步骤面板 -->
    <Step1Select
      v-if="stepViewing === 1"
      v-model:old-cert="oldCert"
      v-model:new-cert="newCert"
      :preselect-notice="preselectNotice"
      :locked="executionStarted"
    />
    <Step2Precheck
      v-else-if="stepViewing === 2"
      :loading="precheckLoading"
      :error="precheckError"
      :change-list="changeList"
      @retry="runPrecheck"
      @scan="onTriggerScan"
      @back="stepViewing = 1"
      @view-orders="goChangesList"
    />
    <Step3List
      v-else-if="stepViewing === 3"
      :change-list="changeList"
      :load-error="listLoadError"
      @retry="runPrecheck"
      @back="stepViewing = 2"
    />
    <Step4Confirm
      v-else-if="stepViewing === 4"
      ref="step4Ref"
      :change-list="changeList"
      :confirm-error="confirmError"
      :submitting="confirmSubmitting"
      :can-confirm="canConfirm"
      @confirm="confirmVisible = true"
    />
    <Step5Progress
      v-else-if="stepViewing === 5"
      :order-id="orderId ?? ''"
      :items="detailItems"
      :initial-status="wizardStatus ?? 'executing'"
      @status-change="onPolledStatus"
    />
    <Step6Verify
      v-else-if="stepViewing === 6"
      :order-id="orderId ?? ''"
      :items="detailItems"
      :verify-window-until="verifyWindowUntil"
      :batch-info="batchInfo"
      :initial-status="wizardStatus ?? 'verifying'"
      :expected-fingerprint="newCert?.fingerprint"
      @status-change="onPolledStatus"
      @early-finish="earlyFinishVisible = true"
    />
    <Step7Report
      v-else-if="stepViewing === 7"
      :order-id="orderId ?? ''"
      :status="wizardStatus ?? 'completed'"
      :protect-until="protectUntil"
    />

    <!-- 步骤导航（Step5 起自动流转，无常规上一步/下一步） -->
    <div v-if="stepViewing <= 4" class="step-nav">
      <el-button class="btn-secondary" :disabled="stepViewing <= 1" @click="goStep(stepViewing - 1)">
        上一步
      </el-button>
      <el-tooltip :disabled="nextEnabled" :content="stepGateHint(stepViewing)" placement="top">
        <span>
          <el-button type="primary" :disabled="!nextEnabled" @click="goStep(stepViewing + 1)">
            下一步
          </el-button>
        </span>
      </el-tooltip>
      <span v-if="!nextEnabled" class="text-secondary text-sm">{{ stepGateHint(stepViewing) }}</span>
    </div>

    <!-- 取消二次确认 Modal -->
    <el-dialog v-model="cancelVisible" width="480px" align-center aria-labelledby="wizard-cancel-title">
      <template #header>
        <h3 id="wizard-cancel-title" class="modal-title">确认取消</h3>
      </template>
      <el-alert type="warning" :closable="false" show-icon>
        未保存的选择将丢弃；已存草稿不受影响（已生成的待确认单可在变更管理列表「继续编辑」恢复）。
      </el-alert>
      <template #footer>
        <el-button @click="cancelVisible = false">继续编辑</el-button>
        <el-button type="danger" @click="onCancelConfirmed">确认取消</el-button>
      </template>
    </el-dialog>

    <!-- Step4 确认执行 Modal（影响面摘要 + 服务端快照重校验说明） -->
    <el-dialog v-model="confirmVisible" width="720px" align-center aria-labelledby="wizard-confirm-title">
      <template #header>
        <h3 id="wizard-confirm-title" class="modal-title">确认执行变更</h3>
      </template>
      <p class="modal-lead">
        本次变更将影响 <strong>{{ executableTotal }} 项资源</strong>
        <template v-if="step4Conf?.enabled">
          ，首批执行 <strong>{{ step4Conf?.batchSize }} 项</strong>（剩余批需人工确认后续批）
        </template>
        。确认后立即进入执行进度，全程留审计。
      </p>
      <p class="text-secondary text-sm">服务端将重校验清单快照新鲜度与引用一致性；不一致将拦截并回退重新预检。</p>
      <template #footer>
        <el-button :disabled="confirmSubmitting" @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="confirmSubmitting" :disabled="!canConfirm" @click="onConfirmExec">
          确认执行
        </el-button>
      </template>
    </el-dialog>

    <!-- Step6 提前完成二次确认 -->
    <el-dialog v-model="earlyFinishVisible" width="480px" align-center aria-labelledby="early-finish-title">
      <template #header>
        <h3 id="early-finish-title" class="modal-title">提前完成</h3>
      </template>
      <el-alert type="warning" :closable="false" show-icon>
        验证窗口未关闭，确认提前完成？窗口内全部达标方可提前关闭，服务端将校验达标判定。
      </el-alert>
      <template #footer>
        <el-button @click="earlyFinishVisible = false">继续验证</el-button>
        <el-button type="primary" @click="onEarlyFinish">提前完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 变更向导（UF-4，任务 6.5）：/certs/changes/new，7 步（选择证书→前置校验→
 * 清单→确认执行→执行进度→验证窗口→报告入口）。
 *
 * 步间导航（ui-design）：当前步高亮；已完成步可回点进入只读回看（徽章+返回
 * 当前步骤）；未到达不可点。下一步闸门（Step1 双选/Step2 双预检/Step3 清单/
 * Step4 确认）。Step1-4 可存草稿（sessionStorage + 已生成单服务端待确认态）；
 * 任意步取消二次确认返回入口页（台账或变更管理，?from=ledger 判定）。
 * ?certId= 预选旧证书（非完整托管/无引用 → 置空+置顶提示，不锁选择器不跳步）。
 * ?orderId= 从列表「继续编辑」恢复（仅草稿/待确认；已执行单重定向报告页只读恢复）。
 * Step4 确认：服务端快照重校验失败（409 SCAN_STALE）→ Error「引用清单已变化，
 * 请重新预检」+ 自动回退 Step2 重新预检。
 * Hard Rules：确认操作仅运维工程师（cert:manage 门面 + 后端 EIAM 兜底）；
 * 执行期间清单快照固定（Step5+ 无任何清单编辑入口）。
 */
import type {
    CertDetail,
    CertListItem,
    ChangeBatchInfo,
    ChangeDetailItem,
    ChangeList,
    ChangeStatus,
} from '@/api/cert'
import {
    cancelChangeApi,
    confirmChangeApi,
    executeChangeApi,
    generateChangeListApi,
    getCertApi,
    getChangeApi,
    triggerCertScanApi,
} from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { hasCertManageAccess } from '@/utils/cert-permission'
import {
    PRESELECT_INELIGIBLE_NOTICE,
    WIZARD_STEPS,
    canAdvance,
    canSaveDraft,
    clearWizardDraft,
    clampBatchSize,
    isReadonlyLookback,
    isExecutionPhase,
    needsBatching,
    partitionListItems,
    preselectEligible,
    saveWizardDraft,
    stepFromStatus,
    stepGateHint,
} from '../format'
import Step1Select from './steps/Step1Select.vue'
import Step2Precheck from './steps/Step2Precheck.vue'
import Step3List from './steps/Step3List.vue'
import Step4Confirm from './steps/Step4Confirm.vue'
import Step5Progress from './steps/Step5Progress.vue'
import Step6Verify from './steps/Step6Verify.vue'
import Step7Report from './steps/Step7Report.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// ===== 向导状态 =====
const stepViewing = ref(1)
const currentStep = ref(1)
const maxVisitedStep = ref(1)

const oldCert = ref<CertListItem | null>(null)
const newCert = ref<CertListItem | null>(null)
const changeList = ref<ChangeList | null>(null)
const orderId = ref<string | null>(null)

const precheckLoading = ref(false)
const precheckError = ref<{ code: string; message: string } | null>(null)
const listLoadError = ref('')

const confirmVisible = ref(false)
const confirmSubmitting = ref(false)
const confirmError = ref('')
const cancelVisible = ref(false)
const earlyFinishVisible = ref(false)

const preselectNotice = ref('')

/** Step5/6 轮询回传的订单状态（驱动自动步进） */
const wizardStatus = ref<ChangeStatus | null>(null)
const detailItems = ref<ChangeDetailItem[]>([])
const verifyWindowUntil = ref<string | null>(null)
const protectUntil = ref<string | null>(null)
const batchInfo = ref<ChangeBatchInfo | null>(null)
const announcement = ref('')

const stepRefs = ref<HTMLElement[]>([])
const step4Ref = ref<InstanceType<typeof Step4Confirm> | null>(null)

/** Step4 暴露的分批配置（confirm Modal 摘要与提交共用） */
const step4Conf = computed(() => step4Ref.value?.batchConf ?? null)
// ===== 入口/权限 =====
const entryFromLedger = computed(() => route.query.from === 'ledger' || Boolean(route.query.certId && !route.query.orderId))
const entryPath = computed(() => (entryFromLedger.value ? '/certs' : '/certs/changes'))
const entryLabel = computed(() => (entryFromLedger.value ? '证书台账' : '变更管理'))

/** Hard Rule：确认操作仅运维工程师角色（7.2 授权码细化前以 cert:manage 门面，后端 EIAM 兜底） */
const canConfirm = computed(() =>
    hasCertManageAccess({ isAdmin: userStore.isAdmin, permissions: userStore.permissions }),
)

const executableTotal = computed(() => partitionListItems(changeList.value?.items ?? []).executable.length)

const executionStarted = computed(() => wizardStatus.value !== null && isExecutionPhase(wizardStatus.value))

/** 只读回看：查看步 < 当前步 */
const lookback = computed(() => isReadonlyLookback(stepViewing.value, currentStep.value))

/** 下一步闸门（当前查看步为 1~4 时） */
const nextEnabled = computed(() =>
    canAdvance(stepViewing.value, {
        oldCertId: oldCert.value?.id ?? null,
        newCertId: newCert.value?.id ?? null,
        precheckPassed: Boolean(changeList.value) && !precheckError.value,
        listGenerated: Boolean(changeList.value),
        confirmed: executionStarted.value,
    }),
)

// ===== 步骤导航 =====
function goStep(n: number) {
    if (n < 1 || n > 7) return
    stepViewing.value = n
    currentStep.value = Math.max(currentStep.value, n)
    maxVisitedStep.value = Math.max(maxVisitedStep.value, n)
}

function onStepClick(n: number) {
    if (n > maxVisitedStep.value) return // 未到达不可点
    goStep(n)
}

/** 步骤条键盘：方向键在步骤间移动焦点（Enter/Space 走 click 语义进入可达步） */
function onStepbarKeydown(e: KeyboardEvent) {
    const n = Number((e.target as HTMLElement).dataset.n ?? 0)
    let next = -1
    if (e.key === 'ArrowRight') next = Math.min(7, n + 1)
    else if (e.key === 'ArrowLeft') next = Math.max(1, n - 1)
    else return
    e.preventDefault()
    stepRefs.value[next - 1]?.focus()
}

// ===== Step2 前置校验（生成清单，双预检） =====
async function runPrecheck() {
    if (!oldCert.value || !newCert.value || precheckLoading.value) return
    precheckLoading.value = true
    precheckError.value = null
    listLoadError.value = ''
    try {
        // 同指纹已有本向导生成的旧单且选配已变 → 先取消释放互斥再重新生成
        if (orderId.value && changeList.value) {
            const pairChanged =
                changeList.value.oldFingerprint !== oldCert.value.fingerprint ||
                changeList.value.newCertId !== newCert.value.id
            if (pairChanged) {
                await cancelChangeApi(orderId.value).catch(() => undefined)
                orderId.value = null
                changeList.value = null
            }
        }
        const res = await generateChangeListApi({
            oldFingerprint: oldCert.value.fingerprint,
            newCertId: newCert.value.id,
        })
        changeList.value = res
        orderId.value = res.orderId
        wizardStatus.value = 'pending_confirm'
        announcement.value = '预检通过，变更清单已生成'
    } catch (err) {
        precheckError.value = {
            code: (err as { code?: string }).code ?? 'UNKNOWN',
            message: (err as Error).message || '预检失败',
        }
        announcement.value = '预检未通过'
    } finally {
        precheckLoading.value = false
    }
}

/** 阻断卡「立即扫描」：触发旧证书引用扫描后重跑预检 */
async function onTriggerScan() {
    if (!oldCert.value) return
    try {
        await triggerCertScanApi(oldCert.value.id)
        ElMessage.success('扫描已触发，完成后将自动重新预检')
        void runPrecheck()
    } catch (err) {
        const code = (err as { code?: string }).code ?? ''
        if (code === 'SCAN_IN_PROGRESS') {
            ElMessage.info('扫描进行中，完成后可重试预检')
        } else {
            ElMessage.error('扫描触发失败，请稍后重试')
        }
    }
}

function goChangesList() {
    void router.push('/certs/changes')
}

// ===== Step4 确认执行（快照重校验失败回退 Step2） =====
async function onConfirmExec() {
    if (!orderId.value) return
    confirmSubmitting.value = true
    confirmError.value = ''
    try {
        const total = executableTotal.value
        const conf = step4Ref.value?.batchConf ?? { enabled: false, batchSize: 1 }
        const enabled = conf.enabled && needsBatching(total)
        await confirmChangeApi(orderId.value, {
            enabled,
            batchSize: enabled ? clampBatchSize(conf.batchSize, total) : total,
            maxBatchRatio: 0.5,
        })
        await executeChangeApi(orderId.value)
        confirmVisible.value = false
        wizardStatus.value = 'executing'
        await refreshDetail()
        goStep(5)
        ElMessage.success('变更已进入执行，进度实时刷新')
    } catch (err) {
        const code = (err as { code?: string }).code ?? ''
        if (code === 'SCAN_STALE') {
            confirmError.value = '引用清单已变化，请重新预检'
            confirmVisible.value = false
            ElMessage.error('引用清单已变化，请重新预检')
            changeList.value = null
            precheckError.value = null
            wizardStatus.value = null
            goStep(2)
        } else {
            confirmError.value = (err as Error).message || '确认执行失败，请重试'
        }
    } finally {
        confirmSubmitting.value = false
    }
}

// ===== Step5/6 轮询状态回传（自动步进） =====
async function onPolledStatus(status: ChangeStatus) {
    if (wizardStatus.value !== status) {
        wizardStatus.value = status
    }
    await refreshDetail()
    // 批间暂停（executing+paused 且有剩余批）→ 停留 Step6 等待人工续批
    const bi = batchInfo.value
    const pausedWithRemaining =
        status === 'executing' && bi?.paused && bi.currentBatch < bi.totalBatches
    let target = stepFromStatus(status)
    if (pausedWithRemaining) target = 6
    if (target > currentStep.value) {
        currentStep.value = target
        maxVisitedStep.value = Math.max(maxVisitedStep.value, target)
        stepViewing.value = target
        announcement.value =
            status === 'verifying'
                ? '执行完成，进入验证窗口'
                : pausedWithRemaining
                  ? '首批验证通过，可执行剩余批'
                  : '验证窗口已关闭，变更报告已生成'
    }
}

async function refreshDetail() {
    if (!orderId.value) return
    try {
        const d = await getChangeApi(orderId.value)
        detailItems.value = d.items
        verifyWindowUntil.value = d.verifyWindowUntil ?? null
        protectUntil.value = d.protectUntil ?? null
        batchInfo.value = d.batchInfo ?? null
    } catch {
        /* 详情刷新失败不打断向导轮询 */
    }
}

// ===== 提前完成（Step6 → Step7） =====
async function onEarlyFinish() {
    earlyFinishVisible.value = false
    await refreshDetail()
    currentStep.value = 7
    maxVisitedStep.value = 7
    stepViewing.value = 7
    announcement.value = '已提前完成验证，进入变更报告'
}

// ===== 存草稿 / 取消 =====
function onSaveDraft() {
    saveWizardDraft({
        orderId: orderId.value ?? undefined,
        oldCertId: oldCert.value?.id,
        oldFingerprint: oldCert.value?.fingerprint,
        newCertId: newCert.value?.id,
        savedStep: stepViewing.value,
        savedAt: new Date().toISOString(),
    })
    ElMessage.success(
        orderId.value
            ? `已存为草稿（${orderId.value}），可从变更管理列表恢复`
            : '已存为草稿（本次会话内可恢复），生成清单后将在服务端保留为待确认单',
    )
}

async function onCancelConfirmed() {
    cancelVisible.value = false
    clearWizardDraft()
    // 已生成的待确认单不取消（「已存草稿不受影响」），仅丢弃本地进度
    void router.push(entryPath.value)
}

// ===== 初始化：?certId= 预选 / ?orderId= 恢复 =====
onMounted(async () => {
    const qsOrderId = route.query.orderId ? String(route.query.orderId) : ''
    const qsCertId = route.query.certId ? String(route.query.certId) : ''

    if (qsOrderId) {
        try {
            const d = await getChangeApi(qsOrderId)
            if (isExecutionPhase(d.status)) {
                // 已执行单重入 → 报告页只读恢复视图（向导无执行回退语义）
                void router.replace(`/certs/changes/${encodeURIComponent(qsOrderId)}`)
                return
            }
            orderId.value = d.orderId
            wizardStatus.value = d.status
            detailItems.value = d.items
            verifyWindowUntil.value = d.verifyWindowUntil ?? null
            protectUntil.value = d.protectUntil ?? null
            batchInfo.value = d.batchInfo ?? null
            // 恢复选配：旧证书按指纹检索，新证书按 ID 取详情
            if (d.newCertId) {
                try {
                    const cert = await getCertApi(d.newCertId)
                    newCert.value = { ...certToListItem(cert), id: d.newCertId }
                } catch {
                    /* 新证书信息缺失不阻塞恢复 */
                }
            }
            const restoredStep = d.items.length > 0 ? 4 : 1
            changeList.value = d.items.length > 0 ? detailToChangeList(d) : null
            currentStep.value = restoredStep
            maxVisitedStep.value = restoredStep
            stepViewing.value = restoredStep
            ElMessage.info(`已恢复变更单 ${d.orderId}，可继续编辑`)
        } catch {
            ElMessage.error('变更单加载失败，请从列表重新进入')
        }
        return
    }

    if (qsCertId) {
        try {
            const cert = await getCertApi(qsCertId)
            if (preselectEligible({ hostingStatus: cert.hostingStatus, refCount: cert.refCount })) {
                oldCert.value = certToListItem(cert)
                ElMessage.success('已预选旧证书（仍可手动更换，选择器未锁定）')
            } else {
                preselectNotice.value = PRESELECT_INELIGIBLE_NOTICE
            }
        } catch {
            preselectNotice.value = PRESELECT_INELIGIBLE_NOTICE
        }
        // 预选不跳步，用户仍在 Step1
    }
})

function certToListItem(cert: CertDetail): CertListItem {
    return {
        id: cert.id,
        fingerprint: cert.fingerprint,
        commonName: cert.commonName,
        sans: cert.sans,
        issuer: cert.issuer,
        notAfter: cert.notAfter,
        daysLeft: cert.daysLeft,
        hostingStatus: cert.hostingStatus,
        protectUntil: cert.protectUntil,
        refCount: cert.refCount,
    }
}

/** ChangeDetail → 向导内清单形态（恢复编辑用；执行期快照固定不重生成） */
function detailToChangeList(d: Awaited<ReturnType<typeof getChangeApi>>): ChangeList {
    return {
        orderId: d.orderId,
        oldFingerprint: d.oldFingerprint,
        newCertId: d.newCertId,
        snapshotId: d.snapshotId,
        scanFreshnessHrs: d.scanFreshnessHrs,
        items: d.items.map((it) => ({
            itemId: it.itemId,
            target: it.target,
            action: it.action,
            autoChangeable: it.autoChangeable,
            reason: it.reason,
        })),
        sanCheck: { passed: true, missing: [], newSans: [] },
        warnings: [],
    }
}
</script>

<style lang="scss" scoped>
.cert-wizard-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
  --cert-success: #50e3c2;
  --cert-warning: #f5a623;
  --cert-error: #ee0000;
  --cert-verifying: #8b5cf6;
  --cert-surface-alt: rgba(255, 255, 255, 0.05);
  --cert-font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  :focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: 2px;
  }
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

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  a {
    color: var(--cert-accent);
    text-decoration: none;

    &:hover {
      color: var(--cert-accent-hover);
    }
  }

  .sep {
    color: var(--text-secondary);
  }

  .current {
    color: var(--text-primary);
  }

  .mono {
    font-family: var(--cert-font-mono);
  }
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 13px;
}

.mono {
  font-family: var(--cert-font-mono);
}

.chg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-base);

  &.tone-secondary {
    color: #a1a1a1;
  }
}

.stepbar-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 8px 16px;
  overflow-x: auto;
}

.stepbar {
  display: flex;
  gap: 4px;
  min-width: max-content;
}

.step {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 10px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  border-bottom: 2px solid transparent;

  .step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1px solid var(--border-base);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  &.active {
    color: var(--text-primary);
    border-bottom-color: var(--cert-accent);

    .step-num {
      border-color: var(--cert-accent);
      color: var(--cert-accent);
    }
  }

  &.done {
    color: var(--text-primary);

    .step-num {
      color: var(--cert-success);
      border-color: color-mix(in srgb, var(--cert-success) 50%, transparent);
    }
  }

  &.locked {
    cursor: not-allowed;
    opacity: 0.55;
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: -2px;
  }
}

.lookback-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: color-mix(in srgb, var(--cert-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--cert-accent) 30%, transparent);
  border-radius: 8px;
  padding: 8px 16px;
}

.step-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-lead {
  margin: 0 0 12px;
  color: var(--text-primary);
  font-size: 14px;
}

@media (max-width: 1023px) {
  .stepbar-card {
    overflow-x: auto;
  }
}
</style>
