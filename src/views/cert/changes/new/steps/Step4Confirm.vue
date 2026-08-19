<template>
  <section class="step4" aria-labelledby="step4-title">
    <div class="card intro-card">
      <h2 id="step4-title">确认执行</h2>
      <p class="text-secondary intro-desc">
        清单共 {{ total }} 项。确认时服务端将重校验清单快照新鲜度与引用一致性，
        不一致将拦截并回退 Step2 重新预检。
      </p>
    </div>

    <div class="grid-2">
      <div class="stat-card">
        <div class="stat-label">清单总量</div>
        <div class="stat-value">{{ total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">分批</div>
        <div class="stat-value">{{ batching ? '需分批' : '免分批' }}</div>
        <div class="stat-sub">首批上限 floor(50%) = {{ cap }}</div>
      </div>
    </div>

    <div class="card batch-card">
      <h3>同单分批勾选</h3>
      <div class="field">
        <el-checkbox id="batch-enabled" v-model="enabled" :disabled="!batching || total <= 1">
          同单分批（首批执行且验证通过后，剩余批需人工确认）
        </el-checkbox>
      </div>
      <div v-if="enabled" class="field">
        <label for="batch-size" class="field-label">首批数量（≤ {{ cap }}）</label>
        <el-input-number
          id="batch-size"
          v-model="size"
          :min="1"
          :max="cap"
          :step="1"
          :disabled="overLimit"
          aria-describedby="batch-size-hint"
        />
        <span v-if="overLimit" class="field-error" role="alert">超出首批上限 {{ cap }}，已禁用</span>
        <span id="batch-size-hint" class="field-hint">
          总量 ≤1 时免分批；首批执行且验证通过后展示「执行剩余批」入口。
        </span>
      </div>
    </div>

    <el-alert
      v-if="confirmError"
      type="error"
      :closable="false"
      show-icon
      role="alert"
      class="confirm-error"
    >
      {{ confirmError }}
    </el-alert>

    <div class="confirm-row">
      <el-button type="primary" :disabled="!canConfirm" @click="$emit('confirm')">
        确认执行
      </el-button>
      <span class="text-secondary text-sm">仅运维工程师角色可确认，全程留审计</span>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Step4 确认执行（AC4）：清单摘要 + 分批勾选（首批上限 floor(总量/2)，超限禁用；
 * 总量 ≤1 免分批）+ 确认按钮（Hard Rule：仅运维工程师可见可用——canConfirm
 * 门面 + 后端 EIAM 兜底）。确认 Modal 由父级持有（影响面摘要二次确认 +
 * 服务端快照重校验失败回退 Step2）。
 */
import type { ChangeList } from '@/api/cert'
import { computed, ref, watch } from 'vue'
import { firstBatchCap, needsBatching, partitionListItems } from '../../format'

const props = defineProps<{
    changeList: ChangeList | null
    confirmError?: string
    submitting?: boolean
    canConfirm: boolean
}>()

defineEmits<{ (e: 'confirm'): void }>()

const enabled = ref(false)
const size = ref(1)

const total = computed(() => partitionListItems(props.changeList?.items ?? []).executable.length)
const cap = computed(() => firstBatchCap(total.value))
const batching = computed(() => needsBatching(total.value))

/** 超限禁用（防呆：输入超上限禁用提交前交互并提示） */
const overLimit = computed(() => enabled.value && batching.value && size.value > cap.value)

// 分批开关/总量变化 → 首批数量重置为上限
watch([cap, enabled], () => {
    if (enabled.value) size.value = cap.value
})

/** 暴露给父级确认 Modal 的分批配置（defineExpose 供 onConfirmExec 读取） */
defineExpose({
    batchConf: computed(() => ({
        enabled: enabled.value && batching.value && !overLimit.value,
        batchSize: size.value,
    })),
})
</script>

<style lang="scss" scoped>
.step4 {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.intro-card {
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.intro-desc {
  margin: 8px 0 0;
  font-size: 13px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 16px 24px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 4px;
}

.stat-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.batch-card {
  h3 {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.field-label {
  font-size: 13px;
  color: var(--text-primary);
}

.field-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.field-error {
  font-size: 12px;
  color: #ee0000;
}

.confirm-error {
  border-radius: 8px;
}

.confirm-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 13px;
}
</style>
