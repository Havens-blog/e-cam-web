<template>
  <el-dialog :model-value="visible" title="自定义列" width="480px" :close-on-click-modal="false" @update:model-value="$emit('update:visible', $event)">
    <div class="column-settings-content">
      <div class="settings-tip"><el-icon><InfoFilled /></el-icon><span>勾选显示/隐藏列，设置将自动保存到本地</span></div>
      <div class="columns-container">
        <div class="column-group">
          <div class="group-title">固定列</div>
          <div class="column-list fixed">
            <div class="column-item disabled"><el-checkbox :model-value="true" disabled /><span class="column-label">存储桶名称</span><span class="column-tag">必选</span></div>
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
  { key: 'storage_class', label: '存储类型', width: 90, visible: true },
  { key: 'acl', label: '访问权限', width: 80, visible: true },
  { key: 'versioning', label: '版本控制', width: 80, visible: true },
  { key: 'object_count', label: '对象数量', width: 90, visible: true },
  { key: 'storage_size', label: '存储量', width: 90, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'region', label: '区域', width: 100, visible: true },
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
  localStorage.setItem('oss-column-settings', JSON.stringify(localColumns.value))
  ElMessage.success('列设置已保存')
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
@import '../../styles/column-settings.scss';
</style>
