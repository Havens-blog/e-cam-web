<template>
  <div class="dict-item-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <div class="header-info">
        <h3 class="header-title">{{ typeName }}</h3>
        <span class="header-code">{{ typeCode }}</span>
      </div>
      <el-button type="primary" size="small" :disabled="!typeId" @click="$emit('add')">
        <el-icon><Plus /></el-icon>
        新增字典项
      </el-button>
    </div>

    <!-- 表格 -->
    <div class="panel-body">
      <el-table
        v-loading="loading"
        :data="items"
        style="width: 100%"
        :row-class-name="rowClassName"
        :header-cell-style="{
          background: 'var(--table-header-bg)',
          color: 'var(--text-secondary)',
          fontWeight: 500,
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          borderBottom: '1px solid var(--border-subtle)'
        }"
        :cell-style="{
          borderBottom: '1px solid var(--border-subtle)',
          color: 'var(--text-regular)'
        }"
      >
        <el-table-column prop="label" label="标签" min-width="140">
          <template #default="{ row }">
            <span class="cell-label">{{ row.label }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="value" label="值" min-width="140">
          <template #default="{ row }">
            <code class="cell-code">{{ row.value }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" align="center">
          <template #default="{ row }">
            <span class="cell-sort">{{ row.sort_order }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 'enabled'"
              size="small"
              inline-prompt
              active-text="启"
              inactive-text="停"
              @change="(val: string | number | boolean) => $emit('statusChange', row, val ? 'enabled' : 'disabled')"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center" fixed="right">
          <template #default="{ row }">
            <div class="action-btns">
              <el-tooltip content="编辑" placement="top">
                <button class="icon-btn" @click="$emit('edit', row)">
                  <el-icon :size="14"><Edit /></el-icon>
                </button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <button class="icon-btn danger" @click="$emit('delete', row)">
                  <el-icon :size="14"><Delete /></el-icon>
                </button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="table-empty">
            <span>暂无字典项数据</span>
          </div>
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { listDictItemsApi } from '@/api/dictionary'
import type { DictItem } from '@/api/types/dictionary'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref, watch } from 'vue'

const props = defineProps<{
  typeId: number | null
  typeName: string
  typeCode: string
}>()

const emit = defineEmits<{
  add: []
  edit: [item: DictItem]
  delete: [item: DictItem]
  statusChange: [item: DictItem, status: string]
  count: [count: number]
}>()

const items = ref<DictItem[]>([])
const loading = ref(false)

async function loadItems() {
  if (!props.typeId) {
    items.value = []
    emit('count', 0)
    return
  }
  loading.value = true
  try {
    const res = await listDictItemsApi(props.typeId)
    const data = (res as unknown as { data: DictItem[] | { items: DictItem[] } }).data || res
    items.value = Array.isArray(data) ? data : ((data as { items?: DictItem[] }).items || [])
    emit('count', items.value.length)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载字典项失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

function rowClassName({ row }: { row: DictItem }) {
  return row.status === 'disabled' ? 'row-disabled' : ''
}

watch(() => props.typeId, () => loadItems(), { immediate: true })

defineExpose({ loadItems })
</script>

<style lang="scss" scoped>
.dict-item-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.header-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-code {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  background: var(--glass-bg-hover);
  padding: 2px 8px;
  border-radius: 4px;
}

.panel-body {
  flex: 1;
  overflow: auto;
}

.cell-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.cell-code {
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--glass-bg-hover);
  color: var(--accent-blue);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-subtle);
}

.cell-sort {
  font-size: 12px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.action-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 150ms ease;

  &:hover {
    background: var(--glass-bg-hover);
    color: var(--accent-blue);
  }

  &.danger:hover {
    color: var(--accent-red);
    background: rgba(239, 68, 68, 0.1);
  }
}

.table-empty {
  padding: 48px 0;
  color: var(--text-muted);
  font-size: 13px;
}

:deep(.row-disabled) {
  opacity: 0.45;
}

:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: var(--glass-bg-hover);
  --el-table-border-color: var(--border-subtle);
  --el-table-text-color: var(--text-regular);
  --el-table-header-text-color: var(--text-secondary);
}

:deep(.el-table__inner-wrapper::before) {
  display: none;
}
</style>
