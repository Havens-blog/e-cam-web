<template>
  <el-drawer
    :model-value="visible"
    size="720px"
    :close-on-click-modal="true"
    class="cdn-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div class="instance-icon">
          <el-icon :size="20"><Connection /></el-icon>
        </div>
        <div class="instance-info">
          <div class="instance-type">CDN 加速域名</div>
          <div class="instance-name">{{ domainName }}</div>
        </div>
      </div>
    </template>
    <div class="drawer-body">
      <template v-if="instance">
        <div class="drawer-tabs">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="详情" name="detail" />
            <el-tab-pane label="流量/命中率" name="metrics" />
            <el-tab-pane label="缓存配置" name="cache" />
            <el-tab-pane label="功能配置" name="settings" />
            <el-tab-pane label="源站配置" name="origins" />
            <el-tab-pane label="标签" name="tags" />
          </el-tabs>
        </div>

        <div class="drawer-content">
          <!-- 详情 Tab -->
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">域名</span>
                    <span class="info-value">{{ domainName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CNAME</span>
                    <span class="info-value mono">{{ attr.cname || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value"><AssetStatusBadge :status="instance.status" :labels="statusLabels" /></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">业务类型</span>
                    <span class="info-value">
                      <el-tag size="small" effect="plain">{{ cdnBusinessTypeLabel(attr.business_type) }}</el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">服务区域</span>
                    <span class="info-value">{{ cdnServiceAreaLabel(attr.service_area) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云平台</span>
                    <span class="info-value">
                      <div class="provider-inline">
                        <ProviderIcon :provider="instance.provider" size="small" />
                        <span>{{ getProviderName(instance.provider) }}</span>
                      </div>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云账号</span>
                    <span class="info-value">{{ attr.cloud_account_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">域名ID</span>
                    <span class="info-value mono">{{ attr.domain_id || instance.asset_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">资源组</span>
                    <span class="info-value mono">{{ attr.resource_group_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">备注</span>
                    <span class="info-value">{{ attr.description || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ formatTime(attr.creation_time) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">修改时间</span>
                    <span class="info-value">{{ formatTime(attr.modified_time) }}</span>
                  </div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">安全配置</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">HTTPS</span>
                    <span class="info-value" :class="attr.https_enabled ? 'bool-on' : 'bool-off'">
                      {{ attr.https_enabled ? '已开启' : '未开启' }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">HTTP/2</span>
                    <span class="info-value" :class="attr.http2_enabled ? 'bool-on' : 'bool-off'">
                      {{ attr.http2_enabled ? '已开启' : '未开启' }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">证书名称</span>
                    <span class="info-value">{{ attr.cert_name || '-' }}</span>
                  </div>
                </div>

                <div class="column-title" style="margin-top: 24px">回源概要</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">回源 Host</span>
                    <span class="info-value mono">{{ attr.origin_host || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">回源类型</span>
                    <span class="info-value">{{ getOriginTypeLabel(attr.origin_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">源站数量</span>
                    <span class="info-value">{{ originList.length }} 个</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 流量/命中率 Tab -->
          <template v-else-if="activeTab === 'metrics'">
            <div v-loading="metricsLoading" class="metrics-section">
              <template v-if="metricsError">
                <div class="empty-tab">
                  <el-icon :size="48"><WarningFilled /></el-icon>
                  <p>{{ metricsError }}</p>
                  <el-button size="small" type="primary" plain @click="fetchDomainMetrics">重试</el-button>
                </div>
              </template>
              <template v-else-if="metricsItems.length > 0">
                <div class="metrics-note">
                  近 30 天流量与命中率(读采集指标表);命中率为「—」表示当日无数据
                </div>
                <div ref="metricsChartRef" class="metrics-chart"></div>
              </template>
              <div v-else-if="!metricsLoading" class="empty-tab">
                <el-icon :size="48"><DataLine /></el-icon>
                <p>暂无流量指标数据</p>
              </div>
            </div>
          </template>

          <!-- 缓存配置 Tab -->
          <template v-else-if="activeTab === 'cache'">
            <div v-loading="cacheLoading" class="cache-section">
              <template v-if="cacheError">
                <div class="empty-tab">
                  <el-icon :size="48"><WarningFilled /></el-icon>
                  <p>{{ cacheError }}</p>
                  <el-button size="small" type="primary" plain @click="fetchCacheRules">重试</el-button>
                </div>
              </template>
              <template v-else-if="cacheRules.length > 0">
                <div class="cache-note">
                  实时读取自云厂商 API,共 {{ cacheRules.length }} 条规则;按优先级生效
                </div>
                <el-table :data="sortedCacheRules" style="width: 100%" border>
                  <el-table-column label="匹配内容" min-width="220" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span class="mono">{{ row.path }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="匹配类型" width="110" align="center">
                    <template #default="{ row }">
                      <el-tag size="small" effect="plain">{{ cdnCacheRuleTypeLabel(row.type) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="缓存时间" width="120" align="center">
                    <template #default="{ row }">
                      <span :class="{ 'ttl-no-cache': row.ttl === 0 }">{{ cdnTtlText(row.ttl) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column min-width="150">
                    <template #header>
                      <span class="behavior-header">
                        行为
                        <el-tooltip placement="top">
                          <template #content>
                            规则的缓存策略细节,悬停各项术语查看说明。<br />
                            多条规则按优先级匹配:命中第一条后不再向下。
                          </template>
                          <el-icon :size="13" class="behavior-help"><QuestionFilled /></el-icon>
                        </el-tooltip>
                      </span>
                    </template>
                    <template #default="{ row }">
                      <span class="behavior-cell">
                        <el-tooltip
                          v-for="seg in cdnCacheBehaviorHints(row)"
                          :key="seg.text"
                          :content="seg.hint"
                          placement="top"
                          :disabled="!seg.hint"
                        >
                          <span class="behavior-item" :class="{ 'behavior-plain': !seg.hint }">{{ seg.text }}</span>
                        </el-tooltip>
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="优先级" width="90" align="center">
                    <template #default="{ row }">{{ row.priority || '-' }}</template>
                  </el-table-column>
                </el-table>
              </template>
              <div v-else-if="!cacheLoading" class="empty-tab">
                <el-icon :size="48"><Connection /></el-icon>
                <p>该云厂商暂无缓存规则数据</p>
              </div>
            </div>
          </template>

          <!-- 功能配置 Tab -->
          <template v-else-if="activeTab === 'settings'">
            <div v-loading="settingsLoading" class="settings-section">
              <template v-if="settingsError">
                <div class="empty-tab">
                  <el-icon :size="48"><WarningFilled /></el-icon>
                  <p>{{ settingsError }}</p>
                  <el-button size="small" type="primary" plain @click="fetchDomainSettings">重试</el-button>
                </div>
              </template>
              <template v-else-if="settingsGroups.length > 0">
                <div class="cache-note">
                  实时读取自云厂商 API,按功能分组展示;悬停配置项查看参数明细,敏感参数已脱敏
                </div>
                <div v-for="g in settingsGroups" :key="g.category" class="settings-group">
                  <div class="settings-group-title">
                    {{ g.label }}
                    <span class="group-count">{{ g.items.length }} 项</span>
                  </div>
                  <div v-for="it in g.items" :key="it.key" class="settings-item">
                    <el-tooltip placement="top" :content="settingsTooltip(it)" :disabled="!settingsTooltip(it)">
                      <div class="settings-item-main">
                        <el-tag v-if="it.enabled === true" size="small" type="success" effect="plain" class="state-tag">开</el-tag>
                        <el-tag v-else-if="it.enabled === false" size="small" type="info" effect="plain" class="state-tag">关</el-tag>
                        <span v-else class="state-tag" />
                        <span class="item-name">{{ it.name }}</span>
                        <span class="item-summary">{{ it.summary || '-' }}</span>
                      </div>
                    </el-tooltip>
                  </div>
                </div>
              </template>
              <div v-else-if="!settingsLoading" class="empty-tab">
                <el-icon :size="48"><Connection /></el-icon>
                <p>该云厂商暂无功能配置数据</p>
              </div>
            </div>
          </template>

          <!-- 源站配置 Tab -->
          <template v-else-if="activeTab === 'origins'">
            <div v-if="originList.length > 0" class="origins-section">
              <div class="origins-summary">
                <div class="summary-item">
                  <span class="summary-label">回源 Host</span>
                  <span class="summary-value mono">{{ attr.origin_host || '-' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">回源类型</span>
                  <span class="summary-value">{{ getOriginTypeLabel(attr.origin_type) }}</span>
                </div>
              </div>

              <el-table :data="originList" style="width: 100%" border>
                <el-table-column label="源站地址" min-width="280" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="mono">{{ row.address || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" effect="plain">{{ getOriginTypeLabel(row.type) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="端口" width="80" align="center">
                  <template #default="{ row }">{{ row.port || '-' }}</template>
                </el-table-column>
                <el-table-column label="优先级" width="80" align="center">
                  <template #default="{ row }">{{ row.priority ?? '-' }}</template>
                </el-table-column>
                <el-table-column label="权重" width="80" align="center">
                  <template #default="{ row }">{{ row.weight ?? '-' }}</template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Connection /></el-icon>
              <p>暂无源站配置信息</p>
            </div>
          </template>

          <!-- 标签 Tab -->
          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" size="default" class="tag-item">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><PriceTag /></el-icon>
              <p>暂无标签</p>
            </div>
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { getCDNCacheConfigApi, getCDNDomainSettingsApi, getCdnMetricsApi, type CDNCacheRule, type CDNConfigGroup, type CDNConfigSetting, type CDNMetricItem } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import {
  CDN_STATUS_LABELS,
  cdnBusinessTypeLabel,
  cdnCacheBehaviorHints,
  cdnCacheRuleTypeLabel,
  cdnServiceAreaLabel,
  cdnTtlText,
} from '@/utils/cdn'
import { getProviderLabel } from '@/utils/constants'
import { formatNumber } from '@/utils/formatters'
import { Connection, DataLine, PriceTag, QuestionFilled, WarningFilled } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

/** 状态值 → 展示文案(与列表页共用同一份映射) */
const statusLabels = CDN_STATUS_LABELS

interface OriginItem {
  address: string
  type?: string
  port?: number
  priority?: number
  weight?: number
}

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()
const activeTab = ref('detail')

// ===== 缓存配置(按需实时查询) =====
const cacheLoading = ref(false)
const cacheRules = ref<CDNCacheRule[]>([])
const cacheError = ref('')
const cacheFetchedKey = ref('')

/** 优先级降序,未标优先级的排后 */
const sortedCacheRules = computed(() =>
  [...cacheRules.value].sort((a, b) => (b.priority || 0) - (a.priority || 0))
)

const fetchCacheRules = async () => {
  const inst = props.instance
  if (!inst) return
  const accountId = Number(inst.attributes?.cloud_account_id || 0)
  const domainName = attr.value.domain_name || ''
  const domainId = String(inst.attributes?.domain_id || inst.asset_id || '')
  if (!accountId || (!domainName && !domainId)) {
    cacheError.value = '缺少账号或域名标识,无法查询'
    return
  }
  cacheLoading.value = true
  cacheError.value = ''
  try {
    const res = await getCDNCacheConfigApi({
      account_id: accountId,
      domain_name: domainName || undefined,
      domain_id: domainId || undefined,
    })
    cacheRules.value = (res as any).data?.rules || []
    cacheFetchedKey.value = `${accountId}:${domainId}:${domainName}`
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询缓存配置失败'
    // 多数情况是厂商接口失败;提示具体原因并允许重试
    cacheError.value = msg.includes('不支持') ? msg : `缓存配置查询失败: ${msg}`
  } finally {
    cacheLoading.value = false
  }
}

// ===== 功能配置全景(按需实时查询) =====
const settingsLoading = ref(false)
const settingsGroups = ref<CDNConfigGroup[]>([])
const settingsError = ref('')
const settingsFetchedKey = ref('')

/** 配置项 tooltip:函数名 + 参数明细(敏感参数后端已脱敏) */
const settingsTooltip = (it: CDNConfigSetting): string => {
  const entries = Object.entries(it.params || {})
  if (entries.length === 0) return it.key
  return [it.key, ...entries.map(([k, v]) => `${k} = ${v}`)].join('\n')
}

const fetchDomainSettings = async () => {
  const inst = props.instance
  if (!inst) return
  const accountId = Number(inst.attributes?.cloud_account_id || 0)
  const domainName = attr.value.domain_name || ''
  const domainId = String(inst.attributes?.domain_id || inst.asset_id || '')
  if (!accountId || (!domainName && !domainId)) {
    settingsError.value = '缺少账号或域名标识,无法查询'
    return
  }
  settingsLoading.value = true
  settingsError.value = ''
  try {
    const res = await getCDNDomainSettingsApi({
      account_id: accountId,
      domain_name: domainName || undefined,
      domain_id: domainId || undefined,
    })
    settingsGroups.value = (res as any).data?.groups || []
    settingsFetchedKey.value = `${accountId}:${domainId}:${domainName}`
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询功能配置失败'
    settingsError.value = msg.includes('不支持') ? msg : `功能配置查询失败: ${msg}`
  } finally {
    settingsLoading.value = false
  }
}

// ===== 流量/命中率趋势(按需查询,读采集指标表) =====
// 与 dashboard 图表一致的暗色配色(echarts 渲染在 canvas 上,CSS 变量不可用)
const AXIS_LABEL_COLOR = '#a1a1aa'
const SPLIT_LINE_COLOR = 'rgba(255,255,255,0.08)'
const TOOLTIP_BG = 'rgba(23,23,23,0.92)'
const METRICS_DAYS = 30

const metricsLoading = ref(false)
const metricsItems = ref<CDNMetricItem[]>([])
const metricsError = ref('')
const metricsFetchedKey = ref('')
const metricsChartRef = ref<HTMLElement>()
let metricsChart: echarts.ECharts | null = null

/** 图表横轴需从早到晚,后端按 date 降序返回,这里统一升序 */
const sortedMetrics = computed(() =>
  [...metricsItems.value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
)

/** 字节 → GB(保留两位) */
const bytesToGB = (bytes: number) => Math.round((bytes / 1024 ** 3) * 100) / 100

const fetchDomainMetrics = async () => {
  const inst = props.instance
  if (!inst) return
  const accountId = Number(inst.attributes?.cloud_account_id || 0)
  const domainName = attr.value.domain_name || ''
  if (!accountId || !domainName) {
    metricsError.value = '缺少账号或域名标识,无法查询'
    return
  }
  metricsLoading.value = true
  metricsError.value = ''
  try {
    const { data } = await getCdnMetricsApi({ account_id: accountId, domain_name: domainName, days: METRICS_DAYS })
    metricsItems.value = data?.items || []
    metricsFetchedKey.value = `${accountId}:${domainName}`
    // 数据到位后模板才渲染出图表容器,nextTick 确保 DOM 就位再 init
    await nextTick()
    renderMetricsChart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询流量指标失败'
    metricsError.value = `流量指标查询失败: ${msg}`
  } finally {
    metricsLoading.value = false
  }
}

/** 双轴图:柱=每日流量(GB,左轴),线=命中率(%,右轴;-1 未知置空断线) */
const renderMetricsChart = () => {
  const items = sortedMetrics.value
  if (!metricsChartRef.value || items.length === 0) return

  if (metricsChart && metricsChart.getDom() !== metricsChartRef.value) {
    metricsChart.dispose()
    metricsChart = null
  }
  if (!metricsChart) metricsChart = echarts.init(metricsChartRef.value)

  metricsChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: TOOLTIP_BG,
      borderColor: SPLIT_LINE_COLOR,
      textStyle: { color: '#d4d4d8', fontSize: 12 },
      formatter: (params: any) => {
        const lines = [String(params[0]?.axisValue ?? '')]
        for (const p of params) {
          if (p.seriesType === 'bar') {
            lines.push(`${p.marker}流量: ${formatNumber(p.value)} GB`)
          } else {
            const unknown = p.value == null || p.value === '-'
            lines.push(`${p.marker}命中率: ${unknown ? '—' : `${p.value}%`}`)
          }
        }
        return lines.join('<br/>')
      }
    },
    legend: {
      top: 0,
      right: 8,
      textStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 }
    },
    grid: { left: 56, right: 56, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: items.map(m => (m.date.length >= 10 ? m.date.slice(5, 10) : m.date)),
      axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
      axisLine: { lineStyle: { color: SPLIT_LINE_COLOR } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '流量(GB)',
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
        name: '命中率',
        min: 0,
        max: 100,
        nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
        axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11, formatter: '{value}%' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '流量',
        type: 'bar',
        data: items.map(m => bytesToGB(m.bytes || 0)),
        barMaxWidth: 18,
        itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
        emphasis: { itemStyle: { color: '#60a5fa' } }
      },
      {
        name: '命中率',
        type: 'line',
        yAxisIndex: 1,
        data: items.map(m => (m.hit_rate == null || m.hit_rate < 0 ? null : Math.round(m.hit_rate * 1000) / 10)),
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
  cacheRules.value = []
  cacheError.value = ''
  cacheFetchedKey.value = ''
  settingsGroups.value = []
  settingsError.value = ''
  settingsFetchedKey.value = ''
  metricsItems.value = []
  metricsError.value = ''
  metricsFetchedKey.value = ''
})

// 打开抽屉或切到按需查询 Tab 时拉取(缓存配置 / 功能配置 / 流量指标同构)
watch(
  () => [props.visible, activeTab.value] as const,
  ([visible, tab]) => {
    if (!visible) return
    if (tab !== 'cache' && tab !== 'settings' && tab !== 'metrics') return
    const inst = props.instance
    const key = inst ? `${Number(inst.attributes?.cloud_account_id || 0)}:${inst.attributes?.domain_id || inst.asset_id || ''}:${inst.attributes?.domain_name || ''}` : ''
    if (!key) return
    if (tab === 'cache' && key !== cacheFetchedKey.value && !cacheError.value) fetchCacheRules()
    if (tab === 'settings' && key !== settingsFetchedKey.value && !settingsError.value) fetchDomainSettings()
    if (tab === 'metrics') {
      if (key !== metricsFetchedKey.value && !metricsError.value) {
        fetchDomainMetrics()
      } else if (metricsItems.value.length > 0) {
        // 抽屉关闭再打开时 el-drawer 用 v-show 保留 DOM,图表容器尺寸可能变化,重渲染兜底
        nextTick(() => renderMetricsChart())
      }
    }
  }
)

// 抽屉打开期间监听窗口尺寸,保证趋势图随窗口缩放
watch(() => props.visible, (val) => {
  if (val) window.addEventListener('resize', handleMetricsResize)
  else window.removeEventListener('resize', handleMetricsResize)
})

/** 安全获取 attributes */
const attr = computed(() => props.instance?.attributes || {} as Record<string, any>)

/** 域名 */
const domainName = computed(() => {
  if (!props.instance) return '-'
  if (attr.value.domain_name) return attr.value.domain_name
  const name = props.instance.asset_name || props.instance.asset_id || ''
  const idx = name.indexOf('CNAME:')
  return idx > 0 ? name.substring(0, idx) : name || '-'
})

/** 源站列表 */
const originList = computed<OriginItem[]>(() => {
  const origins = attr.value.origins
  if (!origins) return []
  if (Array.isArray(origins)) return origins.filter((o: any) => o != null)
  return []
})

/** 标签列表 */
const tagList = computed(() => {
  const tags = attr.value.tags
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return []
  return Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }))
})

/** 云厂商展示名统一走 utils/constants 单源（含 volcengine/bytedance 等变体归一） */
const getProviderName = (provider: string | undefined): string => (provider ? getProviderLabel(provider) : '-')

const getOriginTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    oss: 'OSS 对象存储', ipaddr: 'IP 地址', domain: '域名',
    cos: 'COS 对象存储', obs: 'OBS 对象存储', s3: 'S3 对象存储',
    fc_domain: '函数计算', ip: 'IP 地址',
  }
  return map[type || ''] || type || '-'
}

const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(time)
}
</script>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .instance-icon {
    width: 40px; height: 40px; border-radius: 9px;
    background: rgba(59, 130, 246, 0.14); color: #60a5fa;
    display: flex; align-items: center; justify-content: center;
  }
  .instance-info {
    .instance-type { font-size: 11px; color: var(--text-tertiary); margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  }
}

.drawer-tabs {
  flex-shrink: 0;
  padding: 0 24px; border-bottom: 1px solid var(--glass-border);
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 40px; line-height: 40px; font-size: 13px; }
  }
}

.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; }

.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }

.detail-column {
  .column-title {
    font-size: 14px; font-weight: 600; color: var(--text-primary);
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--glass-border);
  }
}

.info-list { display: flex; flex-direction: column; }

.info-row {
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px;
  .info-label { width: 80px; flex-shrink: 0; color: var(--text-tertiary); }
  .info-value {
    flex: 1; color: var(--text-primary); word-break: break-all;
    &.mono { font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
    &.bool-on { color: #4ade80; }
    &.bool-off { color: var(--text-muted); }
  }
}

.provider-inline {
  display: flex; align-items: center; gap: 6px;
}

.mono {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}

// 缓存配置
.cache-section {
  min-height: 200px;

  .cache-note {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
  }

  .ttl-no-cache {
    color: var(--el-color-warning);
  }

  .behavior-header {
    display: inline-flex;
    align-items: center;
    gap: 3px;

    .behavior-help {
      color: var(--text-tertiary);
      cursor: help;
    }
  }

  .behavior-cell {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    font-size: 12px;

    .behavior-item {
      cursor: help;
      text-decoration: underline dotted var(--text-tertiary);
      text-underline-offset: 3px;
    }

    .behavior-plain {
      cursor: default;
      text-decoration: none;
    }
  }
}

// 流量/命中率
.metrics-section {
  min-height: 200px;

  .metrics-note {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
  }

  .metrics-chart {
    width: 100%;
    height: 320px;
  }
}

// 功能配置
.settings-section {
  min-height: 200px;

  .settings-group {
    margin-bottom: 20px;

    .settings-group-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      padding-bottom: 8px;
      margin-bottom: 4px;
      border-bottom: 1px solid var(--glass-border);

      .group-count {
        font-size: 11px;
        font-weight: 400;
        color: var(--text-tertiary);
      }
    }

    .settings-item-main {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
      cursor: default;

      .state-tag {
        flex-shrink: 0;
        align-self: center;
        min-width: 22px;
        justify-content: center;
      }

      .item-name {
        color: var(--text-primary);
        font-weight: 500;
        white-space: nowrap;
      }

      .item-summary {
        color: var(--text-secondary);
        word-break: break-all;
      }
    }
  }
}

// 源站配置
.origins-section {
  .origins-summary {
    display: flex; gap: 32px; padding: 16px; margin-bottom: 16px;
    background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px;

    .summary-item {
      display: flex; flex-direction: column; gap: 4px;
      .summary-label { font-size: 12px; color: var(--text-tertiary); }
      .summary-value { font-size: 13px; color: var(--text-primary); font-weight: 500; }
    }
  }
}

.tags-container {
  display: flex; flex-wrap: wrap; gap: 12px;
  .tag-item { font-size: 13px; }
}

.empty-tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 300px; color: var(--text-tertiary);
  p { margin-top: 16px; }
}
</style>

<style lang="scss">
.cdn-detail-drawer {
  .el-drawer__body { padding: 0; display: flex; flex-direction: column; overflow: hidden; }
}
</style>
