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

export function formatCost(cost: number, currency = '¥'): string {
    return `${currency}${cost.toFixed(2)}`
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
