<template>
  <div class="dashboard-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">dashboard.welcome</h1>
      <p class="page-subtitle">多云资源管理平台 · 统一视图</p>
    </div>

    <!-- 统计卡片区域 -->
    <div class="stats-row">
      <div class="stat-card" @click="navigateToAccounts">
        <div class="stat-icon blue">
          <el-icon :size="24"><User /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">云账号</div>
          <div class="stat-value">{{ accountCount }}</div>
          <div class="stat-trend up">
            <span>↑ 上月新增</span>
          </div>
        </div>
      </div>

      <div class="stat-card" @click="navigateToAssets">
        <div class="stat-icon orange">
          <el-icon :size="24"><Box /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">资源总数</div>
          <div class="stat-value">{{ formatNumber(statistics?.total_assets || 0) }}</div>
          <div class="stat-trend up">
            <span>↑ 128 较上周</span>
          </div>
        </div>
      </div>

      <div class="stat-card" @click="navigateToCost">
        <div class="stat-icon green">
          <el-icon :size="24"><Money /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">本月费用</div>
          <div class="stat-value">¥{{ formatCost(statistics?.total_cost || 0) }}</div>
          <div class="stat-trend down">
            <span>↓ 8.2% 较上月</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon purple">
          <el-icon :size="24"><Clock /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">运维任务</div>
          <div class="stat-value">{{ taskCount }}</div>
          <div class="stat-trend neutral">
            <span>↑ 1 进行中</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-row">
      <!-- 资源分布 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>资源分布</h3>
          <div class="chart-tabs">
            <button 
              class="tab-btn" 
              :class="{ active: distributionTab === 'provider' }"
              @click="distributionTab = 'provider'"
            >
              按云商
            </button>
            <button 
              class="tab-btn" 
              :class="{ active: distributionTab === 'type' }"
              @click="distributionTab = 'type'"
            >
              按类型
            </button>
          </div>
        </div>
        <div class="chart-body">
          <div ref="distributionChartRef" class="chart-container"></div>
          <div class="chart-legend">
            <div v-for="item in distributionLegend" :key="item.name" class="legend-item">
              <span class="legend-dot" :style="{ background: item.color }"></span>
              <span class="legend-name">{{ item.name }}</span>
              <span class="legend-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 费用趋势 -->
      <div class="chart-card">
        <div class="chart-header">
          <h3>费用趋势</h3>
          <el-select v-model="costPeriod" class="period-select" size="small">
            <el-option label="近6个月" value="6m" />
            <el-option label="近3个月" value="3m" />
            <el-option label="近1年" value="1y" />
          </el-select>
        </div>
        <div class="chart-body">
          <div ref="costChartRef" class="chart-container full"></div>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-section">
      <h3 class="section-title">快捷操作</h3>
      <div class="quick-actions">
        <div class="action-card" @click="navigateToAccounts">
          <div class="action-icon blue">
            <el-icon :size="24"><Plus /></el-icon>
          </div>
          <div class="action-info">
            <div class="action-title">添加云账号</div>
            <div class="action-desc">接入新的云服务商</div>
          </div>
        </div>

        <div class="action-card" @click="navigateToAssets">
          <div class="action-icon cyan">
            <el-icon :size="24"><Search /></el-icon>
          </div>
          <div class="action-info">
            <div class="action-title">资源发现</div>
            <div class="action-desc">扫描云上资源</div>
          </div>
        </div>

        <div class="action-card" @click="navigateToTasks">
          <div class="action-icon yellow">
            <el-icon :size="24"><Document /></el-icon>
          </div>
          <div class="action-info">
            <div class="action-title">创建任务</div>
            <div class="action-desc">新建运维任务</div>
          </div>
        </div>

        <div class="action-card" @click="navigateToCost">
          <div class="action-icon purple">
            <el-icon :size="24"><TrendCharts /></el-icon>
          </div>
          <div class="action-info">
            <div class="action-title">费用报表</div>
            <div class="action-desc">查看成本分析</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getStatisticsApi, listCloudAccountsApi } from '@/api'
import type { Statistics } from '@/api/types/statistics'
import { formatCost } from '@/utils/formatters'
import { Box, Clock, Document, Money, Plus, Search, TrendCharts, User } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 状态
const statistics = ref<Statistics | null>(null)
const accountCount = ref(0)
const taskCount = ref(3)
const distributionTab = ref('provider')
const costPeriod = ref('6m')

// 图表引用
const distributionChartRef = ref<HTMLElement>()
const costChartRef = ref<HTMLElement>()
let distributionChart: echarts.ECharts | null = null
let costChart: echarts.ECharts | null = null

// 图例数据
const distributionLegend = ref([
  { name: '阿里云', value: 580, color: '#3b82f6' },
  { name: '腾讯云', value: 420, color: '#f59e0b' },
  { name: 'AWS', value: 280, color: '#06b6d4' },
])

// 格式化数字
const formatNumber = (num: number) => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

// 初始化资源分布图表
const initDistributionChart = () => {
  if (!distributionChartRef.value) return
  
  distributionChart = echarts.init(distributionChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23, 23, 23, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#fafafa' },
    },
    series: [
      {
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#0a0a0a',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 8,
        },
        data: [
          { value: 580, name: '阿里云', itemStyle: { color: '#3b82f6' } },
          { value: 420, name: '腾讯云', itemStyle: { color: '#f59e0b' } },
          { value: 280, name: 'AWS', itemStyle: { color: '#06b6d4' } },
        ],
      },
    ],
  }
  
  distributionChart.setOption(option)
}

// 初始化费用趋势图表
const initCostChart = () => {
  if (!costChartRef.value) return
  
  costChart = echarts.init(costChartRef.value)
  
  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23, 23, 23, 0.95)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      textStyle: { color: '#fafafa' },
      axisPointer: {
        type: 'cross',
        crossStyle: { color: '#71717a' },
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['1月', '1月', '2月', '3月', '4月', '5月', '6月'],
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#71717a' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: '#71717a' },
    },
    series: [
      {
        name: '费用',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          color: '#3b82f6',
          width: 3,
        },
        itemStyle: {
          color: '#3b82f6',
          borderColor: '#0a0a0a',
          borderWidth: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' },
          ]),
        },
        data: [26694, 30000, 28000, 35000, 42000, 38000, 32000],
        markPoint: {
          data: [
            {
              name: '当前',
              coord: ['1月', 32000],
              value: '32,000',
              itemStyle: { color: '#3b82f6' },
              label: {
                show: true,
                formatter: '1月\n¥ 32,000',
                color: '#fafafa',
                backgroundColor: 'rgba(23, 23, 23, 0.9)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                borderRadius: 4,
                padding: [8, 12],
              },
            },
          ],
        },
      },
    ],
  }
  
  costChart.setOption(option)
}

// 获取统计数据
const fetchStatistics = async () => {
  try {
    const [statsRes, accountsRes] = await Promise.all([
      getStatisticsApi(),
      listCloudAccountsApi({ offset: 0, limit: 1 }),
    ])

    statistics.value = statsRes.data
    accountCount.value = accountsRes.data.total || 5
    
    // 更新图例数据
    if (statistics.value?.provider_stats) {
      const colors = ['#3b82f6', '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6']
      distributionLegend.value = Object.entries(statistics.value.provider_stats).map(([name, value], index) => ({
        name,
        value: value as number,
        color: colors[index % colors.length] || '#3b82f6',
      }))
    }
  } catch (error: unknown) {
    const err = error as Error
    ElMessage.error(err.message || '获取统计数据失败')
  }
}

// 导航
const navigateToAccounts = () => router.push('/accounts')
const navigateToAssets = () => router.push('/assets')
const navigateToCost = () => router.push('/cost')
const navigateToTasks = () => router.push('/tasks')

// 窗口大小变化
const handleResize = () => {
  distributionChart?.resize()
  costChart?.resize()
}

// 监听 tab 切换
watch(distributionTab, () => {
  // 可以根据 tab 切换更新图表数据
})

onMounted(async () => {
  await fetchStatistics()
  nextTick(() => {
    initDistributionChart()
    initCostChart()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  distributionChart?.dispose()
  costChart?.dispose()
})
</script>


<style scoped lang="scss">
.dashboard-page {
  padding: 0;
  min-height: 100%;
}

// 页面标题
.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 8px 0;
    letter-spacing: -0.02em;
  }

  .page-subtitle {
    font-size: 14px;
    color: var(--text-tertiary);
    margin: 0;
  }
}

// 统计卡片行
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.stat-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    background: var(--glass-bg-hover);
    border-color: var(--border-strong);
    transform: translateY(-2px);
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.blue {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
    }

    &.orange {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-yellow);
    }

    &.green {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);
    }

    &.purple {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
    }
  }

  .stat-body {
    flex: 1;
    min-width: 0;

    .stat-label {
      font-size: 13px;
      color: var(--text-tertiary);
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1;
      margin-bottom: 8px;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }

    .stat-trend {
      font-size: 12px;
      font-weight: 500;

      &.up {
        color: var(--accent-green);
      }

      &.down {
        color: var(--accent-red);
      }

      &.neutral {
        color: var(--accent-blue);
      }
    }
  }
}

// 图表行
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
  margin-bottom: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .chart-tabs {
      display: flex;
      gap: 4px;
      background: var(--bg-hover);
      padding: 4px;
      border-radius: 8px;

      .tab-btn {
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-tertiary);
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 200ms ease;

        &:hover {
          color: var(--text-secondary);
        }

        &.active {
          background: var(--bg-surface);
          color: var(--text-primary);
        }
      }
    }

    .period-select {
      width: 100px;

      :deep(.el-select__wrapper) {
        background: var(--bg-hover);
        border: none;
        box-shadow: none;
      }
    }
  }

  .chart-body {
    display: flex;
    align-items: center;
    gap: 24px;

    .chart-container {
      width: 200px;
      height: 200px;
      flex-shrink: 0;

      &.full {
        width: 100%;
        height: 280px;
      }
    }

    .chart-legend {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 12px;

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .legend-name {
          flex: 1;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .legend-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
      }
    }
  }
}

// 快捷操作
.quick-section {
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-tertiary);
    margin: 0 0 16px 0;
  }
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
}

.action-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    background: var(--glass-bg-hover);
    border-color: var(--border-strong);
  }

  .action-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.blue {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent-blue);
    }

    &.cyan {
      background: rgba(6, 182, 212, 0.15);
      color: var(--accent-cyan);
    }

    &.yellow {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-yellow);
    }

    &.purple {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
    }
  }

  .action-info {
    flex: 1;
    min-width: 0;

    .action-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .action-desc {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  }
}
</style>
