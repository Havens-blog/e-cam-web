<template>
  <section class="settings-card" aria-labelledby="thresholds-title">
    <div class="card-header">
      <h2 id="thresholds-title" class="card-title">阈值参数</h2>
    </div>

    <div class="thr-grid">
      <div
        v-for="f in THRESHOLD_FIELDS"
        :key="f.key"
        class="thr-field"
        :class="{ invalid: errors.numeric[f.key] !== undefined }"
      >
        <label class="field-label" :for="`thr-${f.key}`">{{ f.label }}（{{ f.unit }}）</label>
        <div class="thr-controls">
          <el-slider
            class="thr-slider"
            :model-value="draft.numeric[f.key] ?? f.min"
            :min="f.min"
            :max="f.max"
            :step="1"
            :aria-label="`${f.label}滑块`"
            @update:model-value="(v: number | number[]) => emitNumeric(f.key, v)"
          />
          <el-input-number
            :id="`thr-${f.key}`"
            class="thr-input"
            :model-value="draft.numeric[f.key]"
            :min="f.min"
            :max="f.max"
            :step="1"
            step-strictly
            :controls="false"
            :aria-invalid="errors.numeric[f.key] !== undefined"
            :aria-describedby="`thr-${f.key}-err`"
            @update:model-value="(v: number | undefined) => emitNumeric(f.key, v ?? null)"
          />
        </div>
        <span class="hint">{{ f.hint }}</span>
        <span v-if="errors.numeric[f.key]" :id="`thr-${f.key}-err`" class="error-text" role="alert">
          {{ errors.numeric[f.key] }}
        </span>
      </div>

      <!-- 到期分级天数（数组型：数字 tag 编辑） -->
      <div class="thr-field thr-field-wide" :class="{ invalid: errors.expiryLevels !== '' }">
        <label class="field-label" for="expiry-levels-input">
          到期分级天数（{{ EXPIRY_LEVELS_LIMITS.minItems }}~{{ EXPIRY_LEVELS_LIMITS.maxItems }} 档，降序匹配取最紧急级）
        </label>
        <div class="tag-box">
          <el-tag
            v-for="(lv, i) in draft.expiryLevels"
            :key="`${lv}-${i}`"
            type="info"
            closable
            :disable-transitions="true"
            @close="removeLevel(i)"
          >{{ lv }} 天</el-tag>
          <div class="level-adder">
            <input
              id="expiry-levels-input"
              v-model="levelInput"
              class="level-input"
              type="number"
              :min="EXPIRY_LEVELS_LIMITS.min"
              :max="EXPIRY_LEVELS_LIMITS.max"
              placeholder="天数"
              aria-describedby="expiry-levels-err"
              @keydown.enter.prevent="addLevel"
            />
            <el-button size="small" @click="addLevel">添加</el-button>
          </div>
        </div>
        <span class="hint">
          每档 {{ EXPIRY_LEVELS_LIMITS.min }}~{{ EXPIRY_LEVELS_LIMITS.max }} 天且不重复；默认
          {{ EXPIRY_LEVELS_LIMITS.defaults.join('/') }}（去重状态机仅升级触发）
        </span>
        <span v-if="errors.expiryLevels" id="expiry-levels-err" class="error-text" role="alert">
          {{ errors.expiryLevels }}
        </span>
      </div>
    </div>

    <div class="card-actions">
      <el-button type="primary" :loading="saving" :disabled="saveDisabled" @click="emit('save')">保存</el-button>
      <span class="audit-hint">全部配置变更留审计</span>
      <span v-if="saveError" class="inline-error" role="alert">{{ saveError }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 卡3 阈值参数（任务 6.6，AC3）：全部 thresholds（9 数值字段 + expiryLevels）
 * 以数字输入 + 滑块呈现，界值常量表 THRESHOLD_FIELDS 与后端 schema.sql 1:1
 * （单一常量文件供卡片与校验共用，见 ../format.ts）。
 *
 * Hard Rule：前端界值校验仅为体验——越界字段 Error 边框 + 合法区间提示 + 保存禁用；
 * PUT 越界 400 的服务端校验结果由父级以 saveError 行内呈现（输入保留不清空）。
 * 注：「保护期 ≥ 验证窗口」由界值结构保证（24h 上限 < 7 天下限），不做交叉校验。
 */
import { computed, ref } from 'vue'
import {
    EXPIRY_LEVELS_LIMITS,
    THRESHOLD_FIELDS,
    hasThresholdErrors,
    validateThresholdsDraft,
    type NumericThresholdKey,
    type ThresholdsDraft,
} from '../format'

const props = defineProps<{
    draft: ThresholdsDraft
    saving: boolean
    /** 保存异常行内错误（含 PUT 越界 400 的服务端信息） */
    saveError: string
}>()

const emit = defineEmits<{
    (e: 'update-field', key: NumericThresholdKey, value: number | null): void
    (e: 'update-expiry-levels', levels: number[]): void
    (e: 'save'): void
}>()

const errors = computed(() => validateThresholdsDraft(props.draft))

const saveDisabled = computed(() => hasThresholdErrors(errors.value))

function emitNumeric(key: NumericThresholdKey, v: number | number[] | null) {
    const value = Array.isArray(v) ? (v[0] ?? null) : v
    emit('update-field', key, value)
}

// ===== 到期分级天数 tag 编辑 =====
const levelInput = ref('')

function addLevel() {
    const raw = levelInput.value.trim()
    if (!raw) return
    const lv = Number(raw)
    if (!Number.isInteger(lv)) return
    const next = [...props.draft.expiryLevels]
    if (!next.includes(lv)) next.push(lv)
    emit('update-expiry-levels', next)
    levelInput.value = ''
}

function removeLevel(i: number) {
    emit(
        'update-expiry-levels',
        props.draft.expiryLevels.filter((_, idx) => idx !== i),
    )
}
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
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.thr-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px 24px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.thr-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.thr-field-wide {
    grid-column: 1 / -1;
  }

  &.invalid .thr-input :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--cert-error) inset;
  }

  &.invalid .tag-box {
    border-color: var(--cert-error);
  }
}

.field-label {
  font-size: 13px;
  color: var(--text-primary);
}

.thr-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.thr-slider {
  flex: 1;
  min-width: 120px;
}

.thr-input {
  width: 88px;

  :deep(.el-input__inner) {
    text-align: right;
  }
}

.hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.error-text {
  font-size: 12px;
  color: var(--cert-error);
}

.tag-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  border: 1px solid var(--border-strong, #333);
  border-radius: 8px;
  padding: 6px 10px;
  background: var(--cert-surface-alt);
}

.level-adder {
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-input {
  width: 90px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  height: 24px;

  &::placeholder {
    color: var(--text-secondary);
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.audit-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.inline-error {
  font-size: 13px;
  color: var(--cert-error);
}

@media (prefers-reduced-motion: reduce) {
  .el-slider {
    :deep(.el-slider__runway-transition-bar) {
      transition: none;
    }
  }
}
</style>
