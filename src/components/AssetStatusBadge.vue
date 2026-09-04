<template>
  <div class="status-badge" :class="toneClass">
    <span class="status-dot"></span>
    <span class="status-text">{{ displayLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 资产状态徽章(点 + 文本)。
 * 各列表页(EIP/CDN/…)此前的同构副本统一收口到此组件:
 * - labels: 原始状态值 → 展示文案(如 InUse → 已绑定)
 * - tones:  原始状态值 →色调(active/inactive/pending/error)
 * 未命中映射时按关键词推断色调,文案回退原始值。
 */
const props = defineProps<{
    status: string
    labels?: Record<string, string>
    tones?: Record<string, string>
}>()

const TONE_KEYWORDS: Array<[string[], string]> = [
    [['online', 'deployed', 'active', 'started', 'running', 'inuse', 'in_use', 'bound'], 'active'],
    [['offline', 'stopped', 'disabled', 'unbound', 'available', 'deleted'], 'inactive'],
    [['configuring', 'checking', 'creating', 'pending', 'inprogress', 'deploying'], 'pending'],
    [['error', 'failed', 'check_failed'], 'error'],
]

const toneClass = computed(() => {
    const s = props.status?.toLowerCase() || ''
    const mapped = props.tones?.[props.status] || props.tones?.[s]
    if (mapped) return mapped
    for (const [keys, tone] of TONE_KEYWORDS) {
        if (keys.some(k => s.includes(k))) return tone
    }
    return 'inactive'
})

const displayLabel = computed(() => {
    return props.labels?.[props.status] || props.status || '-'
})
</script>

<style scoped lang="scss">
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
    flex-shrink: 0;
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  &.active {
    .status-dot { background: var(--el-color-success); }
    .status-text { color: var(--el-color-success); }
  }

  &.inactive {
    .status-dot { background: var(--text-muted); }
    .status-text { color: var(--text-muted); }
  }

  &.pending {
    .status-dot { background: var(--el-color-warning); animation: badge-pulse 1.5s infinite; }
    .status-text { color: var(--el-color-warning); }
  }

  &.error {
    .status-dot { background: var(--el-color-danger); }
    .status-text { color: var(--el-color-danger); }
  }
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
