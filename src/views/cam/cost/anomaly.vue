<template>
  <PageContainer>
    <ManagerHeader
      :title-level="1"
      title="异常事件与优化建议"
      subtitle="成本异常检测与资源优化建议"
      :show-add-button="false"
      @refresh="refreshCurrentTab"
    />

    <div class="anomaly-page">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- 异常事件 Tab -->
        <el-tab-pane label="异常事件" name="anomalies">
          <div class="filter-bar">
            <el-select
              v-model="anomalyFilter.severity"
              placeholder="严重程度"
              clearable
              style="width: 160px"
              @change="fetchAnomalies"
            >
              <el-option label="全部" value="" />
              <el-option label="信息" value="info" />
              <el-option label="警告" value="warning" />
              <el-option label="严重" value="critical" />
            </el-select>
            <el-popconfirm title="将基于昨日账单数据执行异常检测，确定执行？" @confirm="handleTriggerDetection">
              <template #reference>
                <el-button type="primary" :loading="detecting">手动检测</el-button>
              </template>
            </el-popconfirm>
          </div>

          <!-- 错误态（iter198）：请求失败时持久显示原因 + 重试，而不是把失败渲染成「暂无数据」 -->
          <ErrorDisplay
            v-if="anomalyError"
            :error-info="anomalyError"
            @retry="fetchAnomalies"
          />

          <el-table
            v-else
            :data="anomalies"
            v-loading="anomalyLoading"
            :default-sort="{ prop: 'severity', order: 'descending' }"
            class="glass-table"
          >
            <el-table-column prop="anomaly_date" label="日期" width="120" />
            <el-table-column prop="dimension" label="维度" width="120" />
            <el-table-column prop="dimension_value" label="维度值" min-width="120" />
            <el-table-column prop="actual_amount" label="实际金额" width="130" align="right">
              <template #default="{ row }">{{ formatCost(row.actual_amount) }}</template>
            </el-table-column>
            <el-table-column prop="baseline_amount" label="基线金额" width="130" align="right">
              <template #default="{ row }">{{ formatCost(row.baseline_amount) }}</template>
            </el-table-column>
            <el-table-column prop="deviation_pct" label="偏离%" width="100" align="right">
              <template #default="{ row }">
                <span :class="row.deviation_pct > 0 ? 'text-danger' : 'text-success'">
                  {{ row.deviation_pct > 0 ? '+' : '' }}{{ row.deviation_pct.toFixed(1) }}%
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="severity" label="严重程度" width="110" sortable :sort-method="sortBySeverity">
              <template #default="{ row }">
                <el-tag :type="severityTagType(row.severity)" size="small">
                  {{ severityLabel(row.severity) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="possible_cause" label="可能原因" min-width="180" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <!-- 优化建议 Tab -->
        <el-tab-pane label="优化建议" name="recommendations">
          <div class="filter-bar">
            <el-select
              v-model="recFilter.type"
              placeholder="建议类型"
              clearable
              style="width: 160px"
              @change="fetchRecommendations"
            >
              <el-option label="全部" value="" />
              <el-option label="降配建议" value="downsize" />
              <el-option label="释放云盘" value="release_disk" />
              <el-option label="转包年包月" value="convert_prepaid" />
            </el-select>
          </div>

          <!-- 错误态（iter198）：同异常事件 -->
          <ErrorDisplay
            v-if="recError"
            :error-info="recError"
            @retry="fetchRecommendations"
          />

          <el-table
            v-else
            :data="recommendations"
            v-loading="recLoading"
            class="glass-table"
          >
            <el-table-column prop="type" label="类型" width="120">
              <template #default="{ row }">{{ recTypeLabel(row.type) }}</template>
            </el-table-column>
            <el-table-column prop="provider" label="云厂商" width="100">
              <template #default="{ row }">{{ getProviderLabel(row.provider) }}</template>
            </el-table-column>
            <el-table-column prop="resource_name" label="资源名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="resource_id" label="资源ID" min-width="160" show-overflow-tooltip />
            <el-table-column prop="region" label="地域" width="120" />
            <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
            <el-table-column prop="estimated_saving" label="预估月节省" width="130" align="right">
              <template #default="{ row }">{{ formatCost(row.estimated_saving) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'pending' ? 'warning' : 'info'" size="small">
                  {{ row.status === 'pending' ? '待处理' : '已忽略' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'pending'"
                  type="warning"
                  link
                  size="small"
                  @click="handleDismiss(row)"
                >
                  忽略
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { dismissRecommendationApi, getCostAnomaliesApi, getRecommendationsApi, triggerAnomalyDetectionApi } from '@/api/finops'
import type { CostAnomaly, Recommendation } from '@/api/types/finops'
import { ManagerHeader } from '@haven/ui/ManagerHeader'
import PageContainer from '@/components/PageContainer/index.vue'
import { getProviderLabel } from '@/utils/constants'
import { formatCost } from '@/utils/formatters'
import { ElMessage, ElMessageBox } from 'element-plus'
import ErrorDisplay from '@/components/ErrorDisplay.vue'
import { onMounted, reactive, ref, watch } from 'vue'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { showApiError } from '@/api/request'

// ==================== Tab 状态 ====================

const activeTab = ref('anomalies')

// 当前页签同步 URL（iter153）：此前切到「优化建议」页签后 URL 不变，
// 刷新 / 分享链接 / 从建议详情返回都会掉回「异常事件」。
const urlTab = reactive<Record<string, string | undefined>>({ tab: activeTab.value || undefined })
useUrlFilters(urlTab)
watch(activeTab, (v) => { urlTab.tab = v || undefined })
if (urlTab.tab) activeTab.value = String(urlTab.tab)

// ==================== 异常事件 ====================

const anomalyFilter = reactive({ severity: '' })
// 异常事件的严重程度筛选同步 URL（'sev'）
useUrlFilters(anomalyFilter, {})

const anomalies = ref<CostAnomaly[]>([])
const anomalyLoading = ref(false)
/**
 * 异常事件的加载错误（iter198）。
 *
 * 原先 catch 里只 `ElMessage.error` + `anomalies.value = []` —— toast 3 秒后消失，
 * 表格随即显示「暂无数据」，用户会**误以为成本异常真的是 0 条**，而实际是请求失败。
 * 改为像 ECS 那样持有 errorInfo，由 <ErrorDisplay> 渲染**持久**的错误态 + 重试入口。
 */
const anomalyError = ref<{ message: string; code?: string | number } | null>(null)
const detecting = ref(false)

const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 }

const severityTagType = (s: string): 'danger' | 'warning' | 'info' => {
  if (s === 'critical') return 'danger'
  if (s === 'warning') return 'warning'
  return 'info'
}

const severityLabel = (s: string) => {
  if (s === 'critical') return '严重'
  if (s === 'warning') return '警告'
  return '信息'
}

const sortBySeverity = (a: CostAnomaly, b: CostAnomaly) => {
  return (severityOrder[a.severity] || 0) - (severityOrder[b.severity] || 0)
}

const fetchAnomalies = async () => {
  anomalyLoading.value = true
  try {
    const params: Record<string, any> = {}
    if (anomalyFilter.severity) params.severity = anomalyFilter.severity
    const res = await getCostAnomaliesApi(params)
    const data = (res as any).data || res
    anomalies.value = data?.items || []
    anomalyError.value = null
  } catch (e: any) {
    // 不再只靠瞬时 toast：保留持久错误态，避免把「请求失败」渲染成「暂无数据」
    anomalyError.value = { message: e?.message || '获取异常事件失败', code: e?.code }
    anomalies.value = []
  } finally {
    anomalyLoading.value = false
  }
}

const handleTriggerDetection = async () => {
  detecting.value = true
  try {
    await triggerAnomalyDetectionApi()
    ElMessage.success('异常检测已提交，请稍后刷新查看结果')
    setTimeout(() => fetchAnomalies(), 3000)
  } catch (e: any) {
    showApiError(e, '触发异常检测失败')
  } finally {
    detecting.value = false
  }
}

// ==================== 优化建议 ====================

const recFilter = reactive({ type: '' })
// 优化建议的建议类型筛选同步 URL。
// 页面上已有 urlTab（tab）与 anomalyFilter（severity）两个实例 ——
// useUrlFilters 每个实例只增删自己的 key，互不干扰（见 S51）。
useUrlFilters(recFilter, {})

const recommendations = ref<Recommendation[]>([])
const recLoading = ref(false)

const recTypeLabel = (t: string) => {
  const map: Record<string, string> = {
    downsize: '降配建议',
    release_disk: '释放云盘',
    convert_prepaid: '转包年包月',
  }
  return map[t] || t
}

/** 优化建议的加载错误（iter198，同 anomalyError 的理由） */
const recError = ref<{ message: string; code?: string | number } | null>(null)

const fetchRecommendations = async () => {
  recLoading.value = true
  try {
    const params: Record<string, any> = {}
    if (recFilter.type) params.type = recFilter.type
    const res = await getRecommendationsApi(params)
    const data = (res as any).data || res
    recommendations.value = data?.items || []
    recError.value = null
  } catch (e: any) {
    recError.value = { message: e?.message || '获取优化建议失败', code: e?.code }
    recommendations.value = []
  } finally {
    recLoading.value = false
  }
}

const handleDismiss = async (row: Recommendation) => {
  try {
    await ElMessageBox.confirm(`确定忽略该建议？忽略后 30 天内不再展示同资源同类型建议。`, '确认忽略', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    // user cancelled
    return
  }
  try {
    await dismissRecommendationApi(row.id)
    ElMessage.success('已忽略该建议')
    fetchRecommendations()
  } catch (e: any) {
    ElMessage.error(e?.message || '忽略建议失败')
  }
}

// ==================== Tab 切换与刷新 ====================

const handleTabChange = (tab: string | number) => {
  if (tab === 'anomalies') fetchAnomalies()
  else fetchRecommendations()
}

const refreshCurrentTab = () => {
  if (activeTab.value === 'anomalies') fetchAnomalies()
  else fetchRecommendations()
}

// ==================== 生命周期 ====================

onMounted(() => {
  fetchAnomalies()
})
</script>

<style scoped lang="scss">
.anomaly-page {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 20px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.glass-table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
}

.text-danger {
  color: #ef4444;
  font-weight: 500;
}

.text-success {
  color: #10b981;
  font-weight: 500;
}
</style>
