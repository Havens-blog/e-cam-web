/**
 * 云账号相关类型定义
 */

export interface CloudAccount {
    id: number
    name: string
    provider: "aliyun" | "aws" | "azure" | "tencent" | "huawei"
    environment: "production" | "staging" | "development"
    access_key_id: string
    access_key_secret?: string // 敏感信息，通常不返回
    region: string
    regions?: string[] // 支持多区域
    description?: string
    status: "active" | "disabled" | "error" | "testing"
    config: AccountConfig
    tenant_id: string
    last_sync_time?: string
    last_test_time?: string
    asset_count: number
    user_count?: number // IAM 用户数量
    group_count?: number // 权限组数量
    error_message?: string
    create_time: string
    update_time: string
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
    status: "running" | "completed" | "failed"
    start_time: string
}
