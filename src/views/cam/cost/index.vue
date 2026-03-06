<template>
  <PageContainer>
    <ManagerHeader
      title="成本概览"
      subtitle="多云成本分析与 FinOps 管理"
      :show-add-button="false"
      @refresh="refreshAll"
    />

    <!-- 筛选器 -->
    <CostFilters
      :model-value="filters"
      @update:model-value="handleFiltersUpdate"
      @search="handleSearch"
      @refresh="refreshAll"
    />

    <!-- 成本概览卡片 -->
    <CostSummaryCards :summary="summary" />

    <!-- 图表区域 -->
    <el-row :gutter="16" class="charts-row">
      <el-col :span="10">
        <CostDistributionChart
          :data="distributionData"
          :loading="distributionLoading"
          @dimension-change="handleDimensionChange"
        />
      </el-col>
      <el-col :span="14">
        <CostTrendChart
          :data="trendData"
          :loading="trendLoading"
          @granularity-change="handleGranularityChange"
        />
      </el-col>
    </el-row>

    <!-- 同比环比对比 -->
    <div class="comparison-section">
      <div class="section-header">
        <span class="section-title">同比/环比对比</span>
      </div>
      <el-row :gutter="16">
        <el-col :span="12">
          <div class="comparison-card">
            <div class="comparison-label">环比（与上月对比）</div>
            <div class="comparison-body" v-if="comparison">
              <div class="comparison-row">
                <span class="period">{{ comparison.current_period }}</span>
                <span class="amount">¥{{ comparison.current_amount.toFixed(2) }}</span>
              </div>
              <div class="comparison-row muted">
                <span class="period">{{ comparison.previous_period }}</span>
                <span class="amount">¥{{ comparison.previous_amount.toFixed(2) }}</span>
              </div>
              <div class="comparison-change" :class="changeClass(comparison.change_percent)">
                <span v-if="comparison.change_percent > 0">+</span>{{ comparison.change_percent.toFixed(1) }}%
              </div>
            </div>
            <div v-else class="comparison-empty">
              <el-empty description="暂无数据" :image-size="60" />
            </div>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="comparison-card">
            <div class="comparison-label">同比（与去年同期对比）</div>
            <div class="comparison-body" v-if="yoyComparison">
              <div class="comparison-row">
                <span class="period">{{ yoyComparison.current_period }}</span>
                <span class="amount">¥{{ yoyComparison.current_amount.toFixed(2) }}</span>
              </div>
              <div class="comparison-row muted">
                <span class="period">{{ yoyComparison.previous_period }}</span>
                <span class="amount">¥{{ yoyComparison.previous_amount.toFixed(2) }}</span>
              </div>
              <div class="comparison-change" :class="changeClass(yoyComparison.change_percent)">
                <span v-if="yoyComparison.change_percent > 0">+</span>{{ yoyComparison.change_percent.toFixed(1) }}%
              </div>
            </div>
            <div v-else class="comparison-empty">
              <el-empty description="暂无数据" :image-size="60" />
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    getCostComparisonApi,
    getCostDistributionApi,
    getCostSummaryApi,
    getCostTrendApi
} from '@/api/finops'
import type {
    ComparisonResult,
    CostDistItem,
    CostFilterParams,
    CostSummary,
    CostTrendPoint
} from '@/api/types/finops'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import CostDistributionChart from './components/CostDistributionChart.vue'
import type { CostFilterValues } from './components/CostFilters.vue'
import CostFilters from './components/CostFilters.vue'
import CostSummaryCards from './components/CostSummaryCards.vue'
import CostTrendChart from './components/CostTrendChart.vue'

// ==================== 筛选状态 ====================

const filters = reactive<CostFilterValues>({
  provider: '',
  account_id: undefined,
  service_type: '',
  region: '',
  start_date: (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 2)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })(),
  end_date: (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })(),
})

const currentDimension = ref('provider')
const currentGranularity = ref<'daily' | 'weekly' | 'monthly'>('daily')

// ==================== 数据状态 ====================

const summary = reactive<CostSummary>({
  current_month_amount: 0,
  last_month_amount: 0,
  mom_change_percent: 0,
})

const distributionData = ref<CostDistItem[]>([])
const distributionLoading = ref(false)

const trendData = ref<CostTrendPoint[]>([])
const trendLoading = ref(false)

const comparison = ref<ComparisonResult | null>(null)
const yoyComparison = ref<ComparisonResult | null>(null)

// ==================== 工具函数 ====================

const buildFilterParams = (): CostFilterParams => {
  const params: CostFilterParams = {}
  if (filters.provider) params.provider = filters.provider
  if (filters.account_id) params.account_id = filters.account_id
  if (filters.service_type) params.service_type = filters.service_type
  if (filters.region) params.region = filters.region
  if (filters.start_date) params.start_date = filters.start_date
  if (filters.end_date) params.end_date = filters.end_date
  return params
}

const changeClass = (percent: number) => {
  if (percent > 0) return 'increase'
  if (percent < 0) return 'decrease'
  return ''
}

// ==================== 数据获取 ====================

const fetchSummary = async () => {
  try {
    const res = await getCostSummaryApi(buildFilterParams())
    const data = (res as any).data || res
    Object.assign(summary, data)
  } catch (e: any) {
    ElMessage.error(e.message || '获取成本概览失败')
  }
}

const fetchDistribution = async () => {
  distributionLoading.value = true
  try {
    const res = await getCostDistributionApi({
      ...buildFilterParams(),
      dimension: currentDimension.value as any,
    })
    distributionData.value = (res as any).data || res || []
  } catch (e: any) {
    distributionData.value = []
    ElMessage.error(e.message || '获取成本分布失败')
  } finally {
    distributionLoading.value = false
  }
}

const fetchTrend = async () => {
  trendLoading.value = true
  try {
    const res = await getCostTrendApi({
      ...buildFilterParams(),
      granularity: currentGranularity.value,
    })
    trendData.value = (res as any).data || res || []
  } catch (e: any) {
    trendData.value = []
    ElMessage.error(e.message || '获取成本趋势失败')
  } finally {
    trendLoading.value = false
  }
}

const fetchComparison = async () => {
  try {
    const res = await getCostComparisonApi(buildFilterParams())
    comparison.value = (res as any).data || res || null
  } catch {
    comparison.value = null
  }
  // YoY uses the same endpoint; backend differentiates via date range
  // For now we show the same comparison data as a placeholder
  yoyComparison.value = comparison.value
}

const refreshAll = () => {
  fetchSummary()
  fetchDistribution()
  fetchTrend()
  fetchComparison()
}

// ==================== 事件处理 ====================

const handleFiltersUpdate = (newFilters: CostFilterValues) => {
  Object.assign(filters, newFilters)
}

const handleSearch = () => {
  refreshAll()
}

const handleDimensionChange = (dimension: string) => {
  currentDimension.value = dimension
  fetchDistribution()
}

const handleGranularityChange = (granularity: string) => {
  currentGranularity.value = granularity as 'daily' | 'weekly' | 'monthly'
  fetchTrend()
}

// ==================== 生命周期 ====================

onMounted(() => {
  refreshAll()
})
</script>

<style scoped lang="scss">
.charts-row {
  margin-bottom: 16px;
}

.comparison-section {
  margin-bottom: 16px;

  .section-header {
    margin-bottom: 12px;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
}

.comparison-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;

  .comparison-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 16px;
  }

  .comparison-body {
    .comparison-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;

      .period {
        font-size: 13px;
        color: var(--text-primary);
      }

      .amount {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
      }

      &.muted {
        .period,
        .amount {
          color: var(--text-tertiary);
        }

        .amount {
          font-weight: 400;
          font-size: 14px;
        }
      }
    }

    .comparison-change {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);
      font-size: 22px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--text-secondary);

      &.increase {
        color: #EF4444;
      }

      &.decrease {
        color: #10B981;
      }
    }
  }

  .comparison-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
  }
}
</style>
