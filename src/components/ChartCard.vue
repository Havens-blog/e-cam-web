<template>
  <el-card class="chart-card">
    <template #header>
      <div class="card-header">
        <span class="card-title">{{ title }}</span>
        <slot name="actions"></slot>
      </div>
    </template>
    <div class="chart-container" :style="{ height: height }">
      <div v-if="loading" class="chart-loading">
        <el-icon class="is-loading" :size="32">
          <Loading />
        </el-icon>
        <p>加载中...</p>
      </div>
      <div v-else-if="chartBroken || !hasData" class="chart-empty">
        <el-empty :description="emptyText" />
      </div>
      <div v-else ref="chartRef" class="chart-content"></div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import { nextTick, onMounted, onUnmounted, ref, watch, computed } from 'vue'

interface Props {
  title: string
  option?: EChartsOption
  height?: string
  loading?: boolean
  emptyText?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: '300px',
  loading: false,
  emptyText: '暂无数据'
})

const chartRef = ref<HTMLElement>()
let chartInstance: any = null

/** 图表库不可用（ECharts 导入失败）—— 技术兜底，与「数据为空」区分开 */
const chartBroken = ref(false)

/**
 * 是否**有数据可画**（iter232）。
 *
 * 背景：此前用 `hasData = ref(true)`，只在 initChart 的 catch 里设 false，
 * 即那个「空态」实际只表示「图表库加载失败」。接口返回空数组时，option 里
 * series 仍在但 data 为空，ECharts 不创建 canvas，卡片就变成一块 400px 高的空白
 * （实测 contentChildCount=0、innerHTML=""），用户既看不到图也看不到「暂无数据」。
 *
 * 现在按 option 结构判定：任一 series 有非空 data（或 dataset 有数据）即认为有数据。
 * 判定不出来时（比如极简 option）按「有数据」处理，避免误报空态。
 */
const hasData = computed<boolean>(() => {
  const opt = props.option as Record<string, unknown> | undefined
  if (!opt) return false

  const series = opt.series
  if (Array.isArray(series) && series.length > 0) {
    return series.some((sr) => {
      const item = sr as Record<string, unknown>
      const data = item?.data
      if (Array.isArray(data)) return data.length > 0
      // data 不是数组（如 dataset 驱动）→ 交给下面兜底
      return data !== undefined && data !== null
    })
  }

  // 没有 series：看 dataset；都没有就认为无数据
  const dataset = opt.dataset
  if (dataset && typeof dataset === 'object') {
    const src = (dataset as Record<string, unknown>).source
    if (Array.isArray(src)) return src.length > 0
    return true
  }

  return false
})

const initChart = async () => {
  if (!chartRef.value || !props.option) return

  try {
    const echarts = await import('@/utils/echarts')
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(props.option)
    window.addEventListener('resize', handleResize)
  } catch {
    console.warn('ECharts not installed. Please install echarts: npm install echarts')
    chartBroken.value = true
  }
}

const updateChart = () => {
  if (chartInstance && props.option) {
    chartInstance.setOption(props.option, true)
  }
}

const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

const destroyChart = () => {
  if (chartInstance) {
    window.removeEventListener('resize', handleResize)
    chartInstance.dispose()
    chartInstance = null
  }
}

watch(
  () => props.option,
  () => {
    if (props.option) {
      if (chartInstance) {
        updateChart()
      } else {
        nextTick(() => {
          initChart()
        })
      }
    }
  },
  { deep: true }
)

onMounted(() => {
  if (props.option) {
    nextTick(() => {
      initChart()
    })
  }
})

onUnmounted(() => {
  destroyChart()
})

defineExpose({
  resize: handleResize,
  getInstance: () => chartInstance
})
</script>

<style scoped lang="scss">
.chart-card {
  height: 100%;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;

  :deep(.el-card__header) {
    display: none;
  }

  :deep(.el-card__body) {
    padding: 0;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .chart-container {
    position: relative;
    width: 100%;

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
    }
  }
}
</style>
