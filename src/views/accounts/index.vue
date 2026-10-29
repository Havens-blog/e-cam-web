<template>
  <div class="accounts-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">☁️ 云账号管理</h1>
          <p class="page-subtitle">管理多云平台的接入账号、凭证配置与资产同步</p>
        </div>
        <div class="header-stats">
          <div class="ph-stat">
            <div class="ph-stat-v" style="color: var(--accent-blue)">{{ pagination.total }}</div>
            <div class="ph-stat-l">账号总数</div>
          </div>
          <div class="ph-stat">
            <div class="ph-stat-v" style="color: var(--accent-green)">{{ activeCount }}</div>
            <div class="ph-stat-l">正常连接</div>
          </div>
          <div class="ph-stat">
            <div class="ph-stat-v" style="color: var(--accent-red)">{{ errorCount }}</div>
            <div class="ph-stat-l">异常账号</div>
          </div>
          <div class="ph-stat">
            <div class="ph-stat-v" style="color: var(--accent-yellow)">{{ totalAssets }}</div>
            <div class="ph-stat-l">资产总量</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 按云厂商统计卡片 -->
    <div class="stats-row">
      <div v-for="provider in providerStats" :key="provider.id" class="stat-card">
        <div class="stat-icon" :style="{ background: provider.bgColor }">
          <ProviderIcon :provider="provider.id" size="small" />
        </div>
        <div class="stat-body">
          <div class="stat-value" :style="{ color: provider.color }">{{ provider.count }}</div>
          <div class="stat-label">{{ provider.name }}账号</div>
          <div v-if="provider.note" class="stat-change" :class="provider.noteType">{{ provider.note }}</div>
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
        <div class="filter-left">
          <span class="toolbar-title">账号列表</span>
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
          <el-select
            v-model="filters.provider"
            placeholder="全部云平台"
            clearable
            class="filter-select"
            @change="handleFilterChange"
          >
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <el-select
            v-model="filters.environment"
            placeholder="全部环境"
            clearable
            class="filter-select"
            @change="handleFilterChange"
          >
            <el-option v-for="e in ENVIRONMENTS" :key="e.value" :label="e.label" :value="e.value" />
          </el-select>
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            class="filter-select"
            @change="handleFilterChange"
          >
            <el-option v-for="s in ACCOUNT_STATUS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </div>
        <div class="filter-right">
          <!-- 视图切换 -->
          <div class="view-toggle">
            <button class="vt-btn" :class="{ active: viewMode === 'card' }" title="卡片视图" @click="viewMode = 'card'">
              <el-icon :size="14"><Grid /></el-icon>
            </button>
            <button class="vt-btn" :class="{ active: viewMode === 'list' }" title="列表视图" @click="viewMode = 'list'">
              <el-icon :size="14"><List /></el-icon>
            </button>
          </div>
          <el-button v-if="hasFilters" text class="reset-btn" @click="clearFilters">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
          <el-button :loading="batchSyncing" @click="handleBatchSync">
            <el-icon v-if="!batchSyncing"><Refresh /></el-icon>
            {{ batchSyncing ? '同步中...' : '批量同步' }}
          </el-button>
          <el-button @click="handleRefresh">
            导出
          </el-button>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加账号
          </el-button>
        </div>
      </div>
    </div>

    <!-- 卡片视图 -->
    <AccountCardView
      v-if="!errorInfo && viewMode === 'card'"
      :accounts="filteredAccounts"
      :loading="loading"
      :loading-message="loadingMessage"
      :has-filters="hasFilters"
      :account-action-pending="accountActionPending"
      @view-detail="handleViewDetail"
      @action="handleAction"
      @add="handleAdd"
      @clear-filters="clearFilters"
    />

    <!-- 列表视图 -->
    <AccountListView
      v-if="!errorInfo && viewMode === 'list'"
      :accounts="filteredAccounts"
      :loading="loading"
      :loading-message="loadingMessage"
      :has-filters="hasFilters"
      :account-action-pending="accountActionPending"
      @view-detail="handleViewDetail"
      @action="handleAction"
      @add="handleAdd"
      @clear-filters="clearFilters"
    />

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
      width="640px"
      :close-on-click-modal="false"
      append-to-body
      class="account-form-dialog"
      :show-header="false"
      @closed="handleDialogClosed"
    >
      <div class="account-dialog-modern">
        <!-- 顶部视觉区域 -->
        <div class="dialog-hero">
          <div class="hero-glow"></div>
          <div class="hero-icon" :class="isEdit ? 'hero-icon--edit' : ''">
            <svg v-if="!isEdit" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="16" r="8" stroke="currentColor" stroke-width="2.5" fill="none" />
              <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" />
              <circle cx="36" cy="36" r="8" fill="var(--bg-elevated)" stroke="currentColor" stroke-width="2.5" />
              <path d="M36 32v8M32 36h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            </svg>
            <svg v-else viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="16" r="8" stroke="currentColor" stroke-width="2.5" fill="none" />
              <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none" />
              <circle cx="36" cy="36" r="8" fill="var(--bg-elevated)" stroke="currentColor" stroke-width="2.5" />
              <path d="M33 36l2 2 4-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h2 class="hero-title">{{ isEdit ? '编辑云账号' : '添加云账号' }}</h2>
          <p class="hero-subtitle">{{ isEdit ? '修改云账号的配置信息和凭证' : '接入云平台账号，开始管理多云资源' }}</p>
          <button v-if="true" class="dialog-close-btn" @click="dialogVisible = false">
            <svg viewBox="0 0 16 16" fill="none" width="16" height="16">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- 表单区域 -->
        <div class="dialog-form-body">
          <AccountForm ref="formRef" :account="currentAccount" :is-edit="isEdit" />
        </div>

        <!-- 底部操作区 -->
        <div class="dialog-actions">
          <el-button class="action-btn cancel-btn" @click="dialogVisible = false">
            取消
          </el-button>
          <el-button 
            type="primary" 
            :loading="submitting" 
            class="action-btn submit-btn"
            @click="handleSubmit"
          >
            <svg v-if="!submitting && !isEdit" viewBox="0 0 16 16" fill="none" width="16" height="16" style="margin-right: 6px;">
              <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg v-if="!submitting && isEdit" viewBox="0 0 16 16" fill="none" width="16" height="16" style="margin-right: 6px;">
              <path d="M4 8l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {{ submitting ? '提交中...' : (isEdit ? '保存修改' : '添加账号') }}
          </el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 同步资产对话框 -->
    <el-dialog
      v-model="syncDialogVisible"
      title="同步资产"
      width="500px"
      :close-on-click-modal="false"
      append-to-body
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
            <el-select v-model="syncForm.regions" multiple placeholder="留空表示全部" filterable style="width: 100%">
              <el-option
                v-for="r in syncRegionOptions"
                :key="r.value"
                :label="r.label"
                :value="r.value"
              />
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
      :deleting="deleting"
      :testing="testing"
      :toggling="toggling"
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
import { getFullApiUrl } from '@/utils/api-validator'
import { cacheManager } from '@/utils/cache-manager'
import { ACCOUNT_STATUS, CLOUD_PROVIDERS, ENVIRONMENTS, PROVIDER_CONFIGS } from '@/utils/constants'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logApiConfig, logError } from '@/utils/error-logger'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  Grid,
  InfoFilled,
  List,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import AccountCardView from './components/AccountCardView.vue'
import AccountDetailDrawer from './components/AccountDetailDrawer.vue'
import AccountListView from './components/AccountListView.vue'
import AccountForm from './form.vue'

// 状态
const viewMode = ref<'card' | 'list'>('card')
const loading = ref(false)
const submitting = ref(false)
const syncing = ref(false)
// 防重复提交：删除 / 测试连接 / 禁用启用 的 in-flight 守卫（对齐 handleConfirmSync 的 syncing 写法）
const deleting = ref(false)
const testing = ref(false)
const toggling = ref(false)
const accountActionPending = computed(() => deleting.value || testing.value || toggling.value)
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
  accountProvider: '',
  syncType: 'all' as 'all' | 'custom',
  assetTypes: [] as string[],
  regions: [] as string[],
})

// 同步对话框的区域选项（根据选中账号的云厂商动态获取）
const syncRegionOptions = computed(() => {
  if (!syncForm.accountProvider) return []
  const config = PROVIDER_CONFIGS[syncForm.accountProvider as keyof typeof PROVIDER_CONFIGS]
  return config?.regions || []
})

// 计算属性
const apiUrl = computed(() => getFullApiUrl('/cloud-accounts'))
const hasFilters = computed(() => Boolean(filters.provider || filters.environment || filters.status || searchKeyword.value))
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size) || 1)

// 统计数据
const activeCount = computed(() => accounts.value.filter(a => a.status === 'active').length)
const errorCount = computed(() => accounts.value.filter(a => a.status === 'error' || a.status === 'disabled').length)
const totalAssets = computed(() => accounts.value.reduce((sum, a) => sum + (a.asset_count || 0), 0))

// 按云厂商统计
const providerStats = computed(() => {
  const providers = [
    { id: 'aliyun', name: '阿里云', color: '#ff6a00', bgColor: 'rgba(255, 106, 0, 0.12)' },
    { id: 'aws', name: 'AWS', color: '#ff9900', bgColor: 'rgba(255, 153, 0, 0.12)' },
    { id: 'tencent', name: '腾讯云', color: '#0052d9', bgColor: 'rgba(0, 82, 217, 0.12)' },
    { id: 'huawei', name: '华为云', color: '#cf000f', bgColor: 'rgba(207, 0, 15, 0.12)' },
  ] as const
  return providers.map(p => {
    const list = accounts.value.filter(a => a.provider === p.id)
    const errCount = list.filter(a => a.status === 'error' || a.status === 'disabled').length
    return {
      ...p,
      count: list.length,
      note: errCount > 0 ? `⚠ ${errCount} 凭证异常` : '',
      noteType: errCount > 0 ? 'dn' : 'up',
    }
  })
})

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

// 批量同步
const batchSyncing = ref(false)
const handleBatchSync = async () => {
  const activeAccounts = accounts.value.filter(a => a.status === 'active')
  if (activeAccounts.length === 0) {
    ElMessage.warning('没有可同步的活跃账号')
    return
  }

  try {
    await ElMessageBox.confirm(
      `将对 ${activeAccounts.length} 个活跃账号执行资产同步，同步过程可能需要几分钟，是否继续？`,
      '批量同步确认',
      { confirmButtonText: '开始同步', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return
  }

  batchSyncing.value = true
  let successCount = 0
  let failCount = 0

  const syncMsg = ElMessage({
    type: 'info',
    message: `正在同步 0/${activeAccounts.length} 个账号...`,
    duration: 0,
    showClose: true,
  })

  for (const account of activeAccounts) {
    try {
      await syncCloudAccountApi(account.id, {})
      successCount++
    } catch {
      failCount++
    }
  }

  syncMsg.close()
  batchSyncing.value = false

  if (failCount === 0) {
    ElMessage.success(`批量同步完成，${successCount} 个账号全部成功`)
  } else {
    ElMessage.warning(`批量同步完成：${successCount} 个成功，${failCount} 个失败`)
  }

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
  if (deleting.value) return
  deleting.value = true
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
  } finally {
    deleting.value = false
  }
}

const handleTestConnection = async (account: CloudAccount) => {
  if (testing.value) return
  testing.value = true
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
  } finally {
    testing.value = false
  }
}

const handleSync = (account: CloudAccount) => {
  syncForm.accountId = account.id
  syncForm.accountName = account.name
  syncForm.accountProvider = account.provider
  syncForm.syncType = (account.regions && account.regions.length > 0) ? 'custom' : 'all'
  syncForm.assetTypes = []
  syncForm.regions = account.regions || []
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
  syncForm.accountProvider = ''
  syncForm.syncType = 'all'
  syncForm.assetTypes = []
  syncForm.regions = []
}

const handleToggleStatus = async (account: CloudAccount) => {
  const isActive = account.status === 'active'
  const action = isActive ? '禁用' : '启用'
  if (toggling.value) return
  toggling.value = true
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
  } finally {
    toggling.value = false
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
  margin-bottom: 22px;
  padding: 22px 26px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple), var(--accent-cyan));
  }

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
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 12.5px;
      color: var(--text-tertiary);
      margin: 0;
    }
  }

  .header-stats {
    display: flex;
    gap: 28px;
    flex-shrink: 0;
  }

  .ph-stat {
    text-align: center;

    .ph-stat-v {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .ph-stat-l {
      font-size: 11px;
      color: var(--text-tertiary);
      margin-top: 2px;
    }
  }
}

// 统计卡片
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 22px;

  @media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 640px) { grid-template-columns: 1fr; }
}

.stat-card {
  background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 200ms ease;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .stat-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stat-body {
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 3px;
      font-variant-numeric: tabular-nums;
    }

    .stat-label {
      font-size: 11.5px;
      color: var(--text-tertiary);
    }

    .stat-change {
      font-size: 10.5px;
      margin-top: 2px;

      &.up { color: var(--accent-green); }
      &.dn { color: var(--accent-red); }
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
  background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  @media (max-width: 1024px) {
    flex-wrap: wrap;
  }
}

.search-box {
  position: relative;
  width: 180px;
  flex-shrink: 0;

  @media (max-width: 1024px) { flex: 1; min-width: 160px; }

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    font-size: 13px;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 28px 0 32px;
    background: var(--bg-hover);
    border: 1px solid transparent;
    border-radius: 8px;
    font-size: 12.5px;
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
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    font-size: 12px;
    transition: all 200ms ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  }
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 6px;

  .filter-label {
    font-size: 12px;
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
      height: 32px;
      font-size: 12.5px;
    }
  }
}

// 工具栏内直接放置的 el-select（不在 .filter-item 内）
.filter-left > .filter-select {
  width: 120px;
  flex-shrink: 0;

  :deep(.el-select__wrapper) {
    background: var(--bg-hover);
    border: none;
    box-shadow: none;
    border-radius: 8px;
    height: 32px;
    font-size: 12.5px;
  }
}

.reset-btn {
  color: var(--text-secondary);
  font-size: 12px;
  &:hover { color: var(--accent-blue); }
}

// 筛选区域布局
.filter-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;

  &::-webkit-scrollbar { display: none; }
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toolbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  margin-right: 4px;
}

// 视图切换
.view-toggle {
  display: flex;
  background: var(--bg-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  overflow: hidden;
  margin-left: 8px;

  .vt-btn {
    width: 34px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-tertiary);
    background: transparent;
    border: none;
    border-right: 1px solid var(--border-subtle);
    transition: all 150ms ease;
    padding: 0;

    &:last-child { border-right: none; }
    &:hover { color: var(--text-primary); background: var(--bg-hover); }
    &.active { color: var(--accent-blue); background: rgba(113, 112, 255, 0.1); }
  }
}

// 卡片视图
// 分页
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
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
      /* 白字压原 #7170ff 仅 3.84:1（AA 需 4.5）→ 压暗 18% 至约 5.4:1，色相不变 */
      background: color-mix(in srgb, var(--accent-blue) 82%, #000);
      color: white;
      border-color: color-mix(in srgb, var(--accent-blue) 82%, #000);
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
    background: rgba(113, 112, 255, 0.1);
    border-radius: 8px;
    font-size: 13px;
    color: var(--accent-blue);
  }
}

// 添加/编辑账号对话框 - 现代化
.account-dialog-modern {
  margin: -20px -20px 0;

  .dialog-hero {
    position: relative;
    text-align: center;
    padding: 36px 32px 24px;
    overflow: hidden;

    .hero-glow {
      position: absolute;
      top: -60px;
      left: 50%;
      transform: translateX(-50%);
      width: 260px;
      height: 180px;
      background: radial-gradient(ellipse, rgba(113, 112, 255, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .hero-icon {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 68px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(113, 112, 255, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%);
      border: 1px solid rgba(113, 112, 255, 0.2);
      margin-bottom: 16px;

      svg {
        width: 34px;
        height: 34px;
        color: #7170ff;
      }

      &--edit {
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.12) 100%);
        border-color: rgba(34, 197, 94, 0.2);

        svg { color: #22c55e; }
      }
    }

    .hero-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 6px;
      letter-spacing: -0.02em;
    }

    .hero-subtitle {
      font-size: 13px;
      color: var(--text-tertiary);
      margin: 0;
      line-height: 1.5;
    }

    .dialog-close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: var(--bg-hover);
      border-radius: 8px;
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all 150ms ease;

      &:hover {
        background: var(--bg-surface);
        color: var(--text-primary);
      }
    }
  }

  .dialog-form-body {
    padding: 20px 32px 8px;
    max-height: 55vh;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--border-base);
      border-radius: 4px;
    }
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 20px 32px 28px;
    border-top: 1px solid var(--border-subtle, var(--border-base));

    .action-btn {
      height: 40px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      padding: 0 24px;
      transition: all 200ms ease;
    }

    .cancel-btn {
      background: var(--bg-surface);
      border-color: var(--border-base);
      color: var(--text-secondary);

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    }

    .submit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #7170ff 0%, #6366f1 100%);
      border: none;
      box-shadow: 0 2px 8px rgba(113, 112, 255, 0.3);
      min-width: 140px;

      &:hover {
        box-shadow: 0 4px 16px rgba(113, 112, 255, 0.4);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }
}

// 同步对话框
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

<style lang="scss">
// 添加账号对话框 - 全局样式覆盖（append-to-body 需要非 scoped）
.account-form-dialog {
  .el-dialog {
    border-radius: 16px;
    overflow: hidden;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle, var(--border-base));
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  }

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }

  .el-dialog__footer {
    display: none;
  }

  // 表单内部样式优化
  .el-form-item {
    margin-bottom: 18px;
  }

  .el-form-item__label {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .el-input__wrapper,
  .el-select .el-input__wrapper {
    border-radius: 10px;
    background: var(--bg-base);
    box-shadow: 0 0 0 1px var(--border-base) inset;
    transition: all 200ms ease;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-strong, var(--border-base)) inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1.5px #7170ff inset, 0 0 0 4px rgba(113, 112, 255, 0.1);
    }
  }

  .el-textarea__inner {
    border-radius: 10px;
    background: var(--bg-base);
    box-shadow: 0 0 0 1px var(--border-base) inset;
    transition: all 200ms ease;

    &:hover {
      box-shadow: 0 0 0 1px var(--border-strong, var(--border-base)) inset;
    }

    &:focus {
      box-shadow: 0 0 0 1.5px #7170ff inset, 0 0 0 4px rgba(113, 112, 255, 0.1);
    }
  }

  .el-divider__text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
    background: var(--bg-elevated);
  }

  .el-divider {
    border-color: var(--border-subtle, var(--border-base));
  }
}
</style>
