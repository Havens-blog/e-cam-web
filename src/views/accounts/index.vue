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
          <el-button @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            批量同步
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
    <div v-if="!errorInfo && viewMode === 'card'" v-loading="loading" :element-loading-text="loadingMessage">
      <div v-if="filteredAccounts.length > 0" class="accounts-grid">
        <div
          v-for="account in filteredAccounts"
          :key="account.id"
          class="account-card"
          @click="handleViewDetail(account)"
        >
          <div class="card-accent" :class="getProviderAccentClass(account.provider)" />
          <div class="card-body">
            <div class="card-top">
              <div class="card-top-left">
                <div class="card-avatar" :class="getProviderClass(account.provider)">
                  <ProviderIcon :provider="account.provider || ''" size="small" />
                </div>
                <div>
                  <div class="card-name">{{ account.name }}</div>
                  <div class="card-provider-label">{{ getProviderName(account.provider || '') }}</div>
                </div>
              </div>
              <span class="card-status" :class="getStatusClass(account.status)">
                <span class="dot" />
                {{ getStatusLabel(account.status) }}
              </span>
            </div>

            <div class="card-desc">{{ account.description || getProviderName(account.provider || '') + ' · ' + getEnvironmentLabel(account.environment) }}</div>

            <div class="card-meta">
              <div class="meta-item">
                <span class="meta-label">Access Key</span>
                <span class="meta-value mono">{{ maskAccessKey(account.access_key_id) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">环境</span>
                <span class="meta-value">
                  <span class="env-badge" :class="getEnvClass(account.environment)">
                    {{ getEnvironmentLabel(account.environment) }}
                  </span>
                </span>
              </div>
              <div class="meta-item">
                <span class="meta-label">月费用</span>
                <span class="meta-value" style="color: var(--accent-yellow)">-</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">最近同步</span>
                <span class="meta-value">{{ formatSyncTime(account.last_sync_time) }}</span>
              </div>
            </div>

            <div v-if="account.regions && account.regions.length > 0" class="card-regions">
              <span
                v-for="region in account.regions.slice(0, 3)"
                :key="region"
                class="region-chip"
              >{{ region }}</span>
              <span v-if="account.regions.length > 3" class="region-chip more">+{{ account.regions.length - 3 }}</span>
            </div>

            <div class="card-footer">
              <div class="card-footer-left">
                <span class="card-asset-tag">资产 <strong>{{ account.asset_count || 0 }}</strong></span>
              </div>
              <div class="card-footer-right" @click.stop>
                <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, account)">
                  <button class="card-action-btn">
                    <el-icon><MoreFilled /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view"><el-icon><View /></el-icon>查看详情</el-dropdown-item>
                      <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                      <el-dropdown-item command="test" divided><el-icon><Connection /></el-icon>测试连接</el-dropdown-item>
                      <el-dropdown-item command="sync"><el-icon><Refresh /></el-icon>同步资产</el-dropdown-item>
                      <el-dropdown-item command="toggle" divided><el-icon><Switch /></el-icon>{{ account.status === 'active' ? '禁用' : '启用' }}</el-dropdown-item>
                      <el-dropdown-item command="delete"><el-icon><Delete /></el-icon><span style="color: var(--accent-red)">删除</span></el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 卡片视图空状态 -->
      <div v-if="!loading && filteredAccounts.length === 0" class="empty-state-card">
        <el-icon :size="48" color="var(--text-muted)"><Cloudy /></el-icon>
        <div class="empty-title">{{ hasFilters ? '没有符合条件的账号' : '暂无云账号' }}</div>
        <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮添加第一个云账号' }}</div>
        <el-button v-if="hasFilters" @click="clearFilters">清除筛选</el-button>
        <el-button v-else type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>添加账号</el-button>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-if="!errorInfo && viewMode === 'list'" class="accounts-list" v-loading="loading" :element-loading-text="loadingMessage">
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
      append-to-body
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
import { getFullApiUrl } from '@/utils/api-validator'
import { cacheManager } from '@/utils/cache-manager'
import { ACCOUNT_STATUS, CLOUD_PROVIDERS, ENVIRONMENTS, PROVIDER_CONFIGS } from '@/utils/constants'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logApiConfig, logError } from '@/utils/error-logger'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  Cloudy,
  Connection,
  Delete,
  Edit,
  Grid,
  InfoFilled,
  List,
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
import AccountForm from './form.vue'

// 状态
const viewMode = ref<'card' | 'list'>('card')
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
const dialogTitle = computed(() => (isEdit.value ? '编辑云账号' : '添加云账号'))
const apiUrl = computed(() => getFullApiUrl('/cloud-accounts'))
const hasFilters = computed(() => filters.provider || filters.environment || filters.status || searchKeyword.value)
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

const getProviderAccentClass = (provider: string | undefined) => {
  if (!provider) return ''
  const map: Record<string, string> = {
    'aliyun': 'accent-aliyun',
    'tencent': 'accent-tencent',
    'aws': 'accent-aws',
    'huawei': 'accent-huawei',
    'azure': 'accent-azure'
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
    'testing': 'status-testing',
    'inactive': 'status-inactive'
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
  margin-bottom: 22px;
  padding: 22px 26px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
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
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
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
    &:hover { color: var(--text-primary); background: var(--glass-bg-hover); }
    &.active { color: var(--accent-blue); background: rgba(59, 130, 246, 0.1); }
  }
}

// 卡片视图
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.account-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: var(--border-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
}

.card-accent {
  height: 3px;
  width: 100%;

  &.accent-aliyun { background: linear-gradient(90deg, #ff6a00, #ff9500); }
  &.accent-aws { background: linear-gradient(90deg, #ff9900, #ffb84d); }
  &.accent-tencent { background: linear-gradient(90deg, #0052d9, #4d8fff); }
  &.accent-huawei { background: linear-gradient(90deg, #cf000f, #ff4d4d); }
  &.accent-azure { background: linear-gradient(90deg, #0078d4, #50a0e6); }
}

.card-body {
  padding: 18px 20px 16px;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-hover);

  &.provider-aliyun { background: rgba(255, 106, 0, 0.12); }
  &.provider-aws { background: rgba(255, 153, 0, 0.12); }
  &.provider-tencent { background: rgba(0, 82, 217, 0.12); }
  &.provider-huawei { background: rgba(207, 0, 15, 0.12); }
  &.provider-azure { background: rgba(0, 120, 212, 0.12); }
}

.card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.card-provider-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.card-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  flex-shrink: 0;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &.status-active { background: rgba(16, 185, 129, 0.1); color: var(--accent-green); .dot { background: var(--accent-green); } }
  &.status-error { background: rgba(239, 68, 68, 0.1); color: var(--accent-red); .dot { background: var(--accent-red); } }
  &.status-disabled { background: rgba(255, 255, 255, 0.05); color: var(--text-tertiary); .dot { background: var(--text-tertiary); } }
  &.status-testing { background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); .dot { background: var(--accent-blue); } }
  &.status-inactive { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); .dot { background: var(--text-muted); } }
}

.card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 14px;
  line-height: 1.5;
  min-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--bg-hover);
  border-radius: 6px;
  border: 1px solid var(--border-subtle);

  .meta-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .meta-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);

    &.mono {
      font-family: var(--font-mono);
      font-size: 11.5px;
    }
  }
}

.card-regions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.region-chip {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-tertiary);
  border: 1px solid var(--border-subtle);

  &.more {
    color: var(--text-muted);
  }
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.card-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-asset-tag {
  font-size: 12px;
  color: var(--text-tertiary);

  strong {
    color: var(--accent-blue);
    font-weight: 600;
    font-size: 14px;
  }
}

.card-footer-right {
  display: flex;
  gap: 4px;
}

.card-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  transition: all 150ms ease;
  padding: 0;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.empty-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;

  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
  .empty-desc { font-size: 14px; color: var(--text-tertiary); margin-bottom: 8px; }
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
    &.status-inactive { background: var(--text-muted); }
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
