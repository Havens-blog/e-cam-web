<template>
  <div class="accounts-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">云账号管理</h1>
          <p class="page-subtitle">管理多云平台的访问账号和配置</p>
        </div>
        <div class="header-actions">
          <ConnectionStatus />
          <el-button class="action-btn" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button type="primary" class="action-btn primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加账号
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon :size="20"><Cloudy /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">账号总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon :size="20"><CircleCheck /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ activeCount }}</div>
          <div class="stat-label">正常运行</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">
          <el-icon :size="20"><Box /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ totalAssets }}</div>
          <div class="stat-label">资产总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <el-icon :size="20"><Warning /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ errorCount }}</div>
          <div class="stat-label">异常账号</div>
        </div>
      </div>
    </div>

    <!-- 错误显示 -->
    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      :api-url="apiUrl"
      @retry="fetchAccounts"
    />

    <!-- 缓存数据警告 -->
    <div v-if="usingCache" class="cache-alert">
      <el-icon><Warning /></el-icon>
      <span>正在显示缓存数据（{{ cacheTime }}）</span>
    </div>

    <!-- 筛选区域 -->
    <div v-if="!errorInfo" class="filter-section">
      <div class="filter-row">
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            placeholder="搜索账号名称..."
            @input="handleSearchInput"
          />
          <el-icon v-if="searchKeyword" class="clear-icon" @click="searchKeyword = ''; handleFilterChange()">
            <Close />
          </el-icon>
        </div>
        <div class="filter-controls">
          <div class="filter-item">
            <span class="filter-label">租户</span>
            <TenantSelector
              v-model="filters.tenant_id"
              class="filter-select"
              @update:model-value="handleFilterChange"
            />
          </div>
          <div class="filter-item">
            <span class="filter-label">云厂商</span>
            <el-select
              v-model="filters.provider"
              placeholder="全部"
              clearable
              class="filter-select"
              @change="handleFilterChange"
            >
              <el-option
                v-for="p in CLOUD_PROVIDERS"
                :key="p.value"
                :label="p.label"
                :value="p.value"
              />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">环境</span>
            <el-select
              v-model="filters.environment"
              placeholder="全部"
              clearable
              class="filter-select"
              @change="handleFilterChange"
            >
              <el-option
                v-for="e in ENVIRONMENTS"
                :key="e.value"
                :label="e.label"
                :value="e.value"
              />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">状态</span>
            <el-select
              v-model="filters.status"
              placeholder="全部"
              clearable
              class="filter-select"
              @change="handleFilterChange"
            >
              <el-option
                v-for="s in ACCOUNT_STATUS"
                :key="s.value"
                :label="s.label"
                :value="s.value"
              />
            </el-select>
          </div>
          <el-button v-if="hasFilters" text class="reset-btn" @click="clearFilters">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 账号列表 -->
    <div v-if="!errorInfo" class="accounts-list" v-loading="loading" :element-loading-text="loadingMessage">
      <!-- 列表头部 -->
      <div class="list-header">
        <div class="col-account">账号信息</div>
        <div class="col-provider">云平台</div>
        <div class="col-env">环境</div>
        <div class="col-status">状态</div>
        <div class="col-regions">区域</div>
        <div class="col-assets">资产</div>
        <div class="col-time">最近同步</div>
        <div class="col-actions">操作</div>
      </div>

      <!-- 账号列表项 -->
      <TransitionGroup name="list">
        <div
          v-for="account in filteredAccounts"
          :key="account.id"
          class="account-item"
          @click="handleViewDetail(account)"
        >
          <div class="col-account">
            <div class="account-avatar" :class="getProviderClass(account.provider)">
              <ProviderIcon :provider="account.provider || ''" size="small" />
            </div>
            <div class="account-info">
              <div class="account-name">{{ account.name }}</div>
              <div class="account-key">{{ maskAccessKey(account.access_key_id) }}</div>
            </div>
          </div>
          <div class="col-provider">
            <span class="provider-name">{{ getProviderName(account.provider || '') }}</span>
          </div>
          <div class="col-env">
            <span class="env-badge" :class="getEnvClass(account.environment)">
              {{ getEnvironmentLabel(account.environment) }}
            </span>
          </div>
          <div class="col-status">
            <span class="status-dot" :class="getStatusClass(account.status)"></span>
            <span class="status-text">{{ getStatusLabel(account.status) }}</span>
          </div>
          <div class="col-regions">
            <template v-if="account.regions && account.regions.length > 0">
              <div class="regions-list">
                <span
                  v-for="region in account.regions.slice(0, 2)"
                  :key="region"
                  class="region-tag"
                >
                  {{ region }}
                </span>
                <span v-if="account.regions.length > 2" class="region-more">
                  +{{ account.regions.length - 2 }}
                </span>
              </div>
            </template>
            <span v-else class="no-regions">{{ account.region || '-' }}</span>
          </div>
          <div class="col-assets">
            <span class="asset-count">{{ account.asset_count || 0 }}</span>
          </div>
          <div class="col-time">
            {{ formatSyncTime(account.last_sync_time) }}
          </div>
          <div class="col-actions" @click.stop>
            <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, account)">
              <button class="action-trigger">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="view">
                    <el-icon><View /></el-icon>
                    查看详情
                  </el-dropdown-item>
                  <el-dropdown-item command="edit">
                    <el-icon><Edit /></el-icon>
                    编辑
                  </el-dropdown-item>
                  <el-dropdown-item command="test" divided>
                    <el-icon><Connection /></el-icon>
                    测试连接
                  </el-dropdown-item>
                  <el-dropdown-item command="sync">
                    <el-icon><Refresh /></el-icon>
                    同步资产
                  </el-dropdown-item>
                  <el-dropdown-item command="toggle" divided>
                    <el-icon><Switch /></el-icon>
                    {{ account.status === 'active' ? '禁用' : '启用' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete">
                    <el-icon><Delete /></el-icon>
                    <span style="color: var(--accent-red)">删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </TransitionGroup>

      <!-- 空状态 -->
      <div v-if="!loading && filteredAccounts.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon :size="48"><Cloudy /></el-icon>
        </div>
        <div class="empty-title">{{ hasFilters ? '没有符合条件的账号' : '暂无云账号' }}</div>
        <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮添加第一个云账号' }}</div>
        <div class="empty-actions">
          <el-button v-if="hasFilters" @click="clearFilters">清除筛选</el-button>
          <el-button v-else type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加账号
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="!errorInfo && pagination.total > 0" class="pagination-bar">
      <div class="pagination-info">
        共 <strong>{{ pagination.total }}</strong> 个账号
      </div>
      <div class="pagination-controls">
        <button
          class="page-btn"
          :disabled="pagination.page === 1"
          @click="handlePageChange(pagination.page - 1)"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-num"
            :class="{ active: page === pagination.page, ellipsis: page === '...' }"
            :disabled="page === '...'"
            @click="page !== '...' && handlePageChange(Number(page))"
          >
            {{ page }}
          </button>
        </div>
        <button
          class="page-btn"
          :disabled="pagination.page === totalPages"
          @click="handlePageChange(pagination.page + 1)"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
        <el-select v-model="pagination.size" class="size-select" @change="handleSizeChange">
          <el-option :value="10" label="10 条/页" />
          <el-option :value="20" label="20 条/页" />
          <el-option :value="50" label="50 条/页" />
        </el-select>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
      class="modern-dialog"
      @closed="handleDialogClosed"
    >
      <AccountForm ref="formRef" :account="currentAccount" :is-edit="isEdit" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 同步资产对话框 -->
    <el-dialog
      v-model="syncDialogVisible"
      title="同步资产"
      width="500px"
      :close-on-click-modal="false"
      class="modern-dialog"
      @closed="handleSyncDialogClosed"
    >
      <div class="sync-form">
        <div class="sync-account">
          <span class="sync-label">云账号</span>
          <span class="sync-value">{{ syncForm.accountName }}</span>
        </div>
        <div class="sync-options">
          <span class="sync-label">同步范围</span>
          <el-radio-group v-model="syncForm.syncType">
            <el-radio value="all">全部资产</el-radio>
            <el-radio value="custom">自定义</el-radio>
          </el-radio-group>
        </div>
        <template v-if="syncForm.syncType === 'custom'">
          <div class="sync-select">
            <span class="sync-label">资产类型</span>
            <el-select v-model="syncForm.assetTypes" multiple placeholder="请选择" style="width: 100%">
              <el-option label="虚拟机" value="compute" />
              <el-option label="存储" value="storage" />
              <el-option label="网络" value="network" />
              <el-option label="数据库" value="database" />
              <el-option label="中间件" value="middleware" />
            </el-select>
          </div>
          <div class="sync-select">
            <span class="sync-label">区域</span>
            <el-select v-model="syncForm.regions" multiple placeholder="留空表示全部" style="width: 100%">
              <el-option label="华北-北京" value="cn-beijing" />
              <el-option label="华东-上海" value="cn-shanghai" />
              <el-option label="华南-广州" value="cn-guangzhou" />
            </el-select>
          </div>
        </template>
        <div class="sync-tip">
          <el-icon><InfoFilled /></el-icon>
          <span>同步时间取决于资产数量，请耐心等待</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="handleConfirmSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- 账号详情抽屉 -->
    <AccountDetailDrawer
      v-model:visible="detailDrawerVisible"
      :account="detailAccount"
      @edit="handleEdit"
      @delete="handleDelete"
      @sync="handleSync"
      @test="handleTestConnection"
    />
  </div>
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
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import TenantSelector from '@/components/TenantSelector.vue'
import { getFullApiUrl } from '@/utils/api-validator'
import { cacheManager } from '@/utils/cache-manager'
import { ACCOUNT_STATUS, CLOUD_PROVIDERS, ENVIRONMENTS, PROVIDER_CONFIGS } from '@/utils/constants'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logApiConfig, logError } from '@/utils/error-logger'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  CircleCheck,
  Close,
  Cloudy,
  Connection,
  Delete,
  Edit,
  InfoFilled,
  MoreFilled,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  Switch,
  View,
  Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import AccountDetailDrawer from './components/AccountDetailDrawer.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import AccountForm from './form.vue'

// 状态
const loading = ref(false)
const submitting = ref(false)
const syncing = ref(false)
const dialogVisible = ref(false)
const syncDialogVisible = ref(false)
const detailDrawerVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentAccount = ref<CloudAccount | null>(null)
const detailAccount = ref<CloudAccount | null>(null)
const errorInfo = ref<ErrorInfo | null>(null)
const usingCache = ref(false)
const cacheTime = ref('')
const loadingMessage = ref('')
const searchKeyword = ref('')

// 数据
const accounts = ref<CloudAccount[]>([])
const filters = reactive({
  tenant_id: '' as string,
  provider: '' as string,
  environment: '' as string,
  status: '' as string,
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const syncForm = reactive({
  accountId: 0,
  accountName: '',
  syncType: 'all' as 'all' | 'custom',
  assetTypes: [] as string[],
  regions: [] as string[],
})

// 计算属性
const dialogTitle = computed(() => (isEdit.value ? '编辑云账号' : '添加云账号'))
const apiUrl = computed(() => getFullApiUrl('/cloud-accounts'))
const hasFilters = computed(() => filters.provider || filters.environment || filters.status || searchKeyword.value)
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size) || 1)

// 统计数据
const activeCount = computed(() => accounts.value.filter(a => a.status === 'active').length)
const errorCount = computed(() => accounts.value.filter(a => a.status === 'error' || a.status === 'disabled').length)
const totalAssets = computed(() => accounts.value.reduce((sum, a) => sum + (a.asset_count || 0), 0))

// 过滤后的账号列表
const filteredAccounts = computed(() => {
  if (!searchKeyword.value) return accounts.value
  const keyword = searchKeyword.value.toLowerCase()
  return accounts.value.filter(a => 
    a.name?.toLowerCase().includes(keyword) ||
    a.access_key_id?.toLowerCase().includes(keyword)
  )
})

// 分页数字
const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const current = pagination.page

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }
  return pages
})

// 辅助函数
const getProviderName = (provider: string) => {
  return PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]?.displayName || provider || '-'
}

const getProviderClass = (provider: string | undefined) => {
  if (!provider) return ''
  const map: Record<string, string> = {
    'aliyun': 'provider-aliyun',
    'tencent': 'provider-tencent',
    'aws': 'provider-aws',
    'huawei': 'provider-huawei',
    'azure': 'provider-azure'
  }
  return map[provider] || ''
}

const getEnvClass = (env: string | undefined) => {
  if (!env) return ''
  const map: Record<string, string> = {
    'production': 'env-prod',
    'staging': 'env-staging',
    'development': 'env-dev',
    'test': 'env-test'
  }
  return map[env] || ''
}

const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const map: Record<string, string> = {
    'active': 'status-active',
    'disabled': 'status-disabled',
    'error': 'status-error',
    'testing': 'status-testing'
  }
  return map[status] || ''
}

const getEnvironmentLabel = (env: string | undefined) => {
  if (!env) return '-'
  const item = ENVIRONMENTS.find(e => e.value === env)
  return item?.label || env
}

const getStatusLabel = (status: string | undefined) => {
  if (!status) return '-'
  const item = ACCOUNT_STATUS.find(s => s.value === status)
  return item?.label || status
}

const maskAccessKey = (key: string | undefined) => {
  if (!key) return '-'
  if (key.length <= 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
}



const formatSyncTime = (time: string | undefined) => {
  if (!time) return '从未同步'
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}

// 获取账号列表
const fetchAccounts = async () => {
  loading.value = true
  errorInfo.value = null
  usingCache.value = false

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

    cacheManager.set('cloud-accounts', { accounts: data.accounts, total: data.total })
  } catch (error: any) {
    logError(error, 'fetchAccounts')
    errorInfo.value = handleApiError(error, '获取账号列表失败')

    const cached = cacheManager.get<{ accounts: CloudAccount[]; total: number }>('cloud-accounts')
    if (cached) {
      accounts.value = cached.data.accounts
      pagination.total = cached.data.total
      usingCache.value = true
      const timestamp = cacheManager.getTimestamp('cloud-accounts')
      if (timestamp) cacheTime.value = timestamp.toLocaleString('zh-CN')
    }
  } finally {
    loading.value = false
  }
}

// 事件处理
const handleRefresh = () => {
  cacheManager.clear('cloud-accounts')
  fetchAccounts()
}

const handleFilterChange = () => {
  pagination.page = 1
  fetchAccounts()
}

const handleSearchInput = () => {
  // 本地搜索，不需要请求
}

const clearFilters = () => {
  filters.provider = ''
  filters.environment = ''
  filters.status = ''
  searchKeyword.value = ''
  pagination.page = 1
  fetchAccounts()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchAccounts()
}

const handleSizeChange = () => {
  pagination.page = 1
  fetchAccounts()
}

const handleAdd = () => {
  isEdit.value = false
  currentAccount.value = null
  dialogVisible.value = true
}

const handleEdit = (account: CloudAccount) => {
  isEdit.value = true
  currentAccount.value = account
  dialogVisible.value = true
}

const handleViewDetail = (account: CloudAccount) => {
  detailAccount.value = account
  detailDrawerVisible.value = true
}

const handleAction = (command: string, account: CloudAccount) => {
  switch (command) {
    case 'view': handleViewDetail(account); break
    case 'edit': handleEdit(account); break
    case 'test': handleTestConnection(account); break
    case 'sync': handleSync(account); break
    case 'toggle': handleToggleStatus(account); break
    case 'delete': handleDelete(account); break
  }
}

const handleDelete = async (account: CloudAccount) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除云账号"${account.name}"吗？删除后将无法恢复。`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteCloudAccountApi(account.id)
    ElMessage.success('删除成功')
    detailDrawerVisible.value = false
    fetchAccounts()
  } catch (error: any) {
    if (error !== 'cancel') {
      logError(error, 'deleteAccount')
      handleApiError(error, '删除失败')
    }
  }
}

const handleTestConnection = async (account: CloudAccount) => {
  const loadingMsg = ElMessage({ message: '正在测试连接...', type: 'info', duration: 0 })
  try {
    const { data } = await testConnectionApi(account.id)
    loadingMsg.close()
    if (data.status === 'success') {
      ElMessage.success(`连接测试成功！${data.message || ''}`)
    } else {
      ElMessage.error(`连接测试失败：${data.message || '未知错误'}`)
    }
  } catch (error: any) {
    loadingMsg.close()
    logError(error, 'testConnection')
    ElMessage.error(error.message || '测试连接失败')
  }
}

const handleSync = (account: CloudAccount) => {
  syncForm.accountId = account.id
  syncForm.accountName = account.name
  syncForm.syncType = 'all'
  syncForm.assetTypes = []
  syncForm.regions = []
  syncDialogVisible.value = true
}

const handleConfirmSync = async () => {
  syncing.value = true
  try {
    const requestData: any = {}
    if (syncForm.syncType === 'custom') {
      if (syncForm.assetTypes.length > 0) requestData.asset_types = syncForm.assetTypes
      if (syncForm.regions.length > 0) requestData.regions = syncForm.regions
    }
    const { data } = await syncCloudAccountApi(syncForm.accountId, requestData)
    if (data.status === 'running' || data.status === 'completed' || data.status === 'success' || data.status === 'pending') {
      ElMessage({
        message: data.message || '资产同步已启动',
        type: 'success',
        duration: 3000,
        showClose: true,
        customClass: 'modern-message'
      })
      syncDialogVisible.value = false
      fetchAccounts()
    } else {
      ElMessage.error('资产同步失败')
    }
  } catch (error: any) {
    logError(error, 'syncAccount')
    handleApiError(error, '同步失败')
  } finally {
    syncing.value = false
  }
}

const handleSyncDialogClosed = () => {
  syncForm.accountId = 0
  syncForm.accountName = ''
  syncForm.syncType = 'all'
  syncForm.assetTypes = []
  syncForm.regions = []
}

const handleToggleStatus = async (account: CloudAccount) => {
  const isActive = account.status === 'active'
  const action = isActive ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}云账号"${account.name}"吗？`, `确认${action}`, {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
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

const handleDialogClosed = () => {
  currentAccount.value = null
  if (formRef.value) formRef.value.reset()
}

onMounted(() => {
  logApiConfig()
  fetchAccounts()
})
</script>


<style scoped lang="scss">
.accounts-page {
  padding: 0;
  min-height: 100%;
}

// 页面头部
.page-header {
  margin-bottom: 24px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  .header-info {
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 14px;
      color: var(--text-tertiary);
      margin: 0;
    }
  }

  .header-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
    align-items: center;

    .action-btn {
      height: 38px;
      padding: 0 16px;
      border-radius: 10px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      color: var(--text-primary);
      transition: all 200ms ease;

      &:hover {
        background: var(--glass-bg-hover);
        border-color: var(--border-strong);
      }

      &.primary {
        background: var(--accent-blue);
        border-color: var(--accent-blue);
        color: white;

        &:hover {
          background: #2563eb;
          border-color: #2563eb;
        }
      }
    }
  }
}

// 统计卡片
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 640px) { grid-template-columns: 1fr; }
}

.stat-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 200ms ease;

  &:hover {
    background: var(--glass-bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
  }

  .stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    &.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    &.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
    &.orange { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
  }

  .stat-body {
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 4px;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      font-size: 13px;
      color: var(--text-tertiary);
    }
  }
}

// 缓存警告
.cache-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--accent-yellow);
}

// 筛选区域
.filter-section {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  @media (max-width: 1024px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 320px;

  @media (max-width: 1024px) { max-width: none; }

  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
  }

  .search-input {
    width: 100%;
    height: 40px;
    padding: 0 36px 0 42px;
    background: var(--bg-hover);
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 200ms ease;

    &::placeholder { color: var(--text-muted); }
    &:focus {
      outline: none;
      border-color: var(--accent-blue);
      background: var(--bg-surface);
    }
  }

  .clear-icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 200ms ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  }
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .filter-label {
    font-size: 13px;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .filter-select {
    width: 120px;

    :deep(.el-select__wrapper) {
      background: var(--bg-hover);
      border: none;
      box-shadow: none;
      border-radius: 8px;
      height: 36px;
    }
  }
}

.reset-btn {
  color: var(--text-secondary);
  font-size: 13px;
  &:hover { color: var(--accent-blue); }
}

// 账号列表
.accounts-list {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 1200px) { display: none; }

  .col-account { flex: 2; min-width: 180px; }
  .col-provider { width: 140px; flex-shrink: 0; }
  .col-env { width: 80px; flex-shrink: 0; text-align: center; }
  .col-status { width: 80px; flex-shrink: 0; }
  .col-regions { width: 100px; flex-shrink: 0; }
  .col-assets { width: 60px; flex-shrink: 0; text-align: center; }
  .col-time { width: 100px; flex-shrink: 0; }
  .col-actions { width: 50px; flex-shrink: 0; text-align: center; }
}

.account-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 200ms ease;

  &:last-child { border-bottom: none; }
  &:hover { background: var(--glass-bg-hover); }

  @media (max-width: 1200px) {
    flex-wrap: wrap;

    .col-account { flex: 1; min-width: 0; }
    .col-actions { flex-shrink: 0; }
    .col-provider, .col-env, .col-status, .col-regions, .col-assets, .col-time { display: none; }
  }
}

.col-account {
  flex: 2;
  min-width: 180px;
  display: flex;
  align-items: center;
  gap: 12px;

  .account-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--bg-hover);

    &.provider-aliyun { background: rgba(255, 106, 0, 0.15); }
    &.provider-tencent { background: rgba(0, 122, 255, 0.15); }
    &.provider-aws { background: rgba(255, 153, 0, 0.15); }
    &.provider-huawei { background: rgba(207, 9, 32, 0.15); }
  }

  .account-info {
    min-width: 0;

    .account-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .account-key {
      font-size: 12px;
      color: var(--text-tertiary);
      font-family: var(--font-mono);
    }
  }
}

.col-provider {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  .provider-name {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-env {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .env-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-hover);
    color: var(--text-secondary);

    &.env-prod { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    &.env-staging { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
    &.env-dev { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    &.env-test { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
  }
}

.col-status {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);

    &.status-active { background: var(--accent-green); }
    &.status-disabled { background: var(--text-tertiary); }
    &.status-error { background: var(--accent-red); }
    &.status-testing { background: var(--accent-blue); animation: pulse 1.5s infinite; }
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-regions {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  .regions-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .region-tag {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--bg-hover);
    color: var(--text-tertiary);
  }

  .region-more {
    font-size: 11px;
    color: var(--text-muted);
  }

  .no-regions {
    font-size: 13px;
    color: var(--text-muted);
  }
}

.col-assets {
  width: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .asset-count {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent-blue);
  }
}

.col-time {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

.col-actions {
  width: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .action-trigger {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    transition: all 200ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}

// 空状态
.empty-state {
  padding: 60px 20px;
  text-align: center;

  .empty-icon { color: var(--text-muted); margin-bottom: 16px; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
  .empty-desc { font-size: 14px; color: var(--text-tertiary); margin-bottom: 20px; }
  .empty-actions { display: flex; justify-content: center; gap: 12px; }
}

// 分页
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 16px;
  }

  .pagination-info {
    font-size: 14px;
    color: var(--text-tertiary);
    strong { color: var(--text-primary); font-weight: 600; }
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .page-btn, .page-num {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border-radius: 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 200ms ease;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled):not(.active) {
      background: var(--bg-surface);
      border-color: var(--border-strong);
    }

    &.active {
      background: var(--accent-blue);
      color: white;
      border-color: var(--accent-blue);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    &.ellipsis {
      cursor: default;
      background: transparent;
      border: none;
    }
  }

  .page-numbers {
    display: flex;
    gap: 4px;
  }

  .size-select {
    width: 110px;
    margin-left: 8px;

    :deep(.el-select__wrapper) {
      background: var(--bg-hover);
      border: 1px solid var(--border-subtle);
      box-shadow: none;
      border-radius: 8px;
      height: 36px;
    }
  }
}

// 同步表单
.sync-form {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .sync-account, .sync-options, .sync-select {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sync-label {
    font-size: 13px;
    color: var(--text-tertiary);
  }

  .sync-value {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .sync-tip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    font-size: 13px;
    color: var(--accent-blue);
  }
}

// 动画
.list-enter-active, .list-leave-active {
  transition: all 200ms ease;
}

.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 对话框
.modern-dialog {
  :deep(.el-dialog) {
    border-radius: 16px;
  }

  :deep(.el-dialog__header) {
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);
  }

  :deep(.el-dialog__body) {
    padding: 24px;
  }

  :deep(.el-dialog__footer) {
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
