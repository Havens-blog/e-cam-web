/**
 * 仪表盘 API
 * 资产统计聚合数据
 */

import instance, { API_SERVICE } from './request/service'

// ==================== 类型定义 ====================

export interface KeyCount {
    key: string
    count: number
}

export interface OverviewData {
    total: number
    by_provider: KeyCount[]
    by_type: KeyCount[]
    by_status: KeyCount[]
}

export interface KeyCountList {
    items: KeyCount[]
}

export interface ExpiringAsset {
    id: number
    asset_id: string
    asset_name: string
    asset_type: string
    tenant_id: string
    account_id: number
    provider: string
    region: string
    status: string
    attributes: Record<string, any>
    create_time: number
    update_time: number
}

export interface ExpiringList {
    items: ExpiringAsset[]
    total: number
}

// ==================== API ====================

/** 资产总览 */
export function getOverviewApi() {
    return instance.get<OverviewData>({
        url: `${API_SERVICE.CAM}/dashboard/overview`,
    })
}

/** 按云厂商统计 */
export function getByProviderApi() {
    return instance.get<KeyCountList>({
        url: `${API_SERVICE.CAM}/dashboard/by-provider`,
    })
}

/** 按地域统计 */
export function getByRegionApi() {
    return instance.get<KeyCountList>({
        url: `${API_SERVICE.CAM}/dashboard/by-region`,
    })
}

/** 按资产类型统计 */
export function getByAssetTypeApi() {
    return instance.get<KeyCountList>({
        url: `${API_SERVICE.CAM}/dashboard/by-asset-type`,
    })
}

/** 按云账号统计 */
export function getByAccountApi() {
    return instance.get<KeyCountList>({
        url: `${API_SERVICE.CAM}/dashboard/by-account`,
    })
}

/** 即将过期的资源 */
export function getExpiringApi(params?: { days?: number; offset?: number; limit?: number }) {
    return instance.get<ExpiringList>({
        url: `${API_SERVICE.CAM}/dashboard/expiring`,
        params,
    })
}
