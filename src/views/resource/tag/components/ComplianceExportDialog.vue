<template>
  <el-dialog :model-value="visible" title="导出合规检查数据" width="620px" :close-on-click-modal="false" @update:model-value="$emit('update:visible', $event)">
    <div style="display: flex; flex-direction: column; gap: 20px">
      <div>
        <div class="scope-row">
          <span style="font-size: 14px; color: var(--text-secondary); flex-shrink: 0">导出范围：</span>
          <div class="scope-buttons">
            <button type="button" class="scope-btn" :class="{ active: form.scope === 'all' }" @click="form.scope = 'all'">全部不合规数据</button>
            <button type="button" class="scope-btn" :class="{ active: form.scope === 'current' }" @click="form.scope = 'current'">当前页数据</button>
            <button type="button" class="scope-btn" :class="{ active: form.scope === 'selected', disabled: !selectedCount }" :disabled="!selectedCount" @click="selectedCount && (form.scope = 'selected')">已选中数据</button>
          </div>
          <span style="font-size: 13px; color: var(--text-tertiary); flex-shrink: 0">共计 {{ scopeCount }} 条</span>
        </div>
      </div>
      <div>
        <div style="font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: 12px">导出格式</div>
        <div style="display: flex; gap: 12px">
          <div class="format-card" :class="{ active: form.format === 'xlsx' }" @click="form.format = 'xlsx'">
            <span style="font-size: 14px; font-weight: 500">Excel (.xlsx)</span>
            <span style="font-size: 12px; color: var(--text-tertiary)">适合数据分析</span>
          </div>
          <div class="format-card" :class="{ active: form.format === 'csv' }" @click="form.format = 'csv'">
            <span style="font-size: 14px; font-weight: 500">CSV (.csv)</span>
            <span style="font-size: 12px; color: var(--text-tertiary)">通用兼容</span>
          </div>
        </div>
      </div>
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px">
          <span style="font-size: 14px; font-weight: 500; color: var(--text-primary)">导出字段</span>
          <div><el-button text size="small" @click="form.fields = fields.map(f => f.key)">全选</el-button><el-button text size="small" @click="form.fields = []">取消全选</el-button></div>
        </div>
        <el-checkbox-group v-model="form.fields" class="field-list">
          <el-checkbox v-for="f in fields" :key="f.key" :value="f.key">{{ f.label }}</el-checkbox>
        </el-checkbox-group>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!form.fields.length" @click="handleExport">📥 导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { ComplianceResult } from '@/api/types/tag';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean
  currentPageData: ComplianceResult[]
  selectedData: ComplianceResult[]
  totalCount: number
}>()

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const selectedCount = ref(0)

watch(() => props.visible, (val) => {
  if (val) {
    selectedCount.value = props.selectedData.length
    form.scope = props.selectedData.length > 0 ? 'selected' : 'current'
  }
})

const fields = [
  { key: 'asset_id', label: '资源ID' },
  { key: 'asset_name', label: '资源名称' },
  { key: 'resource_type', label: '资源类型' },
  { key: 'provider', label: '云厂商' },
  { key: 'region', label: '区域' },
  { key: 'violations', label: '违规项' },
  { key: 'status', label: '合规状态' },
]

const form = reactive({
  scope: 'current' as 'current' | 'selected' | 'all',
  format: 'csv' as 'csv' | 'xlsx',
  fields: ['asset_id', 'asset_name', 'resource_type', 'provider', 'violations', 'status'],
})

const scopeCount = computed(() => {
  if (form.scope === 'selected') return selectedCount.value
  if (form.scope === 'current') return props.currentPageData.length
  return props.totalCount
})

const getFieldValue = (row: ComplianceResult, key: string): string => {
  if (key === 'violations') {
    return (row.violations || []).map(v => v.type === 'missing_key' ? `缺少${v.key}` : `${v.key}值无效`).join('; ')
  }
  if (key === 'status') {
    return row.violations && row.violations.length > 0 ? '不合规' : '合规'
  }
  return (row as any)[key] ?? ''
}

const handleExport = () => {
  let data: ComplianceResult[]
  if (form.scope === 'selected') data = props.selectedData
  else if (form.scope === 'current') data = props.currentPageData
  else data = props.currentPageData // all scope falls back to current page for now

  if (data.length === 0) { ElMessage.warning('没有可导出的数据'); return }

  const headers = form.fields.map(k => fields.find(f => f.key === k)?.label || k)
  const rows = data.map(r => form.fields.map(k => getFieldValue(r, k)))
  const BOM = '\uFEFF'
  const sep = form.format === 'csv' ? ',' : '\t'
  const content = [headers.join(sep), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(sep))].join('\n')
  const ext = form.format === 'csv' ? 'csv' : 'xlsx'
  const mime = form.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8'
  const blob = new Blob([BOM + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `合规检查_${new Date().toISOString().slice(0, 10)}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('导出成功')
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.scope-row { display: flex; align-items: center; gap: 12px; }
.scope-buttons { display: flex; border: 1px solid var(--el-border-color); border-radius: 4px; overflow: hidden; }
.scope-btn {
  padding: 8px 16px; font-size: 13px; color: var(--text-secondary); background: var(--el-fill-color-light);
  border: none; border-right: 1px solid var(--el-border-color); cursor: pointer; white-space: nowrap;
  &:last-child { border-right: none; }
  &:hover:not(.disabled) { color: var(--text-primary); background: var(--el-fill-color); }
  &.active { color: #409eff; position: relative; &::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: #409eff; } }
  &.disabled { color: var(--text-tertiary); cursor: not-allowed; opacity: 0.6; }
}
.format-card {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px;
  border: 2px solid var(--el-border-color); border-radius: 10px; cursor: pointer;
  &:hover { border-color: var(--el-border-color-darker); }
  &.active { border-color: #409eff; background: rgba(64, 158, 255, 0.06); }
}
.field-list {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px;
  background: var(--el-fill-color-light); border: 1px solid var(--el-border-color); border-radius: 8px;
  :deep(.el-checkbox) { margin-right: 0; }
}
</style>
