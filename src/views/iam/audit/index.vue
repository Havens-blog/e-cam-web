<template>
  <PageContainer>
    <div class="audit-logs-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">审计日志</h2>
          <p class="page-subtitle">查看和管理 IAM 操作的审计日志记录</p>
        </div>
        <div class="header-right">
          <el-button @click="handleExport">
            <el-icon><Download /></el-icon>
            导出日志
          </el-button>
          <el-button type="primary" @click="handleGenerateReport">
            <el-icon><Document /></el-icon>
            生成报告
          </el-button>
        </div>
      </div>

      <!-- 筛选区域 -->
      <el-card class="filter-card" shadow="never">
        <el-form :model="filters" inline>
          <el-form-item label="操作人">
            <el-input
              v-model="filters.operator"
              placeholder="搜索操作人"
              clearable
              style="width: 200px"
              @clear="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="操作类型">
            <el-select
              v-model="filters.operation_type"
              placeholder="全部类型"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="type in OPERATION_TYPES"
                :key="type.value"
                :label="type.label"
                :value="type.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="目标类型">
            <el-select
              v-model="filters.target_type"
              placeholder="全部目标"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="type in TARGET_TYPES"
                :key="type.value"
                :label="type.label"
                :value="type.value"
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

          <el-form-item label="租户">
            <el-select
              v-model="filters.tenant_id"
              placeholder="全部租户"
              clearable
              filterable
              style="width: 200px"
              @change="handleSearch"
            >
              <el-option
                v-for="tenant in tenants"
                :key="tenant.id"
                :label="tenant.display_name || tenant.name"
                :value="tenant.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="时间范围">
            <el-date-picker
              v-model="dateRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              style="width: 380px"
              @change="handleDateRangeChange"
            />
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
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 日志列表 -->
      <el-card class="table-card" shadow="never">
        <el-table
          v-loading="loading"
          :data="logList"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="operation_time" label="操作时间" width="180" />
          <el-table-column prop="operator" label="操作人" width="150" />
          <el-table-column label="操作类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getOperationTypeColor(row.operation_type)">
                {{ getOperationTypeLabel(row.operation_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="目标类型" width="120">
            <template #default="{ row }">
              {{ getTargetTypeLabel(row.target_type) }}
            </template>
          </el-table-column>
          <el-table-column prop="target_name" label="目标对象" width="180" />
          <el-table-column label="云平台" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.provider">
                {{ getProviderLabel(row.provider) }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作结果" width="100">
            <template #default="{ row }">
              <el-tag :type="row.result === 'success' ? 'success' : 'danger'">
                {{ row.result === 'success' ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="ip_address" label="IP 地址" width="140" />
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">
                详情
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

      <!-- 日志详情对话框 -->
      <LogDetailDialog
        v-model:visible="detailDialogVisible"
        :log="currentLog"
      />

      <!-- 导出对话框 -->
      <ExportDialog
        v-model:visible="exportDialogVisible"
        :filters="filters"
        @success="handleExportSuccess"
      />

      <!-- 报告生成对话框 -->
      <ReportDialog
        v-model:visible="reportDialogVisible"
        @success="handleReportSuccess"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { listAuditLogsApi, listTenantsApi } from '@/api/iam'
import type { AuditLog, Tenant } from '@/api/types/iam'
import PageContainer from '@/components/PageContainer/index.vue'
import { CLOUD_PROVIDERS, OPERATION_TYPES, TARGET_TYPES } from '@/utils/constants'
import { Document, Download, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import ExportDialog from './components/ExportDialog.vue'
import LogDetailDialog from './components/LogDetailDialog.vue'
import ReportDialog from './components/ReportDialog.vue'

// 筛选条件
const filters = reactive({
  operator: '',
  operation_type: '',
  target_type: '',
  provider: '',
  tenant_id: '',
  start_time: '',
  end_time: ''
})

// 日期范围
const dateRange = ref<[Date, Date] | null>(null)

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 日志列表
const logList = ref<AuditLog[]>([])
const loading = ref(false)

// 租户列表
const tenants = ref<Tenant[]>([])

// 对话框
const detailDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const reportDialogVisible = ref(false)
const currentLog = ref<AuditLog>()

// 加载审计日志列表
const loadAuditLogs = async () => {
  loading.value = true
  try {
    const params = {
      operator: filters.operator || undefined,
      operation_type: filters.operation_type || undefined,
      target_type: filters.target_type || undefined,
      provider: filters.provider || undefined,
      tenant_id: filters.tenant_id || undefined,
      start_time: filters.start_time || undefined,
      end_time: filters.end_time || undefined,
      page: pagination.page,
      size: pagination.size
    }
    const res = await listAuditLogsApi(params)
    logList.value = res.data.data || res.data.logs || []
    pagination.total = res.data.total || 0
  } catch (error) {
    console.error('加载审计日志失败:', error)
    ElMessage.error('加载审计日志失败')
  } finally {
    loading.value = false
  }
}

// 加载租户列表
const loadTenants = async () => {
  try {
    const res = await listTenantsApi({ size: 100 })
    tenants.value = res.data.data || []
  } catch (error) {
    console.error('加载租户列表失败:', error)
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadAuditLogs()
}

// 重置
const handleReset = () => {
  filters.operator = ''
  filters.operation_type = ''
  filters.target_type = ''
  filters.provider = ''
  filters.tenant_id = ''
  filters.start_time = ''
  filters.end_time = ''
  dateRange.value = null
  handleSearch()
}

// 日期范围变化
const handleDateRangeChange = (value: [Date, Date] | null) => {
  if (value) {
    filters.start_time = value[0].toISOString()
    filters.end_time = value[1].toISOString()
  } else {
    filters.start_time = ''
    filters.end_time = ''
  }
  handleSearch()
}

// 分页变化
const handleSizeChange = () => {
  pagination.page = 1
  loadAuditLogs()
}

const handlePageChange = () => {
  loadAuditLogs()
}

// 查看详情
const handleViewDetail = (log: AuditLog) => {
  currentLog.value = log
  detailDialogVisible.value = true
}

// 导出日志
const handleExport = () => {
  exportDialogVisible.value = true
}

// 生成报告
const handleGenerateReport = () => {
  reportDialogVisible.value = true
}

// 导出成功
const handleExportSuccess = () => {
  ElMessage.success('导出成功')
}

// 报告生成成功
const handleReportSuccess = () => {
  ElMessage.success('报告生成成功')
}

// 获取操作类型标签
const getOperationTypeLabel = (type: string): string => {
  const item = OPERATION_TYPES.find(t => t.value === type)
  return item?.label || type
}

// 获取操作类型颜色
const getOperationTypeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    create: 'success',
    update: 'warning',
    delete: 'danger',
    query: 'info',
    sync: 'primary'
  }
  return colorMap[type] || 'info'
}

// 获取目标类型标签
const getTargetTypeLabel = (type: string): string => {
  const item = TARGET_TYPES.find(t => t.value === type)
  return item?.label || type
}

// 获取云平台标签
const getProviderLabel = (provider: string): string => {
  const item = CLOUD_PROVIDERS.find(p => p.value === provider)
  return item?.label || provider
}

// 初始化
onMounted(() => {
  loadTenants()
  loadAuditLogs()
})
</script>

<style scoped lang="scss">
.audit-logs-page {
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

    .header-right {
      display: flex;
      gap: 8px;
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
