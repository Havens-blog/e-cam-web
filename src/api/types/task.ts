/**
 * 异步任务管理相关类型定义
 */

/**
 * 任务类型
 * 后端 executor 常量：cam:sync_assets / cam:discover_assets / cam:sync_billing / cam:create_ecs
 * 历史前端误用无前缀的 sync_assets，导致类型筛选恒为 0 条。
 */
export type TaskType =
    | "cam:sync_assets"
    | "cam:discover_assets"
    | "cam:sync_billing"
    | "cam:create_ecs"

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
    /** 后端 TaskResp 实际字段名（error），error_message 为历史兼容 */
    error?: string
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
export type TaskDetailResponse = Task
