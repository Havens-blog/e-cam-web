<template>
  <PageContainer>
    <ManagerHeader
      title="采集管理"
      subtitle="手动触发云账单数据采集"
      :show-add-button="false"
      @refresh="fetchLogs"
    />

    <!-- 触发采集 -->
    <div class="collect-trigger">
      <el-form :inline="true" :model="collectForm" class="collect-form">
        <el-form-item label="云账号" required>
          <el-select
            v-model="collectForm.account_id"
            placeholder="选择云账号"
            filterable
            style="width: 200px"
          >
            <el-option
              v-for="a in accountOptions"
              :key="a.value"
              :label="a.label"
              :value="a.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="账期范围" required>
          <el-date-picker
            v-model="collectDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :shortcuts="dateShortcuts"
            style="width: 280px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="collecting" @click="handleCollect">
            触发采集
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 采集日志 -->
    <div class="logs-section">
      <div class="section-header">
        <span class="section-title">采集日志</span>
        <el-button size="small" circle @click="fetchLogs" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
      <el-table :data="logs" v-loading="logsLoading" stripe style="width: 100%">
        <el-table-column prop="account_id" label="账号 ID" width="100" />
        <el-table-column prop="provider" label="云厂商" width="100">
          <template #default="{ row }">
            {{ getProviderLabel(row.provider) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="账期范围" width="220">
          <template #default="{ row }">
            {{ formatDate(row.bill_start) }} ~ {{ formatDate(row.bill_end) }}
          </template>
        </el-table-column>
        <el-table-column prop="record_count" label="记录数" width="100" />
        <el-table-column prop="duration_ms" label="耗时" width="100">
          <template #default="{ row }">
            {{ row.duration_ms > 0 ? (row.duration_ms / 1000).toFixed(1) + 's' : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="error_msg" label="错误信息" min-width="200" show-overflow-tooltip />
        <el-table-column label="采集时间" width="180">
          <template #default="{ row }">
            {{ formatTimestamp(row.create_time) }}
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="fetchLogs"
        />
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import { listCollectLogsApi, triggerCollectApi } from '@/api/finops'
import type { CollectLog } from '@/api/types/finops'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { getProviderLabel } from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const collectForm = reactive({ account_id: undefined as number | undefined })
const collectDateRange = ref<[string, string] | null>(null)
const collecting = ref(false)

const accountOptions = ref<{ value: number; label: string }[]>([])

const logs = ref<CollectLog[]>([])
const logsLoading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
const pollTimer = ref<ReturnType<typeof setInterval> | null>(null)

const dateShortcuts = [
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth(), 1), now]
    }
  },
  {
    text: '上月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)]
    }
  },
  {
    text: '近3个月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 3, 1), now]
    }
  }
]

const statusType = (s: string) => {
  if (s === 'success') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'running') return 'warning'
  return 'info'
}

const statusLabel = (s: string) => {
  const map: Record<string, string> = { success: '成功', failed: '失败', running: '运行中' }
  return map[s] || s
}

const formatDate = (v: string) => {
  if (!v) return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10)
}

const formatTimestamp = (ts: number) => {
  if (!ts) return '-'
  const d = new Date(ts > 1e12 ? ts : ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const handleCollect = async () => {
  if (!collectForm.account_id) {
    ElMessage.warning('请选择云账号')
    return
  }
  if (!collectDateRange.value) {
    ElMessage.warning('请选择账期范围')
    return
  }
  collecting.value = true
  try {
    const [start, end] = collectDateRange.value
    await triggerCollectApi({
      account_id: collectForm.account_id,
      start_date: start,
      end_date: end
    })
    ElMessage.success('采集任务已提交，后台执行中')
    // 开始轮询采集状态
    startPolling()
    setTimeout(() => fetchLogs(), 1000)
  } catch (e: any) {
    ElMessage.error(e.message || '触发采集失败')
  } finally {
    collecting.value = false
  }
}

const fetchLogs = async () => {
  logsLoading.value = true
  try {
    const res = await listCollectLogsApi({
      offset: (currentPage.value - 1) * pageSize,
      limit: pageSize
    })
    const data = (res as any).data || res
    logs.value = data.items || []
    total.value = data.total || 0

    // 如果没有 running 状态的任务，停止轮询
    const hasRunning = logs.value.some((l: CollectLog) => l.status === 'running')
    if (!hasRunning) {
      stopPolling()
    }
  } catch {
    logs.value = []
  } finally {
    logsLoading.value = false
  }
}

const startPolling = () => {
  stopPolling()
  pollTimer.value = setInterval(() => fetchLogs(), 5000)
}

const stopPolling = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
}

const fetchAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ limit: 100, offset: 0 })
    const data = (res as any).data || res
    const list = data.accounts || data.items || []
    accountOptions.value = list.map((a: any) => ({
      value: a.id,
      label: `${a.name} (${getProviderLabel(a.provider)})`
    }))
  } catch {
    accountOptions.value = []
  }
}

onMounted(() => {
  fetchAccounts()
  fetchLogs()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped lang="scss">
.collect-trigger {
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  margin-bottom: 16px;

  .collect-form {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;

    :deep(.el-form-item) {
      margin-bottom: 0;
      margin-right: 0;
    }
  }
}

.logs-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
