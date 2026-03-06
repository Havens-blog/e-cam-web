<template>
  <div class="trend-chart-card">
    <div class="chart-header">
      <span class="chart-title">成本趋势</span>
      <el-radio-group v-model="activeGranularity" size="small" @change="handleGranularityChange">
        <el-radio-button value="daily">按日</el-radio-button>
        <el-radio-button value="weekly">按周</el-radio-button>
        <el-radio-button value="monthly">按月</el-radio-button>
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
import type { CostTrendPoint } from '@/api/types/finops';
import { Loading } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  data: CostTrendPoint[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'granularity-change', granularity: string): void
}>()

const activeGranularity = ref('daily')
const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const renderChart = () => {
  if (!chartRef.value || !props.data.length) return

  if (chartInstance && chartInstance.getDom() !== chartRef.value) {
    chartInstance.dispose()
    chartInstance = null
  }

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const dates = props.data.map(p => p.date)
  const amounts = props.data.map(p => p.amount_cny)

  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>成本: ¥${p.value.toFixed(2)}`
      }
    },
    grid: { left: 60, right: 24, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
      axisLine: { lineStyle: { color: 'var(--border-base)' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: 'var(--text-tertiary)',
        fontSize: 11,
        formatter: (val: number) => val >= 10000 ? `${(val / 10000).toFixed(1)}万` : `${val}`
      },
      splitLine: { lineStyle: { color: 'var(--border-subtle)', type: 'dashed' } }
    },
    series: [{
      type: 'line',
      data: amounts,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: '#3B82F6' },
      itemStyle: { color: '#3B82F6' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59, 130, 246, 0.25)' },
          { offset: 1, color: 'rgba(59, 130, 246, 0.02)' }
        ])
      }
    }]
  }, true)
}

const handleResize = () => chartInstance?.resize()

const handleGranularityChange = (val: string | number | boolean | undefined) => {
  emit('granularity-change', String(val ?? ''))
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
.trend-chart-card {
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
