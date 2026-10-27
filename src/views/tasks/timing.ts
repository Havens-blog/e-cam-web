/**
 * 任务时间展示规则（纯函数）
 *
 * 背景：任务被重排/重试后可能保持 status=pending 但残留 started_at 与 progress。
 * 若按 started_at 计算「耗时」，等待中的任务会显示一个持续增长的耗时，语义上像正在执行。
 * 规则：pending 一律不使用执行耗时口径，改为展示自 created_at 起的「已等待」。
 */
import type { TaskStatus } from '@/api/types/task'

/** 是否需要展示「开始时间/耗时」这类执行口径（等待中不展示） */
export function shouldUseExecutionTiming(status?: TaskStatus | string): boolean {
    return status !== 'pending'
}

/** 毫秒转人类可读时长：>=1 天用天/小时，>=1 小时用小时/分，否则分/秒 */
export function formatDurationMs(ms: number): string {
    const safe = typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, ms) : 0
    const total = Math.floor(safe / 1000)
    const days = Math.floor(total / 86400)
    const hours = Math.floor((total % 86400) / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    if (days > 0) return `${days}天${hours}小时`
    if (hours > 0) return `${hours}小时${minutes}分`
    if (minutes > 0) return `${minutes}分${seconds}秒`
    return `${seconds}秒`
}

/** 等待中任务的等待时长文案（不含前缀，标签由 UI 提供）；created_at 无效时返回 null */
export function pendingWaitDurationText(createdAt?: string | null, now: number = Date.now()): string | null {
    if (!createdAt) return null
    const created = Date.parse(createdAt)
    if (!Number.isFinite(created)) return null
    return formatDurationMs(Math.max(0, now - created))
}
