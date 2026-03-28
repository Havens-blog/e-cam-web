<template>
  <div class="template-list-page">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <div class="header-left">
        <el-input
          v-model="searchName"
          placeholder="搜索模板名称"
          clearable
          style="width: 240px; margin-right: 12px"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterProvider" placeholder="云厂商" clearable style="width: 120px" @change="loadTemplates">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="AWS" value="aws" />
          <el-option label="华为云" value="huawei" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showCreateForm = true">
          <el-icon><Plus /></el-icon> 创建模板
        </el-button>
        <el-button @click="$router.push('/compute/template/create')">
          <el-icon><Monitor /></el-icon> 直接创建云主机
        </el-button>
      </div>
    </div>

    <!-- 模板列表 -->
    <el-table :data="safeTemplates" v-loading="loading" stripe style="width: 100%">
      <el-table-column prop="name" label="模板名称" min-width="150" />
      <el-table-column prop="provider" label="云厂商" width="100" />
      <el-table-column prop="region" label="地域" width="140" />
      <el-table-column prop="instance_type" label="实例规格" width="160" />
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ row?.created_at ? new Date(row.created_at).toLocaleString() : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleProvision(row)">创建主机</el-button>
          <el-button size="small" link @click="handleEdit(row)">编辑</el-button>
          <el-popconfirm title="确定删除该模板？" @confirm="handleDelete(row)">
            <template #reference>
              <el-button size="small" type="danger" link>删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadTemplates"
        @current-change="loadTemplates"
      />
    </div>

    <!-- 创建/编辑模板抽屉 -->
    <TemplateForm
      v-model:visible="showCreateForm"
      :template-data="editingTemplate"
      :accounts="accountOptions"
      @success="handleFormSuccess"
    />

    <!-- 基于模板创建主机对话框 -->
    <ProvisionDialog
      v-model:visible="showProvisionDialog"
      :template-data="provisionTemplate"
      @success="handleProvisionSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api/index'
import { deleteTemplateApi, listTemplatesApi } from '@/api/template'
import type { CloudAccount } from '@/api/types/account'
import type { VMTemplate } from '@/api/types/template'
import { Monitor, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import ProvisionDialog from './components/ProvisionDialog.vue'
import TemplateForm from './components/TemplateForm.vue'

const loading = ref(false)
const templates = ref<VMTemplate[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchName = ref('')
const filterProvider = ref('')
const showCreateForm = ref(false)
const editingTemplate = ref<VMTemplate | null>(null)
const showProvisionDialog = ref(false)
const provisionTemplate = ref<VMTemplate | null>(null)
const cloudAccounts = ref<CloudAccount[]>([])

const safeTemplates = computed(() =>
  (templates.value || []).filter(item => item != null)
)

const accountOptions = computed(() =>
  (cloudAccounts.value || []).filter(item => item != null).map(acc => ({
    id: acc.id,
    name: `${acc.name} (${acc.provider})`,
    provider: acc.provider,
    regions: acc.regions || (acc.region ? [acc.region] : [])
  }))
)

async function loadTemplates() {
  loading.value = true
  try {
    const res = await listTemplatesApi({
      name: searchName.value || undefined,
      provider: filterProvider.value || undefined,
      offset: (currentPage.value - 1) * pageSize.value,
      limit: pageSize.value
    })
    const data = res?.data
    templates.value = data?.items || []
    total.value = data?.total || 0
  } catch {
    ElMessage.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  currentPage.value = 1
  loadTemplates()
}

function handleEdit(row: VMTemplate) {
  editingTemplate.value = row
  showCreateForm.value = true
}

function handleProvision(row: VMTemplate) {
  provisionTemplate.value = row
  showProvisionDialog.value = true
}

async function handleDelete(row: VMTemplate) {
  try {
    await deleteTemplateApi(row?.id)
    ElMessage.success('删除成功')
    loadTemplates()
  } catch {
    ElMessage.error('删除失败')
  }
}

function handleFormSuccess() {
  showCreateForm.value = false
  editingTemplate.value = null
  loadTemplates()
}

function handleProvisionSuccess() {
  showProvisionDialog.value = false
  provisionTemplate.value = null
  ElMessage.success('创建任务已提交')
}

async function loadAccounts() {
  try {
    const res = await listCloudAccountsApi({ status: 'active', limit: 100 })
    const data = res?.data
    cloudAccounts.value = data?.accounts || []
  } catch {
    cloudAccounts.value = []
  }
}

onMounted(() => {
  loadTemplates()
  loadAccounts()
})
</script>

<style scoped>
.template-list-page {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.header-left {
  display: flex;
  align-items: center;
}
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
