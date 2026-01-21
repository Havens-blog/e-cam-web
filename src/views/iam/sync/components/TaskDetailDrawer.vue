<template>
  <el-drawer
    v-model="drawerVisible"
    title="同步任务详情"
    size="600px"
    :close-on-click-modal="false"
  >
    <div v-loading="loading" class="task-detail">
      <template v-if="task">
        <!-- 操作按钮 -->
        <div class="action-bar">
          <el-button
            v-if="task.status === 'failed'"
            type="warning"
            @click="handleRetry"
          >
            <el-icon><Refresh /></el-icon>
            重试任务
          </el-button>
          <el-button @click="loadTaskDetail">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>

        <!-- 基本信息 -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>基本信息</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="任务 ID">{{ task.id }}</el-descriptions-item>
            <el-descriptions-item label="任务类型">
              {{ getSyncTaskTypeLabel(task.task_type) }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getSyncTaskStatusColor(task.status)">
                {{ getSyncTaskStatusLabel(task.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="云平台">
              <el-tag>{{ getProviderLabel(task.provider) }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="云账号" :span="2">
              {{ task.cloud_account_name }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ task.create_time }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ task.complete_time || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 执行进度 -->
        <el-card v-if="task.status === 'running'" class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>执行进度</span>
            </div>
          </template>
          <div class="progress-section">
            <el-progress
              :percentage="task.progress || 0"
              :status="task.progress === 100 ? 'success' : undefined"
            />
            <div class="progress-text">
              {{ task.progress || 0 }}% 完成
            </div>
          </div>
        </el-card>

        <!-- 执行结果 -->
        <el-card v-if="task.result" class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>执行结果</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="成功数量">
              {{ task.result.success_count || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="失败数量">
              {{ task.result.failed_count || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="跳过数量">
              {{ task.result.skipped_count || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="总数量">
              {{ task.result.total_count || 0 }}
            </el-descriptions-item>
          </el-descriptions>

          <!-- 详细信息 -->
          <div v-if="task.result.details" class="result-details">
            <h4>详细信息</h4>
            <el-input
              :model-value="formatJSON(task.result.details)"
              type="textarea"
              :rows="8"
              readonly
            />
          </div>
        </el-card>

        <!-- 错误信息 -->
        <el-card v-if="task.error_message" class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>错误信息</span>
            </div>
          </template>
          <el-alert
            :title="task.error_message"
            type="error"
            :closable="false"
            show-icon
          />
        </el-card>

        <!-- 任务配置 -->
        <el-card v-if="task.config" class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>任务配置</span>
            </div>
          </template>
          <el-input
            :model-value="formatJSON(task.config)"
            type="textarea"
            :rows="8"
            readonly
          />
        </el-card>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { getSyncTaskStatusApi } from '@/api/iam'
import type { SyncTask } from '@/api/types/iam'
import {
    CLOUD_PROVIDERS,
    getSyncTaskStatusColor,
    getSyncTaskStatusLabel,
    getSyncTaskTypeLabel
} from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { computed, onUnmounted, ref, watch } from 'vue'

interface Props {
  visible: boolean
  taskId?: number
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'retry', task: SyncTask): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const loading = ref(false)
const task = ref<SyncTask>()

// 自动刷新定时器
let refreshTimer: number | null = null

// 加载任务详情
const loadTaskDetail = async () => {
  if (!props.taskId) return

  loading.value = true
  try {
    const res = await getSyncTaskStatusApi(props.taskId)
    task.value = res.data

    // 如果任务正在运行,启动自动刷新
    if (task.value.status === 'running' && !refreshTimer) {
      startAutoRefresh()
    } else if (task.value.status !== 'running' && refreshTimer) {
      stopAutoRefresh()
    }
  } catch (error) {
    console.error('加载任务详情失败:', error)
  } finally {
    loading.value = false
  }
}

// 监听 taskId 变化
watch(
  () => props.taskId,
  () => {
    if (props.visible && props.taskId) {
      loadTaskDetail()
    }
  },
  { immediate: true }
)

// 监听抽屉关闭
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      stopAutoRefresh()
    } else if (visible && props.taskId) {
      loadTaskDetail()
    }
  }
)

// 格式化 JSON
const formatJSON = (data: any): string => {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

// 获取云平台标签
const getProviderLabel = (provider: string): string => {
  const item = CLOUD_PROVIDERS.find(p => p.value === provider)
  return item?.label || provider
}

// 重试任务
const handleRetry = () => {
  if (task.value) {
    emit('retry', task.value)
  }
}

// 启动自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) return
  refreshTimer = window.setInterval(() => {
    loadTaskDetail()
  }, 3000) // 每 3 秒刷新一次
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 清理
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.task-detail {
  .action-bar {
    margin-bottom: 16px;
    display: flex;
    gap: 8px;
  }

  .info-card {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .card-header {
      font-weight: 600;
    }
  }

  .progress-section {
    padding: 16px;

    .progress-text {
      margin-top: 12px;
      text-align: center;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }

  .result-details {
    margin-top: 16px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}
</style>
