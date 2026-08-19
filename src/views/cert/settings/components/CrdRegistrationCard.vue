<template>
  <section class="settings-card" aria-labelledby="crd-title">
    <div class="card-header">
      <h2 id="crd-title" class="card-title">CRD 登记</h2>
      <el-button @click="openAdd">登记 CRD</el-button>
    </div>

    <p class="card-lead">
      首期固定枚举（ALBConfig/Ingress/Gateway/HTTPRoute）之外的自定义网关 CRD，经登记纳入扫描范围；
      未登记或已删除的 CRD 属扫描盲区，引用视图将显式声明。
    </p>

    <!-- Loading：表格 3 行骨架 -->
    <div v-if="loading" class="table-skeleton" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="skeleton-row" />
    </div>

    <!-- 读取失败：卡内错误 + 重试 -->
    <div v-else-if="loadError" class="card-error">
      <span role="alert">登记列表加载失败：{{ loadError }}</span>
      <el-button size="small" @click="load">重试</el-button>
    </div>

    <template v-else>
      <div v-if="items.length > 0" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">集群</th>
              <th scope="col">apiGroup</th>
              <th scope="col">Kind</th>
              <th scope="col">证书引用字段路径</th>
              <th scope="col" class="hide-sm">状态</th>
              <th scope="col" class="hide-sm">来源</th>
              <th scope="col" class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in items" :key="row.id">
              <td class="mono">{{ row.clusterId }}</td>
              <td class="mono">{{ row.apiGroup }}</td>
              <td>{{ row.kind }}</td>
              <td class="mono">{{ row.certFieldPath }}</td>
              <td class="hide-sm">
                <el-tag :type="row.enabled ? 'success' : 'info'" :disable-transitions="true" size="small">
                  {{ row.enabled ? '✓ 启用' : '停用' }}
                </el-tag>
              </td>
              <td class="hide-sm text-secondary">
                {{ row.builtin ? '固定枚举内置' : `自定义 · ${row.operator || '—'}` }}
              </td>
              <td class="col-actions">
                <el-tooltip
                  v-if="row.builtin"
                  content="固定枚举内置登记，不可删除"
                  placement="top"
                >
                  <span class="disabled-action"><el-button text type="danger" disabled>删除</el-button></span>
                </el-tooltip>
                <el-button v-else text type="danger" @click="askRemove(row)">删除</el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="card-empty">
        尚未登记自定义 CRD——未登记的自定义网关 CRD 属扫描盲区（登记后纳入 K8s 扫描范围）。
      </div>
    </template>

    <!-- 登记 Modal（clusterId + apiGroup + kind + certFieldPath；重复 409 行内错误） -->
    <el-dialog
      v-model="addVisible"
      width="720px"
      align-center
      class="cert-modal"
      :close-on-click-modal="!submitting"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
      aria-labelledby="crd-add-title"
    >
      <template #header>
        <h3 id="crd-add-title" class="modal-title">登记自定义 CRD</h3>
      </template>

      <el-alert type="info" :closable="false" show-icon class="modal-alert">
        仅接受 spec 中含云托管证书 ID/名称引用字段的网关类资源；clusterId+apiGroup+kind 唯一，重复登记将被拒绝。
      </el-alert>

      <div class="form-grid">
        <div class="field">
          <label class="field-label" for="crd-cluster-input">集群 ID</label>
          <el-input
            id="crd-cluster-input"
            v-model="form.clusterId"
            class="mono"
            placeholder="prod-k8s-01"
            :aria-invalid="formErrors.clusterId !== undefined"
            aria-describedby="crd-cluster-input-err"
          />
          <span v-if="formErrors.clusterId" id="crd-cluster-input-err" class="error-text" role="alert">
            {{ formErrors.clusterId }}
          </span>
        </div>
        <div class="field">
          <label class="field-label" for="crd-apigroup-input">apiGroup</label>
          <el-input
            id="crd-apigroup-input"
            v-model="form.apiGroup"
            class="mono"
            placeholder="networking.example.com"
            :aria-invalid="formErrors.apiGroup !== undefined"
            aria-describedby="crd-apigroup-input-err"
          />
          <span v-if="formErrors.apiGroup" id="crd-apigroup-input-err" class="error-text" role="alert">
            {{ formErrors.apiGroup }}
          </span>
        </div>
        <div class="field">
          <label class="field-label" for="crd-kind-input">Kind</label>
          <el-input
            id="crd-kind-input"
            v-model="form.kind"
            placeholder="Certificate"
            :aria-invalid="formErrors.kind !== undefined"
            aria-describedby="crd-kind-input-err"
          />
          <span v-if="formErrors.kind" id="crd-kind-input-err" class="error-text" role="alert">
            {{ formErrors.kind }}
          </span>
        </div>
        <div class="field field-wide">
          <label class="field-label" for="crd-path-input">证书引用字段路径</label>
          <el-input
            id="crd-path-input"
            v-model="form.certFieldPath"
            class="mono"
            placeholder="spec.certificates[].certificateId"
            :aria-invalid="formErrors.certFieldPath !== undefined"
            aria-describedby="crd-path-input-err"
          />
          <span class="hint">声明引用字段路径（以 spec. 开头）；非法路径在扫描时报错并计入门户告警。</span>
          <span v-if="formErrors.certFieldPath" id="crd-path-input-err" class="error-text" role="alert">
            {{ formErrors.certFieldPath }}
          </span>
        </div>
      </div>

      <el-alert
        v-if="serverError"
        type="error"
        :closable="false"
        show-icon
        class="modal-alert"
        role="alert"
        :title="serverError.duplicate ? '重复登记' : undefined"
      >
        {{ serverError.message }}
      </el-alert>

      <template #footer>
        <el-button :disabled="submitting" @click="closeAdd">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAdd">确认登记</el-button>
      </template>
    </el-dialog>

    <!-- 删除确认（回归盲区提示） -->
    <el-dialog
      v-model="removeVisible"
      width="480px"
      align-center
      class="cert-modal"
      aria-labelledby="crd-remove-title"
    >
      <template #header>
        <h3 id="crd-remove-title" class="modal-title">删除 CRD 登记</h3>
      </template>
      <div class="confirm-banner" role="alert">
        <span class="confirm-icon" aria-hidden="true">!</span>
        <div>
          <div class="confirm-title">删除后该 CRD 回归扫描盲区</div>
          <div class="confirm-body">
            {{ removeTarget ? `${removeTarget.clusterId} · ${removeTarget.apiGroup} · ${removeTarget.kind}` : '' }}
            的引用将不再被扫描发现，引用视图将以盲区显式声明。操作留审计记录。
          </div>
        </div>
      </div>
      <template #footer>
        <el-button :disabled="removing" @click="removeVisible = false">取消</el-button>
        <el-button type="danger" :loading="removing" @click="submitRemove">确认删除</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
/**
 * CRD 登记管理（任务 6.6，AC4）：登记表单（clusterId+apiGroup+kind+certFieldPath）
 * + 列表（含 enabled / builtin 来源）+ 删除（回归盲区提示）+ 重复登记 409 行内错误。
 *
 * 自包含数据生命周期：GET/POST/DELETE /certs/settings/crds 独立于 settings 主配置
 * （api-handbook「自定义 CRD 登记管理」）；失败态卡内重试，不影响其余卡片。
 * 固定枚举内置登记（builtin=true）不可删除（tooltip 说明）。
 */
import type { CrdRegistration } from '@/api/cert'
import { CertRequestError, createCrdRegistrationApi, deleteCrdRegistrationApi, listCrdRegistrationsApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { EMPTY_CRD_FORM, mapCrdCreateError, validateCrdForm, type CrdFormState } from '../format'

const items = ref<CrdRegistration[]>([])
const loading = ref(true)
const loadError = ref('')

// ===== 登记 Modal =====
const addVisible = ref(false)
const submitting = ref(false)
const form = reactive<CrdFormState>({ ...EMPTY_CRD_FORM })
const formErrors = computed(() => validateCrdForm(form))
const serverError = ref<{ duplicate: boolean; message: string } | null>(null)

// ===== 删除确认 =====
const removeVisible = ref(false)
const removeTarget = ref<CrdRegistration | null>(null)
const removing = ref(false)

watch(addVisible, (v) => {
    if (v) {
        Object.assign(form, EMPTY_CRD_FORM)
        serverError.value = null
    }
})

async function load() {
    loading.value = true
    loadError.value = ''
    try {
        items.value = await listCrdRegistrationsApi()
    } catch (err) {
        loadError.value = err instanceof Error ? err.message : '服务暂时不可用'
    } finally {
        loading.value = false
    }
}

function openAdd() {
    addVisible.value = true
}

function closeAdd() {
    if (submitting.value) return
    addVisible.value = false
}

async function submitAdd() {
    if (Object.keys(formErrors.value).length > 0 || submitting.value) return
    submitting.value = true
    serverError.value = null
    try {
        await createCrdRegistrationApi({
            clusterId: form.clusterId.trim(),
            apiGroup: form.apiGroup.trim(),
            kind: form.kind.trim(),
            certFieldPath: form.certFieldPath.trim(),
        })
        addVisible.value = false
        ElMessage.success('CRD 登记成功，审计已记录')
        await load()
    } catch (err) {
        // 重复登记 409 → Modal 内行内错误（表单保留可修正）
        serverError.value = mapCrdCreateError(
            err instanceof CertRequestError ? { code: err.code, message: err.message } : { message: (err as Error).message },
        )
    } finally {
        submitting.value = false
    }
}

function askRemove(row: CrdRegistration) {
    removeTarget.value = row
    removeVisible.value = true
}

async function submitRemove() {
    const row = removeTarget.value
    if (!row || removing.value) return
    removing.value = true
    try {
        await deleteCrdRegistrationApi(row.id)
        removeVisible.value = false
        removeTarget.value = null
        ElMessage.success('CRD 登记已删除，该 CRD 回归扫描盲区（审计已记录）')
        await load()
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '删除失败，请重试')
    } finally {
        removing.value = false
    }
}

onMounted(() => {
    void load()
})
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

.text-secondary {
  color: var(--text-secondary);
}

.col-actions {
  white-space: nowrap;
}

.disabled-action {
  display: inline-flex;
}

.card-empty {
  padding: 32px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}

.card-error {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px 0;
  font-size: 13px;
  color: var(--cert-error);
}

// 骨架行
.table-skeleton {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-row {
  height: 44px;
  background: var(--cert-surface-alt);
  position: relative;
  overflow: hidden;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: crd-skeleton-wave 1.2s ease-in-out infinite;
  }
}

@keyframes crd-skeleton-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;

  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
}

.field-wide {
  grid-column: 1 / -1;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-primary);
}

.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
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

.modal-alert {
  margin-bottom: 12px;
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
  font-family: var(--cert-font-mono);
}

// 响应式：小屏隐藏低优先列
@media (max-width: 767px) {
  .hide-sm {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-row::after {
    animation: none;
  }
}
</style>
