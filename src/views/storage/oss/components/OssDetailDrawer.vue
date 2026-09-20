<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="oss-detail-drawer"
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
                <el-icon :size="24"><Folder /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">对象存储 OSS</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <!-- S-C10：抽屉「更多」菜单无处理器（权限管理属危险入口），按主题 B 决策禁用 + title -->
                    <el-dropdown-item disabled title="功能开发中">文件管理</el-dropdown-item>
                    <el-dropdown-item disabled title="功能开发中">基础设置</el-dropdown-item>
                    <el-dropdown-item disabled title="功能开发中">权限管理</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="文件列表" name="files" />
              <el-tab-pane label="访问控制" name="acl" />
              <el-tab-pane label="生命周期" name="lifecycle" />
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
                  <div class="info-row"><span class="info-label">存储桶名称</span><span class="info-value">{{ instance.asset_name || instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">存储桶ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">存储类型</span><span class="info-value"><el-tag size="small" :type="getStorageClassType(instance.attributes?.storage_class)">{{ getStorageClassText(instance.attributes?.storage_class) }}</el-tag></span></div>
                  <div class="info-row"><span class="info-label">访问权限</span><span class="info-value">{{ getAclText(instance.attributes?.acl) }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" />{{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">Endpoint</span><span class="info-value">{{ instance.attributes?.endpoint || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">存储统计</div>
                <div class="info-list">
                  <!-- S-Hard：资产表 storage_size/object_count 为枚举快照,不在 OSS 界面展示;
                       存储量/对象数唯一来源为指标表,统一见「监控」tab -->
                  <div class="info-row"><span class="info-label">存储量/对象数</span><span class="info-value link">见「监控」tab(采集指标表数据)</span></div>
                  <div class="info-row"><span class="info-label">版本控制</span><span class="info-value">{{ instance.attributes?.versioning ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">跨域访问</span><span class="info-value">{{ instance.attributes?.cors_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">静态网站</span><span class="info-value">{{ instance.attributes?.website_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">日志记录</span><span class="info-value">{{ instance.attributes?.logging_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">加密</span><span class="info-value">{{ instance.attributes?.encryption_enabled ? '已开启' : '未开启' }}</span></div>
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
                  <el-button size="small" type="primary" plain @click="fetchOssMetrics">重试</el-button>
                </div>
              </template>
              <template v-else-if="hasMetricData">
                <el-alert
                  v-if="metricZeroException"
                  class="metrics-alert"
                  type="warning"
                  :closable="false"
                  show-icon
                  title="部分日期存储量为 0(采集异常行),不代表真实空桶,已按容量异常标记"
                />
                <div class="metrics-note">近 {{ METRICS_DAYS }} 天存储量与对象数(读采集指标表);断线表示当日无数据</div>
                <div class="metrics-latest">
                  <div class="summary-item"><span class="summary-label">最新存储量</span><span class="summary-value">{{ formatCapacityGB(latestSummary?.storage_size) }}</span></div>
                  <div class="summary-item"><span class="summary-label">对象数量</span><span class="summary-value">{{ formatObjectCount(latestSummary?.object_count) }}</span></div>
                  <div class="summary-item"><span class="summary-label">近 {{ METRICS_DAYS }} 天均值</span><span class="summary-value">{{ formatCapacityGB(averageSummary?.storage_size) }}</span></div>
                </div>
                <div ref="metricsChartRef" class="metrics-chart"></div>
              </template>
              <div v-else-if="!metricsLoading" class="empty-tab">
                <el-icon :size="48"><DataLine /></el-icon>
                <p>暂无存储量指标数据(未采集或该厂商未启用指标采集)</p>
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
import { getOssMetricsApi, type OSSBucketMetricsView, type OSSMetricPoint } from '@/api/asset';
import type { Asset } from '@/api/types/asset';
import IconFont from '@/components/IconFont/index.vue';
import { safeTagType, getProviderLabel } from '@/utils/constants';
import { formatNumber } from '@/utils/formatters';
import { formatCapacityGB, formatObjectCount, hasZeroException } from '@/views/storage/oss/ossMetrics';
import { ArrowDown, Close, DataLine, Document, Folder, WarningFilled } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStorageClassText = (type?: string) => { if (!type) return '-'; const map: Record<string, string> = { Standard: '标准存储', IA: '低频存储', Archive: '归档存储', ColdArchive: '冷归档存储' }; return map[type] || type }
const getStorageClassType = (type?: string) => { if (!type) return 'info'; const map: Record<string, string> = { Standard: 'info', IA: 'warning', Archive: 'info' }; return safeTagType(map[type] || 'info') }
const getAclText = (acl?: string) => { if (!acl) return '-'; const map: Record<string, string> = { private: '私有', 'public-read': '公共读', 'public-read-write': '公共读写' }; return map[acl] || acl }

// ===== 监控 tab:存储量/对象数趋势(按需查询,读 ecam_oss_metric 指标表) =====
// 与 NasDetailDrawer 监控 tab 同构;echarts 渲染在 canvas 上,CSS 变量不可用
const AXIS_LABEL_COLOR = '#a1a1aa'
const SPLIT_LINE_COLOR = 'rgba(255,255,255,0.08)'
const TOOLTIP_BG = 'rgba(23,23,23,0.92)'
const METRICS_DAYS = 30

const metricsLoading = ref(false)
const metricsResp = ref<OSSBucketMetricsView | null>(null)
const metricsError = ref('')
const metricsFetchedKey = ref('')
const metricsChartRef = ref<HTMLElement>()
let metricsChart: echarts.ECharts | null = null

/** 存储桶名称(OSS asset_id 即 bucket_name)与云账号 ID */
const bucketName = computed(() => String(props.instance?.asset_id || ''))
const accountId = computed(() => Number(props.instance?.attributes?.cloud_account_id || 0))

/** 后端已按日期升序返回,防御式再排一次(横轴须从早到晚) */
const metricPoints = computed<OSSMetricPoint[]>(() => {
  const days = metricsResp.value?.days || []
  return [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
})
/** 窗口内至少一天有真实数据(缺失日 storage_size/object_count 均为 null) */
const hasMetricData = computed(() => metricPoints.value.some(p => p.storage_size != null || p.object_count != null))
const metricZeroException = computed(() => hasZeroException(metricPoints.value))
const latestSummary = computed(() => metricsResp.value?.latest || null)
const averageSummary = computed(() => metricsResp.value?.average || null)

const fetchOssMetrics = async () => {
  if (!accountId.value || !bucketName.value) {
    metricsError.value = '缺少账号或存储桶标识,无法查询'
    return
  }
  metricsLoading.value = true
  metricsError.value = ''
  try {
    const { data } = await getOssMetricsApi({ bucket_name: bucketName.value, account_id: accountId.value, days: METRICS_DAYS })
    metricsResp.value = data || null
    metricsFetchedKey.value = `${accountId.value}:${bucketName.value}`
    // 数据到位后模板才渲染出图表容器,nextTick 确保 DOM 就位再 init
    await nextTick()
    renderOssChart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询存储量指标失败'
    metricsError.value = `存储量指标查询失败: ${msg}`
  } finally {
    metricsLoading.value = false
  }
}

/** 双轴图:柱=存储量(GB,左轴),线=对象数(右轴;缺失日/异常日置空断线) */
const renderOssChart = () => {
  const items = metricPoints.value
  if (!metricsChartRef.value || !hasMetricData.value) return

  if (metricsChart && metricsChart.getDom() !== metricsChartRef.value) {
    metricsChart.dispose()
    metricsChart = null
  }
  if (!metricsChart) metricsChart = echarts.init(metricsChartRef.value)

  // 供 tooltip 标注 storage_size=0 异常日(qc_status 读取侧闭环)
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
          const suffix = p.seriesType === 'line' ? ' 个' : ' GB'
          lines.push(`${p.marker}${p.seriesName}: ${formatNumber(p.value)}${suffix}`)
        }
        if (statusByDate.get(fullDate) === 'zero_exception') {
          lines.push('⚠ 容量异常(storage_size=0 采集异常行)')
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
        name: '存储量(GB)',
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
        name: '对象数',
        nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        axisLabel: {
          color: AXIS_LABEL_COLOR,
          fontSize: 11,
          formatter: (val: number) => (val >= 10000 ? `${(val / 10000).toFixed(1)}万` : `${val}`)
        },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '存储量',
        type: 'bar',
        data: items.map(p => p.storage_size),
        barMaxWidth: 18,
        itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#60a5fa' } }
      },
      {
        name: '对象数',
        type: 'line',
        yAxisIndex: 1,
        data: items.map(p => p.object_count),
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

// 打开抽屉或切到监控 tab 时按需拉取(bucket_name + account_id + days)
watch(
  () => [props.visible, activeTab.value] as const,
  ([visible, tab]) => {
    if (!visible || tab !== 'monitor') return
    const key = `${accountId.value}:${bucketName.value}`
    if (!key || key === ':') return
    if (key !== metricsFetchedKey.value && !metricsError.value) {
      fetchOssMetrics()
    } else if (hasMetricData.value) {
      // 抽屉关闭再打开时 el-drawer 用 v-show 保留 DOM,图表容器尺寸可能变化,重渲染兜底
      nextTick(() => renderOssChart())
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
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
</script>

<style scoped lang="scss">
@import '../../styles/detail-drawer.scss';

// 监控 tab:存储量/对象数趋势
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
.oss-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
