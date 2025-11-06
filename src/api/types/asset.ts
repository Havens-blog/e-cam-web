/**
 * 资产相关类型定义
 */

export interface Asset {
    id: number
    asset_id: string
    asset_name: string
    asset_type: "ecs" | "rds" | "oss" | "vpc" | "slb" | "eip" | "disk"
    provider: "aliyun" | "aws" | "azure" | "tencent" | "huawei"
    region: string
    zone?: string
    status: "running" | "stopped" | "starting" | "stopping" | "terminated" | "unknown"
    tags?: AssetTag[]
    metadata?: string
    cost: number
    create_time: string
    update_time: string
    discover_time: string
}

export interface AssetTag {
    key: string
    value: string
}

export interface AssetDetail extends Asset {
    // Additional detail fields if needed
}

export interface ListAssetsParams {
    provider?: string
    asset_type?: string
    region?: string
    status?: string
    asset_name?: string
    offset?: number
    limit?: number
}

export interface ListAssetsResponse {
    assets: Asset[]
    total: number
}

export interface UpdateAssetRequest {
    id: number
    asset_name?: string
    status?: string
    cost?: number
}

export interface DiscoverRequest {
    provider: string
    region: string
}

export interface DiscoverResponse {
    assets: Asset[]
    count: number
}

/**
 * 创建资产请求
 */
export interface CreateAssetRequest {
    asset_id: string
    asset_name: string
    asset_type: string
    provider: string
    region: string
    zone?: string
    status: string
    tags?: AssetTag[]
    metadata?: string
    cost?: number
}

/**
 * 批量创建资产请求
 */
export interface CreateMultiAssetsRequest {
    assets: CreateAssetRequest[]
}

/**
 * 批量创建资产响应
 */
export interface CreateMultiAssetsResponse {
    success_count: number
    failed_count: number
    results: Array<{
        success: boolean
        asset?: Asset
        error?: string
    }>
}

/**
 * 同步资产请求
 */
export interface SyncAssetsRequest {
    provider: string
    asset_types?: string[]
    regions?: string[]
}

/**
 * 同步资产响应
 */
export interface SyncAssetsResponse {
    task_id: string
    status: string
}
