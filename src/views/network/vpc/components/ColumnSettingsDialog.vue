<template>
  <el-dialog :model-value="visible" title="自定义列" width="480px" :close-on-click-modal="false" @update:model-value="$emit('update:visible', $event)">
    <div class="column-settings-content">
      <div class="settings-tip"><el-icon><InfoFilled /></el-icon><span>勾选显示/隐藏列，设置将自动保存到本地</span></div>
      <div class="columns-container">
        <div class="column-group">
          <div class="group-title">固定列</div>
          <div class="column-list fixed">
            <div class="column-item disabled"><el-checkbox :model-value="true" disabled /><span class="column-label">名称</span><span class="column-tag">必选</span></div>
            <div class="column-item disabled"><el-checkbox :model-value="true" disabled /><span class="column-label">操作</span><span class="column-tag">必选</span></div>
          </div>
        </div>
        <div class="column-group">
          <div class="group-header">
            <span class="group-title">可选列 ({{ visibleCount }}/{{ localColumns.length }})</span>
            <div class="group-actions">
              <el-button text size="small" @click="selectAll">全选</el-button>
              <el-button text size="small" @click="deselectAll">取消全选</el-button>
              <el-button text size="small" @click="resetDefault">恢复默认</el-button>
            </div>
          </div>
          <div class="column-list">
            <div v-for="col in localColumns" :key="col.key" class="column-item" @click="col.visible = !col.visible">
              <el-checkbox v-model="col.visible" @click.stop /><span class="column-label">{{ col.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleSave">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';

export interface ColumnConfig { key: string; label: string; width?: number; visible: boolean }

const props = defineProps<{ visible: boolean; columns: ColumnConfig[] }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; 'update:columns': [columns: ColumnConfig[]] }>()

const localColumns = ref<ColumnConfig[]>([])
const defaultColumns: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 80, visible: true },
  { key: 'cidr_block', label: 'IPv4网段', width: 130, visible: true },
  { key: 'vswitch_count', label: 'IP数', width: 70, visible: true },
  { key: 'platform', label: '平台', width: 60, visible: true },
  { key: 'account_name', label: '云账号', width: 100, visible: true },
  { key: 'region', label: '区域', width: 130, visible: true },
  { key: 'is_default', label: '默认VPC', width: 80, visible: true },
  { key: 'ipv6_cidr_block', label: 'IPv6网段', width: 130, visible: false },
  { key: 'enable_internet_access', label: '允许外网访问', width: 100, visible: false },
  { key: 'shared_machines', label: '共享机器', width: 100, visible: false },
  { key: 'network_domain', label: '网段域', width: 100, visible: false },
  { key: 'create_time', label: '创建时间', width: 140, visible: false },
]

const visibleCount = computed(() => localColumns.value.filter(c => c.visible).length)

watch(() => props.visible, (val) => {
  if (val) localColumns.value = props.columns.length > 0 ? JSON.parse(JSON.stringify(props.columns)) : JSON.parse(JSON.stringify(defaultColumns))
}, { immediate: true })

const selectAll = () => { localColumns.value.forEach(col => col.visible = true) }
const deselectAll = () => { localColumns.value.forEach(col => col.visible = false) }
const resetDefault = () => { localColumns.value = JSON.parse(JSON.stringify(defaultColumns)) }

const handleSave = () => {
  if (localColumns.value.filter(c => c.visible).length === 0) { ElMessage.warning('请至少选择一个显示列'); return }
  emit('update:columns', JSON.parse(JSON.stringify(localColumns.value)))
  localStorage.setItem('vpc-column-settings', JSON.stringify(localColumns.value))
  ElMessage.success('列设置已保存')
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.column-settings-content { display: flex; flex-direction: column; gap: 16px; }
.settings-tip { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: rgba(59, 130, 246, 0.08); border-radius: 8px; font-size: 13px; color: var(--accent-blue); }
.columns-container { display: flex; flex-direction: column; gap: 16px; }
.column-group { .group-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; } .group-title { font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 10px; } .group-header .group-title { margin-bottom: 0; } .group-actions { display: flex; gap: 4px; } }
.column-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; max-height: 260px; overflow-y: auto; padding: 10px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; &.fixed { background: var(--bg-hover); } }
.column-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 6px; cursor: pointer; &:hover:not(.disabled) { background: var(--bg-hover); } &.disabled { opacity: 0.7; cursor: not-allowed; } .column-label { flex: 1; font-size: 13px; color: var(--text-primary); } .column-tag { padding: 2px 6px; font-size: 10px; background: var(--bg-hover); border-radius: 4px; color: var(--text-tertiary); } }
</style>
