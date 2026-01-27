<template>
  <PageContainer>
    <div class="environments-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">环境管理</h2>
          <p class="page-subtitle">管理部署环境，如开发、测试、预发、生产等</p>
        </div>
        <div class="header-right">
          <el-button v-if="!hasEnvironments" @click="handleInit">
            <el-icon><MagicStick /></el-icon>
            初始化默认环境
          </el-button>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建环境
          </el-button>
        </div>
      </div>

      <!-- 筛选区域 -->
      <div class="filter-section">
        <el-input
          v-model="filters.code"
          placeholder="搜索环境代码"
          clearable
          style="width: 200px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="filters.status"
          placeholder="全部状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
      </div>

      <!-- 环境列表 -->
      <div class="content-section">
        <el-table v-loading="loading" :data="environmentList" stripe>
          <el-table-column label="颜色" width="80" align="center">
            <template #default="{ row }">
              <span class="env-color-dot" :style="{ background: row.color }"></span>
            </template>
          </el-table-column>
          <el-table-column prop="code" label="环境代码" width="120" />
          <el-table-column prop="name" label="环境名称" width="150" />
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column prop="order" label="排序" width="80" align="center" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.status === 1"
                @change="(val) => handleStatusChange(row, val as boolean)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                编辑
              </el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-bar">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </div>

      <!-- 新建/编辑弹窗 -->
      <EnvironmentFormDialog
        v-model:visible="formDialogVisible"
        :environment="currentEnvironment"
        :is-edit="isEdit"
        @success="handleFormSuccess"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    deleteEnvironmentApi,
    initEnvironmentsApi,
    listEnvironmentsApi,
    updateEnvironmentApi
} from '@/api/service-tree'
import type { Environment } from '@/api/types/service-tree'
import { MagicStick, Plus, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import EnvironmentFormDialog from './components/EnvironmentFormDialog.vue'

// 筛选条件
const filters = reactive({
  code: '',
  status: undefined as number | undefined
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 数据
const environmentList = ref<Environment[]>([])
const loading = ref(false)

// 弹窗
const formDialogVisible = ref(false)
const currentEnvironment = ref<Environment | undefined>()
const isEdit = ref(false)

// 是否有环境数据
const hasEnvironments = computed(() => environmentList.value.length > 0)

// 加载环境列表
const loadEnvironments = async () => {
  loading.value = true
  try {
    const params = {
      code: filters.code || undefined,
      status: filters.status,
      page: pagination.page,
      page_size: pagination.pageSize
    }
    const res = await listEnvironmentsApi(params)
    environmentList.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载环境列表失败:', error)
    ElMessage.error('加载环境列表失败')
  } finally {
    loading.value = false
  }
}

// 初始化默认环境
const handleInit = async () => {
  try {
    await ElMessageBox.confirm(
      '将自动创建开发、测试、预发、生产四个默认环境，是否继续？',
      '初始化确认',
      { type: 'info' }
    )
    await initEnvironmentsApi()
    ElMessage.success('初始化成功')
    loadEnvironments()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '初始化失败')
    }
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadEnvironments()
}

// 重置
const handleReset = () => {
  filters.code = ''
  filters.status = undefined
  handleSearch()
}

// 分页
const handleSizeChange = () => {
  pagination.page = 1
  loadEnvironments()
}

const handlePageChange = () => {
  loadEnvironments()
}

// 新建
const handleCreate = () => {
  currentEnvironment.value = undefined
  isEdit.value = false
  formDialogVisible.value = true
}

// 编辑
const handleEdit = (env: Environment) => {
  currentEnvironment.value = env
  isEdit.value = true
  formDialogVisible.value = true
}

// 状态切换
const handleStatusChange = async (env: Environment, enabled: boolean) => {
  try {
    await updateEnvironmentApi(env.id, { status: enabled ? 1 : 0 })
    ElMessage.success(enabled ? '已启用' : '已禁用')
    loadEnvironments()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

// 删除
const handleDelete = async (env: Environment) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除环境 "${env.name}" 吗？如果该环境下有绑定资源，将无法删除。`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteEnvironmentApi(env.id)
    ElMessage.success('删除成功')
    loadEnvironments()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 表单成功
const handleFormSuccess = () => {
  formDialogVisible.value = false
  loadEnvironments()
}

onMounted(() => {
  loadEnvironments()
})
</script>

<style scoped lang="scss">
.environments-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;

    .header-left {
      .page-title {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--text-tertiary);
      }
    }

    .header-right {
      display: flex;
      gap: 12px;
    }
  }

  .filter-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    margin-bottom: 16px;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
  }

  .content-section {
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 16px;
  }

  .env-color-dot {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
