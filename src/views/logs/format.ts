/**
 * 日志查询页格式化辅助(纯函数,单测覆盖)
 */

import type { LogEntry, LogSourceOutcome } from '@/api/types/logs'

/** 字典序固定的云展示名 */
export const CLOUD_LABELS: Record<string, string> = {
    aliyun: '阿里云',
    huawei: '华为云',
    aws: 'AWS',
    tencent: '腾讯云',
    volcano: '火山云',
}

export function cloudLabel(cloud: string): string {
    return CLOUD_LABELS[cloud] ?? cloud
}

/** Unix ms -> "MM-dd HH:mm:ss"(日志列表密度优先,年份罕见变化) */
export function formatLogTime(ts: number): string {
    if (!ts) return '—'
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return '—'
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 空值统一占位(与后端缺失容忍约定一致) */
export function dashIfEmpty(v: string | number | undefined | null): string {
    if (v === undefined || v === null || v === '') return '—'
    return String(v)
}

/** WAF 动作徽章语义(el-tag type) */
export function actionTagType(action: string): 'danger' | 'warning' | 'success' | 'info' {
    switch (action) {
        case 'block':
            return 'danger'
        case 'alert':
            return 'warning'
        case 'allow':
        case 'pass':
            return 'success'
        default:
            return 'info'
    }
}

/** WAF 严重度徽章语义 */
export function severityTagType(severity: string): 'danger' | 'warning' | 'info' {
    switch (severity) {
        case 'high':
            return 'danger'
        case 'medium':
            return 'warning'
        default:
            return 'info'
    }
}

/** 缓存命中徽章语义 */
export function cacheHitTagType(cacheHit: string): 'success' | 'warning' | 'danger' | 'info' {
    switch (cacheHit) {
        case 'hit':
            return 'success'
        case 'partial':
            return 'warning'
        case 'error':
            return 'danger'
        default:
            return 'info'
    }
}

/** HTTP 状态码着色(2xx 成功 / 3xx 跳转 / 4xx 客户端错 / 5xx 服务端错) */
export function statusTagType(status: number): 'success' | 'warning' | 'danger' | 'info' {
    if (status >= 200 && status < 300) return 'success'
    if (status >= 300 && status < 400) return 'info'
    if (status >= 400 && status < 500) return 'warning'
    if (status >= 500) return 'danger'
    return 'info'
}

/** 字节量人类可读(KB/MB) */
export function formatBytes(n: number | undefined): string {
    if (n === undefined || n === null) return '—'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/** per-source 状态摘要(结果条上方逐源展示) */
export function sourceSummary(s: LogSourceOutcome): string {
    const name = `${cloudLabel(s.cloud)}·${s.account_name}`
    if (s.error) return `${name}:失败(${s.error})`
    return `${name}:${s.count} 条`
}

/** per-source 状态聚合徽标(全成功/部分失败/全部失败) */
export function sourcesHealth(sources: LogSourceOutcome[]): 'ok' | 'partial' | 'all-failed' | 'empty' {
    if (!sources.length) return 'empty'
    const failed = sources.filter((s) => s.error).length
    if (failed === 0) return 'ok'
    if (failed === sources.length) return 'all-failed'
    return 'partial'
}

/** 按动态列 key 取单元格值("meta.cloud" 取嵌套;其余取顶层) */
export function cellValue(row: LogEntry, key: string): string | number {
    if (key.startsWith('meta.')) {
        const k = key.slice(5) as keyof LogEntry['meta']
        return row.meta[k] as string
    }
    return (row as unknown as Record<string, unknown>)[key] as string | number
}

/** 默认时间窗口(毫秒):按类型上限取整 7d/3d */
export function defaultWindowMs(maxWindowDays: number): number {
    const days = Math.min(maxWindowDays || 7, 7)
    return days * 24 * 3600_000
}
