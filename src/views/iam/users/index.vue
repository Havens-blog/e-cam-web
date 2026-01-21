<template>
  <div class="users-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">用户管理</h1>
          <p class="page-subtitle">管理多云平台的用户账号和权限</p>
        </div>
        <div class="header-actions">
          <el-button class="action-btn" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
          <el-button class="action-btn" @click="handleSync">
            <el-icon><Refresh /></el-icon>
            同步用户
          </el-button>
          <el-button type="primary" class="action-btn primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建用户
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon :size="20"><User /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">用户总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon :size="20"><CircleCheck /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ activeUserCount }}</div>
          <div class="stat-label">活跃用户</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">
          <el-icon :size="20"><UserFilled /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ groupedUserCount }}</div>
          <div class="stat-label">已分组</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <el-icon :size="20"><Warning /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ disabledUserCount }}</div>
          <div class="stat-label">已禁用</div>
        </div>
      </div>
    </div>

    <!-- 错误显示 -->
    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      :api-url="apiUrl"
      @retry="fetchUsers"
    />

    <!-- 筛选和搜索区域 -->
    <div v-if="!errorInfo" class="filter-section">
      <div class="filter-row">
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="filters.keyword"
            type="text"
            class="search-input"
            placeholder="搜索用户名、显示名称、邮箱..."
            @input="handleSearchInput"
          />
          <el-icon v-if="filters.keyword" class="clear-icon" @click="filters.keyword = ''; handleFilterChange()">
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
            <span class="filter-label">类型</span>
            <el-select
              v-model="filters.user_type"
              placeholder="全部"
              clearable
              class="filter-select"
              @change="handleFilterChange"
            >
              <el-option
                v-for="t in USER_TYPES"
                :key="t.value"
                :label="t.label"
                :value="t.value"
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
                v-for="s in USER_STATUS"
                :key="s.value"
                :label="s.label"
                :value="s.value"
              />
            </el-select>
          </div>
          <el-button v-if="hasFilters" text class="reset-btn" @click="handleResetFilters">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <Transition name="slide-fade">
      <div v-if="selectedUsers.length > 0" class="batch-bar">
        <div class="batch-info">
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="handleSelectAll"
          />
          <span class="selected-text">
            已选择 <strong>{{ selectedUsers.length }}</strong> 个用户
          </span>
        </div>
        <div class="batch-actions">
          <el-button size="small" @click="handleBatchAssign">
            <el-icon><FolderAdd /></el-icon>
            分配用户组
          </el-button>
          <el-button size="small" type="danger" @click="handleBatchDelete">
            <el-icon><Delete /></el-icon>
            批量删除
          </el-button>
          <el-button size="small" text @click="clearSelection">取消选择</el-button>
        </div>
      </div>
    </Transition>

    <!-- 用户列表 -->
    <div v-if="!errorInfo" class="users-list" v-loading="loading" :element-loading-text="loadingMessage">
      <!-- 列表头部 -->
      <div class="list-header">
        <div class="col-checkbox">
          <el-checkbox
            :model-value="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="handleSelectAll"
          />
        </div>
        <div class="col-user">用户</div>
        <div class="col-type">类型</div>
        <div class="col-status">状态</div>
        <div class="col-platform">云平台</div>
        <div class="col-groups">用户组</div>
        <div class="col-time">创建时间</div>
        <div class="col-actions">操作</div>
      </div>

      <!-- 用户列表项 -->
      <TransitionGroup name="list">
        <div
          v-for="user in users"
          :key="user.id"
          class="user-item"
          :class="{ 'is-selected': isSelected(user) }"
          @click="handleViewDetail(user)"
        >
          <div class="col-checkbox" @click.stop>
            <el-checkbox
              :model-value="isSelected(user)"
              @change="toggleSelect(user)"
            />
          </div>
          <div class="col-user">
            <div class="user-avatar">
              {{ getAvatarText(user) }}
            </div>
            <div class="user-info">
              <div class="user-name">{{ user.username }}</div>
              <div class="user-email">{{ user.email || user.display_name || '-' }}</div>
            </div>
          </div>
          <div class="col-type">
            <span class="type-badge" :class="getUserTypeClass(user.user_type)">
              {{ getUserTypeLabel(user.user_type) }}
            </span>
          </div>
          <div class="col-status">
            <span class="status-dot" :class="getStatusClass(user.status)"></span>
            <span class="status-text">{{ getSafeUserStatus(user.status).label }}</span>
          </div>
          <div class="col-platform">
            <div class="platform-info">
              <ProviderIcon :provider="user.provider" size="small" />
              <span>{{ user.cloud_account_name || getProviderLabel(user.provider) }}</span>
            </div>
          </div>
          <div class="col-groups">
            <template v-if="user.permission_groups && user.permission_groups.length > 0">
              <div class="groups-list">
                <span
                  v-for="group in user.permission_groups.slice(0, 2)"
                  :key="group.id"
                  class="group-tag"
                >
                  {{ group.name }}
                </span>
                <span v-if="user.permission_groups.length > 2" class="group-more">
                  +{{ user.permission_groups.length - 2 }}
                </span>
              </div>
            </template>
            <span v-else class="no-groups">未分组</span>
          </div>
          <div class="col-time">
            {{ formatTime(user.create_time) }}
          </div>
          <div class="col-actions" @click.stop>
            <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, user)">
              <button class="action-trigger">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">
                    <el-icon><Edit /></el-icon>
                    编辑
                  </el-dropdown-item>
                  <el-dropdown-item command="detail">
                    <el-icon><View /></el-icon>
                    查看详情
                  </el-dropdown-item>
                  <el-dropdown-item command="assign">
                    <el-icon><FolderAdd /></el-icon>
                    分配用户组
                  </el-dropdown-item>
                  <el-dropdown-item divided command="delete">
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
      <div v-if="!loading && users.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon :size="48"><UserFilled /></el-icon>
        </div>
        <div class="empty-title">{{ hasFilters ? '没有符合条件的用户' : '暂无用户' }}</div>
        <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮创建第一个用户' }}</div>
        <div class="empty-actions">
          <el-button v-if="hasFilters" @click="handleResetFilters">清除筛选</el-button>
          <el-button v-else type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建用户
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="!errorInfo && pagination.total > 0" class="pagination-bar">
      <div class="pagination-info">
        共 <strong>{{ pagination.total }}</strong> 条记录
      </div>
      <div class="pagination-controls">
        <button
          class="page-btn"
          :disabled="pagination.page === 1"
          @click="handleCurrentChange(pagination.page - 1)"
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
            @click="page !== '...' && handleCurrentChange(Number(page))"
          >
            {{ page }}
          </button>
        </div>
        <button
          class="page-btn"
          :disabled="pagination.page === totalPages"
          @click="handleCurrentChange(pagination.page + 1)"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
        <el-select v-model="pagination.size" class="size-select" @change="handleSizeChange">
          <el-option :value="10" label="10 条/页" />
          <el-option :value="20" label="20 条/页" />
          <el-option :value="50" label="50 条/页" />
          <el-option :value="100" label="100 条/页" />
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
      <UserForm ref="formRef" :user="currentUser" :is-edit="isEdit" :tenant-id="filters.tenant_id" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 同步用户对话框 -->
    <SyncUsersDialog
      v-model:visible="syncDialogVisible"
      :tenant-id="filters.tenant_id"
      @success="handleSyncSuccess"
    />

    <!-- 批量分配用户组对话框 -->
    <el-dialog
      v-model="batchAssignDialogVisible"
      title="批量分配用户组"
      width="500px"
      :close-on-click-modal="false"
      class="modern-dialog"
    >
      <el-form label-width="100px">
        <el-form-item label="选择用户组" required>
          <el-select
            v-model="selectedGroupIds"
            multiple
            placeholder="请选择用户组"
            style="width: 100%"
          >
            <el-option
              v-for="group in permissionGroups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="batchAssignDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="batchAssigning"
          @click="handleConfirmBatchAssign"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 导出对话框 -->
    <ExportDialog
      v-model:visible="exportDialogVisible"
      :users="users"
      :selected-users="selectedUsers"
      :total-count="pagination.total"
      @success="handleExportSuccess"
    />

    <!-- 用户详情抽屉 -->
    <UserDetailDrawer
      v-model:visible="detailDrawerVisible"
      :user="detailUser"
      @edit="handleEdit"
      @delete="handleDelete"
    />
  </div>
</template>


<script setup lang="ts">
import {
  batchAssignGroupsApi,
  deleteUserApi,
  listGroupsApi,
  listUsersApi
} from '@/api'
import type { CloudUser } from '@/api/types/iam'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import TenantSelector from '@/components/TenantSelector.vue'
import { getFullApiUrl } from '@/utils/api-validator'
import {
  CLOUD_PROVIDERS,
  getProviderLabel,
  getUserStatus,
  getUserTypeLabel,
  USER_STATUS,
  USER_TYPES,
} from '@/utils/constants'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logApiConfig, logError } from '@/utils/error-logger'
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Close,
  Delete,
  Download,
  Edit,
  FolderAdd,
  MoreFilled,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  User,
  UserFilled,
  View,
  Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import ExportDialog from './components/ExportDialog.vue'
import SyncUsersDialog from './components/SyncUsersDialog.vue'
import UserDetailDrawer from './components/UserDetailDrawer.vue'
import UserForm from './components/UserForm.vue'

// 辅助函数 - 安全获取用户状态
const getSafeUserStatus = (status: string | undefined): { label: string; color: string } => {
  if (!status) return { label: '-', color: 'info' }
  const statusInfo = getUserStatus(status)
  return statusInfo || { label: '-', color: 'info' }
}

// 获取用户类型样式类
const getUserTypeClass = (type: string | undefined) => {
  if (!type) return ''
  const typeMap: Record<string, string> = {
    'iam': 'type-iam',
    'root': 'type-root',
    'service': 'type-service',
    'federated': 'type-federated'
  }
  return typeMap[type] || ''
}

// 获取状态样式类
const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const statusMap: Record<string, string> = {
    'active': 'status-active',
    'inactive': 'status-inactive',
    'disabled': 'status-disabled',
    'locked': 'status-locked'
  }
  return statusMap[status] || ''
}

// 获取头像文字
const getAvatarText = (user: CloudUser) => {
  if (user.display_name) return user.display_name.charAt(0).toUpperCase()
  if (user.username) return user.username.charAt(0).toUpperCase()
  return 'U'
}

// 格式化时间
const formatTime = (time: string | undefined) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// 状态
const loading = ref(false)
const submitting = ref(false)
const batchAssigning = ref(false)
const dialogVisible = ref(false)
const syncDialogVisible = ref(false)
const batchAssignDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentUser = ref<CloudUser | null>(null)
const errorInfo = ref<ErrorInfo | null>(null)
const loadingMessage = ref('')

// 数据
const users = ref<CloudUser[]>([])
const selectedUsers = ref<CloudUser[]>([])
const permissionGroups = ref<any[]>([])
const selectedGroupIds = ref<number[]>([])

const filters = reactive({
  tenant_id: '' as string,
  keyword: '' as string,
  provider: '' as string,
  user_type: '' as string,
  status: '' as string,
})

const searchTimer = ref<number | null>(null)

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 计算属性
const dialogTitle = computed(() => (isEdit.value ? '编辑用户' : '创建用户'))
const apiUrl = computed(() => getFullApiUrl('/iam/users'))
const hasFilters = computed(
  () => filters.keyword || filters.provider || filters.user_type || filters.status
)
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size) || 1)

// 统计数据
const activeUserCount = computed(() => users.value.filter(u => u.status === 'active').length)
const groupedUserCount = computed(() => users.value.filter(u => u.permission_groups && u.permission_groups.length > 0).length)
const disabledUserCount = computed(() => users.value.filter(u => u.status !== 'active').length)

// 选择相关
const isAllSelected = computed(() => users.value.length > 0 && selectedUsers.value.length === users.value.length)
const isIndeterminate = computed(() => selectedUsers.value.length > 0 && selectedUsers.value.length < users.value.length)
const isSelected = (user: CloudUser) => selectedUsers.value.some(u => u.id === user.id)

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

// 选择操作
const toggleSelect = (user: CloudUser) => {
  const index = selectedUsers.value.findIndex(u => u.id === user.id)
  if (index > -1) {
    selectedUsers.value.splice(index, 1)
  } else {
    selectedUsers.value.push(user)
  }
}

const handleSelectAll = (val: boolean | string | number) => {
  selectedUsers.value = val ? [...users.value] : []
}

const clearSelection = () => {
  selectedUsers.value = []
}

// 获取用户列表
const fetchUsers = async () => {
  if (!filters.tenant_id) {
    ElMessage.warning('请先选择租户')
    loading.value = false
    return
  }

  loading.value = true
  errorInfo.value = null
  loadingMessage.value = ''

  try {
    const params = {
      tenant_id: filters.tenant_id,
      keyword: filters.keyword || undefined,
      provider: filters.provider as any,
      user_type: filters.user_type as any,
      status: filters.status as any,
      page: pagination.page,
      size: pagination.size,
    }

    const response = await listUsersApi(params)
    const responseData = response.data as any
    
    if (responseData) {
      if (responseData.data && typeof responseData.total === 'number') {
        users.value = responseData.data
        pagination.total = responseData.total
      } else if (responseData.users && typeof responseData.total === 'number') {
        users.value = responseData.users
        pagination.total = responseData.total
      } else if (Array.isArray(responseData)) {
        users.value = responseData
        pagination.total = responseData.length
      } else if (responseData.items) {
        users.value = responseData.items
        pagination.total = responseData.total || responseData.items.length
      } else {
        users.value = []
        pagination.total = 0
      }
    } else {
      users.value = []
      pagination.total = 0
    }
  } catch (error: any) {
    logError(error, 'fetchUsers')
    errorInfo.value = handleApiError(error, '获取用户列表失败')
    users.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 获取用户组列表
const fetchPermissionGroups = async () => {
  if (!filters.tenant_id) return
  
  try {
    const { data } = await listGroupsApi({ tenant_id: filters.tenant_id, size: 100 })
    permissionGroups.value = data.data || []
  } catch (error: any) {
    logError(error, 'fetchPermissionGroups')
  }
}

// 筛选变化
const handleFilterChange = () => {
  pagination.page = 1
  fetchUsers()
}

// 重置筛选器
const handleResetFilters = () => {
  filters.keyword = ''
  filters.provider = ''
  filters.user_type = ''
  filters.status = ''
  pagination.page = 1
  fetchUsers()
}

// 搜索输入处理（防抖）
const handleSearchInput = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(() => {
    pagination.page = 1
    fetchUsers()
  }, 500)
}

// 分页
const handleSizeChange = () => {
  pagination.page = 1
  fetchUsers()
}

const handleCurrentChange = (newPage: number) => {
  pagination.page = newPage
  fetchUsers()
}

// 添加用户
const handleAdd = () => {
  isEdit.value = false
  currentUser.value = null
  dialogVisible.value = true
}

// 编辑用户
const handleEdit = (user: CloudUser) => {
  isEdit.value = true
  currentUser.value = user
  dialogVisible.value = true
}

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailUser = ref<CloudUser | null>(null)

const handleViewDetail = (user: CloudUser) => {
  detailUser.value = user
  detailDrawerVisible.value = true
}

// 操作处理
const handleAction = (command: string, user: CloudUser) => {
  switch (command) {
    case 'edit':
      handleEdit(user)
      break
    case 'detail':
      handleViewDetail(user)
      break
    case 'assign':
      currentUser.value = user
      selectedUsers.value = [user]
      handleBatchAssign()
      break
    case 'delete':
      handleDelete(user)
      break
  }
}

// 删除用户
const handleDelete = async (user: CloudUser) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户"${user.username}"吗？删除后将无法恢复。`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteUserApi(user.id)
    ElMessage.success('删除成功')
    fetchUsers()
  } catch (error: any) {
    if (error !== 'cancel') {
      logError(error, 'deleteUser')
      handleApiError(error, '删除失败')
    }
  }
}

// 同步用户
const handleSync = () => {
  syncDialogVisible.value = true
}

const handleSyncSuccess = () => {
  syncDialogVisible.value = false
  fetchUsers()
}

// 批量分配用户组
const handleBatchAssign = () => {
  if (!filters.tenant_id) {
    ElMessage.warning('请先选择租户')
    return
  }
  batchAssignDialogVisible.value = true
  selectedGroupIds.value = []
  if (permissionGroups.value.length === 0) fetchPermissionGroups()
}

const handleConfirmBatchAssign = async () => {
  if (selectedGroupIds.value.length === 0) {
    ElMessage.warning('请选择用户组')
    return
  }
  if (!filters.tenant_id) {
    ElMessage.warning('请先选择租户')
    return
  }

  batchAssigning.value = true
  try {
    await batchAssignGroupsApi({
      tenant_id: filters.tenant_id,
      user_ids: selectedUsers.value.map((u) => u.id),
      group_ids: selectedGroupIds.value,
    })
    ElMessage.success('批量分配成功')
    batchAssignDialogVisible.value = false
    fetchUsers()
  } catch (error: any) {
    logError(error, 'batchAssign')
    handleApiError(error, '批量分配失败')
  } finally {
    batchAssigning.value = false
  }
}

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedUsers.value.length} 个用户吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    for (const user of selectedUsers.value) {
      await deleteUserApi(user.id)
    }
    ElMessage.success('批量删除成功')
    selectedUsers.value = []
    fetchUsers()
  } catch (error: any) {
    if (error !== 'cancel') {
      logError(error, 'batchDelete')
      handleApiError(error, '批量删除失败')
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
    fetchUsers()
  } catch (error: any) {
    logError(error, 'submitForm')
    handleApiError(error, '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDialogClosed = () => {
  currentUser.value = null
  if (formRef.value) formRef.value.reset()
}

// 导出
const handleExport = () => {
  exportDialogVisible.value = true
}

const handleExportSuccess = () => {
  exportDialogVisible.value = false
}

// 初始化
const initDefaultTenant = async () => {
  try {
    const { listTenantsApi } = await import('@/api/iam')
    const res = await listTenantsApi({ page: 1, size: 1 })
    const tenants = res.data?.data || []
    if (tenants.length > 0 && tenants[0]) {
      filters.tenant_id = tenants[0].id
    }
  } catch (error) {
    console.error('获取默认租户失败:', error)
  }
}

onMounted(async () => {
  logApiConfig()
  await initDefaultTenant()
  fetchUsers()
})
</script>


<style scoped lang="scss">
.users-page {
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

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
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
    flex-shrink: 0;

    &.blue {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
    }

    &.green {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);
    }

    &.purple {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
    }

    &.orange {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-yellow);
    }
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
  min-width: 280px;
  max-width: 400px;

  @media (max-width: 1024px) {
    max-width: none;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    font-size: 16px;
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

    &::placeholder {
      color: var(--text-muted);
    }

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

  &:hover {
    color: var(--accent-blue);
  }
}

// 批量操作栏
.batch-bar {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .selected-text {
      font-size: 14px;
      color: var(--text-secondary);

      strong {
        color: var(--accent-blue);
        font-weight: 600;
      }
    }
  }

  .batch-actions {
    display: flex;
    gap: 8px;
  }
}

// 用户列表
.users-list {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: grid;
  grid-template-columns: 48px 2fr 100px 100px 160px 160px 120px 60px;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 1200px) {
    display: none;
  }
}

.user-item {
  display: grid;
  grid-template-columns: 48px 2fr 100px 100px 160px 160px 120px 60px;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 200ms ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--glass-bg-hover);
  }

  &.is-selected {
    background: rgba(59, 130, 246, 0.08);
  }

  @media (max-width: 1200px) {
    grid-template-columns: 48px 1fr auto;
    grid-template-rows: auto auto;

    .col-checkbox { grid-row: span 2; }
    .col-user { grid-column: 2; }
    .col-actions { grid-row: span 2; align-self: center; }
    .col-type, .col-status, .col-platform, .col-groups, .col-time {
      display: none;
    }
  }
}

.col-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-user {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .user-info {
    min-width: 0;

    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.col-type {
  display: flex;
  align-items: center;

  .type-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-hover);
    color: var(--text-secondary);

    &.type-iam {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
    }

    &.type-root {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);
    }

    &.type-service {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
    }
  }
}

.col-status {
  display: flex;
  align-items: center;
  gap: 8px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);

    &.status-active {
      background: var(--accent-green);
    }

    &.status-inactive {
      background: var(--text-tertiary);
    }

    &.status-disabled {
      background: var(--accent-red);
    }

    &.status-locked {
      background: var(--accent-yellow);
    }
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-platform {
  display: flex;
  align-items: center;

  .platform-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.col-groups {
  display: flex;
  align-items: center;

  .groups-list {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .group-tag {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .group-more {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .no-groups {
    font-size: 13px;
    color: var(--text-muted);
  }
}

.col-time {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

.col-actions {
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

  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .empty-desc {
    font-size: 14px;
    color: var(--text-tertiary);
    margin-bottom: 20px;
  }

  .empty-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
}

// 分页
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 16px;
  }

  .pagination-info {
    font-size: 14px;
    color: var(--text-tertiary);

    strong {
      color: var(--text-primary);
      font-weight: 600;
    }
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .page-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 200ms ease;

    &:hover:not(:disabled) {
      background: var(--bg-surface);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .page-numbers {
    display: flex;
    gap: 4px;
  }

  .page-num {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 200ms ease;

    &:hover:not(:disabled):not(.active) {
      background: var(--bg-hover);
    }

    &.active {
      background: var(--accent-blue);
      color: white;
    }

    &.ellipsis {
      cursor: default;
      color: var(--text-muted);
    }
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

// 动画
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 200ms ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.list-enter-active,
.list-leave-active {
  transition: all 200ms ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

// 对话框样式
.modern-dialog {
  :deep(.el-dialog) {
    border-radius: 16px;
    overflow: hidden;
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
