<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="nas-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
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
                <el-icon :size="24"><FolderOpened /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">文件存储 NAS</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <!-- S-C9：抽屉「更多」菜单无处理器（扩容属资源变更入口），按主题 B 决策禁用 + title -->
                    <el-dropdown-item disabled title="功能开发中">挂载点管理</el-dropdown-item>
                    <el-dropdown-item disabled title="功能开发中">扩容</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="挂载点" name="mount" />
              <el-tab-pane label="标签" name="tags" />
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
                  <div class="info-row"><span class="info-label">文件系统ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-dot" :class="getStatusClass(instance.attributes?.status)"></span>{{ getStatusText(instance.attributes?.status) }}</span></div>
                  <div class="info-row"><span class="info-label">文件系统类型</span><span class="info-value">{{ getFileSystemTypeText(instance.attributes?.file_system_type) }}</span></div>
                  <div class="info-row"><span class="info-label">协议类型</span><span class="info-value">{{ instance.attributes?.protocol_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">存储类型</span><span class="info-value">{{ instance.attributes?.storage_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" />{{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">容量与配置</div>
                <div class="info-list">
                  <!-- S-Hard：资产表 capacity/used_capacity 为坏值,不在 NAS 界面展示;容量数值统一见「监控」tab(指标表来源) -->
                  <div class="info-row"><span class="info-label">挂载点数量</span><span class="info-value">{{ instance.attributes?.mount_target_count || 0 }}</span></div>
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">加密</span><span class="info-value">{{ instance.attributes?.encrypt_type ? '已加密' : '未加密' }}</span></div>
                  <div class="info-row"><span class="info-label">计费方式</span><span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) }}</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ instance.attributes?.description || '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="activeTab === 'mount'">
            <div class="tab-section">
              <div class="section-title">挂载点列表</div>
              <template v-if="mountTargets.length > 0">
                <div class="mount-list">
                  <div v-for="(mt, idx) in mountTargets" :key="idx" class="mount-card">
                    <div class="info-list">
                      <div class="info-row" v-if="mt.mount_target_id"><span class="info-label">挂载点ID</span><span class="info-value">{{ mt.mount_target_id }}</span></div>
                      <div class="info-row"><span class="info-label">挂载地址</span><span class="info-value monospace">{{ mt.mount_target_domain || '-' }}</span></div>
                      <div class="info-row"><span class="info-label">网络类型</span><span class="info-value">{{ mt.network_type || '-' }}</span></div>
                      <div class="info-row" v-if="mt.vpc_id"><span class="info-label">VPC</span><span class="info-value">{{ mt.vpc_id }}</span></div>
                      <div class="info-row" v-if="mt.vswitch_id"><span class="info-label">交换机</span><span class="info-value">{{ mt.vswitch_id }}</span></div>
                      <div class="info-row" v-if="mt.access_group_name"><span class="info-label">权限组</span><span class="info-value">{{ mt.access_group_name }}</span></div>
                      <div class="info-row" v-if="mt.status"><span class="info-label">状态</span><span class="info-value">{{ mt.status }}</span></div>
                    </div>
                  </div>
                </div>
              </template>
              <div v-else class="empty-tab"><el-icon :size="48"><FolderOpened /></el-icon><p>暂无挂载点</p></div>
            </div>
          </template>
          <template v-else-if="activeTab === 'tags'">
            <div class="tab-section">
              <div class="section-title">标签列表</div>
              <template v-if="tagList.length > 0">
                <table class="tags-table">
                  <thead><tr><th>标签键</th><th>标签值</th></tr></thead>
                  <tbody>
                    <tr v-for="tag in tagList" :key="tag.key">
                      <td>{{ tag.key }}</td>
                      <td>{{ tag.value || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
              <div v-else class="empty-tab"><el-icon :size="48"><PriceTag /></el-icon><p>暂无标签</p></div>
            </div>
          </template>
          <template v-else-if="activeTab === 'monitor'">
            <div v-loading="metricsLoading" class="metrics-section">
              <template v-if="metricsError">
                <div class="empty-tab">
                  <el-icon :size="48"><WarningFilled /></el-icon>
                  <p>{{ metricsError }}</p>
                  <el-button size="small" type="primary" plain @click="fetchNasMetrics">重试</el-button>
                </div>
              </template>
              <template v-else-if="hasMetricData">
                <el-alert
                  v-if="metricZeroException"
                  class="metrics-alert"
                  type="warning"
                  :closable="false"
                  show-icon
                  title="部分日期容量为 0(采集异常行),不代表真实零容量,已按容量异常标记"
                />
                <div class="metrics-note">近 {{ METRICS_DAYS }} 天容量与使用率(读采集指标表);断线表示当日无数据</div>
                <div class="metrics-latest">
                  <div class="summary-item"><span class="summary-label">最新容量</span><span class="summary-value">{{ formatCapacityGB(latestSummary?.capacity) }}</span></div>
                  <div class="summary-item"><span class="summary-label">已用容量</span><span class="summary-value">{{ formatCapacityGB(latestSummary?.used) }}</span></div>
                  <div class="summary-item"><span class="summary-label">使用率</span><span class="summary-value">{{ formatUtilization(latestSummary?.utilization) }}</span></div>
                </div>
                <div ref="metricsChartRef" class="metrics-chart"></div>
              </template>
              <div v-else-if="!metricsLoading" class="empty-tab">
                <el-icon :size="48"><DataLine /></el-icon>
                <p>暂无容量指标数据(未采集或该厂商未启用指标采集)</p>
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
import { getNasMetricsApi, type NASFsMetricsView, type NASMetricPoint } from '@/api/asset';
import type { Asset } from '@/api/types/asset';
import IconFont from '@/components/IconFont/index.vue';
import { getProviderLabel } from '@/utils/constants';
import { CHARGE_TYPE_LABELS, labelOfLenient } from '@/utils/fieldLabels';
import { formatNumber } from '@/utils/formatters';
import { formatCapacityGB, formatUtilization, hasZeroException } from '@/views/storage/nas/nasMetrics';
import { ArrowDown, Close, DataLine, Document, FolderOpened, PriceTag, WarningFilled } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const mountTargets = computed(() => {
  const targets = props.instance?.attributes?.mount_targets
  if (Array.isArray(targets)) return targets
  return []
})

const tagList = computed(() => {
  const tags = props.instance?.attributes?.tags
  if (!tags || typeof tags !== 'object') return []
  return Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }))
})

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); return s === 'running' ? 'running' : s === 'stopped' ? 'stopped' : '' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { running: '运行中', stopped: '已停止', pending: '创建中', Running: '运行中', Stopped: '已停止' }; return map[status] || status }
const getFileSystemTypeText = (type?: string) => { if (!type) return '-'; const map: Record<string, string> = { standard: '通用型', extreme: '极速型', cpfs: 'CPFS' }; return map[type] || type }

// ===== 监控 tab:容量/已用/使用率趋势(按需查询,读 ecam_nas_metric 指标表) =====
// 与 CdnDetailDrawer 指标 tab 同构;echarts 渲染在 canvas 上,CSS 变量不可用
const AXIS_LABEL_COLOR = '#a1a1aa'
const SPLIT_LINE_COLOR = 'rgba(255,255,255,0.08)'
const TOOLTIP_BG = 'rgba(23,23,23,0.92)'
const METRICS_DAYS = 30

const metricsLoading = ref(false)
const metricsResp = ref<NASFsMetricsView | null>(null)
const metricsError = ref('')
const metricsFetchedKey = ref('')
const metricsChartRef = ref<HTMLElement>()
let metricsChart: echarts.ECharts | null = null

/** 文件系统 ID(fs_id = 实例 asset_id)与云账号 ID */
const fsId = computed(() => String(props.instance?.asset_id || ''))
const accountId = computed(() => Number(props.instance?.attributes?.cloud_account_id || 0))

/** 后端已按日期升序返回,防御式再排一次(横轴须从早到晚) */
const metricPoints = computed<NASMetricPoint[]>(() => {
  const days = metricsResp.value?.days || []
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
})
/** 窗口内至少一天有真实数据(缺失日 capacity/used 均为 null) */
const hasMetricData = computed(() => metricPoints.value.some(p => p.capacity != null || p.used != null))
const metricZeroException = computed(() => hasZeroException(metricPoints.value))
const latestSummary = computed(() => metricsResp.value?.latest || null)

const fetchNasMetrics = async () => {
  if (!accountId.value || !fsId.value) {
    metricsError.value = '缺少账号或文件系统标识,无法查询'
    return
  }
  metricsLoading.value = true
  metricsError.value = ''
  try {
    const { data } = await getNasMetricsApi({ fs_id: fsId.value, account_id: accountId.value, days: METRICS_DAYS })
    metricsResp.value = data || null
    metricsFetchedKey.value = `${accountId.value}:${fsId.value}`
    // 数据到位后模板才渲染出图表容器,nextTick 确保 DOM 就位再 init
    await nextTick()
    renderNasChart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询容量指标失败'
    metricsError.value = `容量指标查询失败: ${msg}`
  } finally {
    metricsLoading.value = false
  }
}

/** 双轴图:柱=容量/已用(GB,左轴),线=使用率(%,右轴;缺失日/异常日置空断线) */
const renderNasChart = () => {
  const items = metricPoints.value
  if (!metricsChartRef.value || !hasMetricData.value) return

  if (metricsChart && metricsChart.getDom() !== metricsChartRef.value) {
    metricsChart.dispose()
    metricsChart = null
  }
  if (!metricsChart) metricsChart = echarts.init(metricsChartRef.value)

  // 供 tooltip 标注 capacity=0 异常日(qc_status 读取侧闭环)
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
          const suffix = p.seriesType === 'line' ? '%' : ' GB'
          lines.push(`${p.marker}${p.seriesName}: ${formatNumber(p.value)}${suffix}`)
        }
        if (statusByDate.get(fullDate) === 'zero_exception') {
          lines.push('⚠ 容量异常(capacity=0 采集异常行)')
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
        name: '容量(GB)',
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
        name: '容量',
        type: 'bar',
        data: items.map(p => p.capacity),
        barMaxWidth: 18,
        itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#60a5fa' } }
      },
      {
        name: '已用',
        type: 'bar',
        data: items.map(p => p.used),
        barMaxWidth: 18,
        itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#fbbf24' } }
      },
      {
        name: '使用率',
        type: 'line',
        yAxisIndex: 1,
        data: items.map(p => (p.utilization == null || p.utilization < 0 ? null : Math.round(p.utilization * 1000) / 10)),
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

// 打开抽屉或切到监控 tab 时按需拉取(fs_id + account_id + days)
watch(
  () => [props.visible, activeTab.value] as const,
  ([visible, tab]) => {
    if (!visible || tab !== 'monitor') return
    const key = `${accountId.value}:${fsId.value}`
    if (!key || key === ':') return
    if (key !== metricsFetchedKey.value && !metricsError.value) {
      fetchNasMetrics()
    } else if (hasMetricData.value) {
      // 抽屉关闭再打开时 el-drawer 用 v-show 保留 DOM,图表容器尺寸可能变化,重渲染兜底
      nextTick(() => renderNasChart())
    }
  }
)

// 抽屉打开期间监听窗口尺寸,保证趋势图随窗口缩放
watch(() => props.visible, (val) => {
  if (val) window.addEventListener('resize', handleMetricsResize)
  else window.removeEventListener('resize', handleMetricsResize)
})
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => (provider ? getProviderLabel(provider) : '-')
const getChargeTypeText = (type?: string) => labelOfLenient(CHARGE_TYPE_LABELS, type)
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
</script>

<style lang="scss">
.nas-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>

<style scoped lang="scss">
@import '../../styles/detail-drawer.scss';

.tab-section {
  padding: 16px;
  .section-title { font-size: 14px; font-weight: 500; margin-bottom: 12px; color: var(--text-primary); }
}

// 监控 tab:容量/已用/使用率趋势
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

.mount-list {
  display: flex; flex-direction: column; gap: 12px;
  .mount-card {
    border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px 16px; background: #fafafa;
    .info-list { display: flex; flex-direction: column; gap: 6px; }
    .info-row { display: flex; align-items: center; font-size: 13px; }
    .info-label { color: var(--text-tertiary); width: 80px; flex-shrink: 0; }
    .info-value { color: var(--text-primary); word-break: break-all; }
    .info-value.monospace { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; }
  }
}

.tags-table {
  width: 100%; border-collapse: collapse; font-size: 13px;
  th { text-align: left; padding: 8px 12px; background: var(--glass-bg); color: var(--text-tertiary); font-weight: 500; border-bottom: 1px solid var(--glass-border); }
  td { padding: 8px 12px; border-bottom: 1px solid var(--glass-border); color: var(--text-primary); }
  tr:hover td { background: var(--glass-bg); }
}
</style>
