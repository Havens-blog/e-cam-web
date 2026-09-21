/**
 * CDN 缓存分析卡展示辅助(纯函数,单测覆盖)。
 * 标签/枚举与后端 e-cam-service internal/logquery/cdncache 引擎约定对齐
 * (grade / direction / action / confidence)。
 */
import type { AggregateSourceOutcome, CacheOptimizationItem } from '@/api/types/logs'
import { formatCount } from './diagnose'
import { cloudLabel } from './format'

/** 健康档位中文标签(与引擎 grade 对齐:good/fair/poor/unknown) */
export function cacheGradeLabel(grade: string): string {
    switch (grade) {
        case 'good':
            return '优'
        case 'fair':
            return '中'
        case 'poor':
            return '差'
        case 'unknown':
            return '未知'
        default:
            return grade
    }
}

/** 健康档位徽标色(el-tag type):优=success / 中=warning / 差=danger / 未知=info */
export function cacheGradeTagType(grade: string): 'success' | 'warning' | 'danger' | 'info' {
    switch (grade) {
        case 'good':
            return 'success'
        case 'fair':
            return 'warning'
        case 'poor':
            return 'danger'
        default:
            return 'info'
    }
}

/** 占比格式化(0-1 → "12.3%";非法值占位 —) */
export function formatRate(rate: number | undefined | null): string {
    if (rate === undefined || rate === null || Number.isNaN(rate)) return '—'
    return `${(rate * 100).toFixed(1)}%`
}

/** 前窗趋势方向(与引擎 direction 对齐:up/flat/down) */
export function cacheDirectionLabel(direction: string): string {
    switch (direction) {
        case 'up':
            return '↑ 上升'
        case 'down':
            return '↓ 下降'
        case 'flat':
            return '→ 持平'
        default:
            return '—'
    }
}

/** 趋势徽标色:上升=success / 下降=warning(达告警阈值 danger)/ 持平=info */
export function cacheDirectionTagType(direction: string, alert = false): 'success' | 'warning' | 'danger' | 'info' {
    if (direction === 'up') return 'success'
    if (direction === 'down') return alert ? 'danger' : 'warning'
    return 'info'
}

/** 优化建议动作中文标签(与引擎 action 枚举对齐,未知透传) */
export function optimizationActionLabel(action: string): string {
    switch (action) {
        case 'add_cache_rule':
            return '加缓存规则'
        case 'tune_ttl':
            return '调整 TTL'
        case 'ignore_query_string':
            return '忽略查询串'
        case 'origin_verify':
            return '回源校验'
        default:
            return action
    }
}

/** 可信度分级中文标签(high/medium/low) */
export function confidenceLabel(confidence: string): string {
    switch (confidence) {
        case 'high':
            return '高可信'
        case 'medium':
            return '中可信'
        case 'low':
            return '低可信'
        default:
            return confidence
    }
}

/** 低可信判定:low_confidence 标记优先,confidence=low 兜底 */
function isLowConfidence(o: CacheOptimizationItem): boolean {
    return o.low_confidence || o.confidence === 'low'
}

/**
 * 优化项分组:低可信度(启发式判定)归入折叠组("更多建议"默认收起),
 * 其余保持原序直接展示。不可变:不修改入参。
 */
export function splitOptimizations(items: CacheOptimizationItem[]): { visible: CacheOptimizationItem[]; more: CacheOptimizationItem[] } {
    const visible: CacheOptimizationItem[] = []
    const more: CacheOptimizationItem[] = []
    for (const o of items) (isLowConfidence(o) ? more : visible).push(o)
    return { visible, more }
}

/** 优化项 → 纯文本清单(复制用;统一标注"建议,执行前请验证") */
export function optimizationCopyText(items: CacheOptimizationItem[]): string {
    const lines = items.map((o, i) => {
        const target = o.uri_prefix ? `${o.domain || '全局'} · ${o.uri_prefix}` : o.domain || '全局'
        const base = `${i + 1}. ${target} → ${optimizationActionLabel(o.action)}(未命中流量占比 ${formatRate(o.miss_traffic_ratio)},可信度:${confidenceLabel(o.confidence)})`
        return o.evidence ? `${base} 证据:${o.evidence}` : base
    })
    return ['缓存优化建议(建议,执行前请验证):', ...lines].join('\n')
}

/** 字节量人类可读(B/KB/MB/GB/TB;整数段千分位) */
export function formatCacheBytes(n: number | undefined | null): string {
    if (n === undefined || n === null || Number.isNaN(n)) return '—'
    if (n < 1024) return `${formatCount(n)} B`
    const units = ['KB', 'MB', 'GB', 'TB'] as const
    let v = n / 1024
    let i = 0
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024
        i++
    }
    return `${v.toFixed(1)} ${units[i]}`
}

/** 趋势覆盖范围"基于 X/Y 源"(前窗 per-source;空 = 无源状态,调用方不渲染) */
export function coveredSourceText(sources: AggregateSourceOutcome[]): string {
    if (!sources.length) return ''
    const ok = sources.filter((s) => !s.error).length
    return `基于 ${ok}/${sources.length} 源`
}

/** 缺失源展示名(云·账号;趋势部分覆盖时列出,避免误读为全量) */
export function missingSourceNames(sources: AggregateSourceOutcome[]): string[] {
    return sources.filter((s) => s.error).map((s) => `${cloudLabel(s.cloud)}·${s.account_name}`)
}

/** 对比基期时长("前一 N 秒/分钟/小时";非法/非正返回空串,调用方不渲染) */
export function formatPrevBase(windowSec: number): string {
    if (!Number.isFinite(windowSec) || windowSec <= 0) return ''
    if (windowSec < 60) return `前一 ${windowSec} 秒`
    if (windowSec >= 7200 && windowSec % 3600 === 0) return `前一 ${windowSec / 3600} 小时`
    return `前一 ${Math.round(windowSec / 60)} 分钟`
}

/** 预估扫描量拦截错误识别(窗口 >6h 默认拦截,后端提示 confirm=true 放行) */
export function isScanConfirmError(msg: string): boolean {
    return /confirm=true|estimated scan volume|预估扫描量/i.test(msg)
}
