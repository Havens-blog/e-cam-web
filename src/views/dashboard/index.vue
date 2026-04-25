<template>
  <div class="dashboard-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">多云概览</h1>
      <p class="page-subtitle">多云资源管理平台 · 统一视图</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card" @click="router.push('/assets')">
        <div class="stat-icon blue">
          <el-icon :size="24"><Box /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">资产总数</div>
          <div class="stat-value">{{ formatNumber(overview.total) }}</div>
        </div>
      </div>
      <div class="stat-card" @click="router.push('/accounts')">
        <div class="stat-icon orange">
          <el-icon :size="24"><User /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">云厂商</div>
          <div class="stat-value">{{ overview.by_provider.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon :size="24"><CircleCheck /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">运行中</div>
          <div class="stat-value">{{ runningCount }}</div>
        </div>
      </div>
      <div class="stat-card" @click="scrollToExpiring">
        <div class="stat-icon red">
          <el-icon :size="24"><Warning /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">即将过期</div>
          <div class="stat-value">{{ expiringTotal }}</div>
        </div>
      </div>
    </div>

    <!-- 图表行1: 云厂商分布 + 资产类型分布 -->
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-header">
          <h3>云厂商分布</h3>
        </div>
        <div class="chart-body">
          <div ref="providerChartRef" class="chart-container"></div>
          <div class="chart-legend">
            <div v-for="item in providerLegend" :key="item.name" class="legend-item">
              <span class="legend-dot" :style="{ background: item.color }"></span>
              <span class="legend-name">{{ item.name }}</span>
              <span class="legend-value">{{ item.value }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <h3>资产类型分布</h3>
        </div>
        <div class="chart-body">
          <div ref="assetTypeChartRef" class="chart-container full"></div>
        </div>
      </div>
    </div>

    <!-- 图表行2: 地域分布 + 状态分布 -->
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-header">
          <h3>地域分布 TOP10</h3>
        </div>
        <div class="chart-body">
          <div ref="regionChartRef" class="chart-container full"></div>
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <h3>产品成本 TOP10（{{ costMonth }}）</h3>
        </div>
        <div class="chart-body">
          <div v-if="costByProductItems.length" ref="costByProductChartRef" class="chart-container full"></div>
          <div v-else class="empty-tip">暂无成本数据</div>
        </div>
      </div>
    </div>

    <!-- 即将过期资源 -->
    <div ref="expiringRef" class="expiring-section">
      <div class="chart-card">
        <div class="chart-header">
          <h3>即将过期资源</h3>
          <el-select v-model="expiringDays" size="small" style="width: 120px" @change="fetchExpiring">
            <el-option :label="'7 天内'" :value="7" />
            <el-option :label="'30 天内'" :value="30" />
            <el-option :label="'90 天内'" :value="90" />
          </el-select>
        </div>
        <el-table :data="expiringList" v-loading="expiringLoading" stripe style="width: 100%">
          <el-table-column prop="asset_name" label="资源名称" min-width="160" show-overflow-tooltip />
          <el-table-column prop="asset_id" label="资源ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="asset_type" label="类型" width="120">
            <template #default="{ row }">{{ assetTypeLabel(row.asset_type) }}</template>
          </el-table-column>
          <el-table-column prop="provider" label="云厂商" width="100">
            <template #default="{ row }">{{ providerLabel(row.provider) }}</template>
          </el-table-column>
          <el-table-column prop="region" label="地域" width="140" show-overflow-tooltip />
          <el-table-column label="过期时间" width="180">
            <template #default="{ row }">
              <span :class="expireClass(row)">{{ formatExpireTime(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="剩余天数" width="100">
            <template #default="{ row }">
              <el-tag :type="daysLeftTagType(row)" size="small">{{ daysLeft(row) }} 天</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
    getByRegionApi, getExpiringApi,
    getOverviewApi,
    type ExpiringAsset,
    type KeyCount,
    type OverviewData
} from '@/api/dashboard'
import { getCostDistributionApi } from '@/api/finops'
import { getGlobalAssetStatsApi } from '@/api/service-tree'
import type { CostDistItem } from '@/api/types/finops'
import { Box, CircleCheck, User, Warning } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ==================== 数据 ====================
const overview = ref<OverviewData>({ total: 0, by_provider: [], by_type: [], by_status: [] })
const providerItems = ref<KeyCount[]>([])
const assetTypeItems = ref<KeyCount[]>([])
const regionItems = ref<KeyCount[]>([])
const expiringList = ref<ExpiringAsset[]>([])
const expiringTotal = ref(0)
const expiringDays = ref(30)
const expiringLoading = ref(false)
const costByProductItems = ref<CostDistItem[]>([])

// 上个月的年月标签
const lastMonth = (() => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
})()
const costMonth = `${lastMonth.year}年${String(lastMonth.month).padStart(2, '0')}月`

const runningCount = computed(() => {
  const r = overview.value.by_status.find(s => s.key.toLowerCase() === 'running')
  return r?.count || 0
})

// ==================== 映射 ====================
const providerMap: Record<string, string> = {
  aliyun: '阿里云', aws: 'AWS', huawei: '华为云', tencent: '腾讯云', volcano: '火山引擎',
}
const providerLabel = (k: string) => providerMap[k] || k

const assetTypeMap: Record<string, string> = {
  cloud_vm: '虚拟机', cloud_rds: 'RDS', cloud_redis: 'Redis', cloud_mongodb: 'MongoDB',
  cloud_vpc: 'VPC', cloud_eip: 'EIP', cloud_nas: 'NAS', cloud_oss: 'OSS',
  cloud_kafka: 'Kafka', cloud_elasticsearch: 'ES', cloud_disk: '云盘',
  cloud_snapshot: '快照', cloud_security_group: '安全组',
  ecs: '虚拟机', rds: 'RDS', redis: 'Redis', mongodb: 'MongoDB',
  vpc: 'VPC', eip: 'EIP', nas: 'NAS', oss: 'OSS',
}
const assetTypeLabel = (k: string) => assetTypeMap[k] || k

const COLORS = ['#3b82f6', '#f59e0b', '#06b6d4', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#6366f1']

// ==================== 图表 ====================
const providerChartRef = ref<HTMLElement>()
const assetTypeChartRef = ref<HTMLElement>()
const regionChartRef = ref<HTMLElement>()
const costByProductChartRef = ref<HTMLElement>()
const expiringRef = ref<HTMLElement>()
let providerChart: echarts.ECharts | null = null
let assetTypeChart: echarts.ECharts | null = null
let regionChart: echarts.ECharts | null = null
let costByProductChart: echarts.ECharts | null = null

const providerLegend = computed(() =>
  providerItems.value.map((item, i) => ({
    name: providerLabel(item.key),
    value: item.count,
    color: COLORS[i % COLORS.length],
  }))
)

const formatNumber = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)

const formatExpireTime = (row: ExpiringAsset) => {
  const t = row.attributes?.expire_time
  return t ? new Date(t).toLocaleString('zh-CN') : '-'
}
const daysLeft = (row: ExpiringAsset) => {
  const t = row.attributes?.expire_time
  if (!t) return '-'
  const diff = Math.ceil((new Date(t).getTime() - Date.now()) / 86400000)
  return diff < 0 ? 0 : diff
}
const daysLeftTagType = (row: ExpiringAsset) => {
  const d = daysLeft(row)
  if (typeof d !== 'number') return 'info'
  if (d <= 7) return 'danger'
  if (d <= 30) return 'warning'
  return 'info'
}
const expireClass = (row: ExpiringAsset) => {
  const d = daysLeft(row)
  if (typeof d !== 'number') return ''
  return d <= 7 ? 'expire-danger' : d <= 30 ? 'expire-warning' : ''
}

const scrollToExpiring = () => {
  expiringRef.value?.scrollIntoView({ behavior: 'smooth' })
}

// ==================== 图表初始化 ====================
const initProviderChart = () => {
  if (!providerChartRef.value || !providerItems.value.length) return
  providerChart = echarts.init(providerChartRef.value)
  providerChart.setOption({
    tooltip: { trigger: 'item', backgroundColor: 'rgba(23,23,23,0.95)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#fafafa' } },
    series: [{
      type: 'pie', radius: ['55%', '75%'], center: ['50%', '50%'],
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 8 },
      data: providerItems.value.map((item, i) => ({
        value: item.count, name: providerLabel(item.key),
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    }],
  })
}

const initAssetTypeChart = () => {
  if (!assetTypeChartRef.value || !assetTypeItems.value.length) return
  assetTypeChart = echarts.init(assetTypeChartRef.value)
  const sorted = [...assetTypeItems.value].sort((a, b) => b.count - a.count)
  assetTypeChart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(23,23,23,0.95)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#fafafa' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category', data: sorted.map(i => assetTypeLabel(i.key)),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#71717a', rotate: 30, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: '#71717a' },
    },
    series: [{
      type: 'bar', barWidth: '50%', barMaxWidth: 40,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#3b82f6' }, { offset: 1, color: 'rgba(59,130,246,0.3)' },
        ]),
      },
      data: sorted.map(i => i.count),
    }],
  })
}

const initRegionChart = () => {
  if (!regionChartRef.value || !regionItems.value.length) return
  regionChart = echarts.init(regionChartRef.value)
  const top10 = [...regionItems.value].sort((a, b) => b.count - a.count).slice(0, 10).reverse()
  regionChart.setOption({
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(23,23,23,0.95)', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#fafafa' } },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: '#71717a' },
    },
    yAxis: {
      type: 'category', data: top10.map(i => i.key),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#71717a', fontSize: 11 },
    },
    series: [{
      type: 'bar', barWidth: '60%', barMaxWidth: 24,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: 'rgba(6,182,212,0.3)' }, { offset: 1, color: '#06b6d4' },
        ]),
      },
      data: top10.map(i => i.count),
    }],
  })
}

const initCostByProductChart = () => {
  if (!costByProductChartRef.value || !costByProductItems.value.length) return
  costByProductChart = echarts.init(costByProductChartRef.value)
  const sorted = [...costByProductItems.value].sort((a, b) => b.amount_cny - a.amount_cny)
  const top10 = sorted.slice(0, 10)
  // 如果超过10项，将剩余合并为"其他"
  if (sorted.length > 10) {
    const otherAmount = sorted.slice(10).reduce((sum, item) => sum + item.amount_cny, 0)
    top10.push({ key: `其他 (${sorted.length - 10}项)`, amount: 0, amount_cny: otherAmount, percent: 0 })
  }
  const reversed = [...top10].reverse()
  const barColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899', '#10b981', '#f97316', '#14b8a6', '#6366f1', '#22d3ee']
  costByProductChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23,23,23,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa' },
      formatter: (params: unknown) => {
        const list = params as Array<{ name: string; value: number }>
        const p = list[0]
        if (!p) return ''
        return `${p.name}<br/>¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
    },
    grid: { left: '3%', right: '8%', bottom: '3%', top: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: {
        color: '#71717a',
        formatter: (val: number) => val >= 10000 ? (val / 10000).toFixed(0) + '万' : String(val),
      },
    },
    yAxis: {
      type: 'category',
      data: reversed.map(i => i.key),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: '#71717a', fontSize: 11 },
    },
    series: [{
      type: 'bar', barWidth: '60%', barMaxWidth: 24,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (params: { dataIndex: number }) => barColors[params.dataIndex % barColors.length],
      },
      data: reversed.map(i => i.amount_cny),
    }],
  })
}

// ==================== 数据加载 ====================
const fetchOverview = async () => {
  try {
    const res = await getOverviewApi()
    const d = (res as any).data
    if (d) {
      overview.value = {
        total: d.total || 0,
        by_provider: d.by_provider || [],
        by_type: d.by_type || [],
        by_status: d.by_status || [],
      }
      providerItems.value = overview.value.by_provider
    }
  } catch (e: any) {
    console.error('获取总览失败:', e)
  }
}

const fetchAssetTypeStats = async () => {
  try {
    const res = await getGlobalAssetStatsApi({ include_children: true })
    const d = (res as any).data
    if (d?.by_asset_type) {
      assetTypeItems.value = Object.entries(d.by_asset_type)
        .map(([key, count]) => ({ key, count: count as number }))
    }
  } catch (e: any) {
    console.error('获取资产类别统计失败:', e)
  }
}

const fetchByRegion = async () => {
  try {
    const res = await getByRegionApi()
    regionItems.value = (res as any).data?.items || []
  } catch (e: any) {
    console.error('获取地域统计失败:', e)
  }
}

const fetchCostByProduct = async () => {
  try {
    // 查询上个月整月数据
    const startDate = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-01`
    const endDay = new Date(lastMonth.year, lastMonth.month, 0).getDate()
    const endDate = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    const res = await getCostDistributionApi({ dimension: 'service_type', start_date: startDate, end_date: endDate })
    // eslint-disable-next-line -- 响应结构可能被拦截器改写，需要兼容多种格式
    const d = (res as any).data || res || []
    costByProductItems.value = Array.isArray(d) ? d : []
    // 数据到位后在下一帧渲染图表
    if (costByProductItems.value.length) {
      nextTick(() => initCostByProductChart())
    }
  } catch (e: unknown) {
    console.error('获取产品成本分布失败:', e)
  }
}

const fetchExpiring = async () => {
  expiringLoading.value = true
  try {
    const res = await getExpiringApi({ days: expiringDays.value, limit: 20 })
    expiringList.value = (res as any).data?.items || []
    expiringTotal.value = (res as any).data?.total || 0
  } catch (e: any) {
    console.error('获取过期资源失败:', e)
  } finally {
    expiringLoading.value = false
  }
}

const handleResize = () => {
  providerChart?.resize()
  assetTypeChart?.resize()
  regionChart?.resize()
  costByProductChart?.resize()
}

onMounted(async () => {
  await Promise.all([fetchOverview(), fetchAssetTypeStats(), fetchByRegion(), fetchCostByProduct(), fetchExpiring()])
  nextTick(() => {
    initProviderChart()
    initAssetTypeChart()
    initRegionChart()
  })
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  providerChart?.dispose()
  assetTypeChart?.dispose()
  regionChart?.dispose()
  costByProductChart?.dispose()
})
</script>

<style scoped lang="scss">
.dashboard-page {
  padding: 0;
  min-height: 100%;
}

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

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
  @media (max-width: 1200px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 640px) { grid-template-columns: 1fr; }
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
    width: 48px; height: 48px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    &.blue { background: rgba(59,130,246,0.15); color: var(--accent-blue); }
    &.orange { background: rgba(245,158,11,0.15); color: var(--accent-yellow); }
    &.green { background: rgba(16,185,129,0.15); color: var(--accent-green); }
    &.red { background: rgba(239,68,68,0.15); color: var(--accent-red); }
  }
  .stat-body {
    flex: 1; min-width: 0;
    .stat-label { font-size: 13px; color: var(--text-tertiary); margin-bottom: 8px; }
    .stat-value {
      font-size: 32px; font-weight: 600; color: var(--text-primary);
      line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
    }
  }
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
  margin-bottom: 24px;
  @media (max-width: 1024px) { grid-template-columns: 1fr; }
}

.chart-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  .chart-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
    h3 { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0; }
  }
  .chart-body {
    display: flex; align-items: center; gap: 24px;
    .chart-container {
      width: 200px; height: 200px; flex-shrink: 0;
      &.full { width: 100%; height: 280px; }
    }
    .chart-legend {
      flex: 1; display: flex; flex-direction: column; gap: 14px;
      .legend-item {
        display: flex; align-items: center; gap: 12px;
        .legend-dot { width: 12px; height: 12px; border-radius: 4px; flex-shrink: 0; }
        .legend-name { flex: 1; font-size: 14px; color: var(--text-secondary); }
        .legend-value { font-size: 14px; font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
      }
    }
  }
}

.empty-tip {
  text-align: center; color: var(--text-tertiary); padding: 40px 0; font-size: 14px; width: 100%;
}

.expiring-section {
  margin-bottom: 24px;
}

.expire-danger { color: #ef4444; font-weight: 500; }
.expire-warning { color: #f59e0b; font-weight: 500; }
</style>
