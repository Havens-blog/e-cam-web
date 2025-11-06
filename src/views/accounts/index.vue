<template>
  <PageContainer>
    <ManagerHeader
      title="云账号管理"
      subtitle="管理多云平台的访问账号和配置"
      @refresh="handleRefresh"
    >
      <template #actions>
        <ConnectionStatus />
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          添加账号
        </el-button>
      </template>
    </ManagerHeader>

    <!-- 错误显示 -->
    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      :api-url="apiUrl"
      @retry="fetchAccounts"
    />

    <!-- 缓存数据警告 -->
    <el-alert
      v-if="usingCache"
      type="warning"
      :closable="false"
      show-icon
      class="cache-warning"
    >
      <template #title> 正在显示缓存数据（{{ cacheTime }}） </template>
    </el-alert>

    <!-- 筛选器 -->
    <div v-if="!errorInfo" class="filters-container">
      <el-form :inline="true" class="filters-form">
        <el-form-item label="云厂商">
          <el-select
            v-model="filters.provider"
            placeholder="全部"
            clearable
            @change="handleFilterChange"
          >
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="环境">
          <el-select
            v-model="filters.environment"
            placeholder="全部"
            clearable
            @change="handleFilterChange"
          >
            <el-option
              v-for="e in ENVIRONMENTS"
              :key="e.value"
              :label="e.label"
              :value="e.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部"
            clearable
            @change="handleFilterChange"
          >
            <el-option
              v-for="s in ACCOUNT_STATUS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <!-- 账号卡片列表 -->
    <div
      v-if="!errorInfo && accounts.length > 0"
      v-loading="loading"
      :element-loading-text="loadingMessage"
      class="accounts-grid"
    >
      <AccountCard
        v-for="account in accounts"
        :key="account.id"
        :account="account"
        @edit="handleEdit"
        @delete="handleDelete"
        @test="handleTestConnection"
        @sync="handleSync"
        @toggle-status="handleToggleStatus"
      />
    </div>

    <!-- 加载状态（当没有数据时） -->
    <div
      v-if="!errorInfo && loading && accounts.length === 0"
      v-loading="loading"
      :element-loading-text="loadingMessage"
      class="loading-placeholder"
    />

    <!-- 空状态 -->
    <EmptyState
      v-if="!errorInfo && !loading && accounts.length === 0"
      :description="hasFilters ? '没有符合条件的账号' : '暂无云账号'"
      :show-add-button="!hasFilters"
      :show-clear-filter="!!hasFilters"
      :show-tips="!hasFilters"
      @add="handleAdd"
      @clear-filter="clearFilters"
    />

    <!-- 分页 -->
    <div v-if="!errorInfo && pagination.total > 0" class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="fetchAccounts"
        @current-change="fetchAccounts"
      />
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <AccountForm ref="formRef" :account="currentAccount" :is-edit="isEdit" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import {
  deleteCloudAccountApi,
  disableCloudAccountApi,
  enableCloudAccountApi,
  listCloudAccountsApi,
  syncCloudAccountApi,
  testConnectionApi,
} from '@/api'
import type { CloudAccount } from '@/api/types/account'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { getFullApiUrl } from '@/utils/api-validator'
import { cacheManager } from '@/utils/cache-manager'
import { ACCOUNT_STATUS, CLOUD_PROVIDERS, ENVIRONMENTS } from '@/utils/constants'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logApiConfig, logError } from '@/utils/error-logger'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import AccountCard from './components/AccountCard.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import EmptyState from './components/EmptyState.vue'
import ErrorDisplay from './components/ErrorDisplay.vue'
import AccountForm from './form.vue'

// 状态
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentAccount = ref<CloudAccount | null>(null)
const errorInfo = ref<ErrorInfo | null>(null)
const usingCache = ref(false)
const cacheTime = ref('')
const loadingMessage = ref('')
const loadingTimeout = ref<number | null>(null)
const longLoadingTimeout = ref<number | null>(null)

// 数据
const accounts = ref<CloudAccount[]>([])
const filters = reactive({
  provider: '' as string,
  environment: '' as string,
  status: '' as string,
})
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 计算属性
const dialogTitle = computed(() => (isEdit.value ? '编辑云账号' : '添加云账号'))
const apiUrl = computed(() => getFullApiUrl('/cloud-accounts'))
const hasFilters = computed(
  () => filters.provider || filters.environment || filters.status
)

// 获取账号列表
const fetchAccounts = async () => {
  loading.value = true
  errorInfo.value = null
  usingCache.value = false
  loadingMessage.value = ''

  // 设置加载超时提示
  loadingTimeout.value = setTimeout(() => {
    loadingMessage.value = '加载中，请稍候...'
  }, 3000)

  longLoadingTimeout.value = setTimeout(() => {
    loadingMessage.value = '加载时间较长，请检查网络连接'
  }, 10000)

  try {
    const params = {
      provider: filters.provider || undefined,
      environment: filters.environment || undefined,
      status: filters.status || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }

    const { data } = await listCloudAccountsApi(params)
    accounts.value = data.accounts
    pagination.total = data.total

    // 缓存成功的响应
    const cacheKey = 'cloud-accounts'
    cacheManager.set(cacheKey, { accounts: data.accounts, total: data.total })
  } catch (error: any) {
    // 记录错误
    logError(error, 'fetchAccounts')

    // 处理错误
    errorInfo.value = handleApiError(error, '获取账号列表失败')

    // 尝试使用缓存数据
    const cacheKey = 'cloud-accounts'
    const cached = cacheManager.get<{ accounts: CloudAccount[]; total: number }>(
      cacheKey
    )

    if (cached) {
      accounts.value = cached.data.accounts
      pagination.total = cached.data.total
      usingCache.value = true

      const timestamp = cacheManager.getTimestamp(cacheKey)
      if (timestamp) {
        cacheTime.value = timestamp.toLocaleString('zh-CN')
      }

      ElMessage.warning('使用缓存数据，可能不是最新的')
    }
  } finally {
    loading.value = false
    loadingMessage.value = ''

    // 清除超时定时器
    if (loadingTimeout.value) {
      clearTimeout(loadingTimeout.value)
      loadingTimeout.value = null
    }
    if (longLoadingTimeout.value) {
      clearTimeout(longLoadingTimeout.value)
      longLoadingTimeout.value = null
    }
  }
}

// 刷新
const handleRefresh = () => {
  cacheManager.clear('cloud-accounts')
  fetchAccounts()
}

// 筛选变化
const handleFilterChange = () => {
  pagination.page = 1
  fetchAccounts()
}

// 清除筛选
const clearFilters = () => {
  filters.provider = ''
  filters.environment = ''
  filters.status = ''
  pagination.page = 1
  fetchAccounts()
}

// 添加账号
const handleAdd = () => {
  isEdit.value = false
  currentAccount.value = null
  dialogVisible.value = true
}

// 编辑账号
const handleEdit = (account: CloudAccount) => {
  isEdit.value = true
  currentAccount.value = account
  dialogVisible.value = true
}

// 删除账号
const handleDelete = async (account: CloudAccount) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除云账号"${account.name}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deleteCloudAccountApi(account.id)
    ElMessage.success('删除成功')
    fetchAccounts()
  } catch (error: any) {
    if (error !== 'cancel') {
      logError(error, 'deleteAccount')
      handleApiError(error, '删除失败')
    }
  }
}

// 测试连接
const handleTestConnection = async (account: CloudAccount) => {
  const loadingMsg = ElMessage.info({
    message: '正在测试连接...',
    duration: 0,
  })

  try {
    const { data } = await testConnectionApi(account.id)
    loadingMsg.close()

    if (data.status === 'success') {
      ElMessage.success(`连接测试成功！${data.message}`)
    } else {
      ElMessage.error(`连接测试失败：${data.message}`)
    }
  } catch (error: any) {
    loadingMsg.close()
    logError(error, 'testConnection')
    handleApiError(error, '测试连接失败')
  }
}

// 同步资产
const handleSync = async (account: CloudAccount) => {
  try {
    await ElMessageBox.confirm(
      `确定要同步云账号"${account.name}"的资产吗？`,
      '确认同步',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'info',
      }
    )

    const loadingMsg = ElMessage.info({
      message: '正在同步资产...',
      duration: 0,
    })

    const { data } = await syncCloudAccountApi(account.id, {})
    loadingMsg.close()

    if (data.status === 'running' || data.status === 'completed') {
      ElMessage.success('资产同步已启动')
      fetchAccounts()
    } else {
      ElMessage.error('资产同步失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      logError(error, 'syncAccount')
      handleApiError(error, '同步失败')
    }
  }
}

// 切换状态
const handleToggleStatus = async (account: CloudAccount) => {
  const isActive = account.status === 'active'
  const action = isActive ? '禁用' : '启用'

  try {
    await ElMessageBox.confirm(
      `确定要${action}云账号"${account.name}"吗？`,
      `确认${action}`,
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    if (isActive) {
      await disableCloudAccountApi(account.id)
    } else {
      await enableCloudAccountApi(account.id)
    }

    ElMessage.success(`${action}成功`)
    fetchAccounts()
  } catch (error: any) {
    if (error !== 'cancel') {
      logError(error, 'toggleStatus')
      handleApiError(error, `${action}失败`)
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    submitting.value = true
    await formRef.value.submit()
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    fetchAccounts()
  } catch (error: any) {
    logError(error, 'submitForm')
    handleApiError(error, '操作失败')
  } finally {
    submitting.value = false
  }
}

// 对话框关闭
const handleDialogClosed = () => {
  currentAccount.value = null
  if (formRef.value) {
    formRef.value.reset()
  }
}

// 初始化
onMounted(() => {
  // 记录 API 配置
  logApiConfig()

  // 获取账号列表
  fetchAccounts()
})
</script>

<style scoped lang="scss">
.filters-container {
  margin-bottom: calc(1rem + 0.2vw);
  padding: calc(1rem + 0.2vw);
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);

  .filters-form {
    margin: 0;

    :deep(.el-form-item) {
      margin-bottom: 0;
    }
  }
}

.cache-warning {
  margin-bottom: calc(1rem + 0.2vw);
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: calc(1rem + 0.2vw);
  margin-bottom: calc(1rem + 0.2vw);
  min-height: 200px;
}

.loading-placeholder {
  min-height: 200px;
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: calc(1rem + 0.2vw);
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}
</style>
