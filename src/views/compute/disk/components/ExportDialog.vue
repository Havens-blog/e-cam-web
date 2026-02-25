<template>
  <el-dialog :model-value="visible" title="导出数据" width="680px" :close-on-click-modal="false" class="export-dialog" @update:model-value="$emit('update:visible', $event)">
    <div class="export-content">
      <div class="form-section">
        <div class="scope-row">
          <span class="scope-label">导出范围：</span>
          <div class="scope-buttons">
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'all' }" @click="exportForm.scope = 'all'">全部数据</button>
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'current' }" @click="exportForm.scope = 'current'">当前页数据</button>
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
        <el-checkbox-group v-model="exportForm.fields" class="field-list">
          <el-checkbox v-for="field in availableFields" :key="field.key" :value="field.key">{{ field.label }}</el-checkbox>
        </el-checkbox-group>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="exporting" :disabled="!exportForm.fields.length" @click="handleExport"><el-icon><Download /></el-icon>导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset';
import { Document, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref } from 'vue';

const props = defineProps<{ visible: boolean; instances: Asset[]; total: number }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const exporting = ref(false)
const scopeDataCount = computed(() => exportForm.scope === 'current' ? props.instances.length : props.total)

const availableFields = [
  { key: 'asset_id', label: '云盘ID' }, { key: 'asset_name', label: '名称' }, { key: 'status', label: '状态' },
  { key: 'disk_type', label: '磁盘类型' }, { key: 'size', label: '容量' }, { key: 'category', label: '云盘类型' },
  { key: 'instance_id', label: '挂载实例' }, { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' },
]

const exportForm = reactive({
  scope: 'current' as 'current' | 'all',
  format: 'xlsx' as 'xlsx' | 'csv',
  fields: ['asset_id', 'asset_name', 'status', 'disk_type', 'size', 'category', 'instance_id', 'provider', 'region'],
})

const selectAllFields = () => { exportForm.fields = availableFields.map(f => f.key) }
const deselectAllFields = () => { exportForm.fields = [] }

const handleExport = async () => {
  if (!exportForm.fields.length) { ElMessage.warning('请至少选择一个导出字段'); return }
  exporting.value = true
  try {
    const headers = exportForm.fields.map(key => availableFields.find(f => f.key === key)?.label || key)
    const rows = props.instances.map(i => exportForm.fields.map(key => {
      if (key === 'asset_id' || key === 'asset_name') return i[key] || ''
      return i.attributes?.[key] || ''
    }))
    const BOM = '\uFEFF'
    const content = [headers.join(','), ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([BOM + content], { type: exportForm.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `云盘列表_${new Date().toISOString().slice(0, 10)}.${exportForm.format}`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
    emit('update:visible', false)
  } catch { ElMessage.error('导出失败') } finally { exporting.value = false }
}
</script>

<style scoped lang="scss">
@import '@/views/storage/styles/export-dialog.scss';
</style>
