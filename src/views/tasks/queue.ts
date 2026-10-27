/**
 * 任务队列积压辅助（纯函数）
 *
 * 背景：任务页概览只显示「待执行/执行中」数量，待执行默认按创建时间倒序，
 * 最早的积压任务不在首屏，运维无法判断队列饿死程度。这里计算最老待执行的等待时长。
 */
import type { Task } from '@/api/types/task'
import { formatDurationMs } from './timing'

type PendingLike = Pick<Task, 'status' | 'created_at'> | { status?: string; created_at?: string }

/** 最老待执行任务的等待时长文案；无有效 pending 时返回 null */
export function oldestPendingWaitText(
    tasks: Array<PendingLike> | null | undefined,
    now: number = Date.now()
): string | null {
    let oldest = 0
    for (const task of tasks ?? []) {
        if (!task || task.status !== 'pending') continue
        const created = task.created_at ? Date.parse(task.created_at) : Number.NaN
        if (!Number.isFinite(created)) continue
        if (!oldest || created < oldest) oldest = created
    }
    if (!oldest) return null
    return formatDurationMs(Math.max(0, now - oldest))
}
