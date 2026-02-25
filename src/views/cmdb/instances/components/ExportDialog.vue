<template>
  <el-dialog
    :model-value="visible"
    title="导出数据"
    width="680px"
    :close-on-click-modal="false"
    class="export-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="export-content">
      <!-- 导出范围 -->
      <div class="form-section">
        <div class="scope-row">
          <span class="scope-label">导出范围：</span>
          <div class="scope-buttons">
            <button 
              type="button"
              class="scope-btn" 
              :class="{ active: exportForm.scope === 'all' }"
              @click="exportForm.scope = 'all'"
            >
              当前过滤条件全部数据
            </button>
            <button 
              type="button"
              class="scope-btn" 
              :class="{ active: exportForm.scope === 'current' }"
              @click="exportForm.scope = 'current'"
            >
              当前页数据
            </button>
            <button 
              type="button"
              class="scope-btn" 
              :class="{ active: exportForm.scope === 'selected', disabled: !selectedCount }"
              :disabled="!selectedCount"
              @click="selectedCount && (exportForm.scope = 'selected')"
            >
              已选中数据
            </button>
          </div>
          <span class="scope-count">共计 {{ scopeDataCount }} 条</span>
        </div>
      </div>

      <!-- 导出格式 -->
      <div class="form-section">
        <div class="section-title">导出格式</div>
        <el-radio-group v-model="exportForm.format" class="format-options">
          <div class="format-card" :class="{ active: exportForm.format === 'xlsx' }" @click="exportForm.format = 'xlsx'">
            <el-icon :size="24"><Document /></el-icon>
            <span class="format-name">Excel (.xlsx)</span>
            <span class="format-desc">适合数据分析和编辑</span>
          </div>
          <div class="format-card" :class="{ active: exportForm.format === 'csv' }" @click="exportForm.format = 'csv'">
            <el-icon :size="24"><Document /></el-icon>
            <span class="format-name">CSV (.csv)</span>
            <span class="format-desc">通用格式，兼容性好</span>
          </div>
        </el-radio-group>
      </div>

      <!-- 导出字段 -->
      <div class="form-section">
        <div class="section-header">
          <span class="section-title">导出字段</span>
          <div class="field-actions">
            <el-button text size="small" @click="selectAllFields">全选</el-button>
            <el-button text size="small" @click="deselectAllFields">取消全选</el-button>
          </div>
        </div>
        <el-checkbox-group v-model="exportForm.fields" class="field-list">
          <el-checkbox v-for="field in availableFields" :key="field.key" :value="field.key">
            {{ field.label }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="exporting" :disabled="!exportForm.fields.length" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { InstanceVO } from '@/api/types/cmdb';
import { Document, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean
  instances: InstanceVO[]
  selectedIds: number[]
  total: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const exporting = ref(false)

const currentCount = ref(0)
const selectedCount = ref(0)
const totalCount = ref(0)

watch(() => props.visible, (val) => {
  if (val) {
    currentCount.value = props.instances.length
    selectedCount.value = props.selectedIds.length
    totalCount.value = props.total
    if (props.selectedIds.length > 0) {
      exportForm.scope = 'selected'
    } else {
      exportForm.scope = 'current'
    }
  }
}, { immediate: true })

const scopeDataCount = computed(() => {
  if (exportForm.scope === 'current') return currentCount.value
  if (exportForm.scope === 'selected') return selectedCount.value
  return totalCount.value
})

const availableFields = [
  { key: 'asset_id', label: '资产ID' },
  { key: 'asset_name', label: '名称' },
  { key: 'uid', label: '资产类型' },
  { key: 'provider', label: '云平台' },
  { key: 'region', label: '区域' },
  { key: 'zone', label: '可用区' },
  { key: 'status', label: '状态' },
  { key: 'cloud_account_name', label: '云账号' },
  { key: 'creation_time', label: '创建时间' },
  { key: 'tags', label: '标签' },
]

const exportForm = reactive({
  scope: 'current' as 'current' | 'selected' | 'all',
  format: 'xlsx' as 'xlsx' | 'csv',
  fields: ['asset_id', 'asset_name', 'uid', 'provider', 'region', 'status'],
})

const selectAllFields = () => {
  exportForm.fields = availableFields.map(f => f.key)
}

const deselectAllFields = () => {
  exportForm.fields = []
}

const getFieldValue = (instance: InstanceVO, key: string): string => {
  if (key === 'asset_id' || key === 'asset_name') {
    return instance[key] || ''
  }
  if (key === 'uid') {
    const type = instance.uid?.split('_')[0] || instance.uid
    const typeMap: Record<string, string> = {
      ecs: '云服务器', rds: 'RDS', redis: 'Redis', mongodb: 'MongoDB',
      vpc: 'VPC', eip: '弹性公网IP', nas: '文件存储', oss: '对象存储',
      kafka: 'Kafka', elasticsearch: 'Elasticsearch'
    }
    return typeMap[type] || type || ''
  }
  const attr = instance.attributes || {}
  if (key === 'status') {
    const map: Record<string, string> = { 
      running: '运行中', Running: '运行中', RUNNING: '运行中',
      stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
      available: '可用', Available: '可用',
      pending: '创建中', Pending: '创建中',
      error: '异常', Error: '异常'
    }
    return map[attr.status] || attr.status || ''
  }
  if (key === 'provider') {
    const map: Record<string, string> = {
      aliyun: '阿里云', tencent: '腾讯云', huawei: '华为云', aws: 'AWS',
      volcengine: '火山引擎', volcano: '火山引擎'
    }
    return map[attr.provider] || attr.provider || ''
  }
  if (key === 'tags') {
    const tags = attr.tags
    if (tags && typeof tags === 'object') {
      return Object.entries(tags).map(([k, v]) => `${k}:${v}`).join('; ')
    }
    return ''
  }
  if (key === 'creation_time') {
    const time = attr.creation_time || instance.create_time
    if (!time) return ''
    const date = typeof time === 'number' ? new Date(time * 1000) : new Date(time)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleString('zh-CN')
  }
  return attr[key] || ''
}

const handleExport = async () => {
  if (!exportForm.fields.length) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  exporting.value = true
  try {
    let dataToExport: InstanceVO[] = []
    if (exportForm.scope === 'current') {
      dataToExport = props.instances
    } else if (exportForm.scope === 'selected') {
      dataToExport = props.instances.filter(i => props.selectedIds.includes(i.id))
    } else {
      dataToExport = props.instances
      ElMessage.info('全量导出将导出当前已加载的数据')
    }

    const headers = exportForm.fields.map(key => {
      const field = availableFields.find(f => f.key === key)
      return field?.label || key
    })

    const rows = dataToExport.map(instance => {
      return exportForm.fields.map(key => getFieldValue(instance, key))
    })

    if (exportForm.format === 'csv') {
      exportToCsv(headers, rows)
    } else {
      exportToXlsx(headers, rows)
    }

    ElMessage.success('导出成功')
    emit('update:visible', false)
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const exportToCsv = (headers: string[], rows: string[][]) => {
  const BOM = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n')

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
  downloadFile(blob, `资源实例列表_${formatDate()}.csv`)
}

const exportToXlsx = (headers: string[], rows: string[][]) => {
  const worksheet = [headers, ...rows]
  const csvContent = worksheet.map(row => 
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join('\t')
  ).join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
  downloadFile(blob, `资源实例列表_${formatDate()}.xlsx`)
}

const downloadFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const formatDate = () => {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.export-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-section {
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 12px;
  }

  .section-header .section-title {
    margin-bottom: 0;
  }
}

.scope-row {
  display: flex;
  align-items: center;
  gap: 12px;

  .scope-label {
    font-size: 14px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .scope-count {
    font-size: 13px;
    color: var(--text-tertiary);
    flex-shrink: 0;
  }
}

.scope-buttons {
  display: flex;
  border: 1px solid var(--border-base);
  border-radius: 4px;
  overflow: hidden;

  .scope-btn {
    padding: 8px 16px;
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--bg-elevated);
    border: none;
    border-right: 1px solid var(--border-base);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;

    &:last-child {
      border-right: none;
    }

    &:hover:not(.disabled) {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      color: var(--accent-blue);
      background: var(--bg-elevated);
      border-color: var(--accent-blue);
      position: relative;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--accent-blue);
      }
    }

    &.disabled {
      color: var(--text-muted);
      cursor: not-allowed;
      opacity: 0.6;
    }
  }
}

.format-options {
  display: flex;
  gap: 12px;
}

.format-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: var(--bg-surface);
  border: 2px solid var(--border-subtle);
  border-radius: 10px;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: var(--border-strong);
    background: var(--bg-hover);
  }

  &.active {
    border-color: var(--accent-blue);
    background: rgba(59, 130, 246, 0.08);
  }

  .el-icon {
    color: var(--text-tertiary);
  }

  .format-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .format-desc {
    font-size: 12px;
    color: var(--text-muted);
  }
}

.field-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;

  :deep(.el-checkbox) {
    margin-right: 0;
  }
}

.field-actions {
  display: flex;
  gap: 4px;
}
</style>
