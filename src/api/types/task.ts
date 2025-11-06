/**
 * 异步任务管理相关类型定义
 */

/**
 * 任务类型
 */
export type TaskType = "sync_assets" | "discover_assets"

/**
 * 任务状态
 */
export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

/**
 * 任务对象
 */
export interface Task {
    id: string
    type: TaskType
    status: TaskStatus
    progress?: number
    created_by: string
    created_at: string
    started_at?: string
    completed_at?: string
    error_message?: string
    result?: any
}

/**
 * 任务列表查询参数
 */
export interface ListTasksParams {
    type?: TaskType
    status?: TaskStatus
    created_by?: string
    offset?: number
    limit?: number
}

/**
 * 任务列表响应
 */
export interface TaskListResponse {
    tasks: Task[]
    total: number
}

/**
 * 提交同步资产任务请求
 */
export interface SubmitSyncAssetsTaskRequest {
    provider: string
    asset_types?: string[]
    regions?: string[]
}

/**
 * 提交发现资产任务请求
 */
export interface SubmitDiscoverAssetsTaskRequest {
    provider: string
    region: string
}

/**
 * 提交任务响应
 */
export interface SubmitTaskResponse {
    task_id: string
    status: TaskStatus
}

/**
 * 任务详情响应
 */
export interface TaskDetailResponse extends Task { }
