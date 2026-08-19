<template>
  <el-dialog
    v-model="visible"
    title="导入证书"
    width="480px"
    align-center
    class="cert-modal"
    :show-close="!submitting"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    aria-labelledby="import-cert-title"
    @closed="resetForm"
  >
    <template #header>
      <h3 id="import-cert-title" class="modal-title">导入证书</h3>
    </template>

    <el-form label-position="top" @submit.prevent>
      <div
        class="dropzone"
        :class="{ 'dropzone-active': dragging }"
        role="button"
        tabindex="0"
        aria-label="上传证书文件（PEM），可拖拽或回车选择文件"
        @click="pickCertFile"
        @keydown.enter.prevent="pickCertFile"
        @keydown.space.prevent="pickCertFile"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDropCert"
      >
        <div class="dropzone-text">
          <template v-if="certFile">{{ certFile.name }}</template>
          <template v-else>拖拽 PEM 文件到此处，或点击选择</template>
        </div>
        <div class="dropzone-hint">支持 .pem / .crt</div>
        <input
          ref="certInput"
          type="file"
          class="hidden-input"
          accept=".pem,.crt"
          aria-label="证书文件（PEM）"
          @change="onCertSelected"
        />
      </div>

      <el-form-item label="私钥文件（可选）" for="import-key">
        <input
          id="import-key"
          ref="keyInput"
          type="file"
          class="cert-file-input"
          accept=".key,.pem"
          :disabled="submitting"
          aria-describedby="import-key-hint"
          @change="onKeySelected"
        />
        <span id="import-key-hint" class="field-hint">未提供私钥将走仅指纹登记</span>
      </el-form-item>

      <el-form-item label="预期域名（可选，仅提示性比对）" for="import-domain">
        <el-input
          id="import-domain"
          v-model="expectedDomain"
          placeholder="example.com"
          :disabled="submitting"
          aria-describedby="expected-domain-hint"
        />
        <span id="expected-domain-hint" class="field-hint">用于导入前比对 SAN 覆盖情况，不影响提交</span>
      </el-form-item>

      <el-alert
        v-if="expectedMismatch"
        class="modal-alert"
        type="warning"
        :closable="false"
        show-icon
        aria-live="polite"
      >
        SAN 未覆盖预期域名「{{ expectedDomain }}」（提示性，不拦截）
      </el-alert>

      <div
        v-if="errorItems.length > 0"
        id="import-error-banner"
        class="error-banner"
        role="alert"
        aria-label="校验失败"
      >
        <span class="error-banner-icon" aria-hidden="true">✗</span>
        <div>
          <div class="error-banner-title">校验失败</div>
          <ul class="error-banner-list">
            <li v-for="item in errorItems" :key="item.code">
              <strong>{{ item.label }}</strong>：<span class="mono">{{ item.detail }}</span>
            </li>
          </ul>
        </div>
      </div>
    </el-form>

    <template #footer>
      <el-button :disabled="submitting" @click="closeModal">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!certFile" @click="onSubmit">
        <span v-if="submitting">{{ phaseText }}</span>
        <span v-else>提交</span>
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 单张导入 Modal（AC3）：PEM（必填，拖拽/点击）+ 私钥（可选，缺省仅指纹登记）
 * + 预期域名（可选，客户端 SAN 覆盖 Warning，不拦截）。
 *
 * Hard Rule：提交终态到达前 Modal 不可关闭、按钮 disabled（防重复提交）——
 * submitting 期间 show-close / 点遮罩 / Esc 全部关闭，取消与提交按钮 disabled。
 * 阶段化 loading：上传中 → 解析中 → 校验中（定时推进，终态即停，无中间态闪烁）。
 * 校验失败：表单顶部 Error 横幅逐项列错误（四类 CERT_*，importErrorItems 映射）。
 */
import type { ImportErrorItem } from '../format'
import { importCertApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { expectedDomainCovered, extractPemDomains, importErrorItems } from '../format'

const emit = defineEmits<{
    /** 导入成功：父级刷新列表/统计并高亮新证书 */
    (e: 'imported', payload: { certId: string; fingerprint: string }): void
}>()

const visible = ref(false)
const certFile = ref<File | null>(null)
const keyFile = ref<File | null>(null)
const expectedDomain = ref('')
const errorItems = ref<ImportErrorItem[]>([])
const submitting = ref(false)
const phase = ref<'idle' | 'uploading' | 'parsing' | 'validating'>('idle')
const dragging = ref(false)
const pemDomains = ref<string[]>([])

const certInput = ref<HTMLInputElement | null>(null)
const keyInput = ref<HTMLInputElement | null>(null)

const PHASE_TEXT = {
    idle: '',
    uploading: '上传中…',
    parsing: '解析中…',
    validating: '校验中…',
} as const

const phaseText = computed(() => PHASE_TEXT[phase.value])

/** 预期域名 Warning：有证书+有预期域名且客户端提取的 SAN 不覆盖（提示性，不拦截） */
const expectedMismatch = computed(
    () =>
        certFile.value !== null &&
        expectedDomain.value.trim() !== '' &&
        pemDomains.value.length > 0 &&
        !expectedDomainCovered(expectedDomain.value.trim(), pemDomains.value),
)

let phaseTimer1: ReturnType<typeof setTimeout> | null = null
let phaseTimer2: ReturnType<typeof setTimeout> | null = null

function open() {
    resetForm()
    visible.value = true
}

function closeModal() {
    if (submitting.value) return
    visible.value = false
}

function resetForm() {
    certFile.value = null
    keyFile.value = null
    expectedDomain.value = ''
    errorItems.value = []
    submitting.value = false
    phase.value = 'idle'
    pemDomains.value = []
    clearPhaseTimers()
    for (const input of [certInput.value, keyInput.value]) {
        if (input) input.value = ''
    }
}

function clearPhaseTimers() {
    if (phaseTimer1) clearTimeout(phaseTimer1)
    if (phaseTimer2) clearTimeout(phaseTimer2)
    phaseTimer1 = null
    phaseTimer2 = null
}

function pickCertFile() {
    certInput.value?.click()
}

function onCertSelected(e: Event) {
    setCertFile((e.target as HTMLInputElement).files?.[0] ?? null)
}

function onDropCert(e: DragEvent) {
    dragging.value = false
    setCertFile(e.dataTransfer?.files?.[0] ?? null)
}

async function setCertFile(file: File | null) {
    certFile.value = file
    errorItems.value = []
    pemDomains.value = []
    if (!file) return
    // 读取 PEM 提取域名（预期域名提示性比对用；失败静默——比对是可选增强）
    try {
        const text = await file.text()
        pemDomains.value = extractPemDomains(text)
    } catch {
        pemDomains.value = []
    }
}

function onKeySelected(e: Event) {
    keyFile.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function onSubmit() {
    const cert = certFile.value
    if (submitting.value || !cert) return
    submitting.value = true
    errorItems.value = []
    // 阶段化 loading：定时推进覆盖网络耗时（终态到达即停，避免闪烁）
    phase.value = 'uploading'
    phaseTimer1 = setTimeout(() => {
        if (phase.value === 'uploading') phase.value = 'parsing'
    }, 700)
    phaseTimer2 = setTimeout(() => {
        if (phase.value === 'parsing') phase.value = 'validating'
    }, 1400)

    try {
        const result = await importCertApi({
            certFile: cert,
            keyFile: keyFile.value ?? undefined,
            expectedDomain: expectedDomain.value.trim() || undefined,
        })
        clearPhaseTimers()
        ElMessage.success(`证书导入成功（指纹 ${result.fingerprint.slice(0, 8)}…）`)
        visible.value = false
        emit('imported', { certId: result.certId, fingerprint: result.fingerprint })
    } catch (err) {
        clearPhaseTimers()
        phase.value = 'idle'
        submitting.value = false
        errorItems.value = importErrorItems(err)
    }
}

watch(visible, (v) => {
    if (!v) clearPhaseTimers()
})

defineExpose({ open })
</script>

<style lang="scss" scoped>
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.dropzone {
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  margin-bottom: 16px;
  transition: border-color 150ms ease, background-color 150ms ease;

  &:hover,
  &:focus-visible,
  &.dropzone-active {
    border-color: var(--cert-accent);
    background: var(--cert-surface-alt);
  }
}

.dropzone-text {
  color: var(--text-primary);
  font-size: 14px;
  word-break: break-all;
}

.dropzone-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.hidden-input {
  display: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.cert-file-input {
  width: 100%;
  font-size: 13px;
  color: var(--text-secondary);
}

.field-hint {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.modal-alert {
  margin-bottom: 12px;
}

.error-banner {
  display: flex;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cert-error) 40%, transparent);
  background: color-mix(in srgb, var(--cert-error) 10%, transparent);
  border-radius: 8px;
  padding: 12px;
}

.error-banner-icon {
  color: var(--cert-error);
  font-weight: 700;
}

.error-banner-title {
  font-weight: 600;
  color: var(--cert-error);
  margin-bottom: 4px;
}

.error-banner-list {
  margin: 0;
  padding-left: 16px;
  color: var(--text-primary);
  font-size: 13px;

  li + li {
    margin-top: 2px;
  }
}

.mono {
  font-family: var(--cert-font-mono);
}
</style>
