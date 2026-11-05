import type { AssetTag } from '@/api/types/asset'
import dayjs from 'dayjs'

export function formatTime(time?: string | number, format = 'YYYY-MM-DD HH:mm:ss'): string {
    if (!time) return '-'
    return dayjs(time).format(format)
}

export function formatRelativeTime(time?: string | number): string {
    if (!time) return '-'
    const now = dayjs()
    const target = dayjs(time)
    const diffMinutes = now.diff(target, 'minute')
    const diffHours = now.diff(target, 'hour')
    const diffDays = now.diff(target, 'day')

    if (diffMinutes < 1) return '刚刚'
    if (diffMinutes < 60) return `${diffMinutes}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return formatTime(time, 'YYYY-MM-DD')
}

export function maskAccessKey(accessKey: string): string {
    if (!accessKey || accessKey.length < 8) return '****'
    const start = accessKey.slice(0, 4)
    const end = accessKey.slice(-4)
    return `${start}****${end}`
}

/**
 * 成本金额格式化（iter200 统一）。
 *
 * 原来只 `cost.toFixed(2)` → `¥3703710.19`：**7 位数没有千分位**，用户很难一眼读出量级。
 * 而图表 tooltip 用的是 `toLocaleString('zh-CN')`（`¥3,703,710.19`）、
 * `CdnCostPanel` 用的是 `formatNumber`（`¥3,703,710` —— **还丢了小数**）。
 * 同一个金额在同一个产品里有 3 种写法。现统一到本函数：**千分位 + 固定 2 位小数**。
 *
 * 注意：本文件不在 `shared-hashes.json` 的 drift 锁内（锁的是 constants/error-handler/exportAll 等），
 * 可安全修改。
 */
export function formatCost(cost: number, currency = '¥'): string {
    if (!Number.isFinite(cost)) return `${currency}0.00`
    return `${currency}${cost.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`
}

export function formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatTags(tags?: AssetTag[]): string {
    if (!tags || tags.length === 0) return '-'
    return tags.map((tag) => `${tag.key}:${tag.value}`).join(', ')
}

export function formatJSON(input?: string | Record<string, unknown>): string {
    if (!input) return '{}'
    if (typeof input === 'object') {
        return JSON.stringify(input, null, 2)
    }
    try {
        const obj = JSON.parse(input)
        return JSON.stringify(obj, null, 2)
    } catch {
        return input
    }
}

export function formatPercentage(value: number, total: number): string {
    if (total === 0) return '0%'
    return `${((value / total) * 100).toFixed(1)}%`
}

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function truncateString(str: string, maxLength: number): string {
    if (!str || str.length <= maxLength) return str
    return `${str.slice(0, maxLength)}...`
}
