<template>
  <div class="status-tabs" role="tablist" aria-label="变更单状态筛选">
    <button
      v-for="tab in CHANGE_TABS"
      :key="tab.key"
      :id="`chg-tab-${tab.key}`"
      ref="tabRefs"
      type="button"
      role="tab"
      class="status-tab"
      :class="{ active: tab.key === modelValue }"
      :aria-selected="tab.key === modelValue"
      :tabindex="tab.key === modelValue ? 0 : -1"
      @click="$emit('update:modelValue', tab.key)"
      @keydown="onKeydown"
    >
      {{ tab.label }}
      <span class="tab-count" aria-hidden="true">{{ counts[tab.key] ?? 0 }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * 变更列表状态 Tab（AC1）：全集 7 Tab（待确认含草稿；已回滚/回滚失败合并，
 * Tab 内按行徽章区分——Error+⚠ 徽章自区分回滚失败）。role=tablist + 方向键
 * 移动 + roving tabindex（无障碍规范：Tab 支持键盘操作）。
 * 计数由父级从全集行派生（tabCounts）。
 */
import type { ChangeTabKey } from '../format'
import { CHANGE_TABS } from '../format'
import { ref } from 'vue'

defineProps<{
    modelValue: ChangeTabKey
    counts: Record<ChangeTabKey, number>
}>()

const emit = defineEmits<{ (e: 'update:modelValue', tab: ChangeTabKey): void }>()

const tabRefs = ref<HTMLElement[]>([])

/** 方向键在 Tab 间移动（Enter/Space 由 click 语义触发）；循环导航 */
function onKeydown(e: KeyboardEvent) {
    const keys = CHANGE_TABS.map((t) => t.key)
    const idx = keys.indexOf(((e.target as HTMLElement).id || '').replace('chg-tab-', '') as ChangeTabKey)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % keys.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + keys.length) % keys.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = keys.length - 1
    const target = next >= 0 ? keys[next] : undefined
    if (target !== undefined && idx >= 0) {
        e.preventDefault()
        tabRefs.value[next]?.focus()
        emit('update:modelValue', target)
    }
}
</script>

<style lang="scss" scoped>
.status-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.status-tab {
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 6px 12px;
  cursor: pointer;
  transition: none; // reduced-motion 由全局规范承担，不做过渡
  display: inline-flex;
  align-items: center;
  gap: 6px;

  &:hover {
    color: var(--text-primary);
    background: var(--cert-surface-alt);
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: 2px;
  }

  &.active {
    color: var(--text-primary);
    border-color: var(--cert-accent);
    background: color-mix(in srgb, var(--cert-accent) 10%, transparent);
  }
}

.tab-count {
  font-size: 12px;
  color: #a1a1a1; // Surface 上 Text Secondary 提升对比度（无障碍规范）
  font-variant-numeric: tabular-nums;
}
</style>
