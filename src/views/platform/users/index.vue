<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
    ArrowLeft,
    ArrowRight,
    CircleCheck,
    Close,
    Delete,
    Edit,
    Lock,
    MoreFilled,
    Plus,
    Refresh,
    RefreshLeft,
    Search,
    Unlock,
    User,
    UserFilled,
    Warning,
} from '@element-plus/icons-vue'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { deleteUser, listUsers, updateUser } from '@/api/eiam-users'
import type { EiamUser, EiamUserStatus } from '@/api/types/eiam'
import UserForm from './components/UserForm.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

/** eiam 系统根租户 ID（pkg/ctxutil.SystemTenantID = 1） */
const SYSTEM_TENANT_ID = 1
/** 平台用户管理属系统级能力：当前会话不在系统管理空间时，租户列表等 system-scope 接口会 403 */
const isSystemTenant = computed(() => userStore.currentTenantId === SYSTEM_TENANT_ID)

const users = ref<EiamUser[]>([])
const loading = ref(false)
const errorInfo = ref<{ message: string; code?: number } | null>(null)
const apiUrl = '/api/iam/user/list'

const filters = reactive({ keyword: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const searchTimer = ref<number | null>(null)

const formRef = ref<InstanceType<typeof UserForm>>()

// 本页统计（与云账号用户页一致：total 取全局，启用/禁用取本页）
const activeCount = computed(() => users.value.filter((u) => u.status === 'active').length)
const disabledCount = computed(() => users.value.filter((u) => u.status !== 'active').length)

const hasFilters = computed(() => !!filters.keyword)
const totalPages = computed(() => Math.ceil(pagination.total / pagination.pageSize) || 1)

// 分页数字（含省略号），与云账号用户页同一算法
const visiblePages = computed<(number | string)[]>(() => {
    const pages: (number | string)[] = []
    const total = totalPages.value
    const current = pagination.current
    if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i)
    } else if (current <= 4) {
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
        pages.push(current - 1, current, current + 1)
        pages.push('...')
        pages.push(total)
    }
    return pages
})

async function fetchUsers() {
    loading.value = true
    errorInfo.value = null
    try {
        const res = await listUsers({
            keyword: filters.keyword,
            offset: (pagination.current - 1) * pagination.pageSize,
            limit: pagination.pageSize,
        })
        users.value = res.users
        pagination.total = res.total
    } catch (e) {
        errorInfo.value = { message: (e as Error).message || '加载用户列表失败', code: undefined }
    } finally {
        loading.value = false
    }
}

// 防抖搜索
function handleSearchInput() {
    if (searchTimer.value) clearTimeout(searchTimer.value)
    searchTimer.value = window.setTimeout(() => {
        pagination.current = 1
        fetchUsers()
    }, 500)
}

function handleResetFilters() {
    filters.keyword = ''
    pagination.current = 1
    fetchUsers()
}

function handleCurrentChange(page: number) {
    pagination.current = page
    fetchUsers()
}

function handleSizeChange() {
    pagination.current = 1
    fetchUsers()
}

function openCreate() {
    formRef.value?.openCreate()
}

function openEdit(row: EiamUser) {
    formRef.value?.openEdit(row)
}

async function toggleStatus(row: EiamUser) {
    const next: EiamUserStatus = row.status === 'active' ? 'disable' : 'active'
    const action = next === 'active' ? '启用' : '禁用'
    try {
        await ElMessageBox.confirm(`确定${action}用户 ${row.username} 吗？`, `${action}确认`, {
            type: 'warning',
        })
    } catch {
        return // 用户取消
    }
    try {
        await updateUser({ id: row.id, status: next })
        ElMessage.success(`${action}成功`)
        await fetchUsers()
    } catch (e) {
        ElMessage.error(`${action}失败：${(e as Error).message}`)
    }
}

async function handleDelete(row: EiamUser) {
    try {
        await ElMessageBox.confirm(
            `确定删除用户 ${row.username} 吗？此操作不可恢复。`,
            '删除确认',
            { type: 'warning' },
        )
    } catch {
        return
    }
    try {
        await deleteUser(row.id)
        ElMessage.success('删除成功')
        await fetchUsers()
    } catch (e) {
        ElMessage.error('删除失败：' + (e as Error).message)
    }
}

function handleAction(command: string, row: EiamUser) {
    if (command === 'edit') openEdit(row)
    else if (command === 'toggle') toggleStatus(row)
    else if (command === 'delete') handleDelete(row)
}

// 展示辅助
function getAvatarText(u: EiamUser): string {
    return (u.nickname || u.username || 'U').charAt(0).toUpperCase()
}

function getStatusClass(s: EiamUserStatus): string {
    if (s === 'active') return 'status-active'
    if (s === 'disable') return 'status-disabled'
    return 'status-unknown'
}

function getStatusLabel(s: EiamUserStatus): string {
    if (s === 'active') return '启用'
    if (s === 'disable') return '禁用'
    return '未知'
}

function formatTime(ts: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

onMounted(fetchUsers)
</script>

<template>
  <div class="platform-users-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">平台用户</h1>
          <p class="page-subtitle">管理平台登录账号（eiam 统一身份）</p>
        </div>
        <div class="header-actions">
          <el-button class="action-btn" @click="fetchUsers">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button type="primary" class="action-btn primary" @click="openCreate">
            <el-icon><Plus /></el-icon>
            创建用户
          </el-button>
        </div>
      </div>
    </div>

    <!-- 非系统租户提示：平台用户管理的租户分配等系统级操作需在系统管理空间下进行 -->
    <el-alert
      v-if="!isSystemTenant"
      class="tenant-alert"
      type="warning"
      :closable="false"
      show-icon
      title="当前不在系统管理空间"
      description="平台用户管理（含租户分配、全量租户列表）属系统级能力，请先在顶部租户切换器选择「系统根管理空间」后再操作。"
    />

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
          <div class="stat-value">{{ activeCount }}</div>
          <div class="stat-label">启用（本页）</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <el-icon :size="20"><Warning /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ disabledCount }}</div>
          <div class="stat-label">禁用（本页）</div>
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

    <!-- 搜索区域 -->
    <div v-if="!errorInfo" class="filter-section">
      <div class="filter-row">
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="filters.keyword"
            type="text"
            class="search-input"
            placeholder="搜索用户名、昵称、邮箱..."
            @input="handleSearchInput"
          />
          <el-icon v-if="filters.keyword" class="clear-icon" @click="filters.keyword = ''; handleResetFilters()">
            <Close />
          </el-icon>
        </div>
        <el-button v-if="hasFilters" text class="reset-btn" @click="handleResetFilters">
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
      </div>
    </div>

    <!-- 用户列表 -->
    <div v-if="!errorInfo" class="users-list" v-loading="loading">
      <!-- 列表头部 -->
      <div class="list-header">
        <div class="col-user">用户</div>
        <div class="col-phone">手机号</div>
        <div class="col-status">状态</div>
        <div class="col-time">最近登录</div>
        <div class="col-actions">操作</div>
      </div>

      <!-- 用户列表项 -->
      <div
        v-for="user in users"
        :key="user.id"
        class="user-item"
      >
        <div class="col-user">
          <div class="user-avatar">{{ getAvatarText(user) }}</div>
          <div class="user-info">
            <div class="user-name">{{ user.username }}</div>
            <div class="user-sub">
              <template v-if="user.nickname">{{ user.nickname }}</template>
              <template v-else-if="user.email">{{ user.email }}</template>
              <template v-else>—</template>
            </div>
          </div>
        </div>
        <div class="col-phone">{{ user.phone || '—' }}</div>
        <div class="col-status">
          <span class="status-dot" :class="getStatusClass(user.status)"></span>
          <span class="status-text">{{ getStatusLabel(user.status) }}</span>
        </div>
        <div class="col-time">{{ formatTime(user.lastLoginAt) }}</div>
        <div class="col-actions">
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
                <el-dropdown-item command="toggle">
                  <el-icon>
                    <Lock v-if="user.status === 'active'" />
                    <Unlock v-else />
                  </el-icon>
                  {{ user.status === 'active' ? '禁用' : '启用' }}
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

      <!-- 空状态 -->
      <div v-if="!loading && users.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon :size="48"><UserFilled /></el-icon>
        </div>
        <div class="empty-title">{{ hasFilters ? '没有符合条件的用户' : '暂无用户' }}</div>
        <div class="empty-desc">{{ hasFilters ? '尝试调整搜索关键词' : '点击上方按钮创建第一个平台用户' }}</div>
        <div class="empty-actions">
          <el-button v-if="hasFilters" @click="handleResetFilters">清除搜索</el-button>
          <el-button v-else type="primary" @click="openCreate">
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
          :disabled="pagination.current === 1"
          @click="handleCurrentChange(pagination.current - 1)"
        >
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-num"
            :class="{ active: page === pagination.current, ellipsis: page === '...' }"
            :disabled="page === '...'"
            @click="page !== '...' && handleCurrentChange(Number(page))"
          >
            {{ page }}
          </button>
        </div>
        <button
          class="page-btn"
          :disabled="pagination.current === totalPages"
          @click="handleCurrentChange(pagination.current + 1)"
        >
          <el-icon><ArrowRight /></el-icon>
        </button>
        <el-select v-model="pagination.pageSize" class="size-select" @change="handleSizeChange">
          <el-option :value="10" label="10 条/页" />
          <el-option :value="20" label="20 条/页" />
          <el-option :value="50" label="50 条/页" />
        </el-select>
      </div>
    </div>

    <UserForm ref="formRef" @success="fetchUsers" />
  </div>
</template>

<style scoped lang="scss">
.platform-users-page {
  padding: 0;
  min-height: 100%;
}

.tenant-alert {
  margin-bottom: 16px;
  border-radius: 10px;
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
  grid-template-columns: repeat(3, 1fr);
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

// 搜索区域
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
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
  max-width: 420px;

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

.reset-btn {
  color: var(--text-secondary);
  font-size: 13px;

  &:hover {
    color: var(--accent-blue);
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
  min-height: 120px;
}

.list-header {
  display: grid;
  grid-template-columns: 2.4fr 140px 120px 160px 56px;
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
  grid-template-columns: 2.4fr 140px 120px 160px 56px;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  transition: all 200ms ease;
  align-items: center;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--glass-bg-hover);
  }

  @media (max-width: 1200px) {
    grid-template-columns: 1fr 110px 56px;
    grid-template-rows: auto auto;

    .col-user {
      grid-column: 1;
      grid-row: span 2;
    }
    .col-status {
      grid-column: 2;
      grid-row: 1;
    }
    .col-time {
      grid-column: 2;
      grid-row: 2;
    }
    .col-actions {
      grid-column: 3;
      grid-row: span 2;
    }
    .col-phone {
      display: none;
    }
  }
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

    .user-sub {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.col-phone {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
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
    flex-shrink: 0;

    &.status-active {
      background: var(--accent-green);
    }

    &.status-disabled {
      background: var(--accent-red);
    }

    &.status-unknown {
      background: var(--text-muted);
    }
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-time {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-tertiary);
  white-space: nowrap;
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
</style>
