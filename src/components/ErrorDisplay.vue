<template>
  <div class="error-display">
    <el-alert
      :title="errorInfo.message || '操作失败'"
      type="error"
      :closable="false"
      show-icon
    >
      <template #default>
        <div class="error-details">
          <p v-if="errorInfo.code">错误代码: {{ errorInfo.code }}</p>
          <p v-if="apiUrl">请求地址: {{ apiUrl }}</p>
          <div class="error-actions">
            <el-button size="small" @click="$emit('retry')">
              <el-icon><Refresh /></el-icon>
              重试
            </el-button>
          </div>
        </div>
      </template>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import { Refresh } from '@element-plus/icons-vue'

interface Props {
  errorInfo: {
    message: string
    code?: string | number
  }
  apiUrl?: string
}

defineProps<Props>()

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<style scoped lang="scss">
.error-display {
  margin-bottom: 16px;

  .error-details {
    p {
      margin: 4px 0;
      font-size: 14px;
      color: #606266;
    }

    .error-actions {
      margin-top: 12px;
    }
  }
}
</style>
