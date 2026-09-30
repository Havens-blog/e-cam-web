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
          <el-button @click="rebindDialogVisible = true">
            <el-icon><Switch /></el-icon>
            规则改绑
          </el-button>
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
          <el-table-column prop="name" label="规则名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="node_name" label="目标节点" width="140" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.node_name || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="目标环境" width="100">
            <template #default="{ row }">
              <span v-if="row.env_name" class="env-tag">
                <span class="env-dot" :style="{ background: row.env_color || 'var(--text-tertiary)' }"></span>
                {{ row.env_name }}
              </span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="条件数" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ row.conditions?.length || 0 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.enabled"
                :loading="statusLoadingId === row.id"
                :before-change="() => beforeStatusChange(row)"
                @change="(val) => { if (val) handleStatusChange(row) }"
              />
            </template>
          </el-table-column>
          <el-table-column label="匹配数" width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.last_executed_at">{{ row.last_match_count ?? 0 }}</span>
              <span v-else class="text-muted">未执行</span>
            </template>
          </el-table-column>
          <el-table-column label="最近执行时间" width="160">
            <template #default="{ row }">
              <span v-if="row.last_executed_at">{{ formatDateTime(new Date(row.last_executed_at)) }}</span>
              <span v-else class="text-muted">未执行</span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.description || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="170" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                编辑
              </el-button>
              <el-button link type="warning" size="small" @click="handleUnbind(row)">
                解绑
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

      <!-- 执行规则确认弹窗 -->
      <ExecuteConfirmDialog
        v-model:visible="executeDialogVisible"
        :loading="executing"
        @confirm="confirmExecuteRules"
      />

      <!-- 规则改绑预览/确认弹窗 -->
      <RebindDialog v-model="rebindDialogVisible" @success="handleRebindSuccess" />

      <!-- 删除/禁用规则确认弹窗 -->
      <RuleConfirmDialog
        :model-value="confirmVisible"
        :mode="confirmMode"
        :rule="confirmRule"
        :loading="confirmLoading"
        @update:model-value="handleConfirmClose"
        @confirm="handleConfirm"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    deleteRuleApi,
    executeRulesApi,
    listEnvironmentsApi,
    listRulesApi,
    unbindRuleApi,
    updateRuleApi
} from '@/api/service-tree'
import type { BindingRule, Environment } from '@/api/types/service-tree'
import { Plus, RefreshLeft, Search, Switch, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { formatDateTime } from '@/utils/format'
import ExecuteConfirmDialog from './components/ExecuteConfirmDialog.vue'
import RebindDialog from './components/RebindDialog.vue'
import RuleConfirmDialog from './components/RuleConfirmDialog.vue'
import RuleFormDialog from './components/RuleFormDialog.vue'

// 任务 1 后端 RuleVO 透出的执行统计字段（类型定义暂未同步，本地扩展）
interface BindingRuleWithStats extends BindingRule {
  last_executed_at?: number
  last_match_count?: number
}

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
const ruleList = ref<BindingRuleWithStats[]>([])
const environmentList = ref<Environment[]>([])
const loading = ref(false)
const executing = ref(false)
// 行内启用切换进行中的规则 ID
const statusLoadingId = ref<number | null>(null)

// 弹窗
const formDialogVisible = ref(false)
const executeDialogVisible = ref(false)
const rebindDialogVisible = ref(false)
const confirmVisible = ref(false)
const confirmMode = ref<'delete' | 'disable' | 'unbind'>('delete')
const confirmRule = ref<BindingRule | null>(null)
const confirmLoading = ref(false)
const currentRule = ref<BindingRule | undefined>()
const isEdit = ref(false)

// 加载环境列表
const loadEnvironments = async () => {
  try {
    const res = await listEnvironmentsApi({ status: 1 })
    environmentList.value = res.data?.list || []
  } catch (error) {
    console.error('加载环境列表失败:', error)
    ElMessage.error('加载环境列表失败')
  }
}

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
    const rules = (res.data?.list || []) as BindingRuleWithStats[]
    
    // 根据 env_id 补充环境信息
    const envMap = new Map(environmentList.value.map(e => [e.id, e]))
    ruleList.value = rules.map(rule => {
      const env = envMap.get(rule.env_id)
      return {
        ...rule,
        env_name: rule.env_name || env?.name,
        env_color: rule.env_color || env?.color
      }
    })
    
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载规则列表失败:', error)
    ElMessage.error('加载规则列表失败')
  } finally {
    loading.value = false
  }
}

// 执行规则匹配
const handleExecuteRules = () => {
  executeDialogVisible.value = true
}

const confirmExecuteRules = async () => {
  try {
    executing.value = true
    await executeRulesApi()
    ElMessage.success('规则匹配执行完成')
    executeDialogVisible.value = false
    loadRules()
  } catch (error: any) {
    ElMessage.error(error.message || '执行失败')
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

// 状态切换前守卫：禁用规则会停止自动绑定，需二次确认（走统一确认弹窗）；启用直接放行
let disableResolveFn: ((ok: boolean) => void) | null = null
const beforeStatusChange = (rule: BindingRule) => {
  if (!rule.enabled) return true
  return new Promise<boolean>((resolve) => {
    disableResolveFn = resolve
    confirmMode.value = 'disable'
    confirmRule.value = rule
    confirmVisible.value = true
  })
}

// 启用：直接调（禁用走确认弹窗，见 beforeStatusChange → handleConfirm）
const handleStatusChange = async (rule: BindingRule) => {
  statusLoadingId.value = rule.id
  try {
    await updateRuleApi(rule.id, { enabled: true })
    ElMessage.success('已启用')
    loadRules()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  } finally {
    statusLoadingId.value = null
  }
}

// 删除：打开确认弹窗
const handleDelete = (rule: BindingRule) => {
  confirmMode.value = 'delete'
  confirmRule.value = rule
  confirmVisible.value = true
}

// 解绑：打开确认弹窗（清绑定、保留规则）
const handleUnbind = (rule: BindingRule) => {
  confirmMode.value = 'unbind'
  confirmRule.value = rule
  confirmVisible.value = true
}

// 确认弹窗：删除 → 调删除接口；禁用 → 调禁用接口并放行开关翻转
const handleConfirm = async () => {
  const rule = confirmRule.value
  if (!rule) return
  confirmLoading.value = true
  try {
    if (confirmMode.value === 'delete') {
      await deleteRuleApi(rule.id)
      ElMessage.success('删除成功')
    } else if (confirmMode.value === 'disable') {
      await updateRuleApi(rule.id, { enabled: false })
      ElMessage.success('已禁用')
    } else {
      const res = await unbindRuleApi(rule.id)
      ElMessage.success(`已解绑 ${res.data ?? 0} 个资源`)
    }
    disableResolveFn?.(true)
    loadRules()
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
    disableResolveFn?.(false)
  } finally {
    confirmLoading.value = false
    disableResolveFn = null
    confirmVisible.value = false
  }
}

// 弹窗关闭（取消）：禁用开关回退
const handleConfirmClose = (visible: boolean) => {
  confirmVisible.value = visible
  if (!visible) {
    disableResolveFn?.(false)
    disableResolveFn = null
  }
}

// 表单成功
const handleFormSuccess = () => {
  formDialogVisible.value = false
  loadRules()
}

// 改绑成功后刷新规则列表（匹配数/执行统计可能变化）
const handleRebindSuccess = () => {
  loadRules()
}

onMounted(async () => {
  await loadEnvironments()
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

    :deep(.el-table) {
      background: transparent;

      th.el-table__cell {
        background: var(--table-header-bg);
      }

      tr {
        background: transparent;

        &:hover > td.el-table__cell {
          background: var(--table-row-hover);
        }
      }

      td.el-table__cell {
        background: transparent;
      }

      .el-table__row--striped td.el-table__cell {
        background: rgba(255, 255, 255, 0.02);
      }
    }

    .env-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;

      .env-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
    }

    .text-muted {
      color: var(--text-muted);
    }
  }

  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
