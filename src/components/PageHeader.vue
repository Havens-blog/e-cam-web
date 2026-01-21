<template>
  <div class="page-header">
    <div class="page-header-left">
      <el-button
        v-if="showBack"
        type="text"
        class="back-button"
        @click="handleBack"
      >
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      
      <div class="header-content">
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="description" class="page-description">{{ description }}</p>
      </div>
    </div>

    <div class="page-header-right">
      <slot name="actions">
        <el-button
          v-if="showRefresh"
          :loading="refreshLoading"
          @click="handleRefresh"
        >
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        
        <el-button
          v-if="showExport"
          :loading="exportLoading"
          @click="handleExport"
        >
          <el-icon><Download /></el-icon>
          导出
        </el-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, Download, Refresh } from '@element-plus/icons-vue'
import { ref } from 'vue'

interface Props {
  title: string
  description?: string
  showBack?: boolean
  showRefresh?: boolean
  showExport?: boolean
}

interface Emits {
  (e: 'back'): void
  (e: 'refresh'): void
  (e: 'export'): void
}

withDefaults(defineProps<Props>(), {
  showBack: false,
  showRefresh: false,
  showExport: false
})

const emit = defineEmits<Emits>()

const refreshLoading = ref(false)
const exportLoading = ref(false)

const handleBack = () => {
  emit('back')
}

const handleRefresh = async () => {
  refreshLoading.value = true
  try {
    emit('refresh')
  } finally {
    setTimeout(() => {
      refreshLoading.value = false
    }, 500)
  }
}

const handleExport = async () => {
  exportLoading.value = true
  try {
    emit('export')
  } finally {
    setTimeout(() => {
      exportLoading.value = false
    }, 500)
  }
}
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 0;
  margin-bottom: 20px;
  border-bottom: 1px solid #e4e7ed;

  .page-header-left {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex: 1;

    .back-button {
      padding: 8px 12px;
      font-size: 14px;
      
      .el-icon {
        margin-right: 4px;
      }
    }

    .header-content {
      flex: 1;

      .page-title {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #303133;
        line-height: 1.4;
      }

      .page-description {
        margin: 8px 0 0;
        font-size: 14px;
        color: #909399;
        line-height: 1.5;
      }
    }
  }

  .page-header-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }
}
</style>
