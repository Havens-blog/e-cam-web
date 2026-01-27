<template>
  <PageContainer>
    <ManagerHeader
      title="任务管理"
      subtitle="查看和管理异步任务"
      @refresh="fetchTasks"
    />

    <div class="tasks-content">
      <!-- 筛选器 -->
      <div class="filters-container">
        <el-form :inline="true" class="filters-form">
          <el-form-item label="任务类型">
            <el-select
              v-model="filters.type"
              placeholder="全部类型"
              clearable
              @change="handleFilterChange"
            >
              <el-option label="同步资产" value="sync_assets" />
              <el-option label="发现资产" value="discover_assets" />
            </el-select>
          </el-form-item>
          <el-form-item label="任务状态">
            <el-select
              v-model="filters.status"
              placeholder="全部状态"
              clearable
              @change="handleFilterChange"
            >
              <el-option label="等待中" value="pending" />
              <el-option label="运行中" value="running" />
              <el-option label="已完成" value="completed" />
              <el-option label="失败" value="failed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <!-- 任务列表 -->
      <div v-loading="loading" class="tasks-list">
        <template v-if="tasks.length > 0">
          <TaskCard
            v-for="task in tasks"
            :key="task.id"
            :task="task"
            @view="handleView"
            @cancel="handleCancel"
            @delete="handleDelete"
          />
        </template>
        <el-empty v-else description="暂无任务" />
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchTasks"
          @current-change="fetchTasks"
        />
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { cancelTaskApi, deleteTaskApi, listTasksApi } from '@/api'
import type { Task } from '@/api/types/task'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import TaskCard from './components/TaskCard.vue'

const router = useRouter()

// 状态
const loading = ref(false)
const tasks = ref<Task[]>([])
const filters = reactive({
  type: '',
  status: '',
})
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 自动刷新
let refreshTimer: number | null = null

// 获取任务列表
const fetchTasks = async () => {
  loading.value = true
  try {
    const params = {
      type: (filters.type as any) || undefined,
      status: (filters.status as any) || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    const { data } = await listTasksApi(params)
    tasks.value = data.tasks
    pagination.total = data.total
  } catch (error: any) {
    ElMessage.error(error.message || '获取任务列表失败')
  } finally {
    loading.value = false
  }
}

// 筛选变化
const handleFilterChange = () => {
  pagination.page = 1
  fetchTasks()
}

// 查看任务详情
const handleView = (task: Task) => {
  router.push(`/tasks/${task.id}`)
}

// 取消任务
const handleCancel = async (task: Task) => {
  try {
    await ElMessageBox.confirm(`确定要取消任务"${task.id}"吗？`, '确认取消', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    await cancelTaskApi(task.id)
    ElMessage.success('任务已取消')
    fetchTasks()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '取消任务失败')
    }
  }
}

// 删除任务
const handleDelete = async (task: Task) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除任务"${task.id}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deleteTaskApi(task.id)
    ElMessage.success('删除成功')
    fetchTasks()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 启动自动刷新
const startAutoRefresh = () => {
  // 如果有运行中的任务,每5秒刷新一次
  const hasRunningTasks = tasks.value.some(
    (task) => task.status === 'running' || task.status === 'pending'
  )
  if (hasRunningTasks) {
    refreshTimer = window.setTimeout(() => {
      fetchTasks().then(() => {
        startAutoRefresh()
      })
    }, 5000)
  }
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

// 初始化
onMounted(() => {
  fetchTasks().then(() => {
    startAutoRefresh()
  })
})

// 清理
onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.tasks-content {
  .filters-container {
    margin-bottom: 20px;
    padding: 16px 20px;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    transition: background-color 0.3s ease, border-color 0.3s ease;

    .filters-form {
      margin: 0;

      :deep(.el-form-item) {
        margin-bottom: 0;
      }
    }
  }

  .tasks-list {
    min-height: 200px;
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    padding: 16px;
    margin-top: 20px;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    transition: background-color 0.3s ease, border-color 0.3s ease;
  }
}
</style>
