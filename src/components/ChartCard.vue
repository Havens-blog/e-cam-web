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
      <div v-else-if="!hasData" class="chart-empty">
        <el-empty :description="emptyText" />
      </div>
      <div v-else ref="chartRef" class="chart-content"></div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

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

const hasData = ref(true)

const initChart = async () => {
  if (!chartRef.value || !props.option) return

  try {
    const echarts = await import('echarts')
    chartInstance = echarts.init(chartRef.value)
    chartInstance.setOption(props.option)
    window.addEventListener('resize', handleResize)
  } catch (error) {
    console.warn('ECharts not installed. Please install echarts: npm install echarts')
    hasData.value = false
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
