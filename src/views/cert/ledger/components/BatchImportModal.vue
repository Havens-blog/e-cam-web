<template>
  <el-dialog
    v-model="visible"
    width="720px"
    align-center
    class="cert-modal batch-modal"
    :show-close="!running"
    :close-on-click-modal="false"
    :close-on-press-escape="!running"
    :before-close="guardClose"
    aria-labelledby="batch-import-title"
    @open="onOpen"
    @closed="onClosed"
  >
    <template #header>
      <h3 id="batch-import-title" class="modal-title">批量导入</h3>
    </template>

    <div
      class="dropzone"
      :class="{ 'dropzone-active': dragging }"
      role="button"
      tabindex="0"
      aria-label="选择或拖拽上传证书文件（支持多选 PEM/CRT 与 ZIP 压缩包）"
      @click="pickFiles"
      @keydown.enter.prevent="pickFiles"
      @keydown.space.prevent="pickFiles"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDropFiles"
    >
      <div class="dropzone-text">多文件选择 / 拖拽上传 PEM，逐文件可附加私钥；支持 zip 解包</div>
      <div class="dropzone-hint">支持 .pem / .crt / .key / .zip，zip 内同名基名私钥自动配对</div>
      <input
        ref="picker"
        type="file"
        class="hidden-input"
        multiple
        accept=".pem,.crt,.cer,.key,.zip"
        aria-label="批量选择证书文件"
        @change="onPickerChange"
      />
    </div>

    <!-- 待提交清单（逐文件可选私钥） -->
    <div v-if="pendingRows.length > 0" class="pending-list">
      <div
        v-for="row in pendingRows"
        :key="row.keyId"
        class="pending-row"
        :class="{ 'pending-row-muted': running }"
      >
        <span class="filename" :title="row.fileName">{{ row.fileName }}</span>
        <span v-if="row.fromZip" class="zip-tag">zip</span>
        <span class="row-spacer" />
        <span v-if="row.keyFile" class="key-attached">已附私钥：{{ row.keyFile.name }}</span>
        <button
          v-else
          type="button"
          class="row-link"
          :disabled="running"
          @click="attachKey(row)"
        >
          附加私钥
        </button>
        <button
          type="button"
          class="row-remove"
          :aria-label="`移除文件 ${row.fileName}`"
          :disabled="running"
          @click="removeRow(row)"
        >
          ×
        </button>
      </div>
    </div>
    <p v-if="skippedCount > 0" class="skip-hint">已忽略 {{ skippedCount }} 个无法识别的文件（仅接受证书/私钥/zip）</p>

    <input
      ref="keyPicker"
      type="file"
      class="hidden-input"
      accept=".key,.pem"
      aria-label="为选中文件附加私钥"
      @change="onKeyPicked"
    />

    <!-- 会话进度与逐文件结果 -->
    <div v-if="session" class="session-panel">
      <template v-if="running">
        <el-progress :percentage="progressPercent" :stroke-width="8" :show-text="false" aria-label="批量导入进度" />
        <div class="progress-text" aria-hidden="true">
          处理中：{{ doneCount }}/{{ session.progress.total }} · 成功 {{ successCount }} · 失败 {{ failedCount }}
        </div>
      </template>
      <template v-else>
        <div class="result-summary" aria-live="polite">
          <span v-if="session.status === 'completed'" class="result-flag flag-success">✓ 全部完成</span>
          <span v-else-if="session.status === 'partial_failed'" class="result-flag flag-error">✗ 部分失败</span>
          <span v-else class="result-flag">已终止导入（服务端按已处理文件保留结果）</span>
          <span class="result-meta">成功 {{ successCount }} / 失败 {{ failedCount }}</span>
        </div>
      </template>

      <div class="result-list">
        <div v-for="f in resultFiles" :key="f.fileName" class="result-row">
          <span class="filename" :title="f.fileName">{{ f.fileName }}</span>
          <span class="ledger-badge" :class="`tone-${batchResultMeta(f.result).tone}`">
            {{ batchResultMeta(f.result).label }}
          </span>
          <span v-if="f.certId" class="result-note">{{ f.certId }}</span>
          <span v-else-if="f.errorReason" class="result-note result-note-error">{{ f.errorReason }}</span>
          <span class="row-spacer" />
          <template v-if="f.result === 'failed' && !running">
            <button
              v-if="fileByRowName(f.fileName)"
              type="button"
              class="row-link"
              :disabled="retryingName === f.fileName"
              @click="retryFile(f)"
            >
              {{ retryingName === f.fileName ? '重试中…' : '重试' }}
            </button>
            <label v-else class="retry-pick">
              重新选择文件重试
              <input
                type="file"
                class="hidden-input"
                accept=".pem,.crt,.cer"
                :aria-label="`为 ${f.fileName} 重新选择证书文件`"
                @change="(e) => onRetryFilePicked(e, f)"
              />
            </label>
          </template>
        </div>
      </div>
      <p v-if="terminatedManually" class="terminate-hint">本次导入已终止：已成功文件保留入库；未处理文件不保留，需重新选择上传。</p>
    </div>

    <template #footer>
      <template v-if="running">
        <el-button type="danger" plain @click="confirmTerminate">终止导入</el-button>
        <el-button type="primary" disabled>处理中…</el-button>
      </template>
      <template v-else-if="session">
        <el-button @click="visible = false">关闭</el-button>
        <el-button type="primary" @click="visible = false">完成</el-button>
      </template>
      <template v-else>
        <el-button @click="visible = false">关闭</el-button>
        <el-button type="primary" :loading="submitting" :disabled="submitDisabled" @click="onSubmit">
          {{ submitting ? '提交中…' : `提交（${pendingRows.length} 个文件）` }}
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 批量导入 Modal（720px，AC4）：多文件/拖拽 + 逐文件可选私钥 + zip 解包（fflate）；
 * 提交后 202 会话句柄轮询 GET /certs/batch/:batchId 直至终态（completed/partial_failed）；
 * 处理中不得中途关闭——关闭需二次确认「终止导入」（已成功文件保留入库，服务端语义）；
 * 逐文件结果列表（成功[完整/仅指纹]/失败+原因）+ 失败行单文件重试（重新 POST 单文件，
 * api-handbook 批量导入节）；中断重入经 localStorage batchId 恢复上次会话结果展示。
 */
import type { BatchImportFile, BatchImportSession } from '@/api/cert'
import { batchImportCertsApi, getBatchImportApi } from '@/api/cert'
import { ElMessage, ElMessageBox } from 'element-plus'
import { unzipSync } from 'fflate'
import { computed, onUnmounted, ref } from 'vue'
import {
    batchProgressPercent,
    batchResultMeta,
    isBatchTerminal,
    loadLastBatchId,
    pairBaseName,
    saveLastBatchId,
    sniffPemKind,
    splitZipEntries,
} from '../format'

interface PendingRow {
    keyId: number
    fileName: string
    file: File
    keyFile: File | null
    fromZip: boolean
}

const emit = defineEmits<{
    /** 会话到达终态且用户点「完成」：父级刷新列表与统计 */
    (e: 'completed'): void
}>()

const visible = ref(false)
const dragging = ref(false)
const submitting = ref(false)
const pendingRows = ref<PendingRow[]>([])
const skippedCount = ref(0)
const session = ref<BatchImportSession | null>(null)
const terminatedManually = ref(false)
const retryingName = ref('')
const picker = ref<HTMLInputElement | null>(null)
const keyPicker = ref<HTMLInputElement | null>(null)
let attachTargetKey: number | null = null
let rowSeq = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollInFlight = false
/** 重试后重挂到行上的文件（fileName → File），用于无原始文件的恢复会话重试 */
const retryFiles = new Map<string, File>()

const MAX_FILES = 50

const running = computed(() => session.value !== null && !isBatchTerminal(session.value.status))

const resultFiles = computed<BatchImportFile[]>(() => session.value?.files ?? [])

const doneCount = computed(() => {
    const s = session.value
    if (!s) return 0
    return s.files.filter((f) => f.result !== undefined).length || s.progress.done
})

const successCount = computed(
    () => resultFiles.value.filter((f) => f.result === 'complete' || f.result === 'fingerprintOnly').length,
)

const failedCount = computed(() => resultFiles.value.filter((f) => f.result === 'failed').length)

const progressPercent = computed(() => {
    const s = session.value
    if (!s) return 0
    return batchProgressPercent(doneCount.value, s.progress.total || resultFiles.value.length)
})

const submitDisabled = computed(() => pendingRows.value.length === 0)

function onOpen() {
    // 中断重入：恢复上次会话（running → 续轮询；终态 → 展示结果，失败行可重选文件重试）
    const lastId = loadLastBatchId()
    if (!lastId) return
    getBatchImportApi(lastId)
        .then((s) => {
            if (!visible.value) return
            session.value = s
            if (!isBatchTerminal(s.status)) startPolling()
        })
        .catch(() => {
            // 会话 TTL 过期或不存在：清除残留引用
            saveLastBatchId(null)
        })
}

function onClosed() {
    stopPolling()
    // 关闭后刷新：终态会话（含重试后的结果）或终止时已有成功文件 → 父级刷新列表/统计
    const s = session.value
    if (s && (isBatchTerminal(s.status) || s.files.some((f) => f.result === 'complete' || f.result === 'fingerprintOnly'))) {
        emit('completed')
    }
    pendingRows.value = []
    skippedCount.value = 0
    session.value = null
    terminatedManually.value = false
    retryingName.value = ''
    retryFiles.clear()
    attachTargetKey = null
}

function pickFiles() {
    picker.value?.click()
}

function onPickerChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) addFiles(Array.from(input.files))
    input.value = ''
}

function onDropFiles(e: DragEvent) {
    dragging.value = false
    if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files))
}

/** 归并所选文件：证书入待提交清单、.key 就地配对同名基名行、zip 解包分流 */
async function addFiles(files: File[]) {
    let skipped = 0
    const certFiles: { name: string; file: File; fromZip: boolean }[] = []
    const keysByBase = new Map<string, File>()

    for (const f of files) {
        const lower = f.name.toLowerCase()
        if (lower.endsWith('.zip')) {
            try {
                const buf = await f.arrayBuffer()
                const split = splitZipEntries(unzipSync(new Uint8Array(buf)))
                for (const c of split.certs) {
                    const base = c.name.split(/[\\/]/).pop() ?? c.name
                    certFiles.push({
                        name: base,
                        file: new File([toBlobPart(c.bytes)], base, { type: 'application/x-pem-file' }),
                        fromZip: true,
                    })
                }
                for (const k of split.keys) {
                    const base = k.name.split(/[\\/]/).pop() ?? k.name
                    keysByBase.set(
                        pairBaseName(base),
                        new File([toBlobPart(k.bytes)], base, { type: 'application/x-pem-file' }),
                    )
                }
            } catch {
                skipped++
                ElMessage.error(`zip 解包失败：${f.name}`)
            }
        } else if (/\.(pem|crt|cer)$/.test(lower) && sniffPemKind(f.name, new Uint8Array(await f.arrayBuffer().catch(() => new ArrayBuffer(0)))) === 'cert') {
            certFiles.push({ name: f.name, file: f, fromZip: false })
        } else if (lower.endsWith('.key') || /\.(pem|crt|cer)$/.test(lower)) {
            // 内容嗅探为私钥的 .pem/.crt 或显式 .key：按去扩展名基名配对
            keysByBase.set(pairBaseName(f.name), f)
        } else {
            skipped++
        }
    }

    for (const c of certFiles) {
        if (pendingRows.value.length >= MAX_FILES) {
            skipped += certFiles.length - pendingRows.value.length
            ElMessage.warning(`单次最多 ${MAX_FILES} 个文件`)
            break
        }
        const key = keysByBase.get(pairBaseName(c.name)) ?? null
        pendingRows.value.push({ keyId: ++rowSeq, fileName: c.name, file: c.file, keyFile: key, fromZip: c.fromZip })
    }
    skippedCount.value += skipped
}

function attachKey(row: PendingRow) {
    attachTargetKey = row.keyId
    keyPicker.value?.click()
}

function onKeyPicked(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files && input.files.length > 0 ? input.files[0] : null
    if (file && attachTargetKey !== null) {
        const row = pendingRows.value.find((r) => r.keyId === attachTargetKey)
        if (row) row.keyFile = file
    }
    attachTargetKey = null
    input.value = ''
}

function removeRow(row: PendingRow) {
    pendingRows.value = pendingRows.value.filter((r) => r.keyId !== row.keyId)
}

async function onSubmit() {
    if (submitting.value || running.value || pendingRows.value.length === 0) return
    submitting.value = true
    try {
        const s = await batchImportCertsApi(
            pendingRows.value.map((r) => ({
                // 私钥重命名为 `${去扩展名基名}.key`，与后端 certFiles/keyFiles 配对规则对齐
                cert: r.file,
                key: r.keyFile
                    ? new File([r.keyFile], `${pairBaseName(r.fileName)}.key`, { type: 'application/x-pem-file' })
                    : undefined,
            })),
        )
        session.value = s
        saveLastBatchId(s.batchId)
        pendingRows.value = []
        startPolling()
    } catch (err) {
        const msg = err instanceof Error ? err.message : '批量导入提交失败'
        ElMessage.error(msg)
    } finally {
        submitting.value = false
    }
}

function startPolling() {
    stopPolling()
    pollTimer = setInterval(async () => {
        const id = session.value?.batchId
        if (!id || pollInFlight) return
        pollInFlight = true
        try {
            const s = await getBatchImportApi(id)
            if (session.value?.batchId === id) session.value = s
            if (isBatchTerminal(s.status)) {
                stopPolling()
                // 完成通告（高频轮询不刷屏，仅终态事件 aria-live 一次）
                ElMessage.success(`导入完成：${s.files.filter(isOk).length} 成功 / ${s.files.filter((f) => f.result === 'failed').length} 失败`)
            }
        } catch {
            /* 单次轮询失败退避到下个周期，不打断会话 */
        } finally {
            pollInFlight = false
        }
    }, 2000)
}

function isOk(f: BatchImportFile) {
    return f.result === 'complete' || f.result === 'fingerprintOnly'
}

function stopPolling() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
}

/** 处理中关闭守卫：二次确认「终止导入」 */
function guardClose(done: () => void) {
    if (!running.value) {
        done()
        return
    }
    ElMessageBox.confirm(
        '终止导入将停止本地进度跟踪；服务端已处理完成的文件保留入库，未处理文件不保留（需重新选择上传）。',
        '终止导入',
        { confirmButtonText: '终止导入', cancelButtonText: '继续导入', type: 'warning' },
    )
        .then(() => {
            stopPolling()
            terminatedManually.value = true
            done()
        })
        .catch(() => {
            /* 继续导入：保持 Modal 打开与轮询 */
        })
}

function confirmTerminate() {
    guardClose(() => {
        visible.value = false
    })
}

function fileByRowName(fileName: string): File | null {
    return retryFiles.get(fileName) ?? null
}

/** Uint8Array → 独立 ArrayBuffer（File 构造的 BlobPart 类型收敛） */
function toBlobPart(bytes: Uint8Array): ArrayBuffer {
    const copy = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(copy).set(bytes)
    return copy
}

async function retryFile(f: BatchImportFile) {
    const file = fileByRowName(f.fileName)
    if (!file || retryingName.value) return
    retryingName.value = f.fileName
    try {
        const s = await batchImportCertsApi([{ cert: file }])
        const updated = s.files[0]
        if (updated && session.value) {
            const files = session.value.files.map((x) => (x.fileName === updated.fileName ? updated : x))
            const failed = files.filter((x) => x.result === 'failed').length
            const done = files.filter((x) => x.result !== undefined).length
            session.value = { ...session.value, files, progress: { ...session.value.progress, done, failed } }
            saveLastBatchId(s.batchId)
            ElMessage.success(
                updated.result === 'failed' ? `重试仍失败：${updated.errorReason ?? '未知原因'}` : '重试成功',
            )
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : '重试失败'
        ElMessage.error(msg)
    } finally {
        retryingName.value = ''
    }
}

function onRetryFilePicked(e: Event, f: BatchImportFile) {
    const input = e.target as HTMLInputElement
    const file = input.files && input.files.length > 0 ? input.files[0] : null
    if (file) {
        retryFiles.set(f.fileName, file)
        void retryFile(f)
    }
    input.value = ''
}

onUnmounted(stopPolling)

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
}

.dropzone-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.hidden-input {
  display: none;
}

.pending-list {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 12px;
}

.pending-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }

  &.pending-row-muted {
    opacity: 0.6;
  }
}

.filename {
  font-family: var(--cert-font-mono);
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.zip-tag {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
}

.row-spacer {
  flex: 1;
}

.key-attached {
  font-size: 12px;
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

  &:hover:not(:disabled) {
    color: var(--cert-accent-hover);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.row-remove {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;

  &:hover:not(:disabled) {
    color: var(--cert-error);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.skip-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.session-panel {
  margin-top: 4px;
}

.progress-text {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.result-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
}

.result-flag {
  font-weight: 600;
  color: var(--text-primary);

  &.flag-success {
    color: var(--cert-success);
  }

  &.flag-error {
    color: var(--cert-error);
  }
}

.result-meta {
  color: var(--text-secondary);
}

.result-list {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }
}

.ledger-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;

  &.tone-accent {
    color: var(--cert-accent);
    border-color: color-mix(in srgb, var(--cert-accent) 40%, transparent);
  }

  &.tone-secondary {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }

  &.tone-error {
    color: var(--cert-error);
    border-color: color-mix(in srgb, var(--cert-error) 40%, transparent);
  }
}

.result-note {
  font-family: var(--cert-font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.result-note-error {
    color: var(--cert-error);
  }
}

.retry-pick {
  font-size: 12px;
  color: var(--cert-accent);
  cursor: pointer;
}

.terminate-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
