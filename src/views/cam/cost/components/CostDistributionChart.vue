<template>
  <div class="distribution-chart-card">
    <div class="chart-header">
      <span class="chart-title">成本分布</span>
      <el-radio-group v-model="activeDimension" size="small" @change="handleDimensionChange">
        <el-radio-button value="provider">按云厂商</el-radio-button>
        <el-radio-button value="service_type">按服务类型</el-radio-button>
        <el-radio-button value="region">按地域</el-radio-button>
      </el-radio-group>
    </div>
    <div class="chart-body">
      <div v-if="loading" class="chart-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>加载中...</p>
      </div>
      <div v-else-if="!data.length" class="chart-empty">
        <el-empty description="暂无数据" :image-size="80" />
      </div>
      <div v-else ref="chartRef" class="chart-content"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CostDistItem } from '@/api/types/finops'
import { getProviderLabel } from '@/utils/constants'
import { Loading } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const SERVICE_TYPE_LABELS: Record<string, string> = {
  compute: '计算',
  storage: '存储',
  network: '网络',
  database: '数据库',
  middleware: '中间件',
  other: '其他'
}

const props = defineProps<{
  data: CostDistItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'dimension-change', dimension: string): void
}>()

const activeDimension = ref('provider')
const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const getLabel = (key: string): string => {
  if (activeDimension.value === 'provider') return getProviderLabel(key) || key
  if (activeDimension.value === 'service_type') return SERVICE_TYPE_LABELS[key] || key
  return key
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16']
const MAX_ITEMS = 8

/** 数据项过多时聚合为 Top N + 其他 */
const aggregateData = (items: CostDistItem[]): { name: string; value: number }[] => {
  if (items.length <= MAX_ITEMS) {
    return items.map((item, idx) => ({
      name: getLabel(item.key),
      value: item.amount_cny,
      itemStyle: { color: COLORS[idx % COLORS.length] }
    }))
  }
  const sorted = [...items].sort((a, b) => b.amount_cny - a.amount_cny)
  const top = sorted.slice(0, MAX_ITEMS - 1)
  const rest = sorted.slice(MAX_ITEMS - 1)
  const otherAmount = rest.reduce((sum, i) => sum + i.amount_cny, 0)
  const result = top.map((item, idx) => ({
    name: getLabel(item.key),
    value: item.amount_cny,
    itemStyle: { color: COLORS[idx % COLORS.length] }
  }))
  result.push({
    name: `其他 (${rest.length}项)`,
    value: otherAmount,
    itemStyle: { color: '#9CA3AF' }
  })
  return result
}

const renderChart = () => {
  if (!chartRef.value || !props.data.length) return

  // 如果之前的实例挂载在已被移除的 DOM 上（loading 切换导致），需要重新创建
  if (chartInstance && chartInstance.getDom() !== chartRef.value) {
    chartInstance.dispose()
    chartInstance = null
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const seriesData = aggregateData(props.data)

  chartInstance.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}<br/>¥${params.value.toFixed(2)} (${params.percent}%)`
      }
    },
    legend: {
      orient: 'vertical',
      right: 16,
      top: 'center',
      textStyle: { color: 'var(--text-secondary)', fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.2)' }
      },
      data: seriesData
    }]
  }, true)
}

const handleResize = () => chartInstance?.resize()

const handleDimensionChange = (val: string | number | boolean | undefined) => {
  emit('dimension-change', String(val ?? ''))
}

watch(() => props.data, () => {
  nextTick(renderChart)
}, { deep: true })

watch(() => props.loading, (newVal, oldVal) => {
  if (oldVal && !newVal && props.data.length) {
    nextTick(renderChart)
  }
})

onMounted(() => {
  nextTick(renderChart)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style scoped lang="scss">
.distribution-chart-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .chart-body {
    flex: 1;
    min-height: 280px;

    .chart-loading,
    .chart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-tertiary);

      p {
        margin-top: 8px;
        font-size: 13px;
      }
    }

    .chart-content {
      width: 100%;
      height: 100%;
      min-height: 280px;
    }
  }
}
</style>
