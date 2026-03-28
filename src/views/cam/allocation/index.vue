<template>
  <PageContainer>
    <ManagerHeader
      title="成本分摊"
      subtitle="配置分摊规则，按多维度查看成本归属"
      :show-add-button="false"
      @refresh="handleRefresh"
    />

    <el-tabs v-model="activeTab" class="allocation-tabs">
      <!-- 分摊视图 Tab -->
      <el-tab-pane label="分摊视图" name="tree">
        <div class="tab-toolbar">
          <el-select v-model="treeDimType" placeholder="分摊维度" style="width: 180px" @change="fetchTree">
            <el-option label="按云厂商" value="provider" />
            <el-option label="按云账号" value="cloud_account" />
            <el-option label="按产品类别" value="product_category" />
            <el-option label="按服务类型" value="service_type" />
            <el-option label="按地域" value="region" />
            <el-option label="按项目" value="project" />
            <el-option label="按标签" value="tag" />
          </el-select>
          <el-date-picker
            v-model="treePeriod"
            type="month"
            placeholder="选择月份"
            format="YYYY-MM"
            value-format="YYYY-MM"
            style="width: 160px"
            @change="fetchTree"
          />
          <el-button @click="fetchTree" :loading="treeLoading">刷新</el-button>
          <el-popconfirm title="将根据当前规则重新计算分摊结果，确定执行？" @confirm="handleReallocate">
            <template #reference>
              <el-button type="warning" :loading="reallocating">执行分摊计算</el-button>
            </template>
          </el-popconfirm>
        </div>

        <!-- 汇总卡片 -->
        <div v-if="treeSummary.total > 0" class="summary-row">
          <div class="summary-card">
            <span class="summary-label">当月总成本</span>
            <span class="summary-value">{{ formatCost(treeSummary.total) }}</span>
          </div>
          <div class="summary-card">
            <span class="summary-label">分摊维度数</span>
            <span class="summary-value">{{ treeSummary.count }}</span>
          </div>
        </div>

        <!-- 图表区域 -->
        <div v-if="treeData.length > 0" class="allocation-chart-card">
          <div class="chart-header">
            <span class="chart-title">成本分布图</span>
            <el-radio-group v-model="chartType" size="small" @change="renderAllocationChart">
              <el-radio-button value="bar">柱形图</el-radio-button>
              <el-radio-button value="pie">饼形图</el-radio-button>
            </el-radio-group>
          </div>
          <div ref="allocationChartRef" class="chart-content"></div>
        </div>

        <div class="allocation-table-card">
          <el-table
            :data="treeData"
            v-loading="treeLoading"
            row-key="id"
            stripe
            style="width: 100%"
            :default-sort="{ prop: 'total_amount', order: 'descending' }"
          >
            <el-table-column prop="name" label="名称" min-width="200">
              <template #default="{ row }">
                <span class="dim-name">{{ row.name || '未分类' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="total_amount" label="成本金额" min-width="140" sortable>
              <template #default="{ row }">
                {{ formatCost(row.total_amount || 0) }}
              </template>
            </el-table-column>
            <el-table-column label="占比" min-width="200">
              <template #default="{ row }">
                <div class="pct-cell">
                  <el-progress
                    :percentage="row.percentage || 0"
                    :stroke-width="16"
                    :show-text="false"
                    :color="getPctColor(row.percentage || 0)"
                    style="flex: 1"
                  />
                  <span class="pct-text">{{ (row.percentage || 0).toFixed(1) }}%</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 分摊规则 Tab -->
      <el-tab-pane label="分摊规则" name="rules">
        <div class="tab-toolbar">
          <el-button type="primary" @click="openCreateDialog">创建规则</el-button>
          <el-button @click="openDefaultPolicyDialog">默认分摊策略</el-button>
        </div>

        <div class="allocation-table-card">
          <el-table :data="ruleList" v-loading="rulesLoading" stripe style="width: 100%">
            <el-table-column prop="name" label="规则名称" min-width="140" />
            <el-table-column label="规则类型" min-width="100">
              <template #default="{ row }">
                <el-tag size="small">{{ ruleTypeLabel(row.rule_type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" min-width="80" sortable />
            <el-table-column label="维度组合数" min-width="100">
              <template #default="{ row }">
                {{ row.dimension_combos?.length || 0 }}
              </template>
            </el-table-column>
            <el-table-column label="状态" min-width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'active' ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
                <el-popconfirm title="确定删除该分摊规则？" @confirm="handleDeleteRule(row.id)">
                  <template #reference>
                    <el-button link type="danger" size="small">删除</el-button>
                  </template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 创建/编辑规则对话框 -->
    <el-dialog
      v-model="ruleDialogVisible"
      :title="isEdit ? '编辑分摊规则' : '创建分摊规则'"
      width="680px"
      destroy-on-close
    >
      <el-form ref="ruleFormRef" :model="ruleForm" :rules="ruleFormRules" label-width="90px">
        <el-form-item label="规则名称" prop="name">
          <el-input v-model="ruleForm.name" placeholder="请输入规则名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="规则类型" prop="rule_type">
          <el-select v-model="ruleForm.rule_type" style="width: 100%">
            <el-option label="比例分摊" value="dimension_combo" />
            <el-option label="标签映射" value="tag_mapping" />
            <el-option label="共享资源分摊" value="shared_ratio" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级" prop="priority">
          <el-input-number v-model="ruleForm.priority" :min="1" :max="100" style="width: 100%" />
        </el-form-item>

        <el-divider content-position="left">维度组合配置</el-divider>

        <div v-for="(combo, ci) in ruleForm.dimension_combos" :key="ci" class="combo-block">
          <div class="combo-header">
            <span class="combo-title">组合 {{ ci + 1 }}</span>
            <el-button
              link type="danger" size="small"
              :disabled="ruleForm.dimension_combos.length <= 1"
              @click="removeCombo(ci)"
            >移除</el-button>
          </div>

          <el-form-item label="归属单元">
            <el-col :span="11">
              <el-input v-model="combo.target_id" placeholder="归属 ID" />
            </el-col>
            <el-col :span="2" class="combo-sep">-</el-col>
            <el-col :span="11">
              <el-input v-model="combo.target_name" placeholder="归属名称" />
            </el-col>
          </el-form-item>

          <el-form-item label="分摊比例">
            <el-input-number v-model="combo.ratio" :min="0" :max="100" :precision="2" style="width: 160px" />
            <span class="ratio-hint">%</span>
          </el-form-item>

          <el-form-item label="维度筛选">
            <div class="dim-list">
              <div v-for="(dim, di) in combo.dimensions" :key="di" class="dim-row">
                <el-select v-model="dim.dim_type" placeholder="维度类型" style="width: 140px" size="small">
                  <el-option label="部门" value="department" />
                  <el-option label="资源组" value="resource_group" />
                  <el-option label="项目" value="project" />
                  <el-option label="标签" value="tag" />
                  <el-option label="云账号" value="cloud_account" />
                  <el-option label="地域" value="region" />
                  <el-option label="服务类型" value="service_type" />
                </el-select>
                <el-input v-model="dim.dim_value" placeholder="维度值" size="small" style="width: 160px" />
                <el-button link type="danger" size="small" @click="removeDimension(ci, di)">删除</el-button>
              </div>
              <el-button link type="primary" size="small" @click="addDimension(ci)">+ 添加维度</el-button>
            </div>
          </el-form-item>
        </div>

        <el-button
          type="primary" plain size="small"
          :disabled="ruleForm.dimension_combos.length >= 5"
          @click="addCombo"
        >+ 添加维度组合</el-button>
        <span v-if="ruleForm.dimension_combos.length >= 5" class="max-hint">最多 5 个组合</span>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitRule">确定</el-button>
      </template>
    </el-dialog>

    <!-- 默认分摊策略对话框 -->
    <el-dialog v-model="defaultPolicyVisible" title="默认分摊策略" width="440px" destroy-on-close>
      <el-form :model="defaultPolicyForm" label-width="100px">
        <el-form-item label="兜底节点 ID">
          <el-input v-model="defaultPolicyForm.default_node_id" placeholder="请输入默认归属节点 ID" />
        </el-form-item>
        <el-form-item label="兜底节点名称">
          <el-input v-model="defaultPolicyForm.default_node_name" placeholder="请输入默认归属节点名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="defaultPolicyVisible = false">取消</el-button>
        <el-button type="primary" :loading="policySubmitting" @click="handleSubmitDefaultPolicy">保存</el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    createAllocationRuleApi,
    deleteAllocationRuleApi,
    getAllocationTreeApi,
    listAllocationRulesApi,
    reallocateCostsApi,
    setDefaultAllocationPolicyApi,
    updateAllocationRuleApi
} from '@/api/finops'
import type { AllocationRule, CreateAllocationRuleRequest, DimensionCombo, DimensionFilter } from '@/api/types/finops'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { formatCost } from '@/utils/formatters'
import * as echarts from 'echarts'
 
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

// ==================== Tab 状态 ====================

const activeTab = ref('tree')

const handleRefresh = () => {
  if (activeTab.value === 'rules') fetchRules()
  else fetchTree()
}

// ==================== 规则列表 ====================

const rulesLoading = ref(false)
const ruleList = ref<AllocationRule[]>([])

const fetchRules = async () => {
  rulesLoading.value = true
  try {
    const res = await listAllocationRulesApi()
    const data = (res as any).data || res
    ruleList.value = data?.items || []
  } catch (e: any) {
    ElMessage.error(e.message || '获取分摊规则失败')
  } finally {
    rulesLoading.value = false
  }
}

const handleDeleteRule = async (id: number) => {
  try {
    await deleteAllocationRuleApi(id)
    ElMessage.success('删除成功')
    fetchRules()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

const ruleTypeLabel = (t: string) => {
  const map: Record<string, string> = { dimension_combo: '比例分摊', tag_mapping: '标签映射', shared_ratio: '共享资源分摊' }
  return map[t] || t
}

// ==================== 创建/编辑规则 ====================

const ruleDialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(0)
const submitting = ref(false)
const ruleFormRef = ref<FormInstance>()

const emptyDimension = (): DimensionFilter => ({ dim_type: '', dim_value: '' })
const emptyCombo = (): DimensionCombo => ({
  dimensions: [emptyDimension()],
  target_id: '',
  target_name: '',
  ratio: 0
})

const defaultRuleForm = (): CreateAllocationRuleRequest => ({
  name: '',
  rule_type: 'dimension_combo',
  dimension_combos: [emptyCombo()],
  priority: 1
})

const ruleForm = reactive<CreateAllocationRuleRequest>(defaultRuleForm())

const ruleFormRules: FormRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  rule_type: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
  priority: [{ required: true, message: '请输入优先级', trigger: 'blur' }]
}

const openCreateDialog = () => {
  isEdit.value = false
  editingId.value = 0
  Object.assign(ruleForm, defaultRuleForm())
  ruleDialogVisible.value = true
}

const openEditDialog = (row: AllocationRule) => {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(ruleForm, {
    name: row.name,
    rule_type: row.rule_type,
    priority: row.priority,
    dimension_combos: row.dimension_combos?.map(c => ({
      dimensions: c.dimensions?.map(d => ({ ...d })) || [emptyDimension()],
      target_id: c.target_id,
      target_name: c.target_name,
      ratio: c.ratio
    })) || [emptyCombo()]
  })
  ruleDialogVisible.value = true
}

const addCombo = () => {
  if (ruleForm.dimension_combos.length < 5) {
    ruleForm.dimension_combos.push(emptyCombo())
  }
}

const removeCombo = (idx: number) => {
  ruleForm.dimension_combos.splice(idx, 1)
}

const addDimension = (comboIdx: number) => {
  ruleForm.dimension_combos[comboIdx]?.dimensions.push(emptyDimension())
}

const removeDimension = (comboIdx: number, dimIdx: number) => {
  ruleForm.dimension_combos[comboIdx]?.dimensions.splice(dimIdx, 1)
}

const handleSubmitRule = async () => {
  if (!ruleFormRef.value) return
  try {
    await ruleFormRef.value.validate()
  } catch {
    return
  }

  const totalRatio = ruleForm.dimension_combos.reduce((s, c) => s + c.ratio, 0)
  if (Math.abs(totalRatio - 100) > 0.01) {
    ElMessage.warning('所有维度组合的分摊比例之和必须为 100%')
    return
  }

  submitting.value = true
  try {
    const payload = { ...ruleForm, dimension_combos: ruleForm.dimension_combos.map(c => ({ ...c })) }
    if (isEdit.value) {
      await updateAllocationRuleApi(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await createAllocationRuleApi(payload)
      ElMessage.success('创建成功')
    }
    ruleDialogVisible.value = false
    fetchRules()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

// ==================== 默认分摊策略 ====================

const defaultPolicyVisible = ref(false)
const policySubmitting = ref(false)
const defaultPolicyForm = reactive({ default_node_id: '', default_node_name: '' })

const openDefaultPolicyDialog = () => {
  defaultPolicyForm.default_node_id = ''
  defaultPolicyForm.default_node_name = ''
  defaultPolicyVisible.value = true
}

const handleSubmitDefaultPolicy = async () => {
  if (!defaultPolicyForm.default_node_id) {
    ElMessage.warning('请输入兜底节点 ID')
    return
  }
  policySubmitting.value = true
  try {
    await setDefaultAllocationPolicyApi({ ...defaultPolicyForm })
    ElMessage.success('默认分摊策略已保存')
    defaultPolicyVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    policySubmitting.value = false
  }
}

// ==================== 分摊树形视图 ====================

const treeLoading = ref(false)
const reallocating = ref(false)
const treeDimType = ref('provider')
const treePeriod = ref((() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })())
const treeData = ref<any[]>([])
const treeSummary = ref({ total: 0, count: 0 })
const chartType = ref<'bar' | 'pie'>('bar')
const allocationChartRef = ref<HTMLElement>()
let allocationChart: any = null

const CHART_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6']
const MAX_CHART_ITEMS = 10

const fetchTree = async () => {
  treeLoading.value = true
  try {
    const res = await getAllocationTreeApi({
      dim_type: treeDimType.value,
      root_id: '',
      period: treePeriod.value
    })
    const data = (res as any).data || res
    const children = data?.children || (Array.isArray(data) ? data : [])
    const totalAmount = data?.total_amount || children.reduce((s: number, c: any) => s + (c.total_amount || 0), 0)
    // 映射后端字段到前端表格字段，并计算占比
    treeData.value = children.map((item: any) => mapTreeNode(item, totalAmount))
    treeSummary.value = { total: totalAmount, count: treeData.value.length }
    nextTick(renderAllocationChart)
  } catch (e: any) {
    ElMessage.error(e.message || '获取分摊视图失败')
  } finally {
    treeLoading.value = false
  }
}

/** 将后端 node_id/node_name 映射为前端 id/name，并递归处理 children */
const mapTreeNode = (item: any, parentTotal: number): any => {
  const amount = item.total_amount || 0
  const pct = parentTotal > 0 ? (amount / parentTotal) * 100 : 0
  const children = item.children?.map((c: any) => mapTreeNode(c, amount)) || []
  return {
    id: item.node_id || item.id || '',
    name: item.node_name || item.name || item.node_id || '',
    total_amount: amount,
    percentage: pct,
    children: children.length > 0 ? children : undefined
  }
}

/** 进度条颜色 */
const getPctColor = (pct: number) => {
  if (pct >= 50) return '#F56C6C'
  if (pct >= 25) return '#E6A23C'
  return '#409EFF'
}

const handleReallocate = async () => {
  reallocating.value = true
  try {
    await reallocateCostsApi(treePeriod.value)
    ElMessage.success('分摊计算已提交，请稍后刷新查看结果')
    setTimeout(() => fetchTree(), 2000)
  } catch (e: any) {
    ElMessage.error(e.message || '分摊计算失败')
  } finally {
    reallocating.value = false
  }
}

// ==================== 图表渲染 ====================

/** 准备图表数据：Top N + 其他 */
const prepareChartData = () => {
  const sorted = [...treeData.value].sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
  if (sorted.length <= MAX_CHART_ITEMS) return sorted
  const top = sorted.slice(0, MAX_CHART_ITEMS - 1)
  const rest = sorted.slice(MAX_CHART_ITEMS - 1)
  const otherAmount = rest.reduce((s, r) => s + (r.total_amount || 0), 0)
  top.push({ id: '__other__', name: `其他 (${rest.length}项)`, total_amount: otherAmount, percentage: 0 })
  return top
}

const renderAllocationChart = () => {
  if (!allocationChartRef.value || !treeData.value.length) return

  if (allocationChart && allocationChart.getDom() !== allocationChartRef.value) {
    allocationChart.dispose()
    allocationChart = null
  }
  if (!allocationChart) {
    allocationChart = echarts.init(allocationChartRef.value)
  }

  const items = prepareChartData()
  const names = items.map(i => i.name || '未分类')
  const values = items.map(i => i.total_amount || 0)

  if (chartType.value === 'bar') {
    allocationChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params
          const total = treeSummary.value.total || 1
          const pct = ((p.value / total) * 100).toFixed(1)
          return `${p.name}<br/>¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} (${pct}%)`
        }
      },
      grid: { left: 120, right: 24, top: 12, bottom: 24 },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}`
        }
      },
      yAxis: {
        type: 'category',
        data: names.slice().reverse(),
        axisLabel: {
          width: 100,
          overflow: 'truncate',
          fontSize: 12
        }
      },
      series: [{
        type: 'bar',
        data: values.slice().reverse().map((v, i) => ({
          value: v,
          itemStyle: { color: CHART_COLORS[(names.length - 1 - i) % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] }
        })),
        barMaxWidth: 28
      }]
    }, true)
  } else {
    const pieData = items.map((item, i) => ({
      name: item.name || '未分类',
      value: item.total_amount || 0,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] }
    }))
    allocationChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/>¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })} (${p.percent}%)`
      },
      legend: {
        orient: 'vertical',
        right: 16,
        top: 'center',
        textStyle: { fontSize: 12 }
      },
      series: [{
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' }
        },
        data: pieData
      }]
    }, true)
  }
}

const handleChartResize = () => allocationChart?.resize()

// ==================== 生命周期 ====================

watch(activeTab, (tab) => {
  if (tab === 'rules' && ruleList.value.length === 0) {
    fetchRules()
  }
})

onMounted(() => {
  fetchTree()
  window.addEventListener('resize', handleChartResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleChartResize)
  allocationChart?.dispose()
  allocationChart = null
})
</script>

<style scoped lang="scss">
.allocation-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }
}

.tab-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.allocation-table-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

// 图表卡片
.allocation-chart-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .chart-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }

  .chart-content {
    width: 100%;
    height: 360px;
  }
}

// 维度组合块
.combo-block {
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;

  .combo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .combo-title {
      font-weight: 600;
      font-size: 13px;
      color: var(--el-text-color-primary);
    }
  }
}

.combo-sep {
  text-align: center;
  line-height: 32px;
}

.ratio-hint {
  margin-left: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.dim-list {
  width: 100%;

  .dim-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
}

.max-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

// 汇总行
.summary-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;

  .summary-card {
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 160px;

    .summary-label {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    .summary-value {
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}

// 占比单元格
.pct-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .pct-text {
    min-width: 48px;
    text-align: right;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}

.dim-name {
  font-weight: 500;
}
</style>
