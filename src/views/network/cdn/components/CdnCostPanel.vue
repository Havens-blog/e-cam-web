<template>
  <el-drawer
    :model-value="visible"
    title="CDN 经营成本"
    size="680px"
    :destroy-on-close="true"
    @update:model-value="emit('update:visible', $event)"
    @open="handleOpen"
  >
    <div v-loading="loading" class="cost-panel">
      <template v-if="!loading">
        <!-- 月度成本趋势 -->
        <section class="panel-section">
          <h3 class="section-title">月度成本趋势</h3>
          <div v-if="!hasMonthlyData" class="section-empty">
            <el-empty description="暂无数据" :image-size="60" />
          </div>
          <div v-else ref="trendChartRef" class="chart-box chart-trend"></div>
        </section>

        <!-- 账号占比 -->
        <section class="panel-section">
          <h3 class="section-title">账号占比</h3>
          <div v-if="!hasAccountData" class="section-empty">
            <el-empty description="暂无数据" :image-size="60" />
          </div>
          <div v-else ref="accountChartRef" class="chart-box chart-account"></div>
        </section>

        <!-- 域名成本 Top -->
        <section class="panel-section">
          <h3 class="section-title">域名成本 Top</h3>
          <div v-if="topDomains.length === 0" class="section-empty domain-empty">
            <span class="domain-empty-text">二期指标接入后展示</span>
          </div>
          <ul v-else class="domain-list">
            <li v-for="(d, i) in topDomains" :key="d.domain" class="domain-item">
              <span class="domain-rank" :class="`rank-${i + 1}`">{{ i + 1 }}</span>
              <span class="domain-name" :title="d.domain">{{ d.domain }}</span>
              <span v-if="d.is_estimate" class="domain-tag">估算</span>
              <span class="domain-amount">¥{{ formatNumber(Math.round(d.amount_est)) }}</span>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import {
  getCdnCostApi,
  type CDNCostView,
} from '@/api/asset'
import { formatNumber } from '@/utils/formatters'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

// 与 dashboard 图表一致的暗色配色(echarts 渲染在 canvas 上,CSS 变量不可用,取暗色 token 实际值)
const CHART_COLORS = ['#3b82f6', '#d97706', '#0891b2', '#16a34a', '#8b5cf6', '#eab308']
const AXIS_LABEL_COLOR = '#a1a1aa'
const SPLIT_LINE_COLOR = 'rgba(255,255,255,0.08)'
const TOOLTIP_BG = 'rgba(23,23,23,0.92)'

const loading = ref(false)
const costData = ref<CDNCostView | null>(null)
const trendChartRef = ref<HTMLElement>()
const accountChartRef = ref<HTMLElement>()
let trendChart: echarts.ECharts | null = null
let accountChart: echarts.ECharts | null = null

const hasMonthlyData = computed(() => (costData.value?.monthly ?? []).length > 0)
const hasAccountData = computed(() => (costData.value?.by_account ?? []).length > 0)

/** 域名成本 Top 10(一期 domain_cost 为空,展示空态) */
const topDomains = computed(() => (costData.value?.domain_cost ?? []).slice(0, 10))

const handleOpen = () => { fetchCost() }

const fetchCost = async () => {
  loading.value = true
  try {
    const { data } = await getCdnCostApi({ months: 6 })
    costData.value = data
    await nextTick()
    renderTrendChart()
    renderAccountChart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取 CDN 成本数据失败'
    ElMessage.error(msg)
    costData.value = null
  } finally { loading.value = false }
}

/** 月度成本趋势柱状图(cdn + dcdn 合计) */
const renderTrendChart = () => {
  const monthly = costData.value?.monthly ?? []
  if (!trendChartRef.value || monthly.length === 0) return

  if (trendChart && trendChart.getDom() !== trendChartRef.value) {
    trendChart.dispose()
    trendChart = null
  }
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: TOOLTIP_BG,
      borderColor: SPLIT_LINE_COLOR,
      textStyle: { color: '#d4d4d8', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0]
        return `${p.axisValue}<br/>总成本: ¥${formatNumber(p.value)}`
      }
    },
    grid: { left: 56, right: 16, top: 16, bottom: 28 },
    xAxis: {
      type: 'category',
      data: monthly.map(m => m.month),
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
      axisLine: { lineStyle: { color: SPLIT_LINE_COLOR } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: AXIS_LABEL_COLOR,
        fontSize: 11,
        formatter: (val: number) => (val >= 10000 ? `${(val / 10000).toFixed(1)}万` : `${val}`)
      },
      splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } }
    },
    series: [{
      type: 'bar',
      name: '总成本',
      data: monthly.map(m => Math.round((m.cdn_amount + m.dcdn_amount) * 100) / 100),
      barMaxWidth: 36,
      itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: '#60a5fa' } }
    }]
  }, true)
}

/** 账号占比环形图 */
const renderAccountChart = () => {
  const byAccount = costData.value?.by_account ?? []
  if (!accountChartRef.value || byAccount.length === 0) return

  if (accountChart && accountChart.getDom() !== accountChartRef.value) {
    accountChart.dispose()
    accountChart = null
  }
  if (!accountChart) accountChart = echarts.init(accountChartRef.value)

  accountChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: TOOLTIP_BG,
      borderColor: SPLIT_LINE_COLOR,
      textStyle: { color: '#d4d4d8', fontSize: 12 },
      formatter: (p: any) => `${p.name}<br/>¥${formatNumber(p.value)}(${p.percent}%)`
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { color: AXIS_LABEL_COLOR, fontSize: 12 }
    },
    color: CHART_COLORS,
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['38%', '50%'],
      data: byAccount.map(a => ({
        name: a.account_name || `账号 #${a.account_id}`,
        value: Math.round(a.amount * 100) / 100
      })),
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.4)' }
      }
    }]
  }, true)
}

const handleResize = () => {
  trendChart?.resize()
  accountChart?.resize()
}

// 抽屉打开动画结束后再渲染,避免容器尺寸为 0
watch(() => props.visible, (val) => {
  if (val) window.addEventListener('resize', handleResize)
  else window.removeEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  accountChart?.dispose()
  trendChart = null
  accountChart = null
})
</script>

<style scoped lang="scss">
.cost-panel {
  min-height: 200px;
  padding: 0 4px;
}

.panel-section {
  margin-bottom: 24px;

  .section-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .chart-box {
    width: 100%;
  }

  .chart-trend {
    height: 240px;
  }

  .chart-account {
    height: 220px;
  }

  .section-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px dashed var(--glass-border);
    border-radius: 10px;
    padding: 12px 0;
  }

  .domain-empty {
    .domain-empty-text {
      font-size: 13px;
      color: var(--text-tertiary);
    }
  }
}

.domain-list {
  list-style: none;
  margin: 0;
  padding: 0;

  .domain-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;

    &:hover {
      background: var(--glass-bg-hover);
    }

    & + .domain-item {
      margin-top: 4px;
    }

    .domain-rank {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-tertiary);
      background: var(--glass-border);

      &.rank-1 { color: #fbbf24; background: rgba(217, 119, 6, 0.16); }
      &.rank-2 { color: #d4d4d8; background: rgba(255, 255, 255, 0.08); }
      &.rank-3 { color: #fbbf24; background: rgba(217, 119, 6, 0.08); }
    }

    .domain-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      color: var(--text-primary);
    }

    .domain-tag {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--el-color-warning);
      border: 1px solid var(--el-color-warning);
      border-radius: 4px;
      padding: 0 4px;
      line-height: 16px;
    }

    .domain-amount {
      flex-shrink: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
  }
}
</style>
