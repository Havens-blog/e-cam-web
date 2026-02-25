/**
 * 云资产 API
 * 统一的资产查询接口（ECS、RDS、Redis、MongoDB）
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type { Asset, AssetListResponse, ListAssetsParams, SearchParams, SearchResponse } from './types/asset'

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

// ==================== NAS API ====================

/** NAS 列表查询参数 */
export interface ListNASParams {
    tenant_id?: string
    account_id?: number
    provider?: string
    region?: string
    status?: string
    name?: string
    file_system_type?: string
    protocol_type?: string
    offset?: number
    limit?: number
}

/** 获取 NAS 文件系统列表 */
export function listNASAssetsApi(params?: ListNASParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/nas`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 NAS 文件系统详情 */
export function getNASAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/nas/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== OSS API ====================

/** OSS 列表查询参数 */
export interface ListOSSParams {
    tenant_id?: string
    account_id?: number
    provider?: string
    region?: string
    name?: string
    storage_class?: string
    acl?: string
    offset?: number
    limit?: number
}

/** 获取 OSS 存储桶列表 */
export function listOSSAssetsApi(params?: ListOSSParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/oss`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 OSS 存储桶详情 */
export function getOSSAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/oss/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== 统一搜索 API ====================

/** 搜索资产 */
export function searchAssetsApi(params: SearchParams) {
    return instance.get<SearchResponse>({
        url: `${API_SERVICE.CAM}/assets/search`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}


// ==================== Kafka API ====================

/** 获取 Kafka 实例列表 */
export function listKafkaAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/kafka`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 Kafka 实例详情 */
export function getKafkaAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/kafka/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== Elasticsearch API ====================

/** 获取 Elasticsearch 实例列表 */
export function listElasticsearchAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/elasticsearch`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取 Elasticsearch 实例详情 */
export function getElasticsearchAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/elasticsearch/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== Disk 云盘 API ====================

/** 云盘列表查询参数 */
export interface ListDiskParams extends ListAssetsParams {
    disk_type?: string      // 云盘类型(system/data)
    instance_id?: string    // 挂载的实例ID
}

/** 获取云盘列表 */
export function listDiskAssetsApi(params?: ListDiskParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/disk`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取云盘详情 */
export function getDiskAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/disk/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== Snapshot 快照 API ====================

/** 快照列表查询参数 */
export interface ListSnapshotParams extends ListAssetsParams {
    source_disk_id?: string  // 源磁盘ID
}

/** 获取快照列表 */
export function listSnapshotAssetsApi(params?: ListSnapshotParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/snapshot`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取快照详情 */
export function getSnapshotAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/snapshot/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== SecurityGroup 安全组 API ====================

/** 安全组列表查询参数 */
export interface ListSecurityGroupParams extends ListAssetsParams {
    vpc_id?: string  // VPC ID
}

/** 获取安全组列表 */
export function listSecurityGroupAssetsApi(params?: ListSecurityGroupParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/security-group`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取安全组详情 */
export function getSecurityGroupAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/security-group/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== ECS 关联资源 API ====================

/** ECS 关联资源响应 */
export interface ECSRelationsResp {
    ecs: Asset
    disks: Asset[]
    snapshots: Asset[]
    security_groups: Asset[]
    vpc: Asset | null
    subnet: Asset | null
}

/** 获取 ECS 关联资源 */
export function getECSRelationsApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<{ code: number; data: ECSRelationsResp; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/ecs/${assetId}/relations`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}
