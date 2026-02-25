<template>
  <el-dialog :model-value="visible" title="导出数据" width="480px" @update:model-value="$emit('update:visible', $event)">
    <el-form label-width="80px">
      <el-form-item label="导出范围">
        <el-radio-group v-model="exportRange">
          <el-radio value="current">当前页 ({{ instances.length }}条)</el-radio>
          <el-radio value="selected" :disabled="selectedIds.length === 0">已选择 ({{ selectedIds.length }}条)</el-radio>
          <el-radio value="all">全部 ({{ total }}条)</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="导出格式">
        <el-radio-group v-model="exportFormat">
          <el-radio value="csv">CSV</el-radio>
          <el-radio value="xlsx">Excel</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleExport">导出</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset';
import { ElMessage } from 'element-plus';
import { ref } from 'vue';

defineProps<{ visible: boolean; instances: Asset[]; selectedIds: number[]; total: number }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const exportRange = ref('current')
const exportFormat = ref('csv')

const handleExport = () => { ElMessage.success('导出功能开发中') }
</script>

<style lang="scss" scoped>
@import '@/views/storage/styles/export-dialog.scss';
</style>
