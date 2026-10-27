/**
 * 任务管理页的类型/状态选项与查询构造（纯函数，便于单测）
 *
 * 注意：后端真实任务类型带 `cam:` 前缀（executor 常量），历史前端用的是
 * `sync_assets`，导致类型筛选恒为 0 条。
 */
import type { ListTasksParams, TaskStatus, TaskType } from '@/api/types/task'

export interface TaskFilters {
    type?: TaskType
    status?: TaskStatus
}

export const TASK_TYPE_OPTIONS: Array<{ value: TaskType; label: string }> = [
    { value: 'cam:sync_assets', label: '同步资产' },
    { value: 'cam:discover_assets', label: '发现资产' },
    { value: 'cam:sync_billing', label: '同步账单' },
    { value: 'cam:create_ecs', label: '创建云主机' },
]

export const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
    { value: 'pending', label: '待执行' },
    { value: 'running', label: '执行中' },
    { value: 'completed', label: '已完成' },
    { value: 'failed', label: '失败' },
    { value: 'cancelled', label: '已取消' },
]

export type TaskSummaryKey = 'all' | 'pending' | 'running' | 'completed' | 'failed'

export interface TaskSummary {
    all: number
    pending: number
    running: number
    completed: number
    failed: number
}

/** 队列概览条：全部 + 四个关键状态（顺序即展示顺序） */
export const TASK_SUMMARY_STATUSES: Array<{
    key: TaskSummaryKey
    label: string
    status?: TaskStatus
}> = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待执行', status: 'pending' },
    { key: 'running', label: '执行中', status: 'running' },
    { key: 'completed', label: '已完成', status: 'completed' },
    { key: 'failed', label: '失败', status: 'failed' },
]

export const EMPTY_TASK_SUMMARY: TaskSummary = {
    all: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
}

/** 把页面筛选条件转成接口参数：空值不下发，分页从 1 开始 */
export function buildTaskQuery(
    filters: TaskFilters,
    page: number,
    size: number
): ListTasksParams {
    const query: ListTasksParams = {
        offset: Math.max(0, page - 1) * size,
        limit: size,
    }
    if (filters.type) query.type = filters.type
    if (filters.status) query.status = filters.status
    return query
}

export function taskTypeLabel(type: string): string {
    return TASK_TYPE_OPTIONS.find((o) => o.value === type)?.label || type
}

export function taskStatusLabel(status: string): string {
    return TASK_STATUS_OPTIONS.find((o) => o.value === status)?.label || status
}

/** 是否仍有积压（待执行或执行中） */
export function hasBacklog(summary: Pick<TaskSummary, 'pending' | 'running'>): boolean {
    return summary.pending + summary.running > 0
}
