<template>
  <div class="groups-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">用户组管理</h1>
          <p class="page-subtitle">管理多云平台的用户组和策略配置</p>
        </div>
        <div class="header-actions">
          <el-button class="action-btn" @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
          <el-button class="action-btn" @click="handleSync">
            <el-icon><Refresh /></el-icon>
            同步用户组
          </el-button>
          <el-button type="primary" class="action-btn primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建用户组
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon purple">
          <el-icon :size="20"><Folder /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">用户组总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon :size="20"><Document /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ totalPolicies }}</div>
          <div class="stat-label">策略总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon :size="20"><User /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ totalMembers }}</div>
          <div class="stat-label">成员总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon cyan">
          <el-icon :size="20"><Connection /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ platformCount }}</div>
          <div class="stat-label">云平台</div>
        </div>
      </div>
    </div>

    <!-- 错误显示 -->
    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      :api-url="apiUrl"
      @retry="fetchGroups"
    />

    <!-- 筛选区域 -->
    <div v-if="!errorInfo" class="filter-section">
      <div class="filter-row">
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="filters.keyword"
            type="text"
            class="search-input"
            placeholder="搜索用户组名称或描述..."
            @keyup.enter="handleSearch"
          />
          <el-icon v-if="filters.keyword" class="clear-icon" @click="filters.keyword = ''; handleSearch()">
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
            <span class="filter-label">云平台</span>
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
          <el-button v-if="hasFilters" text class="reset-btn" @click="handleReset">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 用户组列表 -->
    <div v-if="!errorInfo" class="groups-list" v-loading="loading">
      <!-- 列表头部 -->
      <div class="list-header">
        <div class="col-name">用户组</div>
        <div class="col-platforms">云平台</div>
        <div class="col-policies">策略</div>
        <div class="col-members">成员</div>
        <div class="col-time">创建时间</div>
        <div class="col-actions">操作</div>
      </div>

      <!-- 用户组列表项 -->
      <TransitionGroup name="list">
        <div
          v-for="group in groups"
          :key="group.id"
          class="group-item"
          @click="handleViewDetail(group)"
        >
          <div class="col-name">
            <div class="group-icon">
              <el-icon><Folder /></el-icon>
            </div>
            <div class="group-info">
              <div class="group-name">{{ group.name }}</div>
              <div class="group-desc">{{ group.description || '暂无描述' }}</div>
            </div>
          </div>
          <div class="col-platforms">
            <div class="platforms-list">
              <CloudPlatformTag
                v-for="provider in (group.cloud_platforms || []).slice(0, 2)"
                :key="provider"
                :provider="provider"
                size="small"
                class="platform-tag"
              />
              <span v-if="(group.cloud_platforms || []).length > 2" class="platform-more">
                +{{ group.cloud_platforms.length - 2 }}
              </span>
            </div>
          </div>
          <div class="col-policies">
            <span class="count-badge blue">
              {{ group.policies?.length || 0 }}
            </span>
          </div>
          <div class="col-members">
            <span class="count-badge green">
              {{ group.user_count || group.member_count || 0 }}
            </span>
          </div>
          <div class="col-time">
            {{ formatDateTime(group.create_time) }}
          </div>
          <div class="col-actions" @click.stop>
            <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, group)">
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
      <div v-if="!loading && groups.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon :size="48"><Folder /></el-icon>
        </div>
        <div class="empty-title">{{ hasFilters ? '没有符合条件的用户组' : '暂无用户组' }}</div>
        <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮创建第一个用户组' }}</div>
        <div class="empty-actions">
          <el-button v-if="hasFilters" @click="handleReset">清除筛选</el-button>
          <el-button v-else type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建用户组
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="!errorInfo && pagination.total > 0" class="pagination-bar">
      <div class="pagination-info">
        共 <strong>{{ pagination.total }}</strong> 个用户组
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
          <el-option :value="100" label="100 条/页" />
        </el-select>
      </div>
    </div>

    <!-- 同步用户组对话框 -->
    <SyncGroupsDialog
      v-model:visible="syncDialogVisible"
      :tenant-id="filters.tenant_id"
      @success="handleSyncSuccess"
    />

    <!-- 导出对话框 -->
    <ExportGroupsDialog
      v-model:visible="exportDialogVisible"
      :groups="groups"
      :selected-groups="selectedGroups"
      :total-count="pagination.total"
      @success="handleExportSuccess"
    />

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="800px"
      :close-on-click-modal="false"
      class="modern-dialog"
      @closed="handleDialogClosed"
    >
      <GroupForm ref="formRef" :group="currentGroup" :is-edit="isEdit" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 用户组详情抽屉 -->
    <GroupDetailDrawer
      v-model:visible="detailDrawerVisible"
      :group="detailGroup"
      :tenant-id="filters.tenant_id"
      @edit="handleEdit"
      @delete="handleDelete"
    />
  </div>
</template>


<script setup lang="ts">
import { deleteGroupApi, listGroupsApi } from '@/api'
import type { ListGroupsParams, PermissionGroup } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import TenantSelector from '@/components/TenantSelector.vue'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  Connection,
  Delete,
  Document,
  Download,
  Edit,
  Folder,
  MoreFilled,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  User,
  View
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import ExportGroupsDialog from './components/ExportGroupsDialog.vue'
import GroupDetailDrawer from './components/GroupDetailDrawer.vue'
import GroupForm from './components/GroupForm.vue'
import SyncGroupsDialog from './components/SyncGroupsDialog.vue'

const loading = ref(false)
const groups = ref<PermissionGroup[]>([])
const errorInfo = ref<any>(null)
const apiUrl = ref('/api/v1/cam/iam/groups')

const dialogVisible = ref(false)
const isEdit = ref(false)
const currentGroup = ref<PermissionGroup | null>(null)
const submitting = ref(false)
const formRef = ref<InstanceType<typeof GroupForm>>()

const filters = reactive<ListGroupsParams>({
  tenant_id: undefined,
  provider: undefined,
  keyword: undefined,
  page: 1,
  size: 20
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 计算属性
const dialogTitle = computed(() => isEdit.value ? '编辑用户组' : '创建用户组')
const hasFilters = computed(() => !!filters.provider || !!filters.keyword)
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size) || 1)

// 统计数据
const totalPolicies = computed(() => groups.value.reduce((sum, g) => sum + (g.policies?.length || 0), 0))
const totalMembers = computed(() => groups.value.reduce((sum, g) => sum + (g.user_count || g.member_count || 0), 0))
const platformCount = computed(() => {
  const platforms = new Set<string>()
  groups.value.forEach(g => {
    (g.cloud_platforms || []).forEach(p => platforms.add(p))
  })
  return platforms.size
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

const fetchGroups = async () => {
  if (!filters.tenant_id) {
    ElMessage.warning('请先选择租户')
    loading.value = false
    return
  }

  loading.value = true
  errorInfo.value = null
  
  try {
    const params = { ...filters, page: pagination.page, size: pagination.size }
    const response = await listGroupsApi(params)
    const responseData = response.data as any
    
    if (responseData) {
      if (responseData.data && typeof responseData.total === 'number') {
        groups.value = responseData.data
        pagination.total = responseData.total
      } else if (responseData.groups && typeof responseData.total === 'number') {
        groups.value = responseData.groups
        pagination.total = responseData.total
      } else if (Array.isArray(responseData)) {
        groups.value = responseData
        pagination.total = responseData.length
      } else {
        groups.value = []
        pagination.total = 0
      }
    } else {
      groups.value = []
      pagination.total = 0
    }
  } catch (error: any) {
    errorInfo.value = { message: error.message || '获取用户组列表失败', code: error.code }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchGroups()
}

const handleReset = () => {
  filters.provider = undefined
  filters.keyword = undefined
  pagination.page = 1
  fetchGroups()
}

const handleFilterChange = () => {
  pagination.page = 1
  fetchGroups()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchGroups()
}

const handleSizeChange = () => {
  pagination.page = 1
  fetchGroups()
}

const handleAdd = () => {
  currentGroup.value = null
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (group: PermissionGroup) => {
  currentGroup.value = group
  isEdit.value = true
  dialogVisible.value = true
}

const handleAction = (command: string, group: PermissionGroup) => {
  switch (command) {
    case 'edit':
      handleEdit(group)
      break
    case 'detail':
      handleViewDetail(group)
      break
    case 'delete':
      handleDelete(group)
      break
  }
}

// 导出
const exportDialogVisible = ref(false)
const selectedGroups = ref<PermissionGroup[]>([])

const handleExport = () => {
  exportDialogVisible.value = true
}

const handleExportSuccess = () => {
  exportDialogVisible.value = false
}

// 同步用户组
const syncDialogVisible = ref(false)

const handleSync = () => {
  syncDialogVisible.value = true
}

const handleSyncSuccess = () => {
  syncDialogVisible.value = false
  fetchGroups()
}

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailGroup = ref<PermissionGroup | null>(null)

const handleViewDetail = (group: PermissionGroup) => {
  detailGroup.value = group
  detailDrawerVisible.value = true
}

const handleDelete = async (group: PermissionGroup) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户组 "${group.name}" 吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteGroupApi(group.id)
    ElMessage.success('删除成功')
    fetchGroups()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
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
    fetchGroups()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDialogClosed = () => {
  formRef.value?.reset()
  currentGroup.value = null
}

onMounted(() => {
  fetchGroups()
})
</script>


<style scoped lang="scss">
.groups-page {
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
    flex-shrink: 0;

    &.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
    &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    &.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    &.cyan { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
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

  @media (max-width: 1024px) { max-width: none; }

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
    width: 140px;

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

// 用户组列表
.groups-list {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: grid;
  grid-template-columns: 2fr 180px 80px 80px 140px 60px;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 1024px) { display: none; }
}

.group-item {
  display: grid;
  grid-template-columns: 2fr 180px 80px 80px 140px 60px;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 200ms ease;

  &:last-child { border-bottom: none; }
  &:hover { background: var(--glass-bg-hover); }

  @media (max-width: 1024px) {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;

    .col-name { grid-column: 1; }
    .col-actions { grid-row: span 2; align-self: center; }
    .col-platforms, .col-policies, .col-members, .col-time { display: none; }
  }
}

.col-name {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  .group-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(139, 92, 246, 0.15);
    color: var(--accent-purple);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .group-info {
    min-width: 0;

    .group-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .group-desc {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.col-platforms {
  display: flex;
  align-items: center;

  .platforms-list {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .platform-more {
    font-size: 11px;
    color: var(--text-tertiary);
  }
}

.col-policies,
.col-members {
  display: flex;
  align-items: center;
  justify-content: center;

  .count-badge {
    min-width: 32px;
    height: 24px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &.blue {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
    }

    &.green {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);
    }
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
