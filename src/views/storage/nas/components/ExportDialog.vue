<template>
  <el-dialog :model-value="visible" title="导出数据" width="680px" :close-on-click-modal="false" @update:model-value="$emit('update:visible', $event)">
    <div class="export-content">
      <div class="form-section">
        <div class="scope-row">
          <span class="scope-label">导出范围：</span>
          <div class="scope-buttons">
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'all' }" @click="exportForm.scope = 'all'">全部数据</button>
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'current' }" @click="exportForm.scope = 'current'">当前页数据</button>
            <button type="button" class="scope-btn" :class="{ active: exportForm.scope === 'selected', disabled: !selectedCount }" :disabled="!selectedCount" @click="selectedCount && (exportForm.scope = 'selected')">已选中数据</button>
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
  { key: 'asset_id', label: '文件系统ID' }, { key: 'asset_name', label: '名称' }, { key: 'status', label: '状态' },
  { key: 'file_system_type', label: '文件系统类型' }, { key: 'protocol_type', label: '协议类型' }, { key: 'storage_type', label: '存储类型' },
  { key: 'capacity', label: '容量' }, { key: 'used_capacity', label: '已用容量' }, { key: 'mount_target_count', label: '挂载点数' },
  { key: 'provider', label: '云平台' }, { key: 'region', label: '区域' }, { key: 'vpc_id', label: 'VPC' }, { key: 'creation_time', label: '创建时间' },
]

const exportForm = reactive({
  scope: 'current' as 'current' | 'selected' | 'all',
  format: 'xlsx' as 'xlsx' | 'csv',
  fields: ['asset_id', 'asset_name', 'status', 'file_system_type', 'protocol_type', 'capacity', 'provider', 'region'],
})

const selectAllFields = () => { exportForm.fields = availableFields.map(f => f.key) }
const deselectAllFields = () => { exportForm.fields = [] }

const getFieldValue = (instance: Asset, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') return instance[key] || ''
  const attr = instance.attributes || {}
  if (key === 'status') { const map: Record<string, string> = { Running: '运行中', Stopped: '已停止' }; return map[attr.status] || attr.status || '' }
  if (key === 'provider') { const map: Record<string, string> = { aliyun: '阿里云', tencent: '腾讯云', huawei: '华为云', aws: 'AWS', volcano: '火山引擎' }; return map[attr.provider] || attr.provider || '' }
  if (key === 'capacity' || key === 'used_capacity') { const v = attr[key]; if (!v) return ''; if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(1)}TB`; if (v >= 1024) return `${(v / 1024).toFixed(1)}GB`; return `${v}MB` }
  return attr[key] || ''
}

const handleExport = async () => {
  if (!exportForm.fields.length) { ElMessage.warning('请至少选择一个导出字段'); return }
  exporting.value = true
  try {
    const dataToExport: Asset[] = exportForm.scope === 'selected' ? props.instances.filter(i => props.selectedIds.includes(i.id)) : props.instances
    const headers = exportForm.fields.map(key => availableFields.find(f => f.key === key)?.label || key)
    const rows = dataToExport.map(instance => exportForm.fields.map(key => getFieldValue(instance, key)))
    const BOM = '\uFEFF'
    const content = [headers.join(exportForm.format === 'csv' ? ',' : '\t'), ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(exportForm.format === 'csv' ? ',' : '\t'))].join('\n')
    const blob = new Blob([BOM + content], { type: exportForm.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = `NAS文件系统_${new Date().toISOString().slice(0, 10)}.${exportForm.format}`
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
    ElMessage.success('导出成功'); emit('update:visible', false)
  } catch (e) { ElMessage.error('导出失败') }
  finally { exporting.value = false }
}
</script>

<style scoped lang="scss">
@import '../../styles/export-dialog.scss';
</style>
