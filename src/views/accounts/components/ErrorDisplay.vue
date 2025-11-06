<template>
  <div class="error-display">
    <el-alert
      :title="errorInfo.message"
      :type="getAlertType()"
      :description="errorInfo.details"
      show-icon
      :closable="false"
    >
      <template #default>
        <div class="error-content">
          <p v-if="errorInfo.suggestion" class="suggestion">
            💡 {{ errorInfo.suggestion }}
          </p>

          <div v-if="showDetails && isDev" class="error-details">
            <el-divider />
            <p><strong>错误类型:</strong> {{ errorInfo.type }}</p>
            <p v-if="apiUrl"><strong>请求地址:</strong> {{ apiUrl }}</p>
          </div>

          <div class="error-actions">
            <el-button
              v-if="errorInfo.canRetry"
              type="primary"
              size="small"
              @click="$emit('retry')"
            >
              重试
            </el-button>
            <el-button
              v-if="errorInfo.type === 'auth'"
              type="warning"
              size="small"
              @click="handleRelogin"
            >
              重新登录
            </el-button>
            <el-button v-if="isDev" size="small" @click="showDetails = !showDetails">
              {{ showDetails ? '隐藏' : '显示' }}详情
            </el-button>
          </div>
        </div>
      </template>
    </el-alert>
  </div>
</template>

<script setup lang="ts">
import type { ErrorInfo } from '@/utils/error-handler';
import { computed, ref } from 'vue';

interface Props {
  errorInfo: ErrorInfo
  apiUrl?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  retry: []
}>()

const showDetails = ref(false)
const isDev = computed(() => import.meta.env.DEV)

const getAlertType = () => {
  switch (props.errorInfo.type) {
    case 'auth':
      return 'warning'
    case 'network':
    case 'timeout':
      return 'error'
    case 'server':
      return 'error'
    default:
      return 'error'
  }
}

const handleRelogin = () => {
  window.location.href = '/login'
}
</script>

<style scoped lang="scss">
.error-display {
  margin: calc(1rem + 0.2vw) 0;

  .error-content {
    margin-top: calc(0.5rem + 0.1vw);

    .suggestion {
      margin: calc(0.5rem + 0.1vw) 0;
      padding: calc(0.5rem + 0.1vw);
      background: rgba(255, 255, 255, 0.5);
      border-radius: calc(0.2rem + 0.05vw);
      font-size: calc(0.7rem + 0.1vw);
    }

    .error-details {
      font-size: calc(0.65rem + 0.08vw);
      color: #666;

      p {
        margin: calc(0.3rem + 0.05vw) 0;
      }
    }

    .error-actions {
      margin-top: calc(0.8rem + 0.15vw);
      display: flex;
      gap: calc(0.5rem + 0.1vw);
    }
  }
}
</style>
