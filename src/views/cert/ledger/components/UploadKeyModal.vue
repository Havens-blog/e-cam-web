<template>
  <el-dialog
    v-model="visible"
    title="补传私钥"
    width="480px"
    align-center
    class="cert-modal"
    :show-close="!submitting"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    aria-labelledby="supply-key-title"
    @closed="resetForm"
  >
    <template #header>
      <h3 id="supply-key-title" class="modal-title">补传私钥</h3>
    </template>

    <p class="modal-intro">
      上传私钥后系统将进行匹配校验，通过后证书即时升级为完整托管。私钥仅以加密形式托管，不返回明文。
      <template v-if="cert">
        目标证书：<span class="mono">{{ cert.commonName }}</span>
      </template>
    </p>

    <div
      class="dropzone"
      :class="{ 'dropzone-active': dragging }"
      role="button"
      tabindex="0"
      aria-label="上传私钥文件，可拖拽或回车选择文件"
      @click="picker?.click()"
      @keydown.enter.prevent="picker?.click()"
      @keydown.space.prevent="picker?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="dropzone-text">{{ keyFile ? keyFile.name : '拖拽私钥文件到此处，或点击选择' }}</div>
      <div class="dropzone-hint">支持 .key / .pem</div>
      <input
        ref="picker"
        type="file"
        class="hidden-input"
        accept=".key,.pem"
        aria-label="私钥文件"
        @change="onPicked"
      />
    </div>

    <div
      v-if="errorItems.length > 0"
      id="supply-key-error"
      class="error-banner"
      role="alert"
      aria-label="匹配校验失败"
    >
      <span class="error-banner-icon" aria-hidden="true">✗</span>
      <div>
        <div class="error-banner-title">匹配校验失败</div>
        <ul class="error-banner-list">
          <li v-for="item in errorItems" :key="item.code">
            <strong>{{ item.label }}</strong>：<span class="mono">{{ item.detail }}</span>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="submitting" @click="closeModal">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!keyFile" @click="onSubmit">
        <span v-if="submitting">校验中…</span>
        <span v-else>提交校验</span>
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 补传私钥 Modal（AC5，仅指纹登记行「⋯ 补传私钥」入口）：
 * 上传私钥 → POST /certs/:id/key 匹配校验 → 通过后即时升级完整托管（父级刷新行状态）；
 * 失败展示 CERT_KEY_MISMATCH 等错误（横幅，Modal 保持打开可换文件重试）。
 * Hard Rule：提交终态到达前不可关闭/按钮 disabled；任何界面不展示明文私钥
 * （本组件只持有 File 句柄，不读取内容渲染）。
 */
import type { CertListItem } from '@/api/cert'
import { uploadCertKeyApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { importErrorItems, type ImportErrorItem } from '../format'

const emit = defineEmits<{
    /** 校验通过并升级：父级刷新列表/统计（行托管状态即时更新） */
    (e: 'upgraded', payload: { certId: string }): void
}>()

const visible = ref(false)
const cert = ref<CertListItem | null>(null)
const keyFile = ref<File | null>(null)
const submitting = ref(false)
const errorItems = ref<ImportErrorItem[]>([])
const dragging = ref(false)
const picker = ref<HTMLInputElement | null>(null)

function open(row: CertListItem) {
    resetForm()
    cert.value = row
    visible.value = true
}

function closeModal() {
    if (submitting.value) return
    visible.value = false
}

function resetForm() {
    cert.value = null
    keyFile.value = null
    errorItems.value = []
    submitting.value = false
    if (picker.value) picker.value.value = ''
}

function setFile(file: File | null) {
    keyFile.value = file
    errorItems.value = []
}

function onPicked(e: Event) {
    setFile((e.target as HTMLInputElement).files?.[0] ?? null)
}

function onDrop(e: DragEvent) {
    dragging.value = false
    setFile(e.dataTransfer?.files?.[0] ?? null)
}

async function onSubmit() {
    const target = cert.value
    const key = keyFile.value
    if (submitting.value || !target || !key) return
    submitting.value = true
    errorItems.value = []
    try {
        await uploadCertKeyApi(target.id, key)
        ElMessage.success('匹配校验通过，已升���为完整托管')
        visible.value = false
        emit('upgraded', { certId: target.id })
    } catch (err) {
        submitting.value = false
        errorItems.value = importErrorItems(err)
    }
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

.modal-intro {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 16px;
  line-height: 1.6;
}

.mono {
  font-family: var(--cert-font-mono);
}

.dropzone {
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
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

.error-banner {
  display: flex;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cert-error) 40%, transparent);
  background: color-mix(in srgb, var(--cert-error) 10%, transparent);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
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
</style>
