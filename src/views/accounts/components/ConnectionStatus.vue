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

const apiUrl = computed(() => getFullApiUrl('/cam/cloud-accounts'))

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
    gap: 6px;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      opacity: 0.8;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    &.connected {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);

      .status-dot {
        background: var(--accent-green);
      }
    }

    &.disconnected {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);

      .status-dot {
        background: var(--accent-red);
      }
    }

    &.checking {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-yellow);

      .status-dot {
        background: var(--accent-yellow);
      }
    }

    &.unknown {
      background: rgba(113, 113, 122, 0.15);
      color: var(--text-tertiary);

      .status-dot {
        background: var(--text-tertiary);
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
  padding: 16px;
}
</style>
