<template>
  <PageContainer>
    <div class="tenants-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">租户管理</h2>
          <p class="page-subtitle">管理系统中的所有租户，包括租户信息、配额和统计数据</p>
        </div>
        <div class="header-right">
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            创建租户
          </el-button>
        </div>
      </div>

      <!-- 筛选区域 -->
      <el-card class="filter-card" shadow="never">
        <el-form :model="filters" inline>
          <el-form-item label="关键词">
            <el-input
              v-model="filters.keyword"
              placeholder="搜索租户名称或显示名称"
              clearable
              style="width: 240px"
              @clear="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="状态">
            <el-select
              v-model="filters.status"
              placeholder="全部状态"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="status in TENANT_STATUS"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="行业">
            <el-select
              v-model="filters.industry"
              placeholder="全部行业"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="industry in INDUSTRIES"
                :key="industry.value"
                :label="industry.label"
                :value="industry.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="地区">
            <el-select
              v-model="filters.region"
              placeholder="全部地区"
              clearable
              style="width: 150px"
              @change="handleSearch"
            >
              <el-option
                v-for="region in REGIONS"
                :key="region.value"
                :label="region.label"
                :value="region.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" @click="handleSearch">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
            <el-button @click="handleReset">
              <el-icon><RefreshLeft /></el-icon>
              重置
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 租户列表 -->
      <el-card class="table-card" shadow="never">
        <el-table
          v-loading="loading"
          :data="tenantList"
          stripe
          style="width: 100%"
        >
          <el-table-column prop="id" label="租户ID" width="180" />
          <el-table-column prop="name" label="租户名称" width="150" />
          <el-table-column prop="display_name" label="显示名称" width="150" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getTenantStatus(row.status)?.color as any">
                {{ getTenantStatus(row.status)?.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="行业" width="120">
            <template #default="{ row }">
              {{ getIndustryLabel(row.metadata?.industry || '') }}
            </template>
          </el-table-column>
          <el-table-column label="地区" width="120">
            <template #default="{ row }">
              {{ getRegionLabel(row.metadata?.region || '') }}
            </template>
          </el-table-column>
          <el-table-column prop="metadata.user_count" label="用户数" width="100" />
          <el-table-column prop="metadata.user_group_count" label="用户组数" width="100" />
          <el-table-column prop="metadata.cloud_account_count" label="云账号数" width="100" />
          <el-table-column prop="create_time" label="创建时间" width="180" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleView(row)">
                查看
              </el-button>
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
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </el-card>

      <!-- 租户表单对话框 -->
      <TenantFormDialog
        v-model:visible="formDialogVisible"
        :tenant="currentTenant"
        :is-edit="isEdit"
        @success="handleFormSuccess"
      />

      <!-- 租户详情抽屉 -->
      <TenantDetailDrawer
        v-model:visible="detailDrawerVisible"
        :tenant-id="currentTenantId"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { deleteTenantApi, listTenantsApi } from '@/api/iam'
import type { Tenant } from '@/api/types/iam'
import { INDUSTRIES, REGIONS, TENANT_STATUS, getIndustryLabel, getRegionLabel, getTenantStatus } from '@/utils/constants'
import { Plus, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import TenantDetailDrawer from './components/TenantDetailDrawer.vue'
import TenantFormDialog from './components/TenantFormDialog.vue'


// 筛选条件
const filters = reactive({
  keyword: '',
  status: '' as any,
  industry: '',
  region: ''
})

// 分页
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0
})

// 租户列表
const tenantList = ref<Tenant[]>([])
const loading = ref(false)

// 表单对话框
const formDialogVisible = ref(false)
const currentTenant = ref<Tenant | undefined>()
const isEdit = ref(false)

// 详情抽屉
const detailDrawerVisible = ref(false)
const currentTenantId = ref('')

// 加载租户列表
const loadTenants = async () => {
  loading.value = true
  try {
    const params = {
      keyword: filters.keyword || undefined,
      status: filters.status || undefined,
      industry: filters.industry || undefined,
      region: filters.region || undefined,
      page: pagination.page,
      size: pagination.size
    }
    const res = await listTenantsApi(params)
    tenantList.value = res.data.data || []
    pagination.total = res.data.total || 0
  } catch (error) {
    console.error('加载租户列表失败:', error)
    ElMessage.error('加载租户列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadTenants()
}

// 重置
const handleReset = () => {
  filters.keyword = ''
  filters.status = ''
  filters.industry = ''
  filters.region = ''
  handleSearch()
}

// 分页变化
const handleSizeChange = () => {
  pagination.page = 1
  loadTenants()
}

const handlePageChange = () => {
  loadTenants()
}

// 创建租户
const handleCreate = () => {
  currentTenant.value = undefined
  isEdit.value = false
  formDialogVisible.value = true
}

// 查看租户
const handleView = (tenant: Tenant) => {
  currentTenantId.value = tenant.id
  detailDrawerVisible.value = true
}

// 编辑租户
const handleEdit = (tenant: Tenant) => {
  currentTenant.value = tenant
  isEdit.value = true
  formDialogVisible.value = true
  detailDrawerVisible.value = false
}

// 删除租户
const handleDelete = async (tenant: Tenant) => {
  // 检查租户状态
  if (tenant.status === 'active') {
    ElMessage.warning('不能删除活跃状态的租户，请先将状态改为非活跃或暂停')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除租户 "${tenant.name}" 吗？此操作将影响该租户下的所有用户、云账号和权限配置。请输入租户名称进行确认。`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        inputPattern: new RegExp(`^${tenant.name}$`),
        inputPlaceholder: `请输入租户名称: ${tenant.name}`,
        inputErrorMessage: '租户名称不匹配'
      }
    )

    await deleteTenantApi(tenant.id)
    ElMessage.success('删除成功')
    loadTenants()
    detailDrawerVisible.value = false
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除租户失败:', error)
      ElMessage.error(error.message || '删除租户失败')
    }
  }
}

// 表单提交成功
const handleFormSuccess = () => {
  formDialogVisible.value = false
  loadTenants()
}

// 初始化
onMounted(() => {
  loadTenants()
})
</script>

<style scoped lang="scss">
.tenants-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .header-left {
      .page-title {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .filter-card {
    margin-bottom: 16px;

    :deep(.el-card__body) {
      padding: 16px;
    }

    .el-form {
      margin-bottom: 0;
    }
  }

  .table-card {
    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
