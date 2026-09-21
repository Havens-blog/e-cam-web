<!--
  共享导出弹窗（阶段 1 命名 AssetExportDialog，现已不只服务 Asset 行：
  泛型 T 承接 Asset / InstanceVO / CloudUser 等任意含 id: number 的行类型，组件名保持不变以免 15 页 import 变动）。
-->
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
              全部数据
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
          <span v-if="!fetchingAll" class="scope-count">共计 {{ scopeDataCount }} 条</span>
          <span v-else class="scope-count scope-progress">正在获取全量数据 {{ fetchedCount }}/{{ totalCount }}...</span>
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
          <el-checkbox v-for="field in config.fields" :key="field.key" :value="field.key">
            {{ field.label }}
          </el-checkbox>
        </el-checkbox-group>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="exporting" :disabled="!exportForm.fields.length || fetchingAll" @click="handleExport">
        <el-icon><Download /></el-icon>
        导出
      </el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
/**
 * 共享导出弹窗的页面级配置：字段清单/取值映射/文件名前缀/默认勾选字段由各页提供。
 * 泛型 T = 行类型；默认 any 是为既有 15 页的裸 `ExportFieldConfig` 标注兜底（页内闭包自行标注行类型），
 * 新接入页建议显式标注（如 `ExportFieldConfig<InstanceVO>`）。
 */
export interface ExportFieldConfig<T = any> {
  /** 可导出字段清单（key + 列头 label），顺序即列顺序 */
  fields: Array<{ key: string; label: string }>
  /** 纯函数取值映射：(row, key) => 单元格文本；页面特例（如 nas metric-map）经闭包捕获 */
  getValue: (row: T, key: string) => string
  /** 文件名前缀，实际文件名为 `{filename}_{YYYYMMDD}.{ext}` */
  filename: string
  /** 打开弹窗时默认勾选的字段 key */
  defaultFields: string[]
  /** 行标识提取（「已选中」范围按它过滤）；缺省取 `row.id`。无数值 id 的行类型（如合规结果按 account_id+asset_id 复合键）提供此函数 */
  getRowId?: (row: T) => string | number
  /** 初始导出格式；缺省 'xlsx' */
  defaultFormat?: 'csv' | 'xlsx'
}
</script>

<script setup lang="ts" generic="T = any">
import { Document, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean
  instances: T[]
  selectedIds: Array<string | number>
  total: number
  /** 页面级导出配置（字段/取值/文件名/默认勾选） */
  config: ExportFieldConfig<T>
  /** 导出「全部数据」时的全量拉取闭包（父级用列表接口+当前筛选实现）；未提供则退回当前页 */
  fetchAllRows?: (onProgress?: (fetched: number, total: number) => void) => Promise<T[]>
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const exporting = ref(false)

/** 「全部数据」分页拉取进行中（按钮禁用 + 行内进度文案） */
const fetchingAll = ref(false)
const fetchedCount = ref(0)

const currentCount = ref(0)
const selectedCount = ref(0)
const totalCount = ref(0)

const exportForm = reactive({
  scope: 'current' as 'current' | 'selected' | 'all',
  format: (props.config.defaultFormat ?? 'xlsx') as 'xlsx' | 'csv',
  fields: [...props.config.defaultFields],
})

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

const selectAllFields = () => {
  exportForm.fields = props.config.fields.map(f => f.key)
}

const deselectAllFields = () => {
  exportForm.fields = []
}

/** 行标识：页面提供 getRowId 时用之（无数值 id 的行类型），否则回退 row.id */
const rowIdOf = (row: T): string | number =>
  props.config.getRowId ? props.config.getRowId(row) : (row as { id: number }).id

/** 组装导出行：current=当前页 / selected=选中行 / all=父级全量拉取（未提供闭包则退回当前页）。
 *  返回 null 表示全量拉取失败（已在内部提示），调用方直接结束。 */
const resolveExportRows = async (): Promise<T[] | null> => {
  if (exportForm.scope === 'current') return props.instances
  if (exportForm.scope === 'selected') return props.instances.filter(i => props.selectedIds.includes(rowIdOf(i)))
  if (props.fetchAllRows) {
    fetchingAll.value = true
    fetchedCount.value = 0
    try {
      return await props.fetchAllRows((fetched, total) => { fetchedCount.value = fetched; totalCount.value = total })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '全量数据获取失败，请重试'
      ElMessage.error(msg)
      return null
    } finally { fetchingAll.value = false }
  }
  return props.instances
}

const handleExport = async () => {
  if (!exportForm.fields.length) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  exporting.value = true
  try {
    const dataToExport = await resolveExportRows()
    if (!dataToExport) return
    if (dataToExport.length === 0) { ElMessage.warning('没有可导出的数据'); return }

    const headers = exportForm.fields.map(key => {
      const field = props.config.fields.find(f => f.key === key)
      return field?.label || key
    })

    const rows = dataToExport.map(instance => {
      return exportForm.fields.map(key => props.config.getValue(instance, key))
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
  downloadFile(blob, `${props.config.filename}_${formatDate()}.csv`)
}

const exportToXlsx = (headers: string[], rows: string[][]) => {
  const worksheet = [headers, ...rows]
  const csvContent = worksheet.map(row =>
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join('\t')
  ).join('\n')

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' })
  downloadFile(blob, `${props.config.filename}_${formatDate()}.xlsx`)
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

  // 「全部数据」全量分页拉取进行中的行内进度文案
  .scope-progress {
    color: var(--accent-blue, #409eff);
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
    background: rgba(113, 112, 255, 0.08);
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
