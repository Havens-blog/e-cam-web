<template>
  <div class="cert-settings-page" aria-labelledby="cert-settings-title">
    <nav class="breadcrumb" aria-label="面包屑">
      <router-link to="/certs/changes">变更管理</router-link>
      <span class="sep" aria-hidden="true">/</span>
      <span class="current">配置</span>
    </nav>

    <div class="page-header">
      <div>
        <h1 id="cert-settings-title" class="page-title">全局配置</h1>
        <p class="page-desc">仅运维主管 / 审计角色可见，所有配置变更留审计。</p>
      </div>
    </div>

    <div aria-live="polite">
      <!-- Loading：三卡骨架（800ms 内返回直接渲染，不闪骨架） -->
      <template v-if="pageView === 'loading'">
        <div v-if="skeletonVisible" aria-hidden="true">
          <div v-for="i in 3" :key="i" class="skeleton-card" />
        </div>
        <div v-else class="loading-placeholder" aria-label="加载中" />
      </template>

      <!-- 读取失败：错误卡 + 重试（表单不可编辑 = 不渲染表单） -->
      <div v-else-if="pageView === 'error'" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">配置读取失败</div>
          <div class="state-desc">配置服务暂时不可用，表单不可编辑，重试成功后恢复。</div>
          <el-button class="state-cta" @click="fetchSettings()">重试</el-button>
        </div>
      </div>

      <!-- Empty：尚未配置接收人（空态引导首次配置） -->
      <div v-else-if="pageView === 'empty'" class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">⚙</div>
          <div class="state-title">尚未配置接收人</div>
          <div class="state-desc">首次配置：填写告警接收人与探测豁免清单。</div>
          <el-button type="primary" class="state-cta" @click="startEditing = true">开始配置</el-button>
        </div>
      </div>

      <!-- Default：渠道未确认横幅 + 四卡 -->
      <template v-else>
        <!-- AC5：channelConfirmed=false 时 Warning 横幅，就绪后消失 -->
        <div v-if="settings && !settings.channelConfirmed" class="banner banner-warning" role="alert">
          <span class="banner-icon" aria-hidden="true">⚠</span>
          <div>
            <div class="banner-title">告警渠道未确认，相关验收标准不在范围</div>
            <div class="banner-body">请先确认 webhook 与邮件接收组可用，渠道就绪后本提示消失。</div>
          </div>
        </div>

        <AlertReceiverCard
          :webhook-urls="webhooksDraft"
          :email-group="emailsDraft"
          :saving="savingReceivers"
          :testing="testing"
          :save-error="receiversSaveError"
          @update:webhook-urls="webhooksDraft = $event"
          @update:email-group="emailsDraft = $event"
          @save="saveReceivers"
          @test="sendTestAlert"
        />

        <ExemptionListCard
          ref="exemptionCard"
          :exemptions="settings?.exemptions ?? []"
          :mutating="exemptionMutating"
          @add="onAddExemption"
          @remove="onRemoveExemption"
        />

        <ThresholdsCard
          :draft="thresholdsDraft"
          :saving="savingThresholds"
          :save-error="thresholdsSaveError"
          @update-field="onThresholdField"
          @update-expiry-levels="thresholdsDraft.expiryLevels = $event"
          @save="saveThresholds"
        />

        <CrdRegistrationCard />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 全局配置页（UF-5，任务 6.6）：/certs/settings，仅运维主管/审计可见。
 *
 * Hard Rules：
 * - 阈值界值前端校验仅为体验，保存前服务端仍校验——PUT 越界 400 在
 *   ThresholdsCard 保存按钮旁行内呈现服务端信息，表单保留输入不清空。
 * - 角色拦截由 6.1 路由守卫（certManageOnly）完成，本组件不重复实现。
 *
 * 状态机（ui-design States）：loading 三卡骨架 / 读取失败重试（表单不可编辑）/
 * empty「尚未配置接收人」+ 开始配置 / default 四卡（告警接收、豁免清单、
 * 阈值参数、CRD 登记）+ 渠道未确认 Warning 横幅（channelConfirmed=false）。
 * 保存异常：行内错误且草稿不清空（草稿状态在页面持有，保存成功才回填服务端结果）。
 * 豁免增删走独立留审计端点，成功后静默刷新 settings（不动未保存的草稿输入）。
 */
import type { CertSettings } from '@/api/cert'
import {
    CertRequestError,
    addCertExemptionApi,
    getCertSettingsApi,
    removeCertExemptionApi,
    testCertAlertApi,
    updateCertSettingsApi,
} from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AlertReceiverCard from './components/AlertReceiverCard.vue'
import CrdRegistrationCard from './components/CrdRegistrationCard.vue'
import ExemptionListCard from './components/ExemptionListCard.vue'
import ThresholdsCard from './components/ThresholdsCard.vue'
import {
    buildUpdatePayload,
    draftFromThresholds,
    isReceiversEmpty,
    thresholdsFromDraft,
    type NumericThresholdKey,
    type ThresholdsDraft,
} from './format'

const SKELETON_DELAY_MS = 800

const settings = ref<CertSettings | null>(null)
const loadError = ref(false)
const firstLoading = ref(true)
const startEditing = ref(false)
const skeletonVisible = ref(false)

// ===== 草稿（页面持有：保存失败不清空，成功回填服务端结果） =====
const webhooksDraft = ref<string[]>([])
const emailsDraft = ref<string[]>([])
/** 载入前的空草稿基准（ready 前不渲染卡片，仅供类型与占位） */
const EMPTY_NUMERIC_DRAFT: Record<NumericThresholdKey, number | null> = {
    scanFreshnessHours: null,
    verifyWindowHours: null,
    rollbackProtectDays: null,
    verifyConfirmProbes: null,
    verifyProbeIntervalMinutes: null,
    pauseTimeoutHours: null,
    recheckDelayMinutes: null,
    itemHeartbeatTimeoutMinutes: null,
    scanTimeoutHours: null,
}
const thresholdsDraft = ref<ThresholdsDraft>({ numeric: { ...EMPTY_NUMERIC_DRAFT }, expiryLevels: [] })

const pageView = computed<'loading' | 'error' | 'empty' | 'populated'>(() => {
    if (firstLoading.value) return 'loading'
    if (loadError.value) return 'error'
    if (settings.value && isReceiversEmpty(settings.value) && !startEditing.value) return 'empty'
    return 'populated'
})

// ===== 保存/测试进行中状态与行内错误 =====
const savingReceivers = ref(false)
const savingThresholds = ref(false)
const testing = ref(false)
const receiversSaveError = ref('')
const thresholdsSaveError = ref('')
const exemptionMutating = ref(false)

const exemptionCard = ref<InstanceType<typeof ExemptionListCard> | null>(null)

let skeletonTimer: ReturnType<typeof setTimeout> | null = null

function beginSkeletonTimer() {
    skeletonVisible.value = false
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = setTimeout(() => {
        if (firstLoading.value) skeletonVisible.value = true
    }, SKELETON_DELAY_MS)
}

function endSkeletonTimer() {
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = null
    skeletonVisible.value = false
}

function syncDrafts(s: CertSettings) {
    webhooksDraft.value = [...s.webhookUrls]
    emailsDraft.value = [...s.emailGroup]
    thresholdsDraft.value = draftFromThresholds(s.thresholds)
}

async function fetchSettings() {
    firstLoading.value = true
    loadError.value = false
    beginSkeletonTimer()
    try {
        const res = await getCertSettingsApi()
        settings.value = res
        syncDrafts(res)
    } catch (err) {
        loadError.value = true
        settings.value = null
        if (err instanceof Error && err.message) {
            // 读取失败不弹 Toast（页面已有错误卡），仅控制台留痕
            console.warn('[cert-settings] 读取配置失败:', err.message)
        }
    } finally {
        firstLoading.value = false
        endSkeletonTimer()
    }
}

/** 豁免增删后静默刷新（保留未保存的草稿输入） */
async function refreshSettingsKeepDrafts() {
    const res = await getCertSettingsApi()
    settings.value = res
}

// ===== 卡1：告警接收 =====
async function saveReceivers() {
    if (!settings.value || savingReceivers.value) return
    savingReceivers.value = true
    receiversSaveError.value = ''
    try {
        const res = await updateCertSettingsApi(
            buildUpdatePayload(settings.value, {
                webhookUrls: webhooksDraft.value,
                emailGroup: emailsDraft.value,
            }),
        )
        settings.value = res
        syncDrafts(res)
        ElMessage.success('告警配置已保存')
    } catch (err) {
        // 保存异常：行内错误 + 输入保留
        receiversSaveError.value = err instanceof Error ? err.message : '保存失败，请重试'
    } finally {
        savingReceivers.value = false
    }
}

async function sendTestAlert() {
    if (testing.value) return
    testing.value = true
    try {
        const res = await testCertAlertApi()
        if (res.sent) {
            ElMessage.success('测试告警已发送')
        } else {
            ElMessage.error(res.reason ? `测试告警发送失败：${res.reason}` : '测试告警发送失败')
        }
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '测试告警发送失败')
    } finally {
        testing.value = false
    }
}

// ===== 卡2：豁免清单 =====
async function onAddExemption(payload: { domain: string; reason?: string }) {
    exemptionMutating.value = true
    try {
        await addCertExemptionApi(payload)
        await refreshSettingsKeepDrafts()
        exemptionCard.value?.notifyAddResult(true)
        ElMessage.success('豁免已添加，审计已记录')
    } catch (err) {
        const message = err instanceof CertRequestError || err instanceof Error ? err.message : '添加失败，请重试'
        exemptionCard.value?.notifyAddResult(false, message)
    } finally {
        exemptionMutating.value = false
    }
}

async function onRemoveExemption(domain: string) {
    exemptionMutating.value = true
    try {
        await removeCertExemptionApi(domain)
        await refreshSettingsKeepDrafts()
        exemptionCard.value?.notifyRemoveResult(true)
        ElMessage.success('豁免已移除，审计已记录')
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '移除失败，请重试')
        exemptionCard.value?.notifyRemoveResult(false)
    } finally {
        exemptionMutating.value = false
    }
}

// ===== 卡3：阈值参数 =====
function onThresholdField(key: NumericThresholdKey, value: number | null) {
    thresholdsDraft.value.numeric[key] = value
}

async function saveThresholds() {
    if (!settings.value || savingThresholds.value) return
    savingThresholds.value = true
    thresholdsSaveError.value = ''
    try {
        const res = await updateCertSettingsApi(
            buildUpdatePayload(settings.value, { thresholds: thresholdsFromDraft(thresholdsDraft.value) }),
        )
        settings.value = res
        syncDrafts(res)
        ElMessage.success('阈值已保存（审计已记录）')
    } catch (err) {
        // Hard Rule：PUT 越界 400 等服务端错误行内呈现（前端界值仅为体验，服务端仍校验）
        thresholdsSaveError.value = err instanceof Error ? err.message : '保存失败，请重试'
    } finally {
        savingThresholds.value = false
    }
}

onMounted(() => {
    void fetchSettings()
})

onUnmounted(() => {
    endSkeletonTimer()
})
</script>

<style lang="scss" scoped>
// ===== Vercel 设计 token（ui-design Design System）+ Element Plus 变量对齐 =====
.cert-settings-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
  --cert-success: #50e3c2;
  --cert-warning: #f5a623;
  --cert-error: #ee0000;
  --cert-surface-alt: rgba(255, 255, 255, 0.05);
  --cert-font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  // Element Plus 主题对齐（仅本页作用域，含子卡组件）
  --el-color-primary: var(--cert-accent);
  --el-color-primary-light-3: #3291ff;
  --el-color-primary-light-5: #66aaff;
  --el-color-primary-light-7: #99c8ff;
  --el-color-primary-light-8: #b3d6ff;
  --el-color-primary-light-9: #cce4ff;
  --el-color-primary-dark-2: #0058bd;
  --el-color-success: var(--cert-success);
  --el-color-warning: var(--cert-warning);
  --el-color-danger: var(--cert-error);
  --el-border-radius-base: 6px;

  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  // 无障碍：可见 focus ring（2px accent + 2px offset）
  :focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: 2px;
  }
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
}

.page-header {
  display: flex;
  align-items: center;
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

.page-desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

// ===== 渠道未确认 Warning 横幅 =====
.banner {
  display: flex;
  gap: 10px;
  border-radius: 8px;
  padding: 12px 14px;
}

.banner-warning {
  border: 1px solid color-mix(in srgb, var(--cert-warning) 40%, transparent);
  background: color-mix(in srgb, var(--cert-warning) 8%, transparent);
}

.banner-icon {
  color: var(--cert-warning);
  font-size: 16px;
  line-height: 1.4;
}

.banner-title {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}

.banner-body {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

// ===== 骨架（三卡） =====
.skeleton-card {
  height: 220px;
  border-radius: 12px;
  background: var(--cert-surface-alt);
  position: relative;
  overflow: hidden;

  & + & {
    margin-top: 16px;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: settings-skeleton-wave 1.2s ease-in-out infinite;
  }
}

@keyframes settings-skeleton-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.loading-placeholder {
  min-height: 420px;
}

// ===== 空态 / 错误态 =====
.state-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 64px 24px;
  text-align: center;
}

.state-icon {
  font-size: 40px;
  line-height: 1;
}

.state-icon-error {
  color: var(--cert-error);
}

.state-title {
  font-size: 16px;
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
  .skeleton-card::after {
    animation: none;
  }
}
</style>
