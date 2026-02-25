<template>
  <el-dialog :model-value="visible" title="自定义列" width="480px" @update:model-value="$emit('update:visible', $event)" @closed="handleClosed">
    <div class="column-settings">
      <div class="settings-header">
        <span>固定列：名称、操作</span>
        <div class="settings-actions">
          <el-button text size="small" @click="handleSelectAll">全选</el-button>
          <el-button text size="small" @click="handleDeselectAll">取消全选</el-button>
          <el-button text size="small" @click="handleReset">恢复默认</el-button>
        </div>
      </div>
      <div class="column-list">
        <el-checkbox v-for="col in localColumns" :key="col.key" v-model="col.visible" :label="col.label" />
      </div>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

export interface ColumnConfig { key: string; label: string; width?: number; visible: boolean }

const props = defineProps<{ visible: boolean; columns: ColumnConfig[] }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; 'update:columns': [columns: ColumnConfig[]] }>()

const localColumns = ref<ColumnConfig[]>([])

watch(() => props.visible, (val) => { if (val) localColumns.value = JSON.parse(JSON.stringify(props.columns)) })

const handleSelectAll = () => localColumns.value.forEach(c => c.visible = true)
const handleDeselectAll = () => localColumns.value.forEach(c => c.visible = false)
const handleReset = () => {
  localColumns.value = [
    { key: 'status', label: '状态', width: 90, visible: true },
    { key: 'version', label: '版本', width: 100, visible: true },
    { key: 'spec', label: '规格', width: 120, visible: true },
    { key: 'topic_count', label: 'Topic数', width: 80, visible: true },
    { key: 'partition_count', label: '分区数', width: 80, visible: true },
    { key: 'storage', label: '存储', width: 80, visible: true },
    { key: 'endpoint', label: '接入点', width: 200, visible: true },
    { key: 'platform', label: '平台', width: 50, visible: true },
    { key: 'region', label: '区域', width: 100, visible: true },
    { key: 'vpc', label: 'VPC', width: 150, visible: false },
    { key: 'create_time', label: '创建时间', width: 150, visible: false },
  ]
}

const handleConfirm = () => { emit('update:columns', localColumns.value); localStorage.setItem('kafka-column-settings', JSON.stringify(localColumns.value)); emit('update:visible', false) }
const handleClosed = () => { localColumns.value = [] }
</script>

<style lang="scss" scoped>
@import '@/views/storage/styles/column-settings.scss';
</style>
