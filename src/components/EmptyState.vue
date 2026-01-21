<template>
  <div class="empty-state">
    <el-empty :description="description" :image-size="imageSize">
      <template v-if="showAddButton || showClearFilter" #default>
        <el-button v-if="showAddButton" type="primary" @click="$emit('add')">
          <el-icon><Plus /></el-icon>
          {{ addButtonText }}
        </el-button>
        <el-button v-if="showClearFilter" @click="$emit('clear-filter')">
          <el-icon><Refresh /></el-icon>
          清除筛选
        </el-button>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { Plus, Refresh } from '@element-plus/icons-vue'

interface Props {
  description?: string
  imageSize?: number
  showAddButton?: boolean
  showClearFilter?: boolean
  addButtonText?: string
}

withDefaults(defineProps<Props>(), {
  description: '暂无数据',
  imageSize: 200,
  showAddButton: false,
  showClearFilter: false,
  addButtonText: '添加'
})

defineEmits<{
  (e: 'add'): void
  (e: 'clear-filter'): void
}>()
</script>

<style scoped lang="scss">
.empty-state {
  padding: 40px 0;
  text-align: center;

  :deep(.el-empty__description) {
    color: var(--text-tertiary);
  }

  :deep(.el-empty__image) {
    opacity: 0.6;
  }
}
</style>
