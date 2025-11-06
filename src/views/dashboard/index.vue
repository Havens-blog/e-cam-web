<template>
  <PageContainer>
    <ManagerHeader title="多云概览" subtitle="查看所有云平台的资产统计和成本信息" @refresh="fetchStatistics" />

    <div v-loading="loading" class="dashboard-content">
      <!-- 统计卡片区域 -->
      <div class="stats-cards">
        <StatCard
          title="总资产数"
          :value="statistics?.total_assets || 0"
          icon="Box"
          icon-color="#3B82F6"
          clickable
          @click="navigateToAssets"
        />
        <StatCard
          title="总成本"
          :value="formatCost(statistics?.total_cost || 0)"
          icon="Money"
          icon-color="#10B981"
          suffix="/月"
          :format-value="false"
        />
        <StatCard
          title="云账号数"
          :value="accountCount"
          icon="User"
          icon-color="#F59E0B"
          clickable
          @click="navigateToAccounts"
        />
        <StatCard
          title="最后同步"
          :value="formatRelativeTime(statistics?.last_discover_time)"
          icon="Clock"
          icon-color="#8B5CF6"
          :format-value="false"
        />
      </div>

      <!-- 图表区域 -->
      <div class="charts-grid">
        <!-- 云厂商分布 -->
        <ChartCard title="云厂商分布" :option="providerChartOption" :loading="loading" height="350px" />

        <!-- 资产类型分布 -->
        <ChartCard title="资产类型分布" :option="assetTypeChartOption" :loading="loading" height="350px" />

        <!-- 区域分布 -->
        <ChartCard title="区域分布" :option="regionChartOption" :loading="loading" height="350px" />

        <!-- 状态分布 -->
        <ChartCard title="状态分布" :option="statusChartOption" :loading="loading" height="350px" />
      </div>

      <!-- 快速操作区域 -->
      <div class="quick-actions">
        <el-card class="action-card">
          <template #header>
            <span class="card-title">快速操作</span>
          </template>
          <div class="actions-grid">
            <el-button type="primary" size="large" @click="navigateToAccounts">
              <el-icon><User /></el-icon>
              管理云账号
            </el-button>
            <el-button type="primary" size="large" @click="navigateToAssets">
              <el-icon><Box /></el-icon>
              查看资产
            </el-button>
            <el-button type="primary" size="large" @click="navigateToCost">
              <el-icon><TrendCharts /></el-icon>
              成本分析
            </el-button>
          </div>
        </el-card>
      </div>
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { getStatisticsApi, listCloudAccountsApi } from '@/api'
import type { Statistics } from '@/api/types/statistics'
import ChartCard from '@/components/ChartCard.vue'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import StatCard from '@/components/StatCard.vue'
import {
  generateBarChartOption,
  generateDonutChartOption,
  generatePieChartOption,
} from '@/utils/chart-options'
import { formatCost, formatRelativeTime } from '@/utils/formatters'
import { Box, TrendCharts, User } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 状态
const loading = ref(false)
const statistics = ref<Statistics | null>(null)
const accountCount = ref(0)

// 图表配置
const providerChartOption = computed(() => {
  if (!statistics.value?.provider_stats) return undefined
  return generatePieChartOption(statistics.value.provider_stats, undefined, true)
})

const assetTypeChartOption = computed(() => {
  if (!statistics.value?.asset_type_stats) return undefined
  return generateBarChartOption(
    statistics.value.asset_type_stats,
    undefined,
    '资产类型',
    '数量'
  )
})

const regionChartOption = computed(() => {
  if (!statistics.value?.region_stats) return undefined
  return generatePieChartOption(statistics.value.region_stats)
})

const statusChartOption = computed(() => {
  if (!statistics.value?.status_stats) return undefined
  return generateDonutChartOption(statistics.value.status_stats)
})

// 获取统计数据
const fetchStatistics = async () => {
  loading.value = true
  try {
    const [statsRes, accountsRes] = await Promise.all([
      getStatisticsApi(),
      listCloudAccountsApi({ offset: 0, limit: 1 }),
    ])

    statistics.value = statsRes.data
    accountCount.value = accountsRes.data.total
  } catch (error: any) {
    ElMessage.error(error.message || '获取统计数据失败')
  } finally {
    loading.value = false
  }
}

// 导航
const navigateToAccounts = () => {
  router.push('/accounts')
}

const navigateToAssets = () => {
  router.push('/assets')
}

const navigateToCost = () => {
  router.push('/cost')
}

// 初始化
onMounted(() => {
  fetchStatistics()
})
</script>

<style scoped lang="scss">
.dashboard-content {
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: calc(1rem + 0.2vw);
    margin-bottom: calc(1.5rem + 0.3vw);
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: calc(1rem + 0.2vw);
    margin-bottom: calc(1.5rem + 0.3vw);
  }

  .quick-actions {
    .action-card {
      .card-title {
        font-size: calc(0.9rem + 0.2vw);
        font-weight: 600;
        color: #1f2937;
      }

      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: calc(1rem + 0.2vw);

        .el-button {
          height: calc(3rem + 0.5vw);
          font-size: calc(0.8rem + 0.15vw);
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .dashboard-content {
    .stats-cards {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }

    .charts-grid {
      grid-template-columns: 1fr;
    }

    .quick-actions {
      .actions-grid {
        grid-template-columns: 1fr;
      }
    }
  }
}
</style>
