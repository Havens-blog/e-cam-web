<template>
  <el-drawer
    :model-value="visible"
    :title="drawerTitle"
    size="520px"
    destroy-on-close
    @update:model-value="$emit('update:visible', $event)"
  >
    <div v-if="entry" class="detail-body">
      <div class="detail-section">
        <div class="section-title">统一字段</div>
        <div class="kv-grid">
          <div v-for="f in fieldRows" :key="f.key" class="kv-item">
            <span class="kv-label">{{ f.label }}</span>
            <span class="kv-value cell-mono">{{ f.value }}</span>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="section-title">
          原始字段(全量保留)
          <el-button size="small" text type="primary" @click="copyRaw">复制 JSON</el-button>
        </div>
        <pre class="raw-json" data-testid="log-raw-json">{{ rawJson }}</pre>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 日志详情抽屉:统一字段 + Raw 原始字段 JSON 树(信息零丢失出口,ADR D3)。
 */
import type { LogEntry } from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'
import { cloudLabel, dashIfEmpty, formatBytes, formatLogTime } from '../format'

const props = defineProps<{
    visible: boolean
    entry: LogEntry | null
    /** 类型专属字段字典(展示顺序与列表一致) */
    fields: { key: string; label: string }[]
}>()

defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const drawerTitle = computed(() =>
    props.entry ? `日志详情 · ${cloudLabel(props.entry.meta.cloud)} · ${props.entry.meta.resource_id || '-'}` : '日志详情',
)

const fieldRows = computed(() => {
    if (!props.entry) return []
    const e = props.entry as unknown as Record<string, unknown>
    const rows: { key: string; label: string; value: string }[] = []
    for (const f of props.fields) {
        let value: string
        if (f.key === 'timestamp') {
            value = formatLogTime(props.entry.timestamp)
        } else if (f.key === 'bytes_sent') {
            value = `${dashIfEmpty(e.bytes_sent as number)} (${formatBytes(e.bytes_sent as number)})`
        } else if (f.key.startsWith('meta.')) {
            value = dashIfEmpty((props.entry.meta as unknown as Record<string, unknown>)[f.key.slice(5)] as string)
        } else {
            value = dashIfEmpty(e[f.key] as string | number)
        }
        rows.push({ key: f.key, label: f.label, value })
    }
    // 元数据补充(非列表列):源标识 + 区域 + 账号 ID
    rows.push({ key: 'meta.source', label: '源标识', value: dashIfEmpty(props.entry.meta.source) })
    return rows
})

const rawJson = computed(() => (props.entry ? JSON.stringify(props.entry.raw, null, 2) : ''))

async function copyRaw() {
    try {
        await navigator.clipboard.writeText(rawJson.value)
        ElMessage.success('原始字段 JSON 已复制')
    } catch {
        ElMessage.warning('复制失败,请手动选择复制')
    }
}
</script>

<style scoped>
.detail-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.detail-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 13px;
    color: var(--el-text-color-primary);
}
.kv-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px 12px;
}
.kv-item {
    display: flex;
    gap: 12px;
    font-size: 12px;
    line-height: 1.8;
}
.kv-label {
    flex: 0 0 88px;
    color: var(--el-text-color-secondary);
}
.kv-value {
    flex: 1;
    word-break: break-all;
    color: var(--el-text-color-primary);
}
.cell-mono {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
}
.raw-json {
    margin: 0;
    padding: 12px;
    max-height: 50vh;
    overflow: auto;
    background: var(--el-fill-color-light);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
