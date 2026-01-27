<template>
  <PageContainer>
    <div class="rules-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">绑定规则管理</h2>
          <p class="page-subtitle">配置自动绑定规则，根据条件自动将资源绑定到服务树节点</p>
        </div>
        <div class="header-right">
          <el-button @click="handleExecuteRules" :loading="executing">
            <el-icon><VideoPlay /></el-icon>
            执行规则匹配
          </el-button>
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新建规则
          </el-button>
        </div>
      </div>

      <!-- 筛选区域 -->
      <div class="filter-section">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索规则名称"
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
          v-model="filters.enabled"
          placeholder="全部状态"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option label="已启用" :value="true" />
          <el-option label="已禁用" :value="false" />
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

      <!-- 规则列表 -->
      <div class="content-section">
        <el-table v-loading="loading" :data="ruleList" stripe>
          <el-table-column prop="priority" label="优先级" width="80" align="center" />
          <el-table-column prop="name" label="规则名称" min-width="180" show-overflow-tooltip />
          <el-table-column prop="node_name" label="目标节点" width="150" show-overflow-tooltip />
          <el-table-column label="条件数" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ row.conditions?.length || 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                @change="(val) => handleStatusChange(row, val as boolean)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="match_count" label="匹配数" width="80" align="center" />
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
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
      <RuleFormDialog
        v-model:visible="formDialogVisible"
        :rule="currentRule"
        :is-edit="isEdit"
        @success="handleFormSuccess"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    deleteRuleApi,
    executeRulesApi,
    listRulesApi,
    updateRuleApi
} from '@/api/service-tree'
import type { BindingRule } from '@/api/types/service-tree'
import { Plus, RefreshLeft, Search, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import RuleFormDialog from './components/RuleFormDialog.vue'

// 筛选条件
const filters = reactive({
  keyword: '',
  enabled: undefined as boolean | undefined
})

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 数据
const ruleList = ref<BindingRule[]>([])
const loading = ref(false)
const executing = ref(false)

// 弹窗
const formDialogVisible = ref(false)
const currentRule = ref<BindingRule | undefined>()
const isEdit = ref(false)

// 加载规则列表
const loadRules = async () => {
  loading.value = true
  try {
    const params = {
      keyword: filters.keyword || undefined,
      enabled: filters.enabled,
      page: pagination.page,
      page_size: pagination.pageSize
    }
    const res = await listRulesApi(params)
    ruleList.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载规则列表失败:', error)
    ElMessage.error('加载规则列表失败')
  } finally {
    loading.value = false
  }
}

// 执行规则匹配
const handleExecuteRules = async () => {
  try {
    await ElMessageBox.confirm(
      '将对所有未绑定的资源执行规则匹配，是否继续？',
      '执行确认',
      { type: 'info' }
    )
    executing.value = true
    await executeRulesApi()
    ElMessage.success('规则匹配执行完成')
    loadRules()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '执行失败')
    }
  } finally {
    executing.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadRules()
}

// 重置
const handleReset = () => {
  filters.keyword = ''
  filters.enabled = undefined
  handleSearch()
}

// 分页
const handleSizeChange = () => {
  pagination.page = 1
  loadRules()
}

const handlePageChange = () => {
  loadRules()
}

// 新建
const handleCreate = () => {
  currentRule.value = undefined
  isEdit.value = false
  formDialogVisible.value = true
}

// 编辑
const handleEdit = (rule: BindingRule) => {
  currentRule.value = rule
  isEdit.value = true
  formDialogVisible.value = true
}

// 状态切换
const handleStatusChange = async (rule: BindingRule, enabled: boolean) => {
  try {
    await updateRuleApi(rule.id, { enabled })
    ElMessage.success(enabled ? '已启用' : '已禁用')
    loadRules()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

// 删除
const handleDelete = async (rule: BindingRule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则 "${rule.name}" 吗？`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteRuleApi(rule.id)
    ElMessage.success('删除成功')
    loadRules()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 表单成功
const handleFormSuccess = () => {
  formDialogVisible.value = false
  loadRules()
}

onMounted(() => {
  loadRules()
})
</script>

<style scoped lang="scss">
.rules-page {
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

  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
