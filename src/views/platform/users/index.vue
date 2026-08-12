<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { deleteUser, listUsers, updateUser } from '@/api/eiam-users'
import type { EiamUser } from '@/api/types/eiam'
import UserForm from './components/UserForm.vue'

const users = ref<EiamUser[]>([])
const loading = ref(false)
const errorInfo = ref<{ message: string; code?: number } | null>(null)
const apiUrl = '/api/iam/user/list'

const filters = reactive({ keyword: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

const formRef = ref<InstanceType<typeof UserForm>>()

const activeCount = computed(() => users.value.filter((u) => u.status === 'active').length)

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

function handleSearch() {
    pagination.current = 1
    fetchUsers()
}

function handlePageChange(page: number) {
    pagination.current = page
    fetchUsers()
}

function handlePageSizeChange(size: number) {
    pagination.pageSize = size
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
    const next = row.status === 'active' ? 'disable' : 'active'
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

function formatTime(ts: number): string {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false })
}

onMounted(fetchUsers)
</script>

<template>
  <div class="platform-users-page">
    <div class="page-header">
      <div class="header-info">
        <h1 class="page-title">平台用户</h1>
        <p class="page-subtitle">管理平台登录账号（eiam 统一身份）</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="openCreate">创建用户</el-button>
      </div>
    </div>

    <ErrorDisplay
      v-if="errorInfo"
      :error-info="errorInfo"
      :api-url="apiUrl"
      @retry="fetchUsers"
    />

    <template v-else>
      <div class="toolbar">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索用户名、昵称、邮箱..."
          clearable
          style="width: 280px"
          @keyup.enter="handleSearch"
            @clear="handleSearch"
        />
        <el-button @click="handleSearch">搜索</el-button>
        <el-button @click="fetchUsers">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="users" stripe>
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" min-width="130" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近登录" width="170">
          <template #default="{ row }">{{ formatTime(row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link :type="row.status === 'active' ? 'warning' : 'success'" size="small" @click="toggleStatus(row)">
              {{ row.status === 'active' ? '禁用' : '启用' }}
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <span class="total-hint">共 {{ pagination.total }} 条 · 启用 {{ activeCount }} 条（本页）</span>
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="sizes, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </template>

    <UserForm ref="formRef" @success="fetchUsers" />
  </div>
</template>

<style scoped>
.platform-users-page { padding: 16px 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { font-size: 20px; font-weight: 600; margin: 0; }
.page-subtitle { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.pagination-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.total-hint { font-size: 12px; color: var(--text-muted); }
</style>
