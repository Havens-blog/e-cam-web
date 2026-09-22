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
    // 资产扩展信息
    asset_id?: string        // 云资产ID
    asset_type?: string      // 资产类型 ecs/rds/oss 等
    provider?: string        // 云平台 aliyun/aws/tencent 等
    region?: string          // 地域
    private_ip?: string      // 内网IP
    public_ip?: string       // 公网IP
    // CMDB实例扩展信息
    model_uid?: string       // 模型UID
    model_name?: string      // 模型名称
    inst_id?: string         // 实例ID
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
    env_id: number
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
    env_name?: string
    env_color?: string
}

export interface BindingRuleCreateParams {
    node_id: number
    env_id: number
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

// ==================== 规则试运行（dry-run，只读预览不落库） ====================

export interface DryRunRuleParams {
    conditions: RuleCondition[]
    node_id?: number
    env_id?: number
}

export interface DryRunMatchItem {
    resource_id: number
    asset_id: string
    asset_name: string
    provider: string
    region: string
    bind_status: 'unbound' | 'manual' | 'rule'
    bound_node_id?: number
    bound_node_name?: string
    bound_env_id?: number
    bound_rule_id?: number
}

export interface DryRunResult {
    items: DryRunMatchItem[]
    total: number
    capped: boolean
}

// ==================== 规则改绑（预览+确认落库，manual 永锁） ====================

export interface RebindCandidate {
    resource_id: number
    asset_id: string
    asset_name: string
    provider: string
    region: string
    from_node_id: number
    from_node_name?: string
    from_env_id: number
    from_rule_id: number
    to_node_id: number
    to_node_name?: string
    to_env_id: number
    to_rule_id: number
}

export interface RebindPlan {
    items: RebindCandidate[]
    total: number
}

export interface RebindApplyParams {
    resource_ids: number[]
}

// ==================== 节点资产查询 ====================

export interface ListNodeAssetsParams {
    env_id?: number
    asset_type?: string
    include_children?: boolean
    offset?: number
    limit?: number
}

export interface NodeAssetStatsParams {
    include_children?: boolean
}

export interface NodeAssetVO {
    binding_id: number
    node_id: number
    env_id: number
    bind_type: 'manual' | 'rule'
    id: number
    asset_id: string
    asset_name: string
    asset_type: string
    provider: string
    region: string
    status: string
    account_id: number
    attributes: Record<string, any>
    create_time: number
    update_time: number
}

export interface NodeAssetListResponse {
    items: NodeAssetVO[]
    total: number
}

// ==================== 节点子树资产聚合（GET /nodes/:id/asset-summary） ====================

export interface AssetSuspicion {
    asset_id: string       // 云厂商资产ID
    asset_name: string     // 资产名称
    bound_env_id: number   // 绑定环境ID
    bound_env_code: string // 绑定环境代码
    reason: string         // 疑异原因（多信号以 ";" 连接）
}

export interface AssetSummary {
    total: number
    by_environment: Record<string, number> // key: 环境代码 (dev/test/staging/prod)
    by_provider: Record<string, number>    // key: 云平台
    by_type: Record<string, number>        // key: 资产类型
    by_bind_type: Record<string, number>   // key: 绑定来源 (manual/rule)
    suspicious: AssetSuspicion[]           // 环境疑异清单（只提示不改绑）
}

export interface AssetStatsVO {
    total: number
    by_asset_type: Record<string, number>
    by_provider: Record<string, number>
}

export interface AssetNodeVO {
    node_id: number
    uid: string
    name: string
    path: string
    level: number
}
