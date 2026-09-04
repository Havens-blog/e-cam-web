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
      <!-- S-C12：导出为假功能（原实现仅弹 success 提示，属误导反馈），按主题 B 决策禁用 + tooltip；
           handleExport 保留但在入口禁用后不可达，接真实导出 API 时再放开 -->
      <el-tooltip content="功能开发中" placement="top">
        <el-button type="primary" disabled @click="handleExport">导出</el-button>
      </el-tooltip>
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
