<template>
  <PageContainer>
    <ManagerHeader
      title="成本分析"
      subtitle="分析云平台成本趋势和分布"
      @refresh="fetchCostAnalysis"
    />

    <div class="cost-analysis-content">
      <!-- 筛选器 -->
      <div class="filters-container">
        <el-form :inline="true" class="filters-form">
          <el-form-item label="云厂商">
            <el-select
              v-model="filters.provider"
              placeholder="请选择云厂商"
              @change="handleFilterChange"
            >
              <el-option
                v-for="p in CLOUD_PROVIDERS"
                :key="p.value"
                :label="p.label"
                :value="p.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="时间范围">
            <el-select
              v-model="filters.days"
              placeholder="请选择时间范围"
              @change="handleFilterChange"
            >
              <el-option label="最近7天" :value="7" />
              <el-option label="最近15天" :value="15" />
              <el-option label="最近30天" :value="30" />
              <el-option label="最近60天" :value="60" />
              <el-option label="最近90天" :value="90" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <div v-loading="loading">
        <!-- 总成本卡片 -->
        <div class="total-cost-card">
          <StatCard
            title="总成本"
            :value="formatCost(costAnalysis?.total_cost || 0)"
            icon="Money"
            icon-color="#10B981"
            :subtitle="`${filters.provider ? getProviderLabel(filters.provider) : '所有云厂商'} - 最近${filters.days}天`"
            :format-value="false"
          />
        </div>

        <!-- 成本趋势图 -->
        <div class="cost-chart-container">
          <CostChart :data="costAnalysis?.daily_costs || []" :loading="loading" />
        </div>

        <!-- 成本分解 -->
        <div class="cost-breakdown-container">
          <CostBreakdown
            :asset-costs="costAnalysis?.asset_costs || []"
            :region-costs="costAnalysis?.region_costs || {}"
          />
        </div>

        <!-- 空状态 -->
        <el-empty
          v-if="!loading && !costAnalysis"
          description="请选择云厂商查看成本分析"
        />
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { getCostAnalysisApi } from '@/api'
import type { CostAnalysisResponse } from '@/api/types/cost'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import StatCard from '@/components/StatCard.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { formatCost } from '@/utils/formatters'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import CostBreakdown from './components/CostBreakdown.vue'
import CostChart from './components/CostChart.vue'

// 状态
const loading = ref(false)
const costAnalysis = ref<CostAnalysisResponse | null>(null)

// 筛选条件
const filters = reactive({
  provider: '',
  days: 30,
})

// 获取成本分析数据
const fetchCostAnalysis = async () => {
  if (!filters.provider) {
    ElMessage.warning('请先选择云厂商')
    return
  }

  loading.value = true
  try {
    const { data } = await getCostAnalysisApi({
      provider: filters.provider,
      days: filters.days,
    })
    costAnalysis.value = data
  } catch (error: any) {
    ElMessage.error(error.message || '获取成本分析失败')
    costAnalysis.value = null
  } finally {
    loading.value = false
  }
}

// 筛选变化
const handleFilterChange = () => {
  fetchCostAnalysis()
}

// 初始化
onMounted(() => {
  // 默认选择第一个云厂商
  if (CLOUD_PROVIDERS.length > 0) {
    filters.provider = CLOUD_PROVIDERS[0].value
    fetchCostAnalysis()
  }
})
</script>

<style scoped lang="scss">
.cost-analysis-content {
  .filters-container {
    margin-bottom: calc(1rem + 0.2vw);
    padding: calc(1rem + 0.2vw);
    background: white;
    border-radius: calc(0.4rem + 0.1vw);
    box-shadow:
      0 1px 3px 0 rgba(0, 0, 0, 0.1),
      0 1px 2px 0 rgba(0, 0, 0, 0.06);

    .filters-form {
      margin: 0;

      :deep(.el-form-item) {
        margin-bottom: 0;
      }
    }
  }

  .total-cost-card {
    margin-bottom: calc(1rem + 0.2vw);
  }

  .cost-chart-container {
    margin-bottom: calc(1rem + 0.2vw);
  }

  .cost-breakdown-container {
    margin-bottom: calc(1rem + 0.2vw);
  }
}
</style>
