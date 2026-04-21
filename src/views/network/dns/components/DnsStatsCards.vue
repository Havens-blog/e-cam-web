<template>
  <div class="dns-stats">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="card in statCards" :key="card.label">
        <div class="stat-icon" :style="{ background: card.iconBg, color: card.iconColor }">
          <el-icon :size="20"><component :is="card.icon" /></el-icon>
        </div>
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-desc">{{ card.desc }}</div>
      </div>
    </div>

    <!-- 图表 -->
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">云厂商域名分布</div>
        <div ref="providerChartRef" class="chart-container"></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">记录类型分布</div>
        <div ref="recordTypeChartRef" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getDnsStatsApi } from '@/api/dns'
import type { DnsStats } from '@/api/types/dns'
import { getProviderLabel } from '@/utils/constants'
import { Cloudy, Connection, List, WarningFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const stats = ref<DnsStats | null>(null)
const loading = ref(false)
const providerChartRef = ref<HTMLElement>()
const recordTypeChartRef = ref<HTMLElement>()
let providerChart: echarts.ECharts | null = null
let recordTypeChart: echarts.ECharts | null = null

const providerColors: Record<string, string> = {
  aliyun: '#ff6a00',
  aws: '#ff9900',
  huawei: '#ef4444',
  tencent: '#3b82f6',
  volcano: '#10b981',
}

const recordTypeColors: Record<string, string> = {
  A: '#6366f1',
  AAAA: '#8b5cf6',
  CNAME: '#3b82f6',
  MX: '#ec4899',
  TXT: '#10b981',
  NS: '#f59e0b',
  SRV: '#ef4444',
  CAA: '#6b7280',
}

const statCards = computed(() => {
  const s = stats.value
  const providerCount = s ? Object.keys(s.provider_distribution || {}).length : 0
  const providerNames = s
    ? Object.keys(s.provider_distribution || {})
        .filter(k => k != null)
        .map(k => getProviderLabel(k))
        .join(' · ')
    : ''
  return [
    {
      label: '域名总数',
      value: s?.total_domains ?? 0,
      desc: '',
      icon: Connection,
      iconBg: 'rgba(99,102,241,0.15)',
      iconColor: '#818cf8',
    },
    {
      label: '解析记录总数',
      value: s?.total_records ?? 0,
      desc: '',
      icon: List,
      iconBg: 'rgba(59,130,246,0.15)',
      iconColor: '#60a5fa',
    },
    {
      label: '云厂商覆盖',
      value: providerCount,
      desc: providerNames,
      icon: Cloudy,
      iconBg: 'rgba(16,185,129,0.15)',
      iconColor: '#34d399',
    },
    {
      label: '异常域名',
      value: 0,
      desc: '',
      icon: WarningFilled,
      iconBg: 'rgba(245,158,11,0.15)',
      iconColor: '#fbbf24',
    },
  ]
})

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await getDnsStatsApi()
    const data = (res as any).data || res
    stats.value = data
  } catch {
    stats.value = null
  } finally {
    loading.value = false
  }
}

const renderProviderChart = () => {
  if (!providerChartRef.value || !stats.value) return
  if (!providerChart) {
    providerChart = echarts.init(providerChartRef.value)
  }
  const dist = stats.value.provider_distribution || {}
  const data = Object.entries(dist)
    .filter(([k]) => k != null)
    .map(([k, v]) => ({
      name: getProviderLabel(k),
      value: v,
      itemStyle: { color: providerColors[k] || '#6b7280' },
    }))
  providerChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        label: { show: true, fontSize: 12 },
        data,
      },
    ],
  })
}

const renderRecordTypeChart = () => {
  if (!recordTypeChartRef.value || !stats.value) return
  if (!recordTypeChart) {
    recordTypeChart = echarts.init(recordTypeChartRef.value)
  }
  const dist = stats.value.record_type_distribution || {}
  const entries = Object.entries(dist).filter(([k]) => k != null)
  recordTypeChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: entries.map(([k]) => k),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: entries.map(([k, v]) => ({
          value: v,
          itemStyle: { color: recordTypeColors[k] || '#6b7280' },
        })),
        barWidth: '50%',
      },
    ],
  })
}

const handleResize = () => {
  providerChart?.resize()
  recordTypeChart?.resize()
}

watch(stats, () => {
  renderProviderChart()
  renderRecordTypeChart()
})

onMounted(() => {
  fetchStats()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  providerChart?.dispose()
  recordTypeChart?.dispose()
})

defineExpose({ refresh: fetchStats })
</script>

<style scoped lang="scss">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--glass-bg, #1a2236);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  font-weight: 500;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary, #f1f5f9);
  line-height: 1;
  margin-bottom: 6px;
}

.stat-desc {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card {
  background: var(--glass-bg, #1a2236);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));
  border-radius: 12px;
  padding: 20px;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary, #f1f5f9);
}

.chart-container {
  height: 200px;
}
</style>
