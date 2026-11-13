/**
 * 云账号相关类型定义
 */

/** 权限体检查单项状态：ok=通过；denied=明确权限不足（403/AccessDenied/NoPermission）；error=其他失败；unsupported=云厂商暂不支持探测 */
export type PermissionCheckStatus = 'ok' | 'denied' | 'error' | 'unsupported'

/** 单类资源的列举权限探测结果 */
export interface PermissionCheckItem {
    asset_type: string
    asset_name: string
    status: PermissionCheckStatus
    code: string
    message: string
}

/** 权限体检汇总（按状态统计项数） */
export interface PermissionSummary {
    ok: number
    denied: number
    error: number
    unsupported: number
}

/** 一次权限体检的完整结果（详情接口 permission_check 字段同构） */
export interface PermissionCheck {
    account_id: number
    provider: string
    /** AK 身份类型，如 RAMUser / PrimaryAccount */
    identity_type: string
    is_primary_account: boolean
    checked_at: string
    summary: PermissionSummary
    items: PermissionCheckItem[]
}

export interface CloudAccount {
    id: number
    name: string
    provider: "aliyun" | "aws" | "azure" | "tencent" | "huawei"
    environment: "production" | "staging" | "development"
    access_key_id: string
    access_key_secret?: string // 敏感信息，通常不返回
    /**
     * 单数 region 属**历史字段**：`GET /cloud-accounts` 实测只返回 `regions: string[]`（无 region）。
     * 展示请用 @/utils/display-fallbacks.accountRegionLabel（优先 region，退到 regions[0]）。
     */
    region?: string
    regions?: string[] // 支持多区域
    description?: string
    status: "active" | "disabled" | "error" | "testing" | "inactive"
    config: AccountConfig
    tenant_id: string
    last_sync_time?: string
    last_test_time?: string
    asset_count: number
    user_count?: number // IAM 用户数量
    group_count?: number // 权限组数量
    error_message?: string
    is_default?: boolean
    create_time: string
    update_time: string
    /** 最近一次权限体检结果；详情接口在未体检过时返回 null，也可能整个字段缺失 */
    permission_check?: PermissionCheck | null
}

export interface AccountConfig {
    enable_auto_sync: boolean
    sync_interval: number
    read_only: boolean
    enable_user_sync?: boolean // 自动同步用户
    show_sub_accounts: boolean
    enable_cost_monitoring: boolean
    supported_regions?: string[]
    supported_asset_types?: string[]
}

export interface ListAccountsParams {
    provider?: string
    environment?: string
    status?: string
    offset?: number
    limit?: number
    page?: number
    size?: number
}

export interface ListAccountsResponse {
    accounts: CloudAccount[]
    total: number
}

export interface CreateAccountRequest {
    name: string
    provider: "aliyun" | "aws" | "azure" | "tencent" | "huawei"
    environment: "production" | "staging" | "development"
    access_key_id: string
    access_key_secret: string
    region: string
    regions?: string[]
    description?: string
    config?: AccountConfig
    tenant_id: string
}

export interface CreateAccountResponse {
    id: number
    name: string
    provider: string
    environment: string
    access_key_id: string
    status: string
    create_time: string
}

export interface UpdateAccountRequest {
    name?: string
    environment?: string
    access_key_id?: string
    access_key_secret?: string
    region?: string
    regions?: string[]
    description?: string
    config?: Partial<AccountConfig>
}

export interface TestConnectionResponse {
    status: "success" | "failed"
    message: string
    regions?: string[]
    test_time: string
}

export interface SyncRequest {
    asset_types?: string[]
    regions?: string[]
}

export interface SyncResponse {
    sync_id: string
    status: "running" | "completed" | "failed" | "success" | "pending"
    message?: string
    start_time: string
}
