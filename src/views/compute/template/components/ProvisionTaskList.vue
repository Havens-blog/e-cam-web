<template>
  <div class="provision-task-list">
    <!-- 筛选栏 -->
    <div class="filters">
      <el-select v-model="filterSource" placeholder="创建方式" clearable style="width: 130px" @change="loadTasks">
        <el-option label="模板创建" value="from_template" />
        <el-option label="直接创建" value="direct" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="任务状态" clearable style="width: 130px; margin-left: 8px" @change="loadTasks">
        <el-option label="待执行" value="pending" />
        <el-option label="执行中" value="running" />
        <el-option label="成功" value="success" />
        <el-option label="部分成功" value="partial_success" />
        <el-option label="失败" value="failed" />
      </el-select>
      <el-button style="margin-left: 8px" @click="loadTasks">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <!-- 任务列表 -->
    <el-table :data="safeTasks" v-loading="loading" stripe style="width: 100%; margin-top: 12px">
      <el-table-column label="创建方式" width="100">
        <template #default="{ row }">
          <el-tag :type="row?.source === 'from_template' ? 'primary' : 'success'" size="small">
            {{ row?.source === 'from_template' ? '模板' : '直接' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="count" label="数量" width="70" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="safeTagType(statusTagType(row?.status))" size="small">{{ statusLabel(row?.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="100">
        <template #default="{ row }">
          {{ row?.success_count || 0 }}/{{ row?.count || 0 }}
        </template>
      </el-table-column>
      <el-table-column prop="message" label="消息" min-width="200" show-overflow-tooltip />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ row?.created_at ? new Date(row.created_at).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link @click="$emit('viewDetail', row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadTasks"
        @current-change="loadTasks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { listProvisionTasksApi } from '@/api/template'
import type { ProvisionTask } from '@/api/types/template'
import { safeTagType } from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'

defineEmits<{
  (e: 'viewDetail', task: ProvisionTask): void
}>()

const loading = ref(false)
const tasks = ref<ProvisionTask[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const filterSource = ref('')
const filterStatus = ref('')

const safeTasks = computed(() =>
  (tasks.value || []).filter(item => item != null)
)

function statusTagType(status?: string): string {
  const map: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    success: 'success',
    partial_success: 'warning',
    failed: 'danger'
  }
  return map[status || ''] || 'info'
}

function statusLabel(status?: string): string {
  const map: Record<string, string> = {
    pending: '待执行',
    running: '执行中',
    success: '成功',
    partial_success: '部分成功',
    failed: '失败'
  }
  return map[status || ''] || status || '-'
}

async function loadTasks() {
  loading.value = true
  try {
    const res = await listProvisionTasksApi({
      source: filterSource.value || undefined,
      status: filterStatus.value || undefined,
      offset: (currentPage.value - 1) * pageSize.value,
      limit: pageSize.value
    })
    const data = res?.data
    tasks.value = data?.items || []
    total.value = data?.total || 0
  } catch {
    ElMessage.error('加载任务列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.filters {
  display: flex;
  align-items: center;
}
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
