<template>
  <el-dialog
    v-model="visible"
    width="720px"
    align-center
    class="cert-modal"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    aria-labelledby="rollback-modal-title"
  >
    <template #header>
      <h3 id="rollback-modal-title" class="modal-title">回滚成功项</h3>
    </template>

    <p class="modal-lead">
      回滚范围：仅本次执行<strong>成功</strong>项（{{ scopeItems.length }} 项）。
      失败项引用未被改动，无需回滚。
    </p>

    <el-alert type="info" :closable="false" show-icon class="modal-alert">
      目标有效性预检：提交时服务端逐项校验云侧旧证书（存在 / 未过期 / 指纹一致），无效项不自动回滚。
    </el-alert>

    <div class="scope-list">
      <div class="table-wrap">
        <table class="mini-table">
          <thead>
            <tr>
              <th scope="col">资源</th>
              <th scope="col">云 / 产品</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in scopeItems" :key="it.itemId">
              <td class="mono">{{ it.resourceId }}</td>
              <td>{{ it.location }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <el-alert
      v-if="invalidTarget"
      type="error"
      :closable="false"
      show-icon
      class="modal-alert"
      role="alert"
    >
      <template #title>云侧旧证书无效（已删除 / 已过期 / 被替换）</template>
      回滚目标无效项不自动回滚，已转人工决策并记录审计。请人工处理后再操作。
    </el-alert>

    <el-alert v-if="errorMessage" type="error" :closable="false" show-icon class="modal-alert" role="alert">
      {{ errorMessage }}
    </el-alert>

    <template #footer>
      <el-button :disabled="submitting" @click="closeModal">取消</el-button>
      <el-button
        type="danger"
        :loading="submitting"
        :disabled="scopeItems.length === 0"
        @click="onSubmit"
      >
        执行回滚
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 回滚成功项 Modal（AC5/AC6，向导 Step5/Step6 与报告详情恢复区共用）。
 *
 * Hard Rule：入口仅 执行中(出现失败项后)/验证中/部分完成 三态可见（入口由
 * canRollbackNow 门控），范围仅执行成功项（rollbackScopeItems，父级传入）。
 * 提交 rollbackChangeApi（留审计服务端端点）；409 ROLLBACK_TARGET_INVALID →
 * 「云侧旧证书无效，转人工决策」Error 横幅（不自动回滚）。
 */
import type { RollbackScopeRow } from '../format'
import { rollbackChangeApi } from '@/api/cert'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
    visible: boolean
    orderId: string
    /** 回滚范围（仅成功项，父级经 rollbackScopeItems/rollbackScopeRows 派生） */
    scopeItems: RollbackScopeRow[]
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'rolled-back'): void }>()

const submitting = ref(false)
const invalidTarget = ref(false)
const errorMessage = ref('')

const visible = computed({
    get: () => props.visible,
    set: (v: boolean) => emit('update:visible', v),
})

watch(visible, (v) => {
    if (v) {
        invalidTarget.value = false
        errorMessage.value = ''
    }
})

function closeModal() {
    if (submitting.value) return
    emit('update:visible', false)
}

async function onSubmit() {
    submitting.value = true
    errorMessage.value = ''
    invalidTarget.value = false
    try {
        await rollbackChangeApi(
            props.orderId,
            props.scopeItems.map((it) => it.itemId),
        )
        emit('update:visible', false)
        emit('rolled-back')
        ElMessage.success('回滚已提交，结果见报告与审计')
    } catch (err) {
        const code = (err as { code?: string }).code ?? ''
        if (code === 'ROLLBACK_TARGET_INVALID') {
            invalidTarget.value = true
        } else {
            errorMessage.value = (err as Error).message || '回滚提交失败，请重试'
        }
    } finally {
        submitting.value = false
    }
}
</script>

<style lang="scss" scoped>
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

.modal-alert {
  margin-bottom: 12px;
}

.scope-list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.table-wrap {
  width: 100%;
}

.mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    text-align: left;
    padding: 8px 12px;
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

  tr:last-child td {
    border-bottom: none;
  }
}

.mono {
  font-family: var(--cert-font-mono);
}
</style>
