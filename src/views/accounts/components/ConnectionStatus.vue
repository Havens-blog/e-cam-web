<template>
  <div class="connection-status">
    <el-tooltip :content="statusText" placement="bottom">
      <div class="status-indicator" :class="statusClass" @click="showDialog">
        <span class="status-dot" />
        <span class="status-text">{{ statusText }}</span>
      </div>
    </el-tooltip>

    <el-dialog v-model="dialogVisible" title="连接详情" width="500px">
      <div class="connection-details">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="状态">
            <el-tag :type="isConnected ? 'success' : 'danger'">
              {{ isConnected ? '已连接' : '未连接' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="API 地址">
            {{ apiUrl }}
          </el-descriptions-item>
          <el-descriptions-item label="最后检查">
            {{ lastCheckTime }}
          </el-descriptions-item>
          <el-descriptions-item v-if="errorMessage" label="错误信息">
            {{ errorMessage }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="checkConnection">重新检查</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { getFullApiUrl } from '@/utils/api-validator'
import { computed, onMounted, ref } from 'vue'

const isConnected = ref<boolean | null>(null)
const isChecking = ref(false)
const dialogVisible = ref(false)
const errorMessage = ref('')
const lastCheckTime = ref('')

const apiUrl = computed(() => getFullApiUrl('/cloud-accounts'))

const statusClass = computed(() => {
  if (isChecking.value) return 'checking'
  if (isConnected.value === null) return 'unknown'
  return isConnected.value ? 'connected' : 'disconnected'
})

const statusText = computed(() => {
  if (isChecking.value) return '检查中...'
  if (isConnected.value === null) return '未知'
  return isConnected.value ? 'API 已连接' : 'API 未连接'
})

const showDialog = () => {
  dialogVisible.value = true
}

const checkConnection = async () => {
  isChecking.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`${apiUrl.value}?offset=0&limit=1`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    isConnected.value = response.ok
    lastCheckTime.value = new Date().toLocaleString('zh-CN')

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      errorMessage.value = `HTTP ${response.status}: ${errorText}`
    }
  } catch (error: any) {
    isConnected.value = false
    errorMessage.value = error.message || '连接失败'
    lastCheckTime.value = new Date().toLocaleString('zh-CN')
  } finally {
    isChecking.value = false
  }
}

onMounted(() => {
  checkConnection()
})
</script>

<style scoped lang="scss">
.connection-status {
  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: calc(0.3rem + 0.05vw);
    padding: calc(0.3rem + 0.05vw) calc(0.6rem + 0.1vw);
    border-radius: calc(0.8rem + 0.15vw);
    font-size: calc(0.65rem + 0.08vw);
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      opacity: 0.8;
    }

    .status-dot {
      width: calc(0.4rem + 0.08vw);
      height: calc(0.4rem + 0.08vw);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    &.connected {
      background: #f0f9ff;
      color: #10b981;

      .status-dot {
        background: #10b981;
      }
    }

    &.disconnected {
      background: #fef2f2;
      color: #ef4444;

      .status-dot {
        background: #ef4444;
      }
    }

    &.checking {
      background: #fffbeb;
      color: #f59e0b;

      .status-dot {
        background: #f59e0b;
      }
    }

    &.unknown {
      background: #f3f4f6;
      color: #6b7280;

      .status-dot {
        background: #6b7280;
      }
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.connection-details {
  padding: calc(1rem + 0.2vw);
}
</style>
