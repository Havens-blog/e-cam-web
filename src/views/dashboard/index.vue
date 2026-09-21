<template>
  <PageContainer class="dashboard-page">
    <template #header>
      <div class="page-header">
        <h1 class="page-title">多云概览</h1>
        <p class="page-subtitle">多云资源管理平台 · 统一视图</p>
      </div>
    </template>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <StatCard
        title="资产总数"
        :value="overviewLoadError ? '-' : formatNumber(overview.total)"
        icon="Box"
        icon-color="#818cf8"
        :subtitle="`覆盖 ${overview.by_provider.length} 个云厂商`"
        clickable
        @click="router.push('/assets')"
      />
      <StatCard
        title="云厂商"
        :value="overviewLoadError ? '-' : overview.by_provider.length"
        :format-value="false"
        icon="User"
        icon-color="#fbbf24"
        subtitle="多云统一接入"
        clickable
        @click="router.push('/accounts')"
      />
      <StatCard
        title="运行中"
        :value="overviewLoadError ? '-' : runningCount"
        :format-value="false"
        icon="CircleCheck"
        icon-color="#4ade80"
        :subtitle="runningShare"
      />
      <StatCard
        title="即将过期"
        :value="expiringLoadError ? '-' : expiringTotal"
        :format-value="false"
        icon="Clock"
        icon-color="#f87171"
        :subtitle="`${expiringDays} 天窗口`"
        clickable
        @click="scrollToExpiring"
      />
    </div>

    <!-- 图表行1: 云厂商分布 + 资产类型分布 -->
    <div class="charts-row">
      <section class="panel-card">
        <div class="panel-card__header">
          <h3>云厂商分布</h3>
        </div>
        <StateBlock :status="providerStatus" error-text="获取总览数据失败" @retry="fetchOverview">
          <div ref="providerChartRef" class="chart-container"></div>
        </StateBlock>
      </section>
      <section class="panel-card">
        <div class="panel-card__header">
          <h3>资产类型分布</h3>
        </div>
        <StateBlock :status="assetTypeStatus" error-text="资产类别统计加载失败" @retry="fetchAssetTypeStats">
          <div ref="assetTypeChartRef" class="chart-container"></div>
        </StateBlock>
      </section>
    </div>

    <!-- 图表行2: 地域分布 + 成本分布 -->
    <div class="charts-row">
      <section class="panel-card">
        <div class="panel-card__header">
          <h3>地域分布 TOP10</h3>
        </div>
        <StateBlock :status="regionStatus" error-text="地域统计加载失败" @retry="fetchByRegion">
          <div ref="regionChartRef" class="chart-container"></div>
        </StateBlock>
      </section>
      <section class="panel-card">
        <div class="panel-card__header">
          <h3>产品成本 TOP10（{{ costMonth }}）</h3>
        </div>
        <StateBlock
          :status="costByProductStatus"
          error-text="产品成本分布加载失败"
          empty-text="暂无成本数据"
          @retry="fetchCostByProduct"
        >
          <div ref="costByProductChartRef" class="chart-container"></div>
        </StateBlock>
      </section>
    </div>

    <!-- 即将过期资源 -->
    <section ref="expiringRef" class="panel-card expiring-section">
      <div class="panel-card__header">
        <h3>即将过期资源</h3>
        <el-select v-model="expiringDays" size="small" style="width: 120px" @change="fetchExpiring">
          <el-option :label="'7 天内'" :value="7" />
          <el-option :label="'30 天内'" :value="30" />
          <el-option :label="'90 天内'" :value="90" />
        </el-select>
      </div>
      <el-table
        :data="expiringList"
        v-loading="expiringLoading"
        :empty-text="expiringLoadError ? '加载失败，请切换天数后重试' : '暂无数据'"
        stripe
        style="width: 100%"
      >
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
    </section>
  </PageContainer>
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
import PageContainer from '@/components/PageContainer/index.vue'
import StateBlock from '@/components/StateBlock/index.vue'
import type { StateBlockStatus } from '@/components/StateBlock/index.vue'
import StatCard from '@/components/StatCard.vue'
import { getProviderLabel } from '@/utils/constants'
import * as echarts from 'echarts'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()

// ==================== 数据 ====================
const overview = ref<OverviewData>({ total: 0, by_provider: [], by_type: [], by_status: [] })
const overviewLoadError = ref(false)
const providerItems = ref<KeyCount[]>([])
const assetTypeItems = ref<KeyCount[]>([])
const assetTypeLoadError = ref(false)
const regionItems = ref<KeyCount[]>([])
const regionLoadError = ref(false)
const expiringList = ref<ExpiringAsset[]>([])
const expiringTotal = ref(0)
const expiringDays = ref(30)
const expiringLoading = ref(false)
const expiringLoadError = ref(false)
const costByProductItems = ref<CostDistItem[]>([])
const costByProductLoadError = ref(false)
// 四张图表卡加载态（首屏即为加载中，StateBlock 骨架屏等价旧页 v-loading 首屏反馈）
const providerLoading = ref(true)
const assetTypeLoading = ref(true)
const regionLoading = ref(true)
const costByProductLoading = ref(true)

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

const runningShare = computed(() => {
  if (overviewLoadError.value || !overview.value.total) return '-'
  const pct = Math.round((runningCount.value / overview.value.total) * 100)
  return `占实体资产 ${pct}%`
})

// ==================== 三态（StateBlock：loading/empty/error/success） ====================
const providerStatus = computed<StateBlockStatus>(() =>
  providerLoading.value ? 'loading' : overviewLoadError.value ? 'error' : providerItems.value.length ? 'success' : 'empty')
const assetTypeStatus = computed<StateBlockStatus>(() =>
  assetTypeLoading.value ? 'loading' : assetTypeLoadError.value ? 'error' : assetTypeItems.value.length ? 'success' : 'empty')
const regionStatus = computed<StateBlockStatus>(() =>
  regionLoading.value ? 'loading' : regionLoadError.value ? 'error' : regionItems.value.length ? 'success' : 'empty')
const costByProductStatus = computed<StateBlockStatus>(() =>
  costByProductLoading.value ? 'loading' : costByProductLoadError.value ? 'error' : costByProductItems.value.length ? 'success' : 'empty')

// ==================== 映射 ====================
/** 云平台展示名统一走 utils/constants 单源（含 volcengine 等变体归一） */
const providerLabel = (k: string) => (k ? getProviderLabel(k) : k)

const assetTypeMap: Record<string, string> = {
  cloud_vm: '虚拟机', cloud_rds: 'RDS', cloud_redis: 'Redis', cloud_mongodb: 'MongoDB',
  cloud_vpc: 'VPC', cloud_eip: 'EIP', cloud_nas: 'NAS', cloud_oss: 'OSS',
  cloud_kafka: 'Kafka', cloud_elasticsearch: 'ES', cloud_disk: '云盘',
  cloud_snapshot: '快照', cloud_security_group: '安全组',
  ecs: '虚拟机', rds: 'RDS', redis: 'Redis', mongodb: 'MongoDB',
  vpc: 'VPC', eip: 'EIP', nas: 'NAS', oss: 'OSS',
  kafka: 'Kafka', elasticsearch: 'ES', lb: '负载均衡', cdn: 'CDN', waf: 'WAF',
  disk: '云盘', snapshot: '快照', security_group: '安全组', eni: '弹性网卡',
  vswitch: '子网', image: '镜像',
}
const assetTypeLabel = (k: string) => assetTypeMap[k] || k

// 分类色板(固定顺序,勿按排名循环):已过暗色表面六项校验
// (CVD 区分度/正常视觉下限/对比度),更新颜色请重跑 dataviz validate_palette.js
const COLORS = ['#7170ff', '#d97706', '#0891b2', '#16a34a', '#8b5cf6']

/** 图表文字层配色：初始化时解析令牌（深浅主题各自正确；系列色保持 fc0b2e4 迁移色不动） */
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const chartTextColors = () => ({
  primary: cssVar('--text-primary'),
  regular: cssVar('--text-regular'),
  secondary: cssVar('--text-secondary'),
  tertiary: cssVar('--text-tertiary'),
  line: cssVar('--border-strong'),
})

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

const formatNumber = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)

const formatExpireTime = (row: ExpiringAsset) => {
  // 到期时间由同步执行器写入 attributes.expired_time（勿改回 expire_time）
  const t = row.attributes?.expired_time
  return t ? new Date(t).toLocaleString('zh-CN') : '-'
}
const daysLeft = (row: ExpiringAsset) => {
  const t = row.attributes?.expired_time
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

/** 图表容器由 StateBlock 惰性渲染：状态进入 success 且 DOM 挂载完成后再初始化图表 */
const renderChartWhenReady = (status: Ref<StateBlockStatus>, init: () => void) => {
  watch(status, async (value) => {
    if (value !== 'success') return
    await nextTick()
    init()
  })
}

// ==================== 图表初始化 ====================
const initProviderChart = () => {
  if (!providerChartRef.value || !providerItems.value.length) return
  providerChart?.dispose()
  providerChart = echarts.init(providerChartRef.value)
  const text = chartTextColors()
  const total = providerItems.value.reduce((sum, item) => sum + item.count, 0)
  providerChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23,23,23,0.95)', borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa' },
      formatter: (p: any) => `${p.marker} ${p.name}<br/>${p.value} 台 · ${p.percent}%`,
    },
    series: [{
      type: 'pie', radius: ['52%', '70%'], center: ['50%', '50%'],
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 2 },
      // 扇区外直接标注厂商+数量+占比,信息全在图上,无需对照图例
      label: {
        show: true,
        formatter: (p: any) => `{name|${p.name}}\n{value|${p.value} 台 · ${p.percent}%}`,
        rich: {
          name: { fontSize: 13, fontWeight: 500, color: text.regular, lineHeight: 20 },
          value: { fontSize: 12, color: text.tertiary },
        },
      },
      labelLine: { length: 14, length2: 12, lineStyle: { color: text.line } },
      emphasis: { scale: true, scaleSize: 6 },
      data: providerItems.value.map((item, i) => ({
        value: item.count, name: providerLabel(item.key),
        itemStyle: { color: COLORS[i % COLORS.length] },
      })),
    }],
    // 环心显示资产总数,与各扇区数量对照
    graphic: [
      {
        type: 'text', left: 'center', top: '42%',
        style: { text: String(total), fontSize: 26, fontWeight: 700, fill: text.primary, textAlign: 'center' },
      },
      {
        type: 'text', left: 'center', top: '56%',
        style: { text: '资产总数', fontSize: 12, fill: text.tertiary, textAlign: 'center' },
      },
    ],
  })
}

const initAssetTypeChart = () => {
  if (!assetTypeChartRef.value || !assetTypeItems.value.length) return
  assetTypeChart?.dispose()
  assetTypeChart = echarts.init(assetTypeChartRef.value)
  const text = chartTextColors()
  const sorted = [...assetTypeItems.value].sort((a, b) => b.count - a.count)
  const total = sorted.reduce((sum, item) => sum + item.count, 0)
  // 单系列横向排名条:单色(量级任务),每条值标注在条尾,坐标轴刻度冗余故隐藏
  assetTypeChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23,23,23,0.95)', borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa' },
      formatter: (p: any) => `${p.marker} ${p.name}<br/>${p.value} 台 · ${((p.value / total) * 100).toFixed(1)}%`,
    },
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category', data: sorted.map(i => assetTypeLabel(i.key)).reverse(),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: text.secondary, fontSize: 12 },
    },
    series: [{
      type: 'bar', barMaxWidth: 18,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: '#7170ff' },
      label: {
        show: true, position: 'right', color: text.regular, fontSize: 11,
        formatter: (p: any) => `${p.value} · ${((p.value / total) * 100).toFixed(1)}%`,
      },
      data: sorted.map(i => i.count).reverse(),
    }],
  })
}

const initRegionChart = () => {
  if (!regionChartRef.value || !regionItems.value.length) return
  regionChart?.dispose()
  regionChart = echarts.init(regionChartRef.value)
  const text = chartTextColors()
  const top10 = [...regionItems.value].sort((a, b) => b.count - a.count).slice(0, 10)
  regionChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23,23,23,0.95)', borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa' },
      formatter: (p: any) => `${p.marker} ${p.name}<br/>${p.value} 台`,
    },
    grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category', data: top10.map(i => i.key).reverse(),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: text.secondary, fontSize: 11 },
    },
    series: [{
      type: 'bar', barMaxWidth: 18,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: '#0891b2' },
      label: { show: true, position: 'right', color: text.regular, fontSize: 11 },
      data: top10.map(i => i.count).reverse(),
    }],
  })
}

const initCostByProductChart = () => {
  if (!costByProductChartRef.value || !costByProductItems.value.length) return
  costByProductChart?.dispose()
  costByProductChart = echarts.init(costByProductChartRef.value)
  const text = chartTextColors()
  const sorted = [...costByProductItems.value].sort((a, b) => b.amount_cny - a.amount_cny)
  const top10 = sorted.slice(0, 10)
  // 如果超过10项，将剩余合并为"其他"
  if (sorted.length > 10) {
    const otherAmount = sorted.slice(10).reduce((sum, item) => sum + item.amount_cny, 0)
    top10.push({ key: `其他 (${sorted.length - 10}项)`, amount: 0, amount_cny: otherAmount, percent: 0 })
  }
  const reversed = [...top10].reverse()
  const fmtCNY = (val: number) => `¥${val.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
  costByProductChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(23,23,23,0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fafafa' },
      formatter: (p: any) => `${p.marker} ${p.name}<br/>¥${p.value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    grid: { left: 8, right: 88, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: reversed.map(i => i.key),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: text.secondary, fontSize: 11 },
    },
    series: [{
      type: 'bar', barMaxWidth: 18,
      itemStyle: { borderRadius: [0, 4, 4, 0], color: '#8b5cf6' },
      label: { show: true, position: 'right', color: text.regular, fontSize: 11, formatter: (p: any) => fmtCNY(p.value) },
      data: reversed.map(i => i.amount_cny),
    }],
  })
}

renderChartWhenReady(providerStatus, initProviderChart)
renderChartWhenReady(assetTypeStatus, initAssetTypeChart)
renderChartWhenReady(regionStatus, initRegionChart)
renderChartWhenReady(costByProductStatus, initCostByProductChart)

// 双主题：主题切换后以新令牌重渲四图（文字层随主题解析，系列色不变；AC4 浏览器实测项）
watch(() => appStore.theme, () => {
  initProviderChart()
  initAssetTypeChart()
  initRegionChart()
  initCostByProductChart()
})

// ==================== 数据加载 ====================
const fetchOverview = async () => {
  providerLoading.value = true
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
    overviewLoadError.value = false
  } catch (e: any) {
    overviewLoadError.value = true
    console.error('获取总览失败:', e)
    ElMessage.error('获取总览数据失败，请刷新页面重试')
  } finally {
    providerLoading.value = false
  }
}

const fetchAssetTypeStats = async () => {
  assetTypeLoading.value = true
  try {
    const res = await getGlobalAssetStatsApi({ include_children: true })
    const d = (res as any).data
    if (d?.by_asset_type) {
      assetTypeItems.value = Object.entries(d.by_asset_type)
        .map(([key, count]) => ({ key, count: count as number }))
    }
    assetTypeLoadError.value = false
  } catch (e: any) {
    assetTypeLoadError.value = true
    console.error('获取资产类别统计失败:', e)
    ElMessage.error('获取资产类别统计数据失败')
  } finally {
    assetTypeLoading.value = false
  }
}

const fetchByRegion = async () => {
  regionLoading.value = true
  try {
    const res = await getByRegionApi()
    regionItems.value = (res as any).data?.items || []
    regionLoadError.value = false
  } catch (e: any) {
    regionLoadError.value = true
    console.error('获取地域统计失败:', e)
    ElMessage.error('获取地域统计数据失败')
  } finally {
    regionLoading.value = false
  }
}

const fetchCostByProduct = async () => {
  costByProductLoading.value = true
  try {
    // 查询上个月整月数据
    const startDate = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-01`
    const endDay = new Date(lastMonth.year, lastMonth.month, 0).getDate()
    const endDate = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    const res = await getCostDistributionApi({ dimension: 'service_type', start_date: startDate, end_date: endDate })
    const d = (res as any).data || res || []
    costByProductItems.value = Array.isArray(d) ? d : []
    costByProductLoadError.value = false
  } catch (e: unknown) {
    costByProductLoadError.value = true
    console.error('获取产品成本分布失败:', e)
    ElMessage.error('获取产品成本分布数据失败')
  } finally {
    costByProductLoading.value = false
  }
}

const fetchExpiring = async () => {
  expiringLoading.value = true
  try {
    const res = await getExpiringApi({ days: expiringDays.value, limit: 20 })
    expiringList.value = (res as any).data?.items || []
    expiringTotal.value = (res as any).data?.total || 0
    expiringLoadError.value = false
  } catch (e: any) {
    expiringLoadError.value = true
    console.error('获取过期资源失败:', e)
    ElMessage.error('获取过期资源列表失败')
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
// 页面只承载组件无法吸收的布局微调，全部颜色走 Phase 1 令牌（零硬编���色）。
.page-header {
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

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 16px;
  margin-bottom: 24px;
  @media (max-width: 1024px) { grid-template-columns: 1fr; }
}

.panel-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 20px;

  &.expiring-section {
    margin-bottom: 24px;
  }

  .panel-card__header {
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
  }
}

.chart-container {
  width: 100%;
  height: 280px;
}

.expire-danger { color: var(--accent-red); font-weight: 500; }
.expire-warning { color: var(--accent-yellow); font-weight: 500; }
</style>
