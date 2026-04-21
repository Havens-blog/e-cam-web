/**
 * 多云标签管理 API 类型定义
 */

// ==================== 标签聚合查询 ====================

/** 标签摘要（聚合结果） */
export interface TagSummary {
    key: string
    value: string
    resource_count: number
    providers: string[]
}

/** 标签统计 */
export interface TagStats {
    total_keys: number
    total_values: number
    tagged_resources: number
    total_resources: number
    coverage_percent: number
}

/** 标签列表查询参数 */
export interface TagFilter {
    key?: string
    value?: string
    provider?: string
    account_id?: number
    resource_type?: string
    offset?: number
    limit?: number
}

// ==================== 标签关联资源 ====================

/** 标签关联资源 */
export interface TagResource {
    asset_id: string
    asset_name: string
    resource_type: string
    provider: string
    region: string
    account_id: number
    account_name: string
}

/** 标签关联资源查询参数 */
export interface TagResourceFilter {
    key: string
    value?: string
    provider?: string
    resource_type?: string
    offset?: number
    limit?: number
}

// ==================== 标签操作 ====================

/** 资源引用 */
export interface ResourceRef {
    account_id: number
    region: string
    resource_type: string
    resource_id: string
}

/** 绑定标签请求 */
export interface BindTagsReq {
    resources: ResourceRef[]
    tags: Record<string, string>
}

/** 解绑标签请求 */
export interface UnbindTagsReq {
    resources: ResourceRef[]
    tag_keys: string[]
}

/** 批量操作结果 */
export interface BatchResult {
    total: number
    success_count: number
    failed_count: number
    failures: FailureDetail[]
}

/** 失败明细 */
export interface FailureDetail {
    resource_id: string
    error: string
}

// ==================== 标签策略 ====================

/** 标签策略 */
export interface TagPolicy {
    id: number
    name: string
    description: string
    required_keys: string[]
    key_value_constraints: Record<string, string[]>
    resource_types: string[]
    status: string
    tenant_id: string
    created_at: number
    updated_at: number
}

/** 创建策略请求 */
export interface CreatePolicyReq {
    name: string
    description?: string
    required_keys: string[]
    key_value_constraints?: Record<string, string[]>
    resource_types?: string[]
}

/** 更新策略请求 */
export interface UpdatePolicyReq {
    name?: string
    description?: string
    required_keys?: string[]
    key_value_constraints?: Record<string, string[]>
    resource_types?: string[]
    status?: string
}

/** 策略查询参数 */
export interface PolicyFilter {
    offset?: number
    limit?: number
}

// ==================== 合规检查 ====================

/** 合规检查结果 */
export interface ComplianceResult {
    asset_id: string
    asset_name: string
    resource_type: string
    provider: string
    region: string
    account_id: number
    violations: Violation[]
}

/** 违规项 */
export interface Violation {
    type: 'missing_key' | 'invalid_value'
    key: string
    value?: string
    allowed?: string[]
}

/** 合规检查查询参数 */
export interface ComplianceFilter {
    policy_id?: number
    resource_type?: string
    provider?: string
    offset?: number
    limit?: number
}

/** 合规检查响应 */
export interface ComplianceResponse {
    items: ComplianceResult[]
    total: number
    compliant_count: number
    non_compliant_count: number
}

// ==================== 自动打标规则 ====================

/** 规则匹配条件 */
export interface RuleCondition {
    field: 'asset_name' | 'asset_id' | 'model_uid' | 'provider' | 'region' | 'account_name'
    operator: 'contains' | 'equals' | 'prefix' | 'suffix' | 'regex'
    value: string
}

/** 自动打标规则 */
export interface TagRule {
    id: number
    name: string
    description: string
    logic: 'and' | 'or'
    conditions: RuleCondition[]
    tags: Record<string, string>
    priority: number
    status: string
    tenant_id: string
    created_at: number
    updated_at: number
}

/** 创建规则请求 */
export interface CreateRuleReq {
    name: string
    description?: string
    logic: 'and' | 'or'
    conditions: RuleCondition[]
    tags: Record<string, string>
    priority?: number
}

/** 更新规则请求 */
export interface UpdateRuleReq {
    name?: string
    description?: string
    logic?: 'and' | 'or'
    conditions?: RuleCondition[]
    tags?: Record<string, string>
    priority?: number
    status?: string
}

/** 规则查询参数 */
export interface RuleFilter {
    offset?: number
    limit?: number
}

/** 规则预览结果 */
export interface RulePreviewResult {
    rule_id: number
    rule_name: string
    match_count: number
    resources: PreviewResource[]
}

/** 预览匹配资源摘要 */
export interface PreviewResource {
    asset_id: string
    asset_name: string
    resource_type: string
    provider: string
    region: string
}

/** 规则执行结果 */
export interface RuleExecuteResult {
    rule_id: number
    rule_name: string
    match_count: number
    success_count: number
    failed_count: number
}
