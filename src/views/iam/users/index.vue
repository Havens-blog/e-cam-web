<template>
  <div class="users-page">
    <!-- 页面头部 -->
    <UserPageHeader @export="handleExport" @sync="handleSync" @add="handleAdd" />

    <!-- 统计卡片 -->
    <UserStatsCards
      :total="pagination.total"
      :active-count="activeUserCount"
      :grouped-count="groupedUserCount"
      :disabled-count="disabledUserCount"
    />

    <!-- 错误显示 -->
    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      :api-url="apiUrl"
      @retry="fetchUsers"
    />

    <!-- 筛选和搜索区域 -->
    <UserFilterBar
      v-if="!errorInfo"
      v-model:keyword="filters.keyword"
      v-model:provider="filters.provider"
      v-model:user-type="filters.user_type"
      v-model:status="filters.status"
      :has-filters="hasFilters"
      @change="handleFilterChange"
      @search-input="handleSearchInput"
      @reset="handleResetFilters"
    />

    <!-- 批量操作栏 -->
    <UserBatchBar
      :selected-count="selectedUsers.length"
      :is-all-selected="isAllSelected"
      :is-indeterminate="isIndeterminate"
      :batch-deleting="batchDeleting"
      @select-all="handleSelectAll"
      @batch-assign="handleBatchAssign"
      @batch-delete="handleBatchDelete"
      @clear-selection="clearSelection"
    />

    <!-- 用户列表 -->
    <UserTable
      v-if="!errorInfo"
      :users="users"
      :loading="loading"
      :loading-message="loadingMessage"
      :has-filters="hasFilters"
      :is-all-selected="isAllSelected"
      :is-indeterminate="isIndeterminate"
      :selected-users="selectedUsers"
      @select-all="handleSelectAll"
      @toggle-select="toggleSelect"
      @view-detail="handleViewDetail"
      @action="handleAction"
      @reset="handleResetFilters"
      @add="handleAdd"
    />

    <!-- 分页 -->
    <UserPagination
      v-if="!errorInfo && pagination.total > 0"
      v-model:size="pagination.size"
      :page="pagination.page"
      :total="pagination.total"
      :total-pages="totalPages"
      :visible-pages="visiblePages"
      @current-change="handleCurrentChange"
      @size-change="handleSizeChange"
    />

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
      class="modern-dialog"
      @closed="handleDialogClosed"
    >
      <UserForm ref="formRef" :user="currentUser" :is-edit="isEdit" />
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
      @success="handleSyncSuccess"
    />

    <!--
      批量分配用户组对话框（保持原内联实现，未复用既有的 BatchAssignDialog.vue）

      为什么不复用 components/BatchAssignDialog.vue：该文件虽已存在且全仓零引用，但与本内联版
      存在多处实质性差异，强行接入会改变行为：
        1. 提交 payload 不同：本内联版提交 { user_ids, group_ids }；
           BatchAssignDialog 额外发送 mode（append/replace）——会改变后端语义；
        2. 用户组列表解析口径不同：父组件用 data.data，其组件内用 data.groups ?? data.data；
        3. 错误处理路径不同：本内联版走项目统一的 logError + handleApiError（结构化上报），
           其组件用 console.error + ElMessage，会丢失结构化错误上报；
        4. 成功后的行为不同：本内联版立即关闭并刷新列表，其组件延迟 1.5s 并展示结果面板。
      结论：按「有任何不一致就不强行复用」的原则保持原样，不改动 BatchAssignDialog.vue。
    -->
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
    <AssetExportDialog
      v-model:visible="exportDialogVisible"
      :instances="users"
      :selected-ids="selectedUsers.map((u) => u.id)"
      :total="pagination.total"
      :fetch-all-rows="fetchAllExportRows"
      :config="exportConfig"
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
import AssetExportDialog, { type ExportFieldConfig } from '@/components/AssetExportDialog.vue'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { getFullApiUrl } from '@/utils/api-validator'
import {
  getProviderLabel,
  getUserStatus,
  getUserTypeLabel,
} from '@/utils/constants'
import { fetchAllRows } from '@/utils/exportAll'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logApiConfig, logError } from '@/utils/error-logger'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import SyncUsersDialog from './components/SyncUsersDialog.vue'
import UserBatchBar from './components/UserBatchBar.vue'
import UserDetailDrawer from './components/UserDetailDrawer.vue'
import UserFilterBar from './components/UserFilterBar.vue'
import UserForm from './components/UserForm.vue'
import UserPageHeader from './components/UserPageHeader.vue'
import UserPagination from './components/UserPagination.vue'
import UserStatsCards from './components/UserStatsCards.vue'
import UserTable from './components/UserTable.vue'

// 状态
const loading = ref(false)
const submitting = ref(false)
const batchAssigning = ref(false)
const batchDeleting = ref(false)
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
// 注意：短路或运算的返回值可能是字符串，而 hasFilters 会作为 boolean prop 传给子组件，
// 故显式用 Boolean() 收敛为布尔值（真值语义与拆分前完全一致）。
const hasFilters = computed(
  () => Boolean(filters.keyword || filters.provider || filters.user_type || filters.status)
)
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size) || 1)

// 统计数据
const activeUserCount = computed(() => users.value.filter(u => u.status === 'active').length)
const groupedUserCount = computed(() => users.value.filter(u => u.permission_groups && u.permission_groups.length > 0).length)
const disabledUserCount = computed(() => users.value.filter(u => u.status !== 'active').length)

// 选择相关（isSelected 已随列表模板下沉到 components/UserTable.vue）
const isAllSelected = computed(() => users.value.length > 0 && selectedUsers.value.length === users.value.length)
const isIndeterminate = computed(() => selectedUsers.value.length > 0 && selectedUsers.value.length < users.value.length)

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
  loading.value = true
  errorInfo.value = null
  loadingMessage.value = ''

  try {
    const params = {
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

/** 导出「全部」：按当前筛选分页拉取全量（iam-2 IAM2-009），供 ExportDialog 调用 */
const fetchAllExportRows = async (onProgress?: (fetched: number, total: number) => void): Promise<CloudUser[]> =>
  fetchAllRows<CloudUser>(async (page, pageSize) => {
    const params = {
      keyword: filters.keyword || undefined,
      provider: filters.provider as any,
      user_type: filters.user_type as any,
      status: filters.status as any,
      page,
      size: pageSize,
    }
    const response = await listUsersApi(params)
    const responseData = response.data as any
    const list: CloudUser[] = Array.isArray(responseData)
      ? responseData
      : responseData?.data || responseData?.users || responseData?.items || []
    const total = Array.isArray(responseData)
      ? list.length
      : (typeof responseData?.total === 'number' ? responseData.total : list.length)
    return { list, total }
  }, { onProgress })

// 获取用户组列表
const fetchPermissionGroups = async () => {
  try {
    const { data } = await listGroupsApi({ size: 100 })
    permissionGroups.value = data.data || []
  } catch (error: any) {
    logError('fetchPermissionGroups failed', error, 'users/index')
    ElMessage.error('获取用户组列表失败，请重新打开对话框重试')
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
  batchAssignDialogVisible.value = true
  selectedGroupIds.value = []
  if (permissionGroups.value.length === 0) fetchPermissionGroups()
}

const handleConfirmBatchAssign = async () => {
  if (selectedGroupIds.value.length === 0) {
    ElMessage.warning('请选择用户组')
    return
  }

  batchAssigning.value = true
  try {
    await batchAssignGroupsApi({
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
  // 防重复提交：批量删除执行期间忽略再次触发
  if (batchDeleting.value) return
  const totalCount = selectedUsers.value.length
  let deletedCount = 0
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${totalCount} 个用户吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    batchDeleting.value = true
    for (const user of selectedUsers.value) {
      await deleteUserApi(user.id)
      deletedCount += 1
    }
    ElMessage.success('批量删除成功')
    selectedUsers.value = []
    fetchUsers()
  } catch (error: any) {
    if (error !== 'cancel') {
      logError('batchDelete failed', error, 'users/index')
      // 部分删除成功时刷新列表，让界面呈现真实状态
      if (deletedCount > 0) fetchUsers()
      handleApiError(
        error,
        deletedCount > 0
          ? `批量删除中断：已删除 ${deletedCount}/${totalCount} 个用户`
          : '批量删除失败'
      )
    }
  } finally {
    batchDeleting.value = false
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

/** 共享导出弹窗页面级配置：字段描述由原本地弹窗的 {label,value} 翻译为 {key,label}（10 字段逐字），
 *  getValue 闭包逐字搬运自原 formatFieldValue（permission_groups 数组格式化等特例保留）。
 *  原本地弹窗的 success emit 页面仅用于关闭弹窗（exportDialogVisible=false），
 *  共享组件导出成功后自带 update:visible(false)，行为等价，故不再单独衔接。 */
const exportConfig: ExportFieldConfig<CloudUser> = {
  fields: [
    { key: 'username', label: '用户名' },
    { key: 'display_name', label: '显示名称' },
    { key: 'user_type', label: '用户类型' },
    { key: 'status', label: '状态' },
    { key: 'provider', label: '云平台' },
    { key: 'cloud_account_name', label: '云账号' },
    { key: 'email', label: '邮箱' },
    { key: 'permission_groups', label: '权限组' },
    { key: 'create_time', label: '创建时间' },
    { key: 'update_time', label: '更新时间' },
  ],
  getValue: (user: CloudUser, field: string): string => {
    switch (field) {
      case 'user_type':
        return getUserTypeLabel(user.user_type) || '-'
      case 'status':
        return getUserStatus(user.status)?.label || '-'
      case 'provider':
        return getProviderLabel(user.provider) || '-'
      case 'permission_groups':
        return user.permission_groups?.map((g) => g.name).join(', ') || '-'
      default:
        return (user as any)[field] || '-'
    }
  },
  filename: '用户数据',
  defaultFields: [
    'username',
    'display_name',
    'user_type',
    'status',
    'provider',
    'cloud_account_name',
    'email',
    'permission_groups',
    'create_time',
  ],
}

// 初始化
onMounted(async () => {
  logApiConfig()
  fetchUsers()
})
</script>

<style scoped lang="scss">
.users-page {
  padding: 0;
  min-height: 100%;
}

// 对话框样式（供本文件内两个 el-dialog 复用；`.modern-dialog` 由父组件模板传入）
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
