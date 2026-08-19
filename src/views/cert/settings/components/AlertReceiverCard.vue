<template>
  <section class="settings-card" aria-labelledby="alert-receiver-title">
    <div class="card-header">
      <h2 id="alert-receiver-title" class="card-title">告警接收</h2>
    </div>

    <!-- Webhook URL（mono，多行动态增删：后端 webhookUrls 为数组） -->
    <div class="field">
      <label class="field-label" :for="webhookInputId(0)">Webhook URL</label>
      <div v-if="webhookUrls.length === 0" class="field-empty-hint">未配置 webhook（可仅用邮件接收）</div>
      <div
        v-for="(url, i) in webhookUrls"
        :key="i"
        class="webhook-row"
        :class="{ invalid: webhookErrors[i] !== '' }"
      >
        <el-input
          :id="webhookInputId(i)"
          :model-value="url"
          class="mono"
          placeholder="https://hooks.example.com/alerts/ssl-cert"
          :aria-invalid="webhookErrors[i] !== ''"
          :aria-describedby="webhookErrors[i] ? `${webhookInputId(i)}-err` : undefined"
          @update:model-value="(v: string) => updateWebhook(i, v)"
        />
        <el-button
          class="row-remove"
          text
          type="danger"
          :aria-label="`移除 Webhook ${i + 1}`"
          @click="removeWebhook(i)"
        >
          移除
        </el-button>
        <span
          v-if="webhookErrors[i]"
          :id="`${webhookInputId(i)}-err`"
          class="error-text"
          role="alert"
        >{{ webhookErrors[i] }}</span>
      </div>
      <el-button class="add-row-btn" text type="primary" @click="addWebhook">+ 添加 Webhook</el-button>
    </div>

    <!-- 邮件接收组（tag 输入：回车/逗号提交，非法邮箱标红） -->
    <div class="field">
      <label class="field-label" for="alert-email-input">邮件接收组</label>
      <div class="tag-box" :class="{ invalid: invalidTags.length > 0 }">
        <el-tag
          v-for="(email, i) in emailGroup"
          :key="`${email}-${i}`"
          :type="isValidEmail(email) ? 'info' : 'danger'"
          closable
          :disable-transitions="true"
          @close="removeEmail(i)"
        >{{ email }}</el-tag>
        <input
          id="alert-email-input"
          v-model="emailInput"
          class="tag-input"
          type="text"
          placeholder="输入邮箱后回车，多个邮箱以逗号分隔"
          aria-describedby="alert-email-hint"
          @keydown.enter.prevent="commitEmailInput"
          @keydown.,.prevent="commitEmailInput"
          @blur="commitEmailInput"
        />
      </div>
      <span id="alert-email-hint" class="hint">多个邮箱以英文逗号分隔</span>
      <span v-if="invalidTags.length > 0" class="error-text" role="alert">
        存在格式不正确的邮箱：{{ invalidTags.join('、') }}
      </span>
    </div>

    <div class="card-actions">
      <el-button :loading="testing" :disabled="saving" @click="emit('test')">发送测试</el-button>
      <el-button type="primary" :loading="saving" :disabled="saveDisabled" @click="emit('save')">保存</el-button>
      <span v-if="saveError" class="inline-error" role="alert">{{ saveError }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 卡1 告警接收（任务 6.6，AC1）：webhook URL（mono，数组多行）+ 邮件接收组
 * （tag 输入）+ 发送测试 + 保存。
 *
 * 受控组件：草稿状态在父级（保存异常保留输入不清空由父级持有保证），
 * 本卡只做格式校验（format.ts 纯函数）与行内提示；格式非法时保存禁用。
 * 发送测试走 POST /certs/settings/test，结果 Toast（成功/失败原因）由父级呈现。
 */
import { computed, ref } from 'vue'
import { isValidEmail, parseEmailTags, validateWebhookUrl } from '../format'

const props = defineProps<{
    webhookUrls: string[]
    emailGroup: string[]
    saving: boolean
    testing: boolean
    /** 保存异常行内错误（服务端错误信息；输入保留） */
    saveError: string
}>()

const emit = defineEmits<{
    (e: 'update:webhookUrls', v: string[]): void
    (e: 'update:emailGroup', v: string[]): void
    (e: 'save'): void
    (e: 'test'): void
}>()

function webhookInputId(i: number) {
    return `alert-webhook-${i}`
}

/** 逐行 webhook 校验（空串=通过） */
const webhookErrors = computed(() => props.webhookUrls.map((url) => validateWebhookUrl(url)))

const invalidTags = computed(() => props.emailGroup.filter((e) => !isValidEmail(e)))

const saveDisabled = computed(
    () => webhookErrors.value.some((err) => err !== '') || invalidTags.value.length > 0,
)

function updateWebhook(i: number, v: string) {
    const next = [...props.webhookUrls]
    next[i] = v
    emit('update:webhookUrls', next)
}

function addWebhook() {
    emit('update:webhookUrls', [...props.webhookUrls, ''])
}

function removeWebhook(i: number) {
    emit(
        'update:webhookUrls',
        props.webhookUrls.filter((_, idx) => idx !== i),
    )
}

// ===== 邮件 tag 输入 =====
const emailInput = ref('')

function commitEmailInput() {
    const tags = parseEmailTags(emailInput.value)
    if (tags.length === 0) {
        emailInput.value = ''
        return
    }
    const next = [...props.emailGroup]
    for (const t of tags) {
        if (!next.includes(t)) next.push(t)
    }
    emit('update:emailGroup', next)
    emailInput.value = ''
}

function removeEmail(i: number) {
    emit(
        'update:emailGroup',
        props.emailGroup.filter((_, idx) => idx !== i),
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

.field {
  margin-bottom: 16px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-primary);
}

.field-empty-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.mono {
  font-family: var(--cert-font-mono);
}

.webhook-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;

  .el-input {
    flex: 1;
    min-width: 260px;
  }

  &.invalid :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--cert-error) inset;
  }
}

.error-text {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--cert-error);
}

.add-row-btn {
  padding: 0;
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
  cursor: text;

  &:focus-within {
    border-color: var(--cert-accent);
  }

  &.invalid {
    border-color: var(--cert-error);
  }
}

.tag-input {
  flex: 1;
  min-width: 200px;
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

.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.inline-error {
  font-size: 13px;
  color: var(--cert-error);
}
</style>
