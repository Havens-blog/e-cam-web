/**
 * 模型管理相关类型定义
 */

/**
 * 模型对象
 */
export interface Model {
    id: number
    uid: string
    name: string
    description: string
    provider: string
    category: string
    level: number
    parent_uid?: string
    icon?: string
    extensible: boolean
    model_group_id?: number
    create_time: string
    update_time: string
}

/**
 * 模型列表查询参数
 */
export interface ListModelsParams {
    provider?: string
    category?: string
    parent_uid?: string
    level?: number
    offset?: number
    limit?: number
}

/**
 * 模型列表响应
 */
export interface ListModelsResponse {
    models: Model[]
    total: number
}

/**
 * 创建模型请求
 */
export interface CreateModelRequest {
    uid: string
    name: string
    description?: string
    provider: string
    category: string
    level: number
    parent_uid?: string
    icon?: string
    extensible?: boolean
}

/**
 * 更新模型请求
 */
export interface UpdateModelRequest {
    name?: string
    description?: string
    icon?: string
    extensible?: boolean
}
