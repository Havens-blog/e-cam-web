<template>
  <el-dialog
    v-model="visible"
    width="720px"
    align-center
    class="cert-modal"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    aria-labelledby="remaining-batch-title"
  >
    <template #header>
      <h3 id="remaining-batch-title" class="modal-title">执行剩余批（人工确认）</h3>
    </template>

    <p class="modal-lead">
      首批已执行且批级验证通过。剩余批共
      <strong>{{ remainingItems.length }} 项</strong>，同样需人工确认后执行；
      服务端将校验续批门控（上一批全部 success 且批级验证达标）。
    </p>

    <div class="scope-list">
      <div class="table-wrap">
        <table class="mini-table">
          <thead>
            <tr>
              <th scope="col">资源</th>
              <th scope="col">云 / 产品</th>
              <th scope="col">批次</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in remainingItems" :key="it.itemId">
              <td class="mono">{{ it.target.resourceId }}</td>
              <td>{{ targetLocationLabel(it.target) }}</td>
              <td>{{ it.batchNo }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <el-alert
      v-if="gateError"
      type="error"
      :closable="false"
      show-icon
      class="modal-alert"
      role="alert"
    >
      {{ gateError }}
    </el-alert>

    <template #footer>
      <el-button :disabled="submitting" @click="closeModal">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="remainingItems.length === 0" @click="onSubmit">
        确认执行
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 执行剩余批 Modal（AC5/AC6，Step6 页头与报告详情页头共用）：
 * 剩余批清单确认（人工确认，PRD 分批灰度门控）→ confirmChangeBatchApi（放行）
 * → executeChangeApi（派发当前批）。409 BATCH_NOT_CONFIRMABLE → 门控未满足
 * Error 提示（上一批存在失败项或批级验证未达标）。
 * Hard Rule：确认走留审计服务端端点；执行期间清单快照固定（仅整批推进，无逐项增删）。
 */
import type { ChangeDetailItem } from '@/api/cert'
import { confirmChangeBatchApi, executeChangeApi } from '@/api/cert'
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { targetLocationLabel } from '../format'

const props = defineProps<{
    visible: boolean
    orderId: string
    /** 剩余批清单项（batchNo > currentBatch） */
    remainingItems: ChangeDetailItem[]
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'resumed'): void }>()

const submitting = ref(false)
const gateError = ref('')

const visible = computed({
    get: () => props.visible,
    set: (v: boolean) => emit('update:visible', v),
})

watch(visible, (v) => {
    if (v) gateError.value = ''
})

function closeModal() {
    if (submitting.value) return
    emit('update:visible', false)
}

async function onSubmit() {
    submitting.value = true
    gateError.value = ''
    try {
        await confirmChangeBatchApi(props.orderId)
        await executeChangeApi(props.orderId)
        emit('update:visible', false)
        emit('resumed')
        ElMessage.success('剩余批已进入执行，进度实时刷新')
    } catch (err) {
        const code = (err as { code?: string }).code ?? ''
        if (code === 'BATCH_NOT_CONFIRMABLE') {
            gateError.value = '续批门控未满足：上一批存在失败项或批级验证未达标，暂不能执行剩余批。'
        } else {
            gateError.value = (err as Error).message || '执行剩余批失败，请重试'
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

.scope-list {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  margin-bottom: 12px;
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
