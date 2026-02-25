/**
 * 云资产类型定义
 * 统一的资产数据结构（ECS、RDS、Redis、MongoDB）
 */

/** 资产类型 */
export type AssetType = 'ecs' | 'rds' | 'redis' | 'mongodb' | 'vpc' | 'eip'

/** 云厂商 */
export type CloudProvider = 'aliyun' | 'aws' | 'huawei' | 'tencent' | 'volcano'

/** 实例状态 */
export type AssetStatus = 'running' | 'stopped' | 'creating' | 'deleting' | 'restarting' | 'upgrading'

/** 统一资产对象 */
export interface Asset {
    id: number
    asset_id: string
    asset_name: string
    asset_type: AssetType
    tenant_id: string
    account_id: number
    provider: CloudProvider
    region: string
    status: string
    attributes: Record<string, any>
    create_time: number
    update_time: number
}

/** 资产列表查询参数 */
export interface ListAssetsParams {
    tenant_id?: string
    account_id?: number
    provider?: CloudProvider
    region?: string
    status?: string
    name?: string
    offset?: number
    limit?: number
}

/** 资产列表响应 */
export interface AssetListResponse {
    items: Asset[]
    total: number
}

/** 资产详情响应 */
export interface AssetDetailResponse {
    code: number
    msg: string
    data: Asset
}

/** 标签 */
export interface Tag {
    key: string
    value: string
}

/** 搜索匹配信息 */
export interface MatchInfo {
    field: string
    value: string
    label: string
}

/** 搜索结果项 */
export interface SearchResultItem extends Asset {
    matches: MatchInfo[]
}

/** 搜索响应 */
export interface SearchResponse {
    items: SearchResultItem[]
    total: number
    keyword: string
}

/** 搜索参数 */
export interface SearchParams {
    keyword: string
    types?: string
    provider?: string
    account_id?: number
    region?: string
    offset?: number
    limit?: number
}
