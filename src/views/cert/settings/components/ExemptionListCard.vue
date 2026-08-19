<template>
  <section class="settings-card" aria-labelledby="exemption-title">
    <div class="card-header">
      <h2 id="exemption-title" class="card-title">探测豁免清单</h2>
      <el-button @click="openAdd">添加豁免</el-button>
    </div>

    <p class="card-lead">豁免域名仍会探测但不告警；验证窗口内豁免域名计 skipped，不阻塞达标判定。</p>

    <div v-if="exemptions.length > 0" class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">子域名</th>
            <th scope="col">加入原因</th>
            <th scope="col" class="hide-sm">操作人</th>
            <th scope="col" class="hide-sm">时间</th>
            <th scope="col" class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in exemptions" :key="row.domain">
            <td class="mono">{{ row.domain }}</td>
            <td class="reason-cell">{{ row.reason || '—' }}</td>
            <td class="hide-sm text-secondary">{{ row.operator || '—' }}</td>
            <td class="hide-sm text-secondary">{{ formatExemptionTime(row.createdAt) }}</td>
            <td class="col-actions">
              <el-button text type="danger" @click="askRemove(row)">移除</el-button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="card-empty">暂无豁免域名</div>

    <!-- 添加豁免 Modal（子域名 + 原因） -->
    <el-dialog
      v-model="addVisible"
      width="480px"
      align-center
      class="cert-modal"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
      aria-labelledby="exempt-add-title"
    >
      <template #header>
        <h3 id="exempt-add-title" class="modal-title">添加探测豁免</h3>
      </template>
      <div class="field">
        <label class="field-label" for="exempt-domain-input">子域名</label>
        <el-input
          id="exempt-domain-input"
          v-model="addForm.domain"
          class="mono"
          placeholder="intranet.example.com"
          :aria-invalid="addError.domain !== ''"
          aria-describedby="exempt-domain-input-err"
        />
        <span v-if="addError.domain" id="exempt-domain-input-err" class="error-text" role="alert">
          {{ addError.domain }}
        </span>
      </div>
      <div class="field field-last">
        <label class="field-label" for="exempt-reason-input">加入原因</label>
        <el-input
          id="exempt-reason-input"
          v-model="addForm.reason"
          type="textarea"
          :rows="3"
          placeholder="说明为何豁免探测"
        />
      </div>
      <span v-if="addError.server" class="error-text" role="alert">{{ addError.server }}</span>
      <template #footer>
        <el-button :disabled="submitting" @click="closeAdd">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAdd">确认添加</el-button>
      </template>
    </el-dialog>

    <!-- 移除二次确认（变更留审计提示） -->
    <el-dialog
      v-model="removeVisible"
      width="480px"
      align-center
      class="cert-modal"
      aria-labelledby="exempt-remove-title"
    >
      <template #header>
        <h3 id="exempt-remove-title" class="modal-title">移除探测豁免</h3>
      </template>
      <div class="confirm-banner" role="alert">
        <span class="confirm-icon" aria-hidden="true">!</span>
        <div>
          <div class="confirm-title">移除后恢复常规探测与差异告警</div>
          <div class="confirm-body">
            确认移除 <span class="mono">{{ removeTarget?.domain }}</span>
            ？移除后该域名恢复差异告警判定，操作将留审计记录。
          </div>
        </div>
      </div>
      <template #footer>
        <el-button :disabled="removing" @click="removeVisible = false">取消</el-button>
        <el-button type="danger" :loading="removing" @click="submitRemove">确认移除</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
/**
 * 卡2 探测豁免清单（任务 6.6，AC2）：表格（子域名/原因/操作人/时间/移除）
 * + 添加豁免 Modal（子域名+原因）+ 移除二次确认。
 *
 * 增删走服务端留审计端点，成功后 emit added/removed 由父级刷新列表（即时更新），
 * Toast「审计已记录」由父级呈现；本卡负责表单校验（domain 格式 + 清单内重复预判）。
 */
import type { CertExemption } from '@/api/cert'
import { reactive, ref, watch } from 'vue'
import { formatExemptionTime, isDuplicateExemption, validateExemptionDomain } from '../format'

const props = defineProps<{
    exemptions: CertExemption[]
    /** 增删请求进行中（禁用表格操作，防重复提交） */
    mutating: boolean
}>()

const emit = defineEmits<{
    (e: 'add', payload: { domain: string; reason?: string }): void
    (e: 'remove', domain: string): void
}>()

// ===== 添加 Modal =====
const addVisible = ref(false)
const submitting = ref(false)
const addForm = reactive({ domain: '', reason: '' })
const addError = reactive({ domain: '', server: '' })

// ===== 移除确认 =====
const removeVisible = ref(false)
const removeTarget = ref<CertExemption | null>(null)
const removing = ref(false)

watch(addVisible, (v) => {
    if (v) {
        addForm.domain = ''
        addForm.reason = ''
        addError.domain = ''
        addError.server = ''
    }
})

function openAdd() {
    addVisible.value = true
}

function closeAdd() {
    if (submitting.value) return
    addVisible.value = false
}

function submitAdd() {
    addError.domain = ''
    addError.server = ''
    const domain = addForm.domain.trim()
    const domainError = validateExemptionDomain(domain)
    if (domainError) {
        addError.domain = domainError
        return
    }
    if (isDuplicateExemption(domain, props.exemptions)) {
        addError.domain = '该子域名已在豁免清单中'
        return
    }
    submitting.value = true
    emit('add', { domain, reason: addForm.reason.trim() || undefined })
}

/** 父级请求结束后回置提交态并按需关窗（成功路径） */
function notifyAddResult(ok: boolean, serverError = '') {
    submitting.value = false
    if (ok) {
        addVisible.value = false
    } else {
        addError.server = serverError
    }
}

function askRemove(row: CertExemption) {
    removeTarget.value = row
    removeVisible.value = true
}

function submitRemove() {
    const row = removeTarget.value
    if (!row || removing.value) return
    removing.value = true
    emit('remove', row.domain)
}

/** 父级请求结束后回置（成功路径关窗） */
function notifyRemoveResult(ok: boolean) {
    removing.value = false
    if (ok) {
        removeVisible.value = false
        removeTarget.value = null
    }
}

defineExpose({ notifyAddResult, notifyRemoveResult })
</script>

<style lang="scss" scoped>
.settings-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-lead {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-base);
    color: var(--text-primary);
  }

  th {
    color: #a1a1a1;
    font-weight: 500;
    background: var(--cert-surface-alt);
    position: sticky;
    top: 0;
  }

  tbody tr:hover td {
    background: var(--cert-surface-alt);
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.mono {
  font-family: var(--cert-font-mono);
}

.reason-cell {
  max-width: 320px;
}

.text-secondary {
  color: var(--text-secondary);
}

.col-actions {
  white-space: nowrap;
}

.card-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.field {
  margin-bottom: 14px;
}

.field-last {
  margin-bottom: 0;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-primary);
}

.error-text {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--cert-error);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.confirm-banner {
  display: flex;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cert-error) 40%, transparent);
  background: color-mix(in srgb, var(--cert-error) 10%, transparent);
  border-radius: 8px;
  padding: 12px;
}

.confirm-icon {
  color: var(--cert-error);
  font-weight: 700;
}

.confirm-title {
  font-weight: 600;
  color: var(--cert-error);
  margin-bottom: 4px;
}

.confirm-body {
  font-size: 13px;
  color: var(--text-primary);
}

// 响应式：小屏隐藏���优先列（ui-design 表格列优先级）
@media (max-width: 767px) {
  .hide-sm {
    display: none;
  }
}
</style>
