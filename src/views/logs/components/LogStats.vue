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
        <ChartCard :title="thirdChartTitle" :option="thirdOption" height="240px" />
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
import { computed } from 'vue'
import type { LogAggregateResponse, LogEntry, LogType } from '@/api/types/logs'
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
}>()

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

/** TopN 横向条形:单一蓝色,直接标数值(文本用文字色,不染色) */
function topBarOption(data: { name: string; value: number }[]): EChartsOption {
    const rows = [...data].reverse() // yAxis 自下而上,反转后第一名在顶部
    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const p = (ps as Array<{ name: string; value: number }>)[0]
                if (!p) return ''
                return `${p.name}: ${p.value.toLocaleString()} 条`
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
            axisLabel: { color: 'var(--text-secondary)', fontSize: 12 },
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
                    formatter: (p: unknown) => ((p as { value: number }).value || 0).toLocaleString(),
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
    const base = props.logType === 'waf' ? '规则 Top' : '域名 Top'
    return hasAggregate.value ? base : `${base}(采样)`
})

const thirdOption = computed<EChartsOption>(() => {
    if (hasAggregate.value && props.aggregate!.topn.length > 0) {
        return topBarOption(props.aggregate!.topn.map((t) => ({ name: t.name, value: t.count })))
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
.chart-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}
.chart-cell {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 12px;

    &.chart-cell-wide {
        grid-column: 1 / -1;
    }
}
.chart-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin-bottom: 8px;
}
</style>
