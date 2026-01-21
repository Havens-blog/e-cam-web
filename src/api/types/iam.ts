/**
 * IAM (Identity and Access Management) 相关类型定义
 */

// ==================== 基础类型 ====================

export type CloudProvider = 'aliyun' | 'aws' | 'azure' | 'tencent' | 'huawei'

// ==================== 租户类型 ====================

export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'deleted'

export interface TenantMetadata {
    company_name: string
    contact_email: string
    contact_phone: string
    owner: string
    industry: string
    region: string
    tags: Record<string, string>
    user_count: number
    user_group_count: number
    cloud_account_count: number
}

export interface TenantSettings {
    max_users: number
    max_user_groups: number
    max_cloud_accounts: number
    allowed_providers: CloudProvider[]
    features: Record<string, boolean>
    custom_fields: Record<string, string>
}

export interface Tenant {
    id: string
    name: string
    display_name: string
    description: string
    status: TenantStatus
    metadata: TenantMetadata
    settings: TenantSettings
    create_time: string
    update_time: string
}

export interface TenantStats {
    current_users: number
    max_users: number
    current_user_groups: number
    max_user_groups: number
    current_cloud_accounts: number
    max_cloud_accounts: number
}

// ==================== 云用户类型 ====================

export type CloudUserType = 'api_key' | 'access_key' | 'ram_user' | 'iam_user'
export type CloudUserStatus = 'active' | 'inactive' | 'deleted'

export interface CloudUser {
    id: number
    username: string
    display_name: string
    user_type: CloudUserType
    status: CloudUserStatus
    provider: CloudProvider
    cloud_account_id: number
    cloud_account_name: string
    email: string
    permission_groups: PermissionGroup[]
    tenant_id: string
    create_time: string
    update_time: string
}

// ==================== 权限组类型 ====================

export interface PermissionGroup {
    id: number
    name: string
    description: string
    cloud_platforms: CloudProvider[]
    policies: PermissionPolicy[]
    member_count: number
    user_count?: number // 后端可能返回 user_count
    tenant_id: string
    create_time: string
    update_time: string
}

// ==================== 权限策略类型 ====================

export type PolicyType = 'system' | 'custom'

export interface PermissionPolicy {
    policy_id: string
    policy_name: string
    policy_type: PolicyType
    policy_document: string
    provider: CloudProvider
}

// ==================== 策略模板类型 ====================

export type TemplateCategory = 'read_only' | 'admin' | 'developer' | 'custom'

export interface PolicyTemplate {
    id: number
    name: string
    category: TemplateCategory
    description: string
    cloud_platforms: CloudProvider[]
    policies: PermissionPolicy[]
    is_built_in: boolean
    tenant_id: string
    create_time: string
    update_time: string
}

// ==================== 审计日志类型 ====================

export type OperationResult = 'success' | 'failed'

export interface AuditLog {
    id: number
    operation_type: string
    operator_id: string
    operator_name: string
    target_type: string
    target_id: string
    target_name: string
    cloud_platform: CloudProvider
    tenant_id: string
    operation_time: string
    operation_result: OperationResult
    error_message?: string
    request_data?: any
    response_data?: any
}

// ==================== 同步任务类型 ====================

export type SyncTaskType = 'user_sync' | 'permission_sync' | 'group_sync'
export type SyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed'
export type SyncTargetType = 'user' | 'group'

export interface SyncTask {
    id: number
    task_type: SyncTaskType
    status: SyncTaskStatus
    cloud_account_id: number
    cloud_account_name: string
    provider: CloudProvider
    target_type: SyncTargetType
    target_id: number
    progress: number
    error_message?: string
    create_time: string
    start_time?: string
    complete_time?: string
}

// ==================== 租户管理 API 请求/响应类型 ====================

export interface ListTenantsParams {
    keyword?: string
    status?: TenantStatus
    industry?: string
    region?: string
    page?: number
    size?: number
}

export interface ListTenantsResponse {
    data: Tenant[]
    total: number
    page: number
    size: number
}

export interface CreateTenantRequest {
    id: string
    name: string
    display_name?: string
    description?: string
    metadata?: Partial<TenantMetadata>
    settings?: Partial<TenantSettings>
}

export interface UpdateTenantRequest {
    name?: string
    display_name?: string
    description?: string
    status?: TenantStatus
    metadata?: Partial<TenantMetadata>
    settings?: Partial<TenantSettings>
}

// ==================== 用户管理 API 请求/响应类型 ====================

export interface ListUsersParams {
    tenant_id?: string
    keyword?: string
    provider?: CloudProvider
    user_type?: CloudUserType
    status?: CloudUserStatus
    cloud_account_id?: number
    page?: number
    size?: number
}

export interface ListUsersResponse {
    data: CloudUser[]
    total: number
    page: number
    size: number
}

export interface CreateUserRequest {
    username: string
    display_name: string
    user_type: CloudUserType
    cloud_account_id: number
    email: string
    permission_groups: number[]
    tenant_id: string
}

export interface UpdateUserRequest {
    display_name?: string
    email?: string
    status?: CloudUserStatus
    permission_groups?: number[]
}

export interface BatchAssignRequest {
    tenant_id?: string
    user_ids: number[]
    group_ids: number[]
    mode?: 'append' | 'replace' // 分配模式：追加或替换
}

export interface SyncUsersRequest {
    tenant_id?: string
    cloud_account_id: number
}

// ==================== 权限组管理 API 请求/响应类型 ====================

export interface ListGroupsParams {
    tenant_id?: string
    keyword?: string
    provider?: CloudProvider
    cloud_account_id?: number
    page?: number
    size?: number
}

export interface ListGroupsResponse {
    data: PermissionGroup[]
    total: number
    page: number
    size: number
}

export interface CreateGroupRequest {
    name: string
    description: string
    cloud_platforms: CloudProvider[]
    policies: PermissionPolicy[]
    tenant_id: string
}

export interface UpdateGroupRequest {
    name?: string
    description?: string
    cloud_platforms?: CloudProvider[]
    policies?: PermissionPolicy[]
}

export interface UpdatePoliciesRequest {
    policies: PermissionPolicy[]
}

// ==================== 策略模板管理 API 请求/响应类型 ====================

export interface ListTemplatesParams {
    category?: TemplateCategory
    is_built_in?: boolean
    tenant_id?: string
    keyword?: string
    page?: number
    size?: number
}

export interface ListTemplatesResponse {
    data: PolicyTemplate[]
    total: number
    page: number
    size: number
}

export interface CreateTemplateRequest {
    name: string
    category: TemplateCategory
    description: string
    cloud_platforms: CloudProvider[]
    policies: PermissionPolicy[]
    tenant_id: string
}

export interface UpdateTemplateRequest {
    name?: string
    description?: string
    cloud_platforms?: CloudProvider[]
    policies?: PermissionPolicy[]
}

export interface CreateFromGroupRequest {
    group_id: number
    name: string
    description?: string
}

// ==================== 审计日志 API 请求/响应类型 ====================

export interface ListAuditLogsParams {
    operation_type?: string
    operator_id?: string
    target_type?: string
    cloud_platform?: CloudProvider
    tenant_id?: string
    start_time?: string
    end_time?: string
    page?: number
    size?: number
}

export interface ListAuditLogsResponse {
    data: AuditLog[]
    total: number
    page: number
    size: number
}

export interface ExportAuditLogsParams {
    operation_type?: string
    operator_id?: string
    target_type?: string
    cloud_platform?: CloudProvider
    tenant_id?: string
    start_time?: string
    end_time?: string
    format: 'csv' | 'json'
}

export interface GenerateAuditReportRequest {
    start_time: string
    end_time: string
    tenant_id: string
}

// ==================== 同步任务 API 请求/响应类型 ====================

export interface ListSyncTasksParams {
    task_type?: SyncTaskType
    status?: SyncTaskStatus
    cloud_account_id?: number
    provider?: CloudProvider
    page?: number
    size?: number
}

export interface ListSyncTasksResponse {
    data: SyncTask[]
    total: number
    page: number
    size: number
}

export interface CreateSyncTaskRequest {
    task_type: SyncTaskType
    cloud_account_id: number
    provider: CloudProvider
    target_type: SyncTargetType
    target_id: number
}

export interface SyncTaskStatusResponse {
    task: SyncTask
}
