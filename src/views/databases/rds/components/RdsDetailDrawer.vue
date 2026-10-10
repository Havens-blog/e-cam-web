<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="rds-detail-drawer" @update:model-value="$emit('update:visible', $event)">
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
                <IconFont type="caise-database" :size="24" />
              </div>
              <div class="instance-info">
                <div class="instance-type">RDS 云数据库</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <!-- F-C5：重启/备份无处理器，按主题 B 决策禁用 + title（重启属危险操作，实现时必须二次确认） -->
                    <el-dropdown-item disabled title="功能开发中">重启实例</el-dropdown-item>
                    <el-dropdown-item disabled title="功能开发中">备份</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="白名单" name="whitelist" />
              <el-tab-pane label="备份" name="backup" />
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
                  <div class="info-row"><span class="info-label">云上ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value"><span class="status-dot" :class="getStatusClass(instance.attributes?.status)"></span>{{ getStatusText(instance.attributes?.status) }}</span>
                  </div>
                  <div class="info-row"><span class="info-label">数据库类型</span><span class="info-value">{{ instance.attributes?.engine || '-' }} {{ instance.attributes?.engine_version || '' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" /> {{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">计费方式</span><span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span></div>
                  <div class="info-row"><span class="info-label">到期时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.expired_time) }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) || formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">配置信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">规格</span><span class="info-value">{{ instance.attributes?.instance_type || instance.attributes?.db_instance_class || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">CPU</span><span class="info-value">{{ instance.attributes?.cpu || '-' }} 核</span></div>
                  <div class="info-row"><span class="info-label">内存</span><span class="info-value">{{ instance.attributes?.memory || '-' }} GB</span></div>
                  <div class="info-row"><span class="info-label">存储</span><span class="info-value">{{ instance.attributes?.storage_size || instance.attributes?.db_instance_storage || '-' }} GB</span></div>
                  <div class="info-row"><span class="info-label">连接地址</span><span class="info-value">{{ instance.attributes?.connection_string || instance.attributes?.endpoint || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">端口</span><span class="info-value">{{ instance.attributes?.port || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">子网</span><span class="info-value">{{ instance.attributes?.vswitch_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">最大连接数</span><span class="info-value">{{ instance.attributes?.max_connections || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">最大IOPS</span><span class="info-value">{{ instance.attributes?.max_iops || '-' }}</span></div>
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
                  <el-button size="small" type="primary" plain @click="fetchRdsMetrics">重试</el-button>
                </div>
              </template>
              <template v-else-if="hasMetricData">
                <el-alert
                  v-if="metricZeroException"
                  class="metrics-alert"
                  type="warning"
                  :closable="false"
                  show-icon
                  title="部分日期四指标全 0(采集异常行),不代表真实零负载,已按数据异常标记"
                />
                <div class="metrics-note">近 {{ METRICS_DAYS }} 天 CPU/内存/磁盘使用率与连接数(读采集指标表);断线表示当日无数据</div>
                <div class="metrics-latest">
                  <div class="summary-item"><span class="summary-label">最新 CPU</span><span class="summary-value">{{ formatPercent(latestSummary?.cpu_percent) }}</span></div>
                  <div class="summary-item"><span class="summary-label">最新内存</span><span class="summary-value">{{ formatPercent(latestSummary?.memory_percent) }}</span></div>
                  <div class="summary-item"><span class="summary-label">最新磁盘</span><span class="summary-value">{{ formatPercent(latestSummary?.disk_percent) }}</span></div>
                  <div class="summary-item"><span class="summary-label">最新连接数</span><span class="summary-value">{{ formatConnections(latestSummary?.connections) }}</span></div>
                </div>
                <div ref="metricsChartRef" class="metrics-chart"></div>
              </template>
              <div v-else-if="!metricsLoading" class="empty-tab">
                <el-icon :size="48"><DataLine /></el-icon>
                <p>暂无使用率指标数据(未采集或该厂商未启用指标采集)</p>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="empty-tab"><el-icon :size="48"><Document /></el-icon><p>{{ activeTab }} 功能开发中...</p></div>
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { getRdsMetricsApi, type RDSMetricPoint, type RDSMetricsView } from '@/api/asset';
import type { Asset } from '@/api/types/asset';
import IconFont from '@/components/IconFont/index.vue';
import { getProviderLabel } from '@/utils/constants';
import { CHARGE_TYPE_LABELS, RDS_STATUS_LABELS, labelOfLenient } from '@/utils/fieldLabels';
import { formatNumber } from '@/utils/formatters';
import { formatConnections, formatPercent, hasZeroException } from '@/views/databases/rds/rdsMetrics';
import { ArrowDown, Close, DataLine, Document, WarningFilled } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { getProviderIcon } from '@/utils/icon-mapping'

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStatusClass = (status?: string) => {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'running') return 'running'
  if (['stopped', 'shutdown'].includes(s)) return 'stopped'
  return 'pending'
}

/** 状态文案统一走 fieldLabels 单源（RDS 列表页 canonical） */
const getStatusText = (status?: string) => labelOfLenient(RDS_STATUS_LABELS, status, status || '-')

const getPlatformIcon = (provider?: string) => getProviderIcon(provider || '')

/** 云厂商展示名统一走 utils/constants 单源（含 volcengine/bytedance 等变体归一） */
const getProviderName = (provider?: string) => (provider ? getProviderLabel(provider) : '-')

const getChargeTypeText = (chargeType?: string) => labelOfLenient(CHARGE_TYPE_LABELS, chargeType)

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '-'
  try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr }
}

const formatTime = (time?: number) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

// ===== 监控 tab:CPU/内存/磁盘使用率 + 连接数趋势(按需查询,读 ecam_rds_metric 指标表) =====
// 与 NasDetailDrawer 指标 tab 同构;echarts 渲染在 canvas 上,CSS 变量不可用
const AXIS_LABEL_COLOR = '#a1a1aa'
const SPLIT_LINE_COLOR = 'rgba(255,255,255,0.08)'
const TOOLTIP_BG = 'rgba(23,23,23,0.92)'
const METRICS_DAYS = 30

const metricsLoading = ref(false)
const metricsResp = ref<RDSMetricsView | null>(null)
const metricsError = ref('')
const metricsFetchedKey = ref('')
const metricsChartRef = ref<HTMLElement>()
let metricsChart: echarts.ECharts | null = null

/** 实例 ID(rds_id = asset_id)与云账号 ID */
const rdsId = computed(() => String(props.instance?.asset_id || ''))
const accountId = computed(() => Number(props.instance?.attributes?.cloud_account_id || 0))

/** 后端已按日期升序返回,防御式再排一次(横轴须从早到晚) */
const metricPoints = computed<RDSMetricPoint[]>(() => {
  const days = metricsResp.value?.days || []
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
})
/** 窗口内至少一天有真实数据(缺失日四指标均 null) */
const hasMetricData = computed(() => metricPoints.value.some(p => p.cpu_percent != null || p.memory_percent != null || p.disk_percent != null || p.connections != null))
const metricZeroException = computed(() => hasZeroException(metricPoints.value))
const latestSummary = computed(() => metricsResp.value?.latest || null)

const fetchRdsMetrics = async () => {
  if (!accountId.value || !rdsId.value) {
    metricsError.value = '缺少账号或实例标识,无法查询'
    return
  }
  metricsLoading.value = true
  metricsError.value = ''
  try {
    const { data } = await getRdsMetricsApi({ rds_id: rdsId.value, account_id: accountId.value, days: METRICS_DAYS })
    metricsResp.value = data || null
    metricsFetchedKey.value = `${accountId.value}:${rdsId.value}`
    await nextTick()
    renderRdsChart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询使用率指标失败'
    metricsError.value = `使用率指标查询失败: ${msg}`
  } finally {
    metricsLoading.value = false
  }
}

/** 三线图:CPU/内存/磁盘使用率(%,左轴 0~100)+ 连接数(个,右轴;缺失日/异常日置空断线) */
const renderRdsChart = () => {
  const items = metricPoints.value
  if (!metricsChartRef.value || !hasMetricData.value) return

  if (metricsChart && metricsChart.getDom() !== metricsChartRef.value) {
    metricsChart.dispose()
    metricsChart = null
  }
  if (!metricsChart) metricsChart = echarts.init(metricsChartRef.value)

  // 供 tooltip 标注四指标全 0 异常日(qc_status 读取侧闭环)
  const statusByDate = new Map(items.map(p => [p.date, p.data_status]))

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
          const suffix = p.seriesName === '连接数' ? ' 个' : '%'
          lines.push(`${p.marker}${p.seriesName}: ${formatNumber(p.value)}${suffix}`)
        }
        if (statusByDate.get(fullDate) === 'zero_exception') {
          lines.push('⚠ 四指标全 0(采集异常行)')
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
        name: '使用率',
        min: 0,
        max: 100,
        nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: SPLIT_LINE_COLOR, type: 'dashed' } }
      },
      {
        type: 'value',
        name: '连接数',
        min: 0,
        nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        splitLine: { show: false }
      }
    ],
    series: [
      { name: 'CPU', type: 'line', data: items.map(p => p.cpu_percent), connectNulls: false, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#7170ff', width: 2 }, itemStyle: { color: '#7170ff' } },
      { name: '内存', type: 'line', data: items.map(p => p.memory_percent), connectNulls: false, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#f59e0b', width: 2 }, itemStyle: { color: '#f59e0b' } },
      { name: '磁盘', type: 'line', data: items.map(p => p.disk_percent), connectNulls: false, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#16a34a', width: 2 }, itemStyle: { color: '#16a34a' } },
      { name: '连接数', type: 'line', yAxisIndex: 1, data: items.map(p => p.connections), connectNulls: false, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#0ea5e9', width: 2 }, itemStyle: { color: '#0ea5e9' } }
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

// 打开抽屉或切到监控 tab 时按需拉取(rds_id + account_id + days)
watch(
  () => [props.visible, activeTab.value] as const,
  ([visible, tab]) => {
    if (!visible || tab !== 'monitor') return
    const key = `${accountId.value}:${rdsId.value}`
    if (!key || key === ':') return
    if (key !== metricsFetchedKey.value && !metricsError.value) {
      fetchRdsMetrics()
    } else if (hasMetricData.value) {
      // 抽屉关闭再打开时 el-drawer 用 v-show 保留 DOM,图表容器尺寸可能变化,重渲染兜底
      nextTick(() => renderRdsChart())
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

// 监控 tab:CPU/内存/磁盘使用率与连接数趋势
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
    background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px;

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
.rds-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
