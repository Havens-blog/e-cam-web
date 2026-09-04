/**
 * 日志统计聚合(纯函数,组件无关):
 * - KPI 与图表数据全部由已返回条目前端聚合,零后端改动;
 * - 颜色 = 语义固定:状态/命中/动作用状态色板(good/warning/critical),
 *   排名类(TopN/趋势)单一蓝色系,不用彩虹;
 * - 缺失容忍:字段为空/`-` 不计入比率分子。
 */
import type { CDNLogEntry, LogEntry, LogType } from '@/api/types/logs'
import { formatBytes } from './format'

// ---- 语义色板(状态类,与 element 语义一致;排名类单一蓝) ----
export const STATUS_COLORS: Record<string, string> = {
    '2xx': '#0ca30c',
    '3xx': '#2a78d6',
    '4xx': '#fab219',
    '5xx': '#d03b3b',
    其他: '#c0c4cc',
}
export const CACHE_COLORS: Record<string, string> = {
    hit: '#0ca30c',
    miss: '#909399',
    partial: '#fab219',
    error: '#d03b3b',
    '-': '#c0c4cc',
}
export const ACTION_COLORS: Record<string, string> = {
    block: '#d03b3b',
    alert: '#fab219',
    allow: '#0ca30c',
    pass: '#909399',
}
export const SEVERITY_COLORS: Record<string, string> = {
    high: '#d03b3b',
    medium: '#fab219',
    low: '#0ca30c',
    '-': '#c0c4cc',
}
/** 排名/趋势单一色(dataviz:同一量纲不用多色) */
export const SERIES_COLOR = '#2a78d6'

export interface StatKpi {
    label: string
    value: string
    /** 语义色调(错误率等;默认主文字色) */
    tone?: 'good' | 'warning' | 'danger'
    hint?: string
}

export interface Slice {
    name: string
    value: number
    color: string
}

export interface NamedCount {
    name: string
    value: number
}

// ---------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------

/** 状态码分桶(2xx/3xx/4xx/5xx/其他) */
export function statusClass(status: number): string {
    if (!status) return '其他'
    if (status >= 500) return '5xx'
    if (status >= 400) return '4xx'
    if (status >= 300) return '3xx'
    if (status >= 200) return '2xx'
    return '其他'
}

/** TopN(降序,超出部分折叠为"其他"——不循环生成色相,量纲图单一色) */
export function topN(counts: Record<string, number>, n: number): NamedCount[] {
    const sorted = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    if (sorted.length <= n) return sorted
    const rest = sorted.slice(n).reduce((s, x) => s + x.value, 0)
    return [...sorted.slice(0, n), { name: `其他(${sorted.length - n})`, value: rest }]
}

/** 计数 + TopN 快捷 */
function countBy(entries: LogEntry[], key: (e: LogEntry) => string): Record<string, number> {
    const out: Record<string, number> = {}
    for (const e of entries) {
        const k = key(e)
        if (!k) continue
        out[k] = (out[k] || 0) + 1
    }
    return out
}

/** host 优先,退回资源标识(SLB 聚合流可能无 host) */
export function entryHost(e: LogEntry): string {
    return e.host || e.meta.resource_id || ''
}

/** 最近邻百分位(升序样本,p∈[0,100];空数组返回 0) */
export function percentile(values: number[], p: number): number {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
    return sorted[Math.max(0, idx)] ?? 0
}

/** 比率(分子忽略空值/`-`;分母为 0 返回 null——不显示假 0%) */
function ratio(part: number, total: number): number | null {
    if (total <= 0) return null
    return Math.round((part / total) * 1000) / 10
}

function pctText(v: number | null): string {
    return v === null ? '-' : `${v}%`
}

// ---- KPI(按类型定制) ----

export function buildKpis(logType: LogType, entries: LogEntry[]): StatKpi[] {
    const total = entries.length
    if (logType === 'waf') return wafKpis(entries, total)
    if (logType === 'slb') return slbKpis(entries, total)
    return cdnKpis(entries, total)
}

function cdnKpis(entries: LogEntry[], total: number): StatKpi[] {
    const statusBuckets: Record<string, number> = {}
    const cacheBuckets: Record<string, number> = {}
    let bytes = 0
    for (const e of entries) {
        statusBuckets[statusClass(e.status)] = (statusBuckets[statusClass(e.status)] || 0) + 1
        const hit = (e as CDNLogEntry).cache_hit
        if (hit) cacheBuckets[hit] = (cacheBuckets[hit] || 0) + 1
        bytes += Number((e as CDNLogEntry).bytes_sent) || 0
    }
    const errRate = ratio(statusBuckets['5xx'] || 0, total)
    const hitCount = cacheBuckets['hit'] || 0
    const hitTotal = total - (cacheBuckets['-'] || 0)
    return [
        { label: '日志条数', value: total.toLocaleString() },
        { label: '缓存命中率', value: pctText(ratio(hitCount, hitTotal)), tone: 'good', hint: 'hit / 有效判定条数' },
        {
            label: '5xx 错误率',
            value: pctText(errRate),
            tone: errRate !== null && errRate >= 5 ? 'danger' : undefined,
            hint: '状态码 ≥500 占比',
        },
        { label: '总流量', value: formatBytes(bytes) },
    ]
}

function wafKpis(entries: LogEntry[], total: number): StatKpi[] {
    const actionBuckets: Record<string, number> = {}
    let high = 0
    for (const e of entries) {
        const a = (e as { action?: string }).action
        if (a) actionBuckets[a] = (actionBuckets[a] || 0) + 1
        if ((e as { severity?: string }).severity === 'high') high++
    }
    const blockRate = ratio(actionBuckets['block'] || 0, total)
    const alertRate = ratio(actionBuckets['alert'] || 0, total)
    return [
        { label: '日志条数', value: total.toLocaleString() },
        {
            label: '拦截率',
            value: pctText(blockRate),
            tone: blockRate !== null && blockRate > 0 ? 'danger' : undefined,
            hint: 'action=block 占比',
        },
        { label: '告警占比', value: pctText(alertRate), tone: alertRate !== null && alertRate > 0 ? 'warning' : undefined, hint: 'action=alert 占比' },
        { label: '高危事件', value: high.toLocaleString(), tone: high > 0 ? 'danger' : undefined, hint: 'severity=high' },
    ]
}

function slbKpis(entries: LogEntry[], total: number): StatKpi[] {
    const statusBuckets: Record<string, number> = {}
    const latencies: number[] = []
    for (const e of entries) {
        statusBuckets[statusClass(e.status)] = (statusBuckets[statusClass(e.status)] || 0) + 1
        const lat = (e as { latency_ms?: number }).latency_ms
        if (lat && lat > 0) latencies.push(lat)
    }
    const errRate = ratio(statusBuckets['5xx'] || 0, total)
    const p95 = percentile(latencies, 95)
    const avg = latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0
    return [
        { label: '日志条数', value: total.toLocaleString() },
        {
            label: '5xx 错误率',
            value: pctText(errRate),
            tone: errRate !== null && errRate >= 5 ? 'danger' : undefined,
            hint: '状态码 ≥500 占比',
        },
        { label: 'P95 延迟', value: p95 > 0 ? `${p95.toLocaleString()} ms` : '-' },
        { label: '平均延迟', value: avg > 0 ? `${avg.toLocaleString()} ms` : '-' },
    ]
}

// ---- 切片(donut) ----

export function buildStatusSlices(entries: LogEntry[]): Slice[] {
    const buckets = countBy(entries, (e) => statusClass(e.status))
    return orderSlices(buckets, ['2xx', '3xx', '4xx', '5xx', '其他'], STATUS_COLORS)
}

export function buildCacheSlices(entries: LogEntry[]): Slice[] {
    const buckets = countBy(entries, (e) => (e as CDNLogEntry).cache_hit || '-')
    return orderSlices(buckets, ['hit', 'miss', 'partial', 'error', '-'], CACHE_COLORS)
}

export function buildActionSlices(entries: LogEntry[]): Slice[] {
    const buckets = countBy(entries, (e) => (e as { action?: string }).action || '')
    return orderSlices(buckets, ['block', 'alert', 'allow', 'pass'], ACTION_COLORS)
}

export function buildSeveritySlices(entries: LogEntry[]): Slice[] {
    const buckets = countBy(entries, (e) => (e as { severity?: string }).severity || '-')
    return orderSlices(buckets, ['high', 'medium', 'low', '-'], SEVERITY_COLORS)
}

/** 固定语义顺序输出(0 值不显示;计数里出现顺序外键归入"其他"色) */
function orderSlices(
    buckets: Record<string, number>,
    order: string[],
    colors: Record<string, string>
): Slice[] {
    const out: Slice[] = []
    for (const k of order) {
        const v = buckets[k]
        if (v) out.push({ name: k, value: v, color: colors[k] ?? '#c0c4cc' })
    }
    for (const [k, v] of Object.entries(buckets)) {
        if (!order.includes(k) && v) out.push({ name: k, value: v, color: '#c0c4cc' })
    }
    return out
}

// ---- TopN(条形) ----

export function buildTopHosts(entries: LogEntry[], n = 8): NamedCount[] {
    return topN(countBy(entries, entryHost), n)
}

export function buildTopRules(entries: LogEntry[], n = 8): NamedCount[] {
    const buckets = countBy(entries, (e) => (e as { rule_name?: string }).rule_name || '')
    delete buckets['-']
    return topN(buckets, n)
}

/** SLB 延迟直方(语义分桶,优于等宽直方) */
export function buildLatencyBuckets(entries: LogEntry[]): NamedCount[] {
    const defs: Array<{ label: string; max: number }> = [
        { label: '<10ms', max: 10 },
        { label: '10~50ms', max: 50 },
        { label: '50~100ms', max: 100 },
        { label: '100~500ms', max: 500 },
        { label: '0.5~1s', max: 1000 },
        { label: '≥1s', max: Infinity },
    ]
    const counts = defs.map(() => 0)
    for (const e of entries) {
        const lat = (e as { latency_ms?: number }).latency_ms
        if (!lat || lat <= 0) continue
        const i = defs.findIndex((d) => lat < d.max)
        const idx = i < 0 ? defs.length - 1 : i
        counts[idx] = (counts[idx] ?? 0) + 1
    }
    return defs
        .map((d, i) => ({ name: d.label, value: counts[i] ?? 0 }))
        .filter((x) => x.value > 0)
}

// ---- 时间趋势(自适应分桶) ----

export interface TrendPoint {
    name: string
    value: number
}

/** 分桶步长:span 内目标 ≤60 桶,取常见步长 */
function pickBucketMs(spanMs: number): number {
    const steps = [60_000, 5 * 60_000, 15 * 60_000, 3_600_000, 6 * 3_600_000, 86_400_000]
    for (const s of steps) {
        if (spanMs / s <= 60) return s
    }
    return steps[steps.length - 1] ?? 86_400_000
}

function formatBucket(ts: number, bucketMs: number): string {
    const d = new Date(ts)
    const pad = (v: number) => `${v}`.padStart(2, '0')
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    if (bucketMs >= 86_400_000) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (bucketMs >= 3_600_000) return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}时`
    return hm
}

export function buildTrend(entries: LogEntry[], fallbackWindowMs = 0): TrendPoint[] {
    if (!entries.length) return []
    let min = Infinity
    let max = -Infinity
    for (const e of entries) {
        if (e.timestamp < min) min = e.timestamp
        if (e.timestamp > max) max = e.timestamp
    }
    const span = Math.max(max - min, fallbackWindowMs)
    const bucketMs = pickBucketMs(span || 60_000)
    const start = Math.floor(min / bucketMs) * bucketMs
    const end = Math.floor(max / bucketMs) * bucketMs
    const buckets = new Map<number, number>()
    for (let t = start; t <= end; t += bucketMs) buckets.set(t, 0)
    for (const e of entries) {
        const t = Math.floor(e.timestamp / bucketMs) * bucketMs
        buckets.set(t, (buckets.get(t) || 0) + 1)
    }
    return Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([t, v]) => ({ name: formatBucket(t, bucketMs), value: v }))
}
