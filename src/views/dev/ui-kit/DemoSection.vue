<template>
  <section :id="sectionId" class="ui-kit-section" :aria-labelledby="`${sectionId}-title`">
    <div class="ui-kit-section__head">
      <h3 :id="`${sectionId}-title`" class="ui-kit-section__title">{{ title }}</h3>
      <el-button
        size="small"
        text
        type="primary"
        class="ui-kit-copy"
        :aria-label="`复制 ${title} 示例代码`"
        @click="copyCode"
      >
        <el-icon><CopyDocument /></el-icon>
        复制代码
      </el-button>
    </div>
    <p class="ui-kit-section__desc">{{ description }}</p>
    <div class="ui-kit-section__demo">
      <slot />
    </div>
    <pre class="ui-kit-code"><code>{{ code }}</code></pre>
  </section>
</template>

<script setup lang="ts">
/**
 * /dev/ui-kit demo 页的通用区块壳（ui-unify-phase2-components 任务 8）。
 *
 * 承载单个组件示例：标题 + 一键复制按钮 + 说明 + 示例运行区（默认插槽）+
 * 源码片段展示（照抄样板定位：片段文字与 snippets.ts 常量逐字一致，复制即得）。
 * 仅消费 Phase 1 Linear CSS 变量令牌（零硬编码色）。
 */
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Props {
  /** 锚点 id（区块根元素 id，与锚点导航 href 对应） */
  sectionId: string
  /** 区块标题 */
  title: string
  /** 一句话说明 */
  description: string
  /** 展示并复制的源码片段 */
  code: string
}

const props = defineProps<Props>()

/** 一键复制示例源码（navigator.clipboard，失败时提示手动复制） */
async function copyCode(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.code)
    ElMessage.success('代码已复制，可直接粘贴进业务页')
  } catch {
    ElMessage.error('复制失败，请手动选择代码复制')
  }
}
</script>

<style scoped lang="scss">
.ui-kit-section {
  margin-top: 32px;
  // 原生锚点跳转定位时给标题留出呼吸空间
  scroll-margin-top: 16px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  &__title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  &__desc {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary);
  }

  &__demo {
    border: 1px solid var(--border-base);
    border-radius: 8px;
    background: var(--bg-elevated);
    padding: 16px;
    margin-bottom: 12px;
  }
}

.ui-kit-code {
  margin: 0;
  padding: 12px 16px;
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-surface);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-regular);
  white-space: pre;
}
</style>
