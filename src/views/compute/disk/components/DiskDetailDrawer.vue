<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="disk-detail-drawer" @update:model-value="$emit('update:visible', $event)">
    <div class="drawer-wrapper">
      <template v-if="instance">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="header-left">
              <div class="close-corner" @click="$emit('update:visible', false)">
                <div class="corner-bg"></div>
                <el-icon class="corner-icon" :size="12"><Close /></el-icon>
              </div>
              <div class="instance-icon">
                <el-icon :size="24"><Box /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">云盘</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="快照" name="snapshot" />
              <el-tab-pane label="监控" name="monitor" />
              <el-tab-pane label="操作日志" name="log" />
            </el-tabs>
          </div>
        </div>
        <div class="drawer-content">
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">云盘ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-dot" :class="getStatusClass(instance.status)"></span>{{ getStatusText(instance.status) }}</span></div>
                  <div class="info-row"><span class="info-label">磁盘类型</span><span class="info-value">{{ instance.attributes?.disk_type === 'system' ? '系统盘' : '数据盘' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.provider)" :size="16" />{{ getProviderName(instance.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">配置信息</div>
                <div class="info-list">
                  <!-- S-Hard:资产表 size/iops/throughput 为枚举快照,不在 Disk 界面展示;使用率/IOPS/吞吐统一见「监控」tab(指标表来源) -->
                  <div class="info-row"><span class="info-label">云盘类型</span><span class="info-value">{{ getDiskCategory(instance.attributes?.category) }}</span></div>
                  <div class="info-row"><span class="info-label">挂载实例</span><span class="info-value link">{{ instance.attributes?.instance_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">挂载点</span><span class="info-value">{{ instance.attributes?.device || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">是否加密</span><span class="info-value">{{ instance.attributes?.encrypted ? '是' : '否' }}</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ instance.attributes?.description || '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="activeTab === 'monitor'">
            <div v-loading="metricsLoading" class="metrics-section">
              <template v-if="metricsError">
                <div class="empty-tab">
                  <el-icon :size="48"><WarningFilled /></el-icon>
                  <p>{{ metricsError }}</p>
                  <el-button size="small" type="primary" plain @click="fetchDiskMetrics">重试</el-button>
                </div>
              </template>
              <template v-else-if="hasMetricData">
                <el-alert
                  v-if="metricZeroException"
                  class="metrics-alert"
                  type="warning"
                  :closable="false"
                  show-icon
                  title="部分日期使用率为 0(口径缺失的采集异常行),不代表真实水位,已按异常标记"
                />
                <div class="metrics-note">
                  近 {{ METRICS_DAYS }} 天使用率与 IO(读采集指标表);断线表示当日无数据;使用率口径:{{ usageScopeLabel(diskUsageScope) }}<template v-if="isBusyShareScope(diskUsageScope)">(IO 忙闲占比,非容量水位)</template>
                </div>
                <div class="metrics-latest">
                  <div class="summary-item"><span class="summary-label">最新使用率</span><span class="summary-value">{{ formatUsagePercent(latestSummary?.usage_percent) }}</span></div>
                  <div class="summary-item"><span class="summary-label">最新 IOPS</span><span class="summary-value">{{ formatIOPS(latestSummary?.iops) }}</span></div>
                  <div class="summary-item"><span class="summary-label">最新吞吐</span><span class="summary-value">{{ formatThroughputMBps(latestSummary?.throughput) }}</span></div>
                </div>
                <div ref="metricsChartRef" class="metrics-chart"></div>
              </template>
              <div v-else-if="!metricsLoading" class="empty-tab">
                <el-icon :size="48"><DataLine /></el-icon>
                <p>暂无磁盘指标数据(未采集或该厂商未启用指标采集)</p>
              </div>
            </div>
          </template>
          <template v-else><div class="empty-tab"><el-icon :size="48"><Document /></el-icon><p>{{ activeTab }} 功能开发中...</p></div></template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { getDiskMetricsApi, type DiskMetricsView, type DiskMetricPoint } from '@/api/asset';
import type { Asset } from '@/api/types/asset';
import IconFont from '@/components/IconFont/index.vue';
import { getProviderLabel } from '@/utils/constants';
import { formatIOPS, formatThroughputMBps, formatUsagePercent, hasZeroException, isBusyShareScope, usageScopeLabel } from '@/views/compute/disk/diskMetrics';
import { Box, Close, DataLine, Document, WarningFilled } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (s.includes('use')) return 'running'; if (s.includes('available')) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { in_use: '使用中', available: '可用', creating: '创建中' }; return map[status.toLowerCase()] || status }
const getDiskCategory = (category?: string) => { if (!category) return '-'; const map: Record<string, string> = { cloud_efficiency: '高效云盘', cloud_ssd: 'SSD云盘', cloud_essd: 'ESSD云盘', cloud: '普通云盘' }; return map[category] || category }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => (provider ? getProviderLabel(provider) : '-')
const formatTime = (time?: number) => time ? new Date(time).toLocaleString('zh-CN') : '-'

// ===== 监控 tab:使用率/IOPS/吞吐趋势(按需查询,读 ecam_disk_metric 指标表) =====
// 与 NasDetailDrawer 监控 tab 同构;echarts 渲染在 canvas 上,CSS 变量不可用
const AXIS_LABEL_COLOR = '#a1a1aa'
const SPLIT_LINE_COLOR = 'rgba(255,255,255,0.08)'
const TOOLTIP_BG = 'rgba(23,23,23,0.92)'
const METRICS_DAYS = 30

const metricsLoading = ref(false)
const metricsResp = ref<DiskMetricsView | null>(null)
const metricsError = ref('')
const metricsFetchedKey = ref('')
const metricsChartRef = ref<HTMLElement>()
let metricsChart: echarts.ECharts | null = null

/** 云盘 ID(disk_id = 实例 asset_id)与云账号 ID(列表 VO 顶层 account_id,兼容 attributes 快照) */
const diskId = computed(() => String(props.instance?.asset_id || ''))
const accountId = computed(() => Number(props.instance?.account_id || props.instance?.attributes?.cloud_account_id || 0))

/** 后端已按日期升序返回,防御式再排一次(横轴须从早到晚) */
const metricPoints = computed<DiskMetricPoint[]>(() => {
  const days = metricsResp.value?.days || []
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
})
/** 窗口内至少一天有真实数据(缺失日各指标均为 null) */
const hasMetricData = computed(() => metricPoints.value.some(p => p.usage_percent != null || p.iops != null || p.throughput != null))
const metricZeroException = computed(() => hasZeroException(metricPoints.value))
const latestSummary = computed(() => metricsResp.value?.latest || null)
/** 使用率口径随代表行携带(实例级/IO 繁忙占比,展示须区分容量水位) */
const diskUsageScope = computed(() => metricsResp.value?.days?.find(p => p.usage_scope)?.usage_scope || '')

const fetchDiskMetrics = async () => {
  if (!accountId.value || !diskId.value) {
    metricsError.value = '缺少账号或云盘标识,无法查询'
    return
  }
  metricsLoading.value = true
  metricsError.value = ''
  try {
    const { data } = await getDiskMetricsApi({ disk_id: diskId.value, account_id: accountId.value, days: METRICS_DAYS })
    metricsResp.value = data || null
    metricsFetchedKey.value = `${accountId.value}:${diskId.value}`
    // 数据到位后模板才渲染出图表容器,nextTick 确保 DOM 就位再 init
    await nextTick()
    renderDiskChart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询磁盘指标失败'
    metricsError.value = `磁盘指标查询失败: ${msg}`
  } finally {
    metricsLoading.value = false
  }
}

/** 双轴图:线=IOPS/吞吐(次/秒、MB/s,左轴),线=使用率(%,0~100,右轴;缺失日置空断线) */
const renderDiskChart = () => {
  const items = metricPoints.value
  if (!metricsChartRef.value || !hasMetricData.value) return

  if (metricsChart && metricsChart.getDom() !== metricsChartRef.value) {
    metricsChart.dispose()
    metricsChart = null
  }
  if (!metricsChart) metricsChart = echarts.init(metricsChartRef.value)

  // 供 tooltip 标注口径缺失 0 异常日(qc_status 读取侧闭环);异常日使用率断线不渲染 0
  const statusByDate = new Map(items.map(p => [p.date, p.data_status]))
  const usageOrNull = (v: number | null, date: string) =>
    statusByDate.get(date) === 'zero_exception' || v == null || v < 0 ? null : Math.round(v * 10) / 10

  metricsChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: TOOLTIP_BG,
      borderColor: SPLIT_LINE_COLOR,
      textStyle: { color: '#d4d4d8', fontSize: 12 },
      formatter: (params: any) => {
        const date = String(params[0]?.axisValue ?? '')
        const fullDate = items.find(p => p.date.slice(5, 10) === date)?.date || date
        const lines = [date]
        for (const p of params) {
          if (p.value == null) {
            lines.push(`${p.marker}${p.seriesName}: —`)
            continue
          }
          const suffix = p.seriesName === '使用率' ? '%' : p.seriesName === 'IOPS' ? ' 次/秒' : ' MB/s'
          lines.push(`${p.marker}${p.seriesName}: ${p.value}${suffix}`)
        }
        if (statusByDate.get(fullDate) === 'zero_exception') {
          lines.push('⚠ 使用率异常(口径缺失 0 采集异常行)')
        }
        return lines.join('<br/>')
      }
    },
    legend: { top: 0, right: 8, textStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 } },
    grid: { left: 56, right: 56, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: items.map(p => (p.date.length >= 10 ? p.date.slice(5, 10) : p.date)),
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
      axisLine: { lineStyle: { color: SPLIT_LINE_COLOR } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: 'IOPS/吞吐',
        nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        axisLabel: {
          color: AXIS_LABEL_COLOR,
          fontSize: 11,
          formatter: (val: number) => (val >= 10000 ? `${(val / 10000).toFixed(1)}万` : `${val}`)
        },
        splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } }
      },
      {
        type: 'value',
        name: '使用率',
        min: 0,
        max: 100,
        nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11, formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'IOPS',
        type: 'line',
        data: items.map(p => p.iops),
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#7170ff', width: 2 },
        itemStyle: { color: '#7170ff' }
      },
      {
        name: '吞吐',
        type: 'line',
        data: items.map(p => (p.throughput == null || p.throughput < 0 ? null : Math.round(p.throughput * 100) / 100)),
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#f59e0b', width: 2 },
        itemStyle: { color: '#f59e0b' }
      },
      {
        name: '使用率',
        type: 'line',
        yAxisIndex: 1,
        data: items.map(p => usageOrNull(p.usage_percent, p.date)),
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#16a34a', width: 2 },
        itemStyle: { color: '#16a34a' }
      }
    ]
  }, true)
}

const handleMetricsResize = () => { metricsChart?.resize() }

onUnmounted(() => {
  window.removeEventListener('resize', handleMetricsResize)
  metricsChart?.dispose()
  metricsChart = null
})

// 切换实例时重置 tab 与按需查询状态
watch(() => props.instance, () => {
  activeTab.value = 'detail'
  metricsResp.value = null
  metricsError.value = ''
  metricsFetchedKey.value = ''
})

// 打开抽屉或切到监控 tab 时按需拉取(disk_id + account_id + days)
watch(
  () => [props.visible, activeTab.value] as const,
  ([visible, tab]) => {
    if (!visible || tab !== 'monitor') return
    const key = `${accountId.value}:${diskId.value}`
    if (!key || key === ':') return
    if (key !== metricsFetchedKey.value && !metricsError.value) {
      fetchDiskMetrics()
    } else if (hasMetricData.value) {
      // 抽屉关闭再打开时 el-drawer 用 v-show 保留 DOM,图表容器尺寸可能变化,重渲染兜底
      nextTick(() => renderDiskChart())
    }
  }
)

// 抽屉打开期间监听窗口尺寸,保证趋势图随窗口缩放
watch(() => props.visible, (val) => {
  if (val) window.addEventListener('resize', handleMetricsResize)
  else window.removeEventListener('resize', handleMetricsResize)
})
</script>

<style scoped lang="scss">
@import '@/views/storage/styles/detail-drawer.scss';

// 监控 tab:使用率/IOPS/吞吐趋势(样式口径与 NasDetailDrawer 一致)
.metrics-section {
  min-height: 200px;

  .metrics-alert { margin-bottom: 12px; }

  .metrics-note {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
  }

  .metrics-latest {
    display: flex; gap: 32px; padding: 12px 16px; margin-bottom: 16px;
    background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px;

    .summary-item {
      display: flex; flex-direction: column; gap: 4px;
      .summary-label { font-size: 12px; color: var(--text-tertiary); }
      .summary-value { font-size: 13px; color: var(--text-primary); font-weight: 500; }
    }
  }

  .metrics-chart {
    width: 100%;
    height: 320px;
  }
}
</style>

<style lang="scss">
.disk-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
