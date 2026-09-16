<template>
  <div class="log-stats" data-viz-root>
    <!-- KPI 行 -->
    <div class="kpi-row">
      <div v-for="k in kpis" :key="k.label" class="kpi-tile">
        <div class="kpi-value" :class="k.tone ? `tone-${k.tone}` : ''" :title="k.hint">
          {{ k.value }}
        </div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <!-- 图表区:三个并列 + 时间趋势全宽 -->
    <div class="chart-grid">
      <div class="chart-cell">
        <div class="chart-title">状态码分布(采样)</div>
        <ChartCard title="状态码分布" :option="statusOption" height="240px" />
      </div>
      <div class="chart-cell">
        <div class="chart-title">{{ secondChartTitle }}</div>
        <ChartCard :title="secondChartTitle" :option="secondOption" height="240px" />
      </div>
      <div class="chart-cell">
        <div class="chart-title">{{ thirdChartTitle }}</div>
        <ChartCard ref="topnChartRef" :title="thirdChartTitle" :option="thirdOption" height="240px" />
      </div>
      <div class="chart-cell chart-cell-wide">
        <div class="chart-title">{{ trendChartTitle }}</div>
        <ChartCard title="时间趋势" :option="trendOption" height="220px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 日志统计视图:KPI 行 + 按类型定制的图表组(状态码/命中/动作 + TopN + 时间趋势)。
 * 趋势/总数/TopN 优先用服务端聚合(全窗真实);聚合缺失时回退采样估算。
 * 占比图(状态码/命中/动作/延迟)始终采样估算,图题标"(采样)"。
 * 颜色纪律:语义切片用状态色板并固定顺序,排名/趋势单一蓝;身份靠图例/标签。
 */
import type { EChartsOption } from 'echarts'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LogAggregateResponse, LogEntry, LogType } from '@/api/types/logs'
import ChartCard from '@/components/ChartCard.vue'
import { formatBytes } from '../format'
import {
    SERIES_COLOR,
    buildActionSlices,
    buildCacheSlices,
    buildKpis,
    buildLatencyBuckets,
    buildStatusSlices,
    buildTopHosts,
    buildTopRules,
    buildTrend,
    buildTrendFromBuckets,
} from '../stats'
import type { Slice } from '../stats'

const props = defineProps<{
    entries: LogEntry[]
    logType: LogType
    /** 服务端聚合结果(真实总数/趋势/TopN;null=聚合失败,回退采样) */
    aggregate?: LogAggregateResponse | null
    /** 当前聚合指标(count/sum_bytes/avg_latency/p99_latency),TopN 数值图用 */
    metric?: string
}>()

/** TopN 条形图点击下钻:只上报被点击的分组名,维度映射与重查由父组件完成(不反向改父级 state) */
const emit = defineEmits<{ 'bar-click': [payload: { name: string }] }>()

/** 指标展示单位与标题(图题标注真实指标名,避免只看百分比猜语义) */
const metricMeta = computed(() => {
    switch (props.metric) {
        case 'sum_bytes':
            return { label: '下行字节', unit: 'B', fmt: (v: number) => formatBytes(v) }
        case 'avg_latency':
            return { label: '平均耗时', unit: 'ms', fmt: (v: number) => `${Math.round(v).toLocaleString()} ms` }
        case 'p99_latency':
            return { label: 'P99 耗时', unit: 'ms', fmt: (v: number) => `${Math.round(v).toLocaleString()} ms` }
        default:
            return { label: '计数', unit: '条', fmt: (v: number) => `${v.toLocaleString()} 条` }
    }
})

const kpis = computed(() => buildKpis(props.logType, props.entries))

// ---- 图表选项 ----

/** 环形图:语义切片 + 右侧图例(名称+条数),标签不参与配色 */
function donutOption(slices: Slice[]): EChartsOption {
    return {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} 条({d}%)',
        },
        legend: {
            orient: 'vertical',
            right: 8,
            top: 'middle',
            icon: 'circle',
            itemWidth: 8,
            itemHeight: 8,
            textStyle: { color: 'var(--text-secondary)', fontSize: 12 },
        },
        series: [
            {
                type: 'pie',
                radius: ['48%', '72%'],
                center: ['38%', '50%'],
                itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 4 },
                label: { show: false },
                data: slices.map((s) => ({
                    name: s.name,
                    value: s.value,
                    itemStyle: { color: s.color },
                })),
            },
        ],
    }
}

/** TopN 横向条形:单一蓝色,直接标数值(文本用文字色,不染色;可带指标格式化) */
function topBarOption(data: { name: string; value: number }[], fmt?: (v: number) => string): EChartsOption {
    const show = fmt ?? ((v: number) => `${v.toLocaleString()} 条`)
    const rows = [...data].reverse() // yAxis 自下而上,反转后第一名在顶部
    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const p = (ps as Array<{ name: string; value: number }>)[0]
                if (!p) return ''
                return `${p.name}: ${show(p.value)}`
            },
        },
        grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
        xAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: 'var(--glass-border)', type: 'dashed' } },
            axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
        },
        yAxis: {
            type: 'category',
            data: rows.map((r) => r.name),
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: {
                color: 'var(--text-secondary)',
                fontSize: 12,
                // 长分组值(如 IPv6 / 完整 UA)限宽省略,避免 echarts 按真实
                // 标签宽度撑大左侧留白把图压瘪;完整值在 tooltip 里
                width: 200,
                overflow: 'truncate',
                formatter: (v: string) => (v.length > 26 ? `${v.slice(0, 25)}…` : v),
            },
        },
        series: [
            {
                type: 'bar',
                data: rows.map((r) => r.value),
                barMaxWidth: 14,
                itemStyle: { color: SERIES_COLOR, borderRadius: [0, 4, 4, 0] },
                label: {
                    show: true,
                    position: 'right',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    formatter: (p: unknown) => show((p as { value: number }).value || 0),
                },
            },
        ],
    }
}

/** 时间趋势:面积图(单一蓝,浅填充),自适应分桶 */
function trendChartOption(points: { name: string; value: number }[]): EChartsOption {
    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: '#c0c4cc' } },
            formatter: (ps: unknown) => {
                const p = (ps as Array<{ name: string; value: number }>)[0]
                if (!p) return ''
                return `${p.name}: ${p.value.toLocaleString()} 条`
            },
        },
        grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
        xAxis: {
            type: 'category',
            data: points.map((p) => p.name),
            boundaryGap: false,
            axisTick: { show: false },
            axisLine: { lineStyle: { color: 'var(--glass-border)' } },
            axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            minInterval: 1,
            splitLine: { lineStyle: { color: 'var(--glass-border)', type: 'dashed' } },
            axisLabel: { color: 'var(--text-tertiary)', fontSize: 11 },
        },
        series: [
            {
                type: 'line',
                data: points.map((p) => p.value),
                smooth: true,
                showSymbol: false,
                lineStyle: { color: SERIES_COLOR, width: 2 },
                itemStyle: { color: SERIES_COLOR },
                areaStyle: { color: 'rgba(42, 120, 214, 0.12)' },
            },
        ],
    }
}

// ---- 按类型定制三张图(状态码固定第一张,趋势固定全宽) ----
// 占比图用采样估算(占比对采样不敏感);趋势/TopN 优先服务端聚合(全窗真实)。

const statusOption = computed(() => donutOption(buildStatusSlices(props.entries)))

const secondChartTitle = computed(() => {
    const base = props.logType === 'cdn' ? '缓存命中分布' : props.logType === 'waf' ? '动作分布' : '延迟分布'
    return `${base}(采样)`
})

const secondOption = computed<EChartsOption>(() => {
    if (props.logType === 'cdn') return donutOption(buildCacheSlices(props.entries))
    if (props.logType === 'waf') return donutOption(buildActionSlices(props.entries))
    return topBarOption(buildLatencyBuckets(props.entries))
})

const hasAggregate = computed(() => !!props.aggregate && (props.aggregate.buckets.length > 0 || props.aggregate.topn.length > 0))

const thirdChartTitle = computed(() => {
    // 全窗下展示真实指标名(自定义分组时维度/指标可能不是默认域名/计数)
    const base = hasAggregate.value && props.aggregate!.topn.length > 0
        ? `${metricMeta.value.label} Top`
        : (props.logType === 'waf' ? '规则 Top' : '域名 Top')
    return hasAggregate.value ? base : `${base}(采样)`
})

const thirdOption = computed<EChartsOption>(() => {
    if (hasAggregate.value && props.aggregate!.topn.length > 0) {
        return topBarOption(
            props.aggregate!.topn.map((t) => ({ name: t.name, value: t.value ?? t.count })),
            metricMeta.value.fmt,
        )
    }
    if (props.logType === 'waf') return topBarOption(buildTopRules(props.entries))
    return topBarOption(buildTopHosts(props.entries))
})

// WAF 严重度已并入 KPI"高危事件"与动作分布环图,不再单列图表
const trendChartTitle = computed(() => (hasAggregate.value && props.aggregate!.buckets.length > 0 ? '时间趋势(全窗)' : '时间趋势(采样)'))

const trendOption = computed(() => {
    if (hasAggregate.value && props.aggregate!.buckets.length > 0) {
        return trendChartOption(buildTrendFromBuckets(props.aggregate!.buckets))
    }
    return trendChartOption(buildTrend(props.entries))
})

// ---- TopN 条形图点击下钻(仅第三图;占比环图/趋势图不参与) ----
const topnChartRef = ref<InstanceType<typeof ChartCard> | null>(null)

interface BarClickParams {
    componentType?: string
    seriesType?: string
    name?: string
}

function onBarClick(params: BarClickParams): void {
    if (params.componentType !== 'series' || params.seriesType !== 'bar' || !params.name) return
    emit('bar-click', { name: params.name })
}

/** 给 TopN 图实例挂点击事件;off+on 幂等,重复绑定不会叠加监听 */
function bindTopnBarClick(): boolean {
    const chart = topnChartRef.value?.getInstance()
    if (!chart) return false
    chart.off('click', onBarClick)
    chart.on('click', onBarClick)
    return true
}

onMounted(async () => {
    // ChartCard 在动态 import('echarts') 完成后才创建实例,轮询等就绪(上限约 1s)
    for (let i = 0; i < 20; i++) {
        await nextTick()
        if (bindTopnBarClick()) return
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
})

onBeforeUnmount(() => {
    topnChartRef.value?.getInstance()?.off('click', onBarClick)
})

// 图 option 更新后补绑一次(off+on 幂等,防实例重建后监听丢失)
watch(thirdOption, () => {
    void nextTick(() => {
        bindTopnBarClick()
    })
})
</script>

<style scoped lang="scss">
.log-stats {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}
.kpi-tile {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 14px 16px;
}
.kpi-value {
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;

    &.tone-good {
        color: var(--el-color-success);
    }
    &.tone-warning {
        color: var(--el-color-warning);
    }
    &.tone-danger {
        color: var(--el-color-danger);
    }
}
.kpi-label {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
}
/* 自适应栅格:窄容器自动折行(每列最小 280px),长分组值/长标题不撑破轨道 */
.chart-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 12px;
}
.chart-cell {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 12px;
    /* 允许内容收缩:防止 grid 轨道被不可收缩内容(长文本)撑破 */
    min-width: 0;

    &.chart-cell-wide {
        /* 趋势图恒占整行(全宽),不随三小图折行挤压 */
        grid-column: 1 / -1;
    }
}
.chart-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
    min-width: 0;
    overflow-wrap: anywhere;
}
/* 窄屏断点:KPI 四列→两列;图表栅格由 auto-fit 按容器宽度自动折行,无需固定断点 */
@media (max-width: 1280px) {
    .kpi-row {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>
