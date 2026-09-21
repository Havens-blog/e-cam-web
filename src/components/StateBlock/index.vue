<template>
  <div class="state-block">
    <slot v-if="status === 'success'" />

    <div v-else-if="status === 'loading'" class="state-block__state">
      <el-skeleton :rows="skeletonRows" animated />
    </div>

    <div v-else-if="status === 'empty'" class="state-block__state">
      <el-empty :description="emptyText" :image-size="emptyImageSize">
        <template v-if="$slots.icon" #image>
          <slot name="icon" />
        </template>
        <template v-if="$slots.actions" #default>
          <slot name="actions" />
        </template>
      </el-empty>
    </div>

    <div v-else class="state-block__state state-block__state--error" role="alert">
      <el-icon class="state-block__error-icon" :size="32">
        <CircleCloseFilled />
      </el-icon>
      <p class="state-block__error-text">{{ errorText }}</p>
      <p v-if="errorCode" class="state-block__error-meta">错误代码: {{ errorCode }}</p>
      <p v-if="errorDetail" class="state-block__error-meta">{{ errorDetail }}</p>
      <el-button size="small" class="state-block__retry" @click="emit('retry')">
        <el-icon><Refresh /></el-icon>
        {{ retryText }}
      </el-button>
      <div v-if="$slots.actions" class="state-block__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * StateBlock 统一三态块（Phase 2 布局层第一个组件）。
 *
 * status 驱动的四态容器：loading 渲染 el-skeleton 骨架屏；empty 渲染空态
 * （吸收 EmptyState 的自定义文案/图标/操作按钮能力）；error 渲染错误信息 +
 * 重试按钮（吸收 ErrorDisplay 的错误码/详情/重试能力）；success 渲染默认插槽
 * 承载成功态内容。仅消费 Phase 1 Linear CSS 变量令牌（零硬编码色），供
 * DataTable 与业务页面复用。迁移期 EmptyState.vue / ErrorDisplay.vue 保留
 * 不动（Phase 3/4 统一下线）。
 */
/** StateBlock 的状态：loading=骨架屏加载态；empty=空态；error=错误态；success=成功态（渲染默认插槽） */
export type StateBlockStatus = 'loading' | 'empty' | 'error' | 'success'
</script>

<script setup lang="ts">
import { CircleCloseFilled, Refresh } from '@element-plus/icons-vue'

interface Props {
  /** 当前状态：loading 渲染骨架屏，empty 渲染空态，error 渲染错误信息+重试按钮，success 渲染默认插槽 */
  status?: StateBlockStatus
  /** 空态文案（吸收 EmptyState.description） */
  emptyText?: string
  /** 空态插画尺寸 px（吸收 EmptyState.imageSize） */
  emptyImageSize?: number
  /** loading 骨架屏段落数 */
  skeletonRows?: number
  /** 错误态主文案（吸收 ErrorDisplay.errorInfo.message） */
  errorText?: string
  /** 错误码（吸收 ErrorDisplay.errorInfo.code；空值不展示） */
  errorCode?: string | number
  /** 错误详情透传（如请求地址、响应摘要等附加行；空值不展示） */
  errorDetail?: string
  /** 重试按钮文案 */
  retryText?: string
}

withDefaults(defineProps<Props>(), {
  status: 'success',
  emptyText: '暂无数据',
  emptyImageSize: 120,
  skeletonRows: 3,
  errorText: '操作失败',
  retryText: '重试',
})

const emit = defineEmits<{
  /** 错误态点击重试按钮时触发，由父级重新拉取数据 */
  (e: 'retry'): void
}>()

defineSlots<{
  /** 成功态内容（status=success 时渲染） */
  default?: () => unknown
  /** 空态自定义图标（替换 el-empty 默认插画） */
  icon?: () => unknown
  /** 空态/错误态底部的操作按钮区（如「添加」「清除筛选」，覆盖 EmptyState 按钮能力） */
  actions?: () => unknown
}>()
</script>

<style scoped lang="scss">
.state-block {
  width: 100%;

  &__state {
    padding: 40px 16px;
    text-align: center;
  }

  &__error-icon {
    color: var(--accent-red);
    margin-bottom: 8px;
  }

  &__error-text {
    margin: 0 0 4px;
    font-size: 14px;
    color: var(--text-primary);
  }

  &__error-meta {
    margin: 4px 0;
    font-size: 12px;
    color: var(--text-secondary);
    word-break: break-all;
  }

  &__retry {
    margin-top: 12px;
  }

  &__actions {
    margin-top: 12px;
  }

  // 吸收 EmptyState 的空态视觉处理：描述降级 + 插画弱化
  :deep(.el-empty__description) {
    color: var(--text-tertiary);
  }

  :deep(.el-empty__image) {
    opacity: 0.6;
  }
}
</style>
