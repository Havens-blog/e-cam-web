/**
 * 云资产 API
 * 统一的资产查询接口（ECS、RDS、Redis、MongoDB）
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type { Asset, AssetListResponse, ListAssetsParams } from './types/asset'

// 资产 API 响应拦截器
function createAssetApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data
            if (data.code === 0) {
                return response
            }
            if (data.code === undefined) {
                response.data = { code: 0, data: data, message: 'success' }
                return response
            }
            return response
        }
    }
}

// ==================== ECS API ====================

/** 获取 ECS 实例列表 */
export function listECSAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/ecs`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 ECS 实例详情 */
export function getECSAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/ecs/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== RDS API ====================

/** 获取 RDS 实例列表 */
export function listRDSAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/rds`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 RDS 实例详情 */
export function getRDSAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/rds/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== Redis API ====================

/** 获取 Redis 实例列表 */
export function listRedisAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/redis`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 Redis 实例详情 */
export function getRedisAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/redis/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== MongoDB API ====================

/** 获取 MongoDB 实例列表 */
export function listMongoDBAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/mongodb`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 MongoDB 实例详情 */
export function getMongoDBAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/mongodb/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}


// ==================== VPC API ====================

/** 获取 VPC 列表 */
export function listVPCAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/vpc`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 VPC 详情 */
export function getVPCAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/vpc/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== EIP API ====================

/** 获取 EIP 列表 */
export function listEIPAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/eip`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 EIP 详情 */
export function getEIPAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/eip/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}
