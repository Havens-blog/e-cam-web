<template>
  <el-dialog :model-value="visible" title="导出数据" width="680px" :close-on-click-modal="false" @update:model-value="$emit('update:visible', $event)">
    <div class="export-content">
      <div class="form-section">
        <div class="scope-row">
          <span class="scope-label">导出范围：</span>
          <div class="scope-buttons">
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'all' }" @click="exportForm.scope = 'all'">全部数据</button>
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'current' }" @click="exportForm.scope = 'current'">当前页</button>
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'selected', disabled: !selectedCount }" :disabled="!selectedCount" @click="selectedCount && (exportForm.scope = 'selected')">已选中</button>
          </div>
          <span class="scope-count">共计 {{ scopeDataCount }} 条</span>
        </div>
      </div>
      <div class="form-section">
        <div class="section-title">导出格式</div>
        <el-radio-group v-model="exportForm.format" class="format-options">
          <div class="format-card" :class="{ active: exportForm.format === 'xlsx' }" @click="exportForm.format = 'xlsx'"><el-icon :size="24"><Document /></el-icon><span class="format-name">Excel (.xlsx)</span></div>
          <div class="format-card" :class="{ active: exportForm.format === 'csv' }" @click="exportForm.format = 'csv'"><el-icon :size="24"><Document /></el-icon><span class="format-name">CSV (.csv)</span></div>
        </el-radio-group>
      </div>
      <div class="form-section">
        <div class="section-header"><span class="section-title">导出字段</span><div class="field-actions"><el-button text size="small" @click="selectAllFields">全选</el-button><el-button text size="small" @click="deselectAllFields">取消全选</el-button></div></div>
        <el-checkbox-group v-model="exportForm.fields" class="field-list"><el-checkbox v-for="field in availableFields" :key="field.key" :value="field.key">{{ field.label }}</el-checkbox></el-checkbox-group>
      </div>
    </div>
    <template #footer><el-button @click="$emit('update:visible', false)">取消</el-button><el-button type="primary" :loading="exporting" :disabled="!exportForm.fields.length" @click="handleExport"><el-icon><Download /></el-icon>导出</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset';
import { Document, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{ visible: boolean; instances: Asset[]; selectedIds: number[]; total: number }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const exporting = ref(false)
const currentCount = ref(0)
const selectedCount = ref(0)
const totalCount = ref(0)

watch(() => props.visible, (val) => {
  if (val) { currentCount.value = props.instances.length; selectedCount.value = props.selectedIds.length; totalCount.value = props.total; exportForm.scope = props.selectedIds.length > 0 ? 'selected' : 'current' }
}, { immediate: true })

const scopeDataCount = computed(() => exportForm.scope === 'current' ? currentCount.value : exportForm.scope === 'selected' ? selectedCount.value : totalCount.value)

const availableFields = [
  { key: 'asset_id', label: 'EIP ID' }, { key: 'asset_name', label: '名称' }, { key: 'ip_address', label: 'IP地址' },
  { key: 'status', label: '状态' }, { key: 'bandwidth', label: '带宽' }, { key: 'charge_type', label: '计费方式' },
  { key: 'instance_id', label: '绑定实例' }, { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' },
]

const exportForm = reactive({ scope: 'current' as 'current' | 'selected' | 'all', format: 'xlsx' as 'xlsx' | 'csv', fields: ['asset_id', 'asset_name', 'ip_address', 'status', 'bandwidth', 'provider', 'region'] })

const selectAllFields = () => { exportForm.fields = availableFields.map(f => f.key) }
const deselectAllFields = () => { exportForm.fields = [] }

const getFieldValue = (instance: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return instance[key] || ''
  const attr = instance.attributes || {}
  if (key === 'provider') { const map: Record<string, string> = { aliyun: '阿里云', tencent: '腾讯云', huawei: '华为云', aws: 'AWS' }; return map[instance.provider] || instance.provider || '' }
  if (key === 'region') return instance.region || ''
  if (key === 'status') return instance.status || ''
  if (key === 'bandwidth') return attr.bandwidth ? `${attr.bandwidth}Mbps` : ''
  return attr[key] || ''
}

const handleExport = async () => {
  if (!exportForm.fields.length) { ElMessage.warning('请至少选择一个导出字段'); return }
  exporting.value = true
  try {
    const dataToExport: Asset[] = exportForm.scope === 'selected' ? props.instances.filter(i => props.selectedIds.includes(i.id)) : props.instances
    const headers = exportForm.fields.map(key => availableFields.find(f => f.key === key)?.label || key)
    const rows = dataToExport.map(instance => exportForm.fields.map(key => getFieldValue(instance, key)))
    const BOM = '\uFEFF'; const sep = exportForm.format === 'csv' ? ',' : '\t'
    const content = [headers.join(sep), ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(sep))].join('\n')
    const blob = new Blob([BOM + content], { type: exportForm.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `EIP列表_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.${exportForm.format}`; link.click(); URL.revokeObjectURL(url)
    ElMessage.success('导出成功'); emit('update:visible', false)
  } catch { ElMessage.error('导出失败') } finally { exporting.value = false }
}
</script>

<style scoped lang="scss">
.export-content { display: flex; flex-direction: column; gap: 20px; }
.form-section { .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; } .section-title { font-size: 14px; font-weight: 500; color: var(--text-primary); margin-bottom: 12px; } .section-header .section-title { margin-bottom: 0; } }
.scope-row { display: flex; align-items: center; gap: 12px; .scope-label { font-size: 14px; color: var(--text-secondary); } .scope-count { font-size: 13px; color: var(--text-tertiary); } }
.scope-buttons { display: flex; border: 1px solid var(--border-base); border-radius: 4px; overflow: hidden; .scope-btn { padding: 8px 16px; font-size: 13px; color: var(--text-secondary); background: var(--bg-elevated); border: none; border-right: 1px solid var(--border-base); cursor: pointer; &:last-child { border-right: none; } &:hover:not(.disabled) { background: var(--bg-hover); } &.active { color: var(--accent-blue); } &.disabled { opacity: 0.6; cursor: not-allowed; } } }
.format-options { display: flex; gap: 12px; }
.format-card { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px; background: var(--bg-surface); border: 2px solid var(--border-subtle); border-radius: 10px; cursor: pointer; &:hover { border-color: var(--border-strong); } &.active { border-color: var(--accent-blue); background: rgba(59, 130, 246, 0.08); } .format-name { font-size: 14px; font-weight: 500; color: var(--text-primary); } }
.field-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 200px; overflow-y: auto; padding: 12px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; }
.field-actions { display: flex; gap: 4px; }
</style>
