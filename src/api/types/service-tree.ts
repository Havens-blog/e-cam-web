/**
 * 服务树相关类型定义
 */

// 环境
export interface Environment {
    id: number
    code: string
    name: string
    description?: string
    color: string
    order: number
    status: number // 1=启用, 0=禁用
    create_time?: number
    update_time?: number
}

export interface EnvironmentCreateParams {
    code: string
    name: string
    description?: string
    color: string
    order?: number
}

export interface EnvironmentUpdateParams extends Partial<EnvironmentCreateParams> {
    status?: number
}

export interface EnvironmentListParams {
    code?: string
    status?: number
    page?: number
    page_size?: number
}

// 服务树节点
export interface ServiceTreeNode {
    id: number
    uid?: string
    name: string
    parent_id: number
    level: number
    path?: string
    owner?: string
    team?: string
    description?: string
    tags?: string[]
    order?: number
    status: number
    resource_count?: number
    create_time?: number
    update_time?: number
    children?: ServiceTreeNode[]
}

export interface ServiceTreeNodeCreateParams {
    uid?: string
    name: string
    parent_id?: number
    level?: number
    owner?: string
    team?: string
    description?: string
    tags?: string[]
    order?: number
}

export interface ServiceTreeNodeUpdateParams extends Partial<ServiceTreeNodeCreateParams> {
    status?: number
}

export interface ServiceTreeNodeListParams {
    parent_id?: number
    level?: number
    name?: string
    owner?: string
    team?: string
    status?: number
    page?: number
    page_size?: number
}

// 资源绑定
export interface ResourceBinding {
    id: number
    node_id: number
    env_id: number
    resource_type: 'instance' | 'asset'
    resource_id: number
    bind_type: 'manual' | 'rule'
    create_time?: number
    // 关联信息（前端展示用）
    resource_name?: string
    resource_status?: string
    env_name?: string
    env_color?: string
}

export interface ResourceBindingCreateParams {
    env_id: number
    resource_type: 'instance' | 'asset'
    resource_id: number
}

export interface ResourceBindingBatchParams {
    env_id: number
    resource_type: 'instance' | 'asset'
    resource_ids: number[]
}

export interface ResourceBindingListParams {
    env_id?: number
    resource_type?: string
    bind_type?: string
    page?: number
    page_size?: number
}

// 绑定规则
export interface RuleCondition {
    field: string
    operator: 'eq' | 'ne' | 'contains' | 'regex' | 'in' | 'exists'
    value: string
}

export interface BindingRule {
    id: number
    node_id: number
    name: string
    priority: number
    conditions: RuleCondition[]
    enabled: boolean
    description?: string
    match_count?: number
    create_time?: number
    update_time?: number
    // 关联信息
    node_name?: string
}

export interface BindingRuleCreateParams {
    node_id: number
    name: string
    priority?: number
    conditions: RuleCondition[]
    enabled?: boolean
    description?: string
}

export type BindingRuleUpdateParams = Partial<BindingRuleCreateParams>

export interface BindingRuleListParams {
    node_id?: number
    enabled?: boolean
    keyword?: string
    page?: number
    page_size?: number
}

// 通用响应
export interface ListResponse<T> {
    list: T[]
    total: number
}
