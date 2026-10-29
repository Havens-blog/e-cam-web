<template>
  <PageContainer>
    <ManagerHeader
      title="预算管理"
      subtitle="设置预算规则，监控成本消耗进度"
      :title-level="1"
      add-button-text="创建预算"
      @add="openCreateDialog"
      @refresh="fetchAll"
    />

    <!-- 预算规则列表 -->
    <div class="budget-table-card">
      <el-table
        :data="budgetList"
        v-loading="loading || progressLoadingAll"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
        row-class-name="clickable-row"
      >
        <el-table-column prop="name" label="预算名称" min-width="140" />
        <el-table-column label="金额上限" min-width="120">
          <template #default="{ row }">
            {{ formatCost(row.amount_limit) }}
          </template>
        </el-table-column>
        <el-table-column label="消耗进度" min-width="230">
          <template #default="{ row }">
            <div v-if="progressMap[row.id]" class="usage-cell">
              <el-progress
                :percentage="clampPercent(progressMap[row.id]!.usage_percent)"
                :stroke-width="8"
                :show-text="false"
                :color="progressColor(progressMap[row.id]!.usage_percent)"
              />
              <div class="usage-meta">
                <span class="usage-amount">{{ formatCost(currentSpend(progressMap[row.id]!)) }}</span>
                <span
                  class="usage-percent"
                  :class="{ over: isOverBudget(progressMap[row.id]!.usage_percent) }"
                >
                  {{ formatUsagePercent(progressMap[row.id]!.usage_percent) }}
                </span>
                <el-tag
                  v-if="isOverBudget(progressMap[row.id]!.usage_percent)"
                  type="danger"
                  size="small"
                >
                  超支
                </el-tag>
                <el-tag
                  v-else-if="isAtLimit(progressMap[row.id]!.usage_percent)"
                  type="warning"
                  size="small"
                >
                  已达上限
                </el-tag>
              </div>
            </div>
            <span v-else-if="progressFailed[row.id]" class="usage-missing" title="点击行可重试">
              获取失败，点击重试
            </span>
            <span v-else class="usage-missing">—</span>
          </template>
        </el-table-column>
        <el-table-column label="周期" min-width="80">
          <template #default="{ row }">
            {{ periodLabel(row.period) }}
          </template>
        </el-table-column>
        <el-table-column label="适用范围" min-width="150">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ scopeLabel(row.scope_type) }}</el-tag>
            <span v-if="row.scope_value" class="scope-value">{{ row.scope_value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="告警阈值" min-width="160">
          <template #default="{ row }">
            <el-tag
              v-for="t in row.thresholds"
              :key="t"
              size="small"
              :type="thresholdTagType(t)"
              class="threshold-tag"
            >
              {{ (t * 100).toFixed(0) }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="openProgress(row)">进度</el-button>
            <el-button link type="primary" size="small" @click.stop="openEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确定删除该预算规则？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button link type="danger" size="small" @click.stop>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 预算进度抽屉 -->
    <el-drawer v-model="progressVisible" title="预算消耗进度" size="420px" direction="rtl">
      <div v-if="progressLoading" v-loading="true" style="min-height: 200px" />
      <div v-else-if="progress" class="progress-content">
        <div class="progress-name">
          {{ progress.name }}
          <el-tag v-if="isOverBudget(progress.usage_percent)" type="danger" size="small">超支</el-tag>
          <el-tag v-else-if="isAtLimit(progress.usage_percent)" type="warning" size="small">
            已达上限
          </el-tag>
        </div>
        <div class="progress-bar-section">
          <el-progress
            :percentage="clampPercent(progress!.usage_percent)"
            :stroke-width="20"
            :color="progressColor(progress!.usage_percent)"
            :format="() => formatUsagePercent(progress!.usage_percent)"
          />
        </div>
        <div class="progress-details">
          <div class="detail-row">
            <span class="detail-label">预算上限</span>
            <span class="detail-value">{{ formatCost(amountLimit(progress!)) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">已消耗</span>
            <span class="detail-value spent">{{ formatCost(currentSpend(progress!)) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">剩余额度</span>
            <span class="detail-value remaining">{{ formatCost(remainingAmount(progress!)) }}</span>
          </div>
          <div v-if="isOverBudget(progress!.usage_percent)" class="detail-row">
            <span class="detail-label">超支金额</span>
            <span class="detail-value over">
              {{ formatCost(overBudgetAmount(progress!.current_spend, progress!.amount_limit)) }}
            </span>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无进度数据" />
    </el-drawer>

    <!-- 创建/编辑预算对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑预算规则' : '创建预算规则'"
      width="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="预算名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入预算名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="金额上限" prop="amount_limit">
          <el-input-number
            v-model="form.amount_limit"
            :min="0.01"
            :precision="2"
            :step="1000"
            placeholder="请输入金额"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="周期" prop="period">
          <el-select v-model="form.period" style="width: 100%">
            <el-option label="月度" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用范围" prop="scope_type">
          <el-select v-model="form.scope_type" style="width: 100%" @change="form.scope_value = ''">
            <el-option label="全局" value="all" />
            <el-option label="按云厂商" value="provider" />
            <el-option label="按云账号" value="account" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.scope_type === 'provider'" label="云厂商" prop="scope_value">
          <el-select v-model="form.scope_value" style="width: 100%" placeholder="请选择云厂商">
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.scope_type === 'account'" label="账号 ID" prop="scope_value">
          <el-input v-model="form.scope_value" placeholder="请输入云账号 ID" />
        </el-form-item>
        <el-form-item label="告警阈值">
          <div class="thresholds-config">
            <div v-for="(_, idx) in form.thresholds" :key="idx" class="threshold-row">
              <el-input-number
                v-model="form.thresholds[idx]"
                :min="0.01"
                :max="1"
                :step="0.1"
                :precision="2"
                size="small"
                style="width: 160px"
              />
              <span class="threshold-hint">{{ ((form.thresholds[idx] ?? 0) * 100).toFixed(0) }}%</span>
              <el-button
                link
                type="danger"
                size="small"
                :disabled="form.thresholds.length <= 1"
                @click="removeThreshold(idx)"
              >
                移除
              </el-button>
            </div>
            <el-button link type="primary" size="small" @click="addThreshold">+ 添加阈值</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    createBudgetApi,
    deleteBudgetApi,
    getBudgetProgressApi,
    listBudgetsApi,
    updateBudgetApi
} from '@/api/finops'
import type { BudgetProgress, BudgetRule, CreateBudgetRequest } from '@/api/types/finops'
import { ManagerHeader } from '@haven/ui/ManagerHeader'
import PageContainer from '@/components/PageContainer/index.vue'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import { formatCost } from '@/utils/formatters'
import {
  amountLimit,
  clampPercent,
  currentSpend,
  formatUsagePercent,
  isAtLimit,
  isOverBudget,
  normalizeProgress,
  overBudgetAmount,
  progressColor,
  remainingAmount
} from './progress'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

// ==================== 列表状态 ====================

const loading = ref(false)
const budgetList = ref<BudgetRule[]>([])
/** 预算 id -> 消耗进度（列表直接展示，避免必须点开抽屉才发现超支） */
const progressMap = ref<Record<number, BudgetProgress>>({})
const progressFailed = ref<Record<number, boolean>>({})
const progressLoadingAll = ref(false)
/** 批量进度请求令牌：刷新交错时丢弃旧结果 */
let progressBatchSeq = 0
const PROGRESS_CONCURRENCY = 4

const fetchBudgets = async () => {
  loading.value = true
  try {
    const res = await listBudgetsApi()
    const data = (res as any).data || res
    budgetList.value = data?.items || []
  } catch (e: any) {
    ElMessage.error(e.message || '获取预算列表失败')
  } finally {
    loading.value = false
  }
}

// 批量取各预算进度：单项失败只影响该行，不阻断列表
const fetchProgress = async (rules: BudgetRule[] = budgetList.value) => {
  const seq = ++progressBatchSeq
  if (!rules.length) {
    progressMap.value = {}
    progressFailed.value = {}
    progressLoadingAll.value = false
    return
  }
  progressLoadingAll.value = true
  const map: Record<number, BudgetProgress> = {}
  const failed: Record<number, boolean> = {}
  try {
    // 限制并发：每个进度请求后端会做一次当月聚合，预算多时避免打满
    for (let i = 0; i < rules.length; i += PROGRESS_CONCURRENCY) {
      const slice = rules.slice(i, i + PROGRESS_CONCURRENCY)
      const results = await Promise.allSettled(slice.map((rule) => getBudgetProgressApi(rule.id)))
      if (seq !== progressBatchSeq) return
      results.forEach((res, idx) => {
        const rule = slice[idx]
        if (!rule) return
        if (res.status === 'fulfilled') {
          const raw = (res.value as any)?.data ?? res.value
          const data = normalizeProgress(raw)
          if (data) map[rule.id] = data
          else failed[rule.id] = true
        } else {
          failed[rule.id] = true
        }
      })
    }
    if (seq !== progressBatchSeq) return
    progressMap.value = map
    progressFailed.value = failed
  } finally {
    if (seq === progressBatchSeq) progressLoadingAll.value = false
  }
}

// 列表 + 进度一起刷新
const fetchAll = async () => {
  await fetchBudgets()
  await fetchProgress()
}

// ==================== 进度抽屉 ====================

const progressVisible = ref(false)
const progressLoading = ref(false)
const progress = ref<BudgetProgress | null>(null)

const handleRowClick = (row: BudgetRule) => {
  openProgress(row)
}

/** 抽屉请求令牌：快速切换行时丢弃旧响应 */
let progressSeq = 0

/**
 * 打开进度抽屉：先渲染缓存（stale-while-revalidate），再后台刷新并回写，
 * 避免编辑金额后抽屉仍显示旧上限/旧百分比。
 */
const openProgress = async (row: BudgetRule) => {
  progressVisible.value = true
  const seq = ++progressSeq
  const cached = progressMap.value[row.id]
  progress.value = cached ?? null
  progressLoading.value = !cached
  try {
    const res = await getBudgetProgressApi(row.id)
    if (seq !== progressSeq) return
    const data = normalizeProgress((res as any)?.data ?? res)
    if (!data) throw new Error('进度数据格式异常')
    progress.value = data
    // 回填列表并清除失败态，保证列表与抽屉一致
    progressMap.value = { ...progressMap.value, [row.id]: data }
    if (progressFailed.value[row.id]) {
      const next = { ...progressFailed.value }
      delete next[row.id]
      progressFailed.value = next
    }
  } catch (e: any) {
    if (seq !== progressSeq) return
    if (!cached) ElMessage.error(e.message || '获取预算进度失败')
  } finally {
    if (seq === progressSeq) progressLoading.value = false
  }
}

// ==================== 创建/编辑对话框 ====================

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number>(0)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const defaultForm = (): CreateBudgetRequest => ({
  name: '',
  amount_limit: 10000,
  period: 'monthly',
  scope_type: 'all',
  scope_value: '',
  thresholds: [0.5, 0.8, 1.0]
})

const form = reactive<CreateBudgetRequest>(defaultForm())

const formRules: FormRules = {
  name: [{ required: true, message: '请输入预算名称', trigger: 'blur' }],
  amount_limit: [{ required: true, message: '请输入金额上限', trigger: 'blur' }],
  period: [{ required: true, message: '请选择周期', trigger: 'change' }],
  scope_type: [{ required: true, message: '请选择适用范围', trigger: 'change' }],
  scope_value: [{ required: true, message: '请填写范围值', trigger: 'blur' }]
}

const openCreateDialog = () => {
  isEdit.value = false
  editingId.value = 0
  Object.assign(form, defaultForm())
  dialogVisible.value = true
}

const openEditDialog = (row: BudgetRule) => {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    amount_limit: row.amount_limit,
    period: row.period,
    scope_type: row.scope_type,
    scope_value: row.scope_value,
    thresholds: [...row.thresholds]
  })
  dialogVisible.value = true
}

const addThreshold = () => {
  form.thresholds.push(0.9)
}

const removeThreshold = (idx: number) => {
  form.thresholds.splice(idx, 1)
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateBudgetApi(editingId.value, { ...form })
      ElMessage.success('更新成功')
    } else {
      await createBudgetApi({ ...form })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await fetchAll()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// ==================== 删除 ====================

const handleDelete = async (id: number) => {
  try {
    await deleteBudgetApi(id)
    ElMessage.success('删除成功')
    await fetchAll()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

// ==================== 工具函数 ====================

const periodLabel = (p: string) => (p === 'monthly' ? '月度' : p)

const scopeLabel = (t: string) => {
  const map: Record<string, string> = {
    all: '全局',
    provider: '云厂商',
    account: '云账号',
    service_tree_node: '服务树节点'
  }
  return map[t] || t
}

const thresholdTagType = (t: number) => {
  if (t >= 1) return 'danger'
  if (t >= 0.8) return 'warning'
  return 'info'
}

// ==================== 生命周期 ====================

onMounted(() => {
  fetchAll()
})
</script>

<style scoped lang="scss">
.budget-table-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.clickable-row {
  cursor: pointer;
}

.usage-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .usage-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;

    .usage-amount {
      color: var(--text-primary);
    }

    .usage-percent.over {
      color: var(--el-color-danger);
      font-weight: 600;
    }
  }
}

.usage-missing {
  font-size: 12px;
  color: var(--text-tertiary);
}

.scope-value {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.threshold-tag {
  margin-right: 4px;
}

// 进度抽屉
.progress-content {
  padding: 8px 0;

  .progress-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 20px;
  }

  .progress-bar-section {
    margin-bottom: 24px;
  }

  .progress-details {
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--border-subtle);

      &:last-child {
        border-bottom: none;
      }

      .detail-label {
        font-size: 14px;
        color: var(--text-secondary);
      }

      .detail-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;

        &.spent {
          color: #F59E0B;
        }

        &.remaining {
          color: #10B981;
        }

        &.over {
          color: var(--el-color-danger);
        }
      }
    }
  }
}

// 阈值配置
.thresholds-config {
  width: 100%;

  .threshold-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .threshold-hint {
      font-size: 12px;
      color: var(--text-tertiary);
      min-width: 36px;
    }
  }
}
</style>
