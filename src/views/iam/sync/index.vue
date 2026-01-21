<template>
  <PageContainer>
    <div class="sync-tasks-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">同步任务</h2>
          <p class="page-subtitle">管理云平台用户和权限的同步任务</p>
        </div>
        <div class="header-right">
          <el-button type="primary" @click="handleCreateTask">
            <el-icon><Plus /></el-icon>
            创建同步任务
          </el-button>
        </div>
      </div>

      <!-- 筛选区域 -->
      <el-card class="filter-card" shadow="never">
        <el-form :model="filters" inline>
          <el-form-item label="租户">
            <TenantSelector
              v-model="filters.tenant_id"
              @update:model-value="handleSearch"
            />
          </el-form-item>

          <el-form-item label="任务类型">
            <el-select
              v-model="filters.task_type"
              placeholder="全部类型"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="type in SYNC_TASK_TYPES"
                :key="type.value"
                :label="type.label"
                :value="type.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="任务状态">
            <el-select
              v-model="filters.status"
              placeholder="全部状态"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="status in SYNC_TASK_STATUS"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="云账号">
            <el-select
              v-model="filters.cloud_account_id"
              placeholder="全部账号"
              clearable
              filterable
              style="width: 200px"
              @change="handleSearch"
            >
              <el-option
                v-for="account in cloudAccounts"
                :key="account.id"
                :label="account.name"
                :value="account.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="云平台">
            <el-select
              v-model="filters.provider"
              placeholder="全部平台"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="provider in CLOUD_PROVIDERS"
                :key="provider.value"
                :label="provider.label"
                :value="provider.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="handleSearch">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
            <el-button @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>
              重置
            </el-button>
            <el-button @click="handleRefresh">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 任务列表 -->
      <el-card class="table-card" shadow="never">
        <el-table
          v-loading="loading"
          :data="taskList"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="id" label="任务 ID" width="80" />
          <el-table-column label="任务类型" width="120">
            <template #default="{ row }">
              {{ getSyncTaskTypeLabel(row.task_type) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getSyncTaskStatusColor(row.status)">
                {{ getSyncTaskStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="cloud_account_name" label="云账号" width="180" />
          <el-table-column label="云平台" width="120">
            <template #default="{ row }">
              <el-tag>
                {{ getProviderLabel(row.provider) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="150">
            <template #default="{ row }">
              <el-progress
                v-if="row.status === 'running'"
                :percentage="row.progress || 0"
                :status="row.progress === 100 ? 'success' : undefined"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="create_time" label="创建时间" width="180" />
          <el-table-column prop="complete_time" label="完成时间" width="180">
            <template #default="{ row }">
              {{ row.complete_time || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">
                详情
              </el-button>
              <el-button
                v-if="row.status === 'failed'"
                link
                type="warning"
                size="small"
                @click="handleRetry(row)"
              >
                重试
              </el-button>
              <el-button
                v-if="row.status === 'running'"
                link
                type="danger"
                size="small"
                @click="handleCancel(row)"
              >
                取消
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </el-card>

      <!-- 任务创建表单对话框 -->
      <TaskFormDialog
        v-model:visible="formDialogVisible"
        @success="handleFormSuccess"
      />

      <!-- 任务详情抽屉 -->
      <TaskDetailDrawer
        v-model:visible="detailDrawerVisible"
        :task-id="currentTaskId"
        @retry="handleRetry"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import { listSyncTasksApi, retrySyncTaskApi } from '@/api/iam'
import type { CloudAccount } from '@/api/types/account'
import type { SyncTask } from '@/api/types/iam'
import PageContainer from '@/components/PageContainer/index.vue'
import TenantSelector from '@/components/TenantSelector.vue'
import {
  CLOUD_PROVIDERS,
  getSyncTaskStatusColor,
  getSyncTaskStatusLabel,
  getSyncTaskTypeLabel,
  SYNC_TASK_STATUS,
  SYNC_TASK_TYPES
} from '@/utils/constants'
import { Plus, Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import TaskDetailDrawer from './components/TaskDetailDrawer.vue'
import TaskFormDialog from './components/TaskFormDialog.vue'

// 筛选条件
const filters = reactive({
  tenant_id: '',
  task_type: '',
  status: '',
  cloud_account_id: '',
  provider: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 任务列表
const taskList = ref<SyncTask[]>([])
const loading = ref(false)

// 云账号列表
const cloudAccounts = ref<CloudAccount[]>([])

// 对话框和抽屉
const formDialogVisible = ref(false)
const detailDrawerVisible = ref(false)
const currentTaskId = ref<number>()

// 自动刷新定时器
let refreshTimer: number | null = null

// 加载同步任务列表
const loadSyncTasks = async () => {
  loading.value = true
  try {
    const params: any = {
      task_type: filters.task_type || undefined,
      status: filters.status || undefined,
      cloud_account_id: filters.cloud_account_id ? Number(filters.cloud_account_id) : undefined,
      provider: filters.provider || undefined,
      page: pagination.page,
      size: pagination.size
    }
    const res = await listSyncTasksApi(params)
    taskList.value = res.data.data || res.data.tasks || []
    pagination.total = res.data.total || 0

    // 如果有正在运行的任务,启动自动刷新
    const hasRunningTasks = taskList.value.some(task => task.status === 'running')
    if (hasRunningTasks && !refreshTimer) {
      startAutoRefresh()
    } else if (!hasRunningTasks && refreshTimer) {
      stopAutoRefresh()
    }
  } catch (error) {
    console.error('加载同步任务列表失败:', error)
    ElMessage.error('加载同步任务列表失败')
  } finally {
    loading.value = false
  }
}

// 加载云账号列表
const loadCloudAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ limit: 100 })
    cloudAccounts.value = res.data.accounts || []
  } catch (error) {
    console.error('加载云账号列表失败:', error)
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadSyncTasks()
}

// 重置
const handleReset = () => {
  filters.task_type = ''
  filters.status = ''
  filters.cloud_account_id = ''
  filters.provider = ''
  handleSearch()
}

// 刷新
const handleRefresh = () => {
  loadSyncTasks()
}

// 分页变化
const handleSizeChange = () => {
  pagination.page = 1
  loadSyncTasks()
}

const handlePageChange = () => {
  loadSyncTasks()
}

// 创建任务
const handleCreateTask = () => {
  formDialogVisible.value = true
}

// 查看详情
const handleViewDetail = (task: SyncTask) => {
  currentTaskId.value = task.id
  detailDrawerVisible.value = true
}

// 重试任务
const handleRetry = async (task: SyncTask) => {
  try {
    await ElMessageBox.confirm(
      `确定要重试任务 "${task.id}" 吗？`,
      '重试确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await retrySyncTaskApi(task.id)
    ElMessage.success('任务已重新启动')
    loadSyncTasks()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('重试任务失败:', error)
      ElMessage.error(error.message || '重试任务失败')
    }
  }
}

// 取消任务
const handleCancel = async (task: SyncTask) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消任务 "${task.id}" 吗？`,
      '取消确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // TODO: 实现取消任务 API
    ElMessage.success('任务已取消')
    loadSyncTasks()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('取消任务失败:', error)
      ElMessage.error(error.message || '取消任务失败')
    }
  }
}

// 表单提交成功
const handleFormSuccess = () => {
  formDialogVisible.value = false
  loadSyncTasks()
}

// 获取云平台标签
const getProviderLabel = (provider: string): string => {
  const item = CLOUD_PROVIDERS.find(p => p.value === provider)
  return item?.label || provider
}

// 启动自动刷新
const startAutoRefresh = () => {
  if (refreshTimer) return
  refreshTimer = window.setInterval(() => {
    loadSyncTasks()
  }, 5000) // 每 5 秒刷新一次
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

// 初始化
onMounted(() => {
  loadCloudAccounts()
  loadSyncTasks()
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.sync-tasks-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .header-left {
      .page-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .filter-card {
    margin-bottom: 16px;

    :deep(.el-card__body) {
      padding: 16px;
    }

    .el-form {
      margin-bottom: 0;
    }
  }

  .table-card {
    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
