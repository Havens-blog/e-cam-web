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
            // CAM API 返回 code: 200 表示成功
            if (data.code === 200) {
                response.data = { code: 0, data: data.data, message: data.msg || data.message || 'success' }
                return response
            }
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

// ===== NAS 指标(读 ecam_nas_metric 指标表;NAS 界面容量数值唯一来源) =====

/** NAS 单日指标点:缺失日 capacity/used/utilization 为 null(不填充假值,以 data_status=missing 标注) */
export interface NASMetricPoint {
    /** 日期 YYYY-MM-DD(Asia/Shanghai) */
    date: string
    /** 总容量(GB,二进制 GiB);缺失日 null */
    capacity: number | null
    /** 已用容量(GB);缺失日 null */
    used: number | null
    /** used/capacity(0-1);capacity=0 异常行或缺失日 null */
    utilization: number | null
    /** ok | zero_exception | missing */
    data_status: string
    /** 落库 qc_status 原样透出(空=正常;zero_exception=capacity=0 异常行) */
    qc_status?: string
}

/** 「最新一天」/「近 N 天均值」摘要;无可用行时各字段为 null */
export interface NASMetricSummary {
    date?: string
    capacity: number | null
    used: number | null
    utilization: number | null
}

/** GET /assets/nas/metrics 响应体(days[] 按日期升序) */
export interface NASFsMetricsView {
    fs_id: string
    days: NASMetricPoint[]
    latest: NASMetricSummary | null
    average: NASMetricSummary | null
}

/** 查询 NAS 单文件系统近 N 天容量/使用率趋势参数 */
export interface GetNASMetricsParams {
    /** 文件系统 ID */
    fs_id: string
    /** 云账号 ID(必填,服务端校验租户归属) */
    account_id: number
    /** 回看天数(缺省 30,限 1~90) */
    days?: number
}

/** 获取 NAS 文件系统近 N 天容量/使用率趋势(读指标表,采集任务落库) */
export function getNasMetricsApi(params: GetNASMetricsParams) {
    return instance.get<NASFsMetricsView>({
        url: `${API_SERVICE.CAM}/assets/nas/metrics`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** NAS Top 单项:按 fs_id 去重后的代表行(最新一天)+ 近 N 天均值 */
export interface NASTopItem {
    fs_id: string
    fs_name: string
    provider: string
    /** 跨账号同 fs 并存时为去重后的账号列表 */
    account_id: number[]
    /** ok | zero_exception */
    data_status: string
    qc_status?: string
    latest: NASMetricSummary
    average: NASMetricSummary
}

/** GET /assets/nas/top 响应体 */
export interface NASTopView {
    total: number
    page: number
    page_size: number
    items: NASTopItem[]
}

/** 查询 NAS 容量/使用率 Top 参数(account_id 缺省 = 全部租户账号) */
export interface GetNASTopParams {
    account_id?: number
    /** 回看天数(缺省 30,限 1~90) */
    days?: number
    /** 排序键:capacity | utilization(缺省 capacity) */
    sort?: 'capacity' | 'utilization'
    /** 返回条数(缺省 10,最大 50) */
    top?: number
    page?: number
    page_size?: number
}

/** 获取 NAS 容量/使用率 Top(fs_id 去重聚合,不跨账号求和/平均) */
export function getNasTopApi(params?: GetNASTopParams) {
    return instance.get<NASTopView>({
        url: `${API_SERVICE.CAM}/assets/nas/top`,
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

// ===== OSS 指标(读 ecam_oss_metric 指标表;OSS 界面存储量/对象数唯一来源,资产表快照不展示) =====

/** OSS 单日指标点:缺失日 storage_size/object_count 为 null(不填充假值,以 data_status=missing 标注) */
export interface OSSMetricPoint {
    /** 日期 YYYY-MM-DD(Asia/Shanghai) */
    date: string
    /** 存储量(GB,二进制 GiB);缺失日 null;zero_exception 日为 0 */
    storage_size: number | null
    /** 对象数量;缺失日 null */
    object_count: number | null
    /** ok | zero_exception | missing */
    data_status: string
    /** 落库 qc_status 原样透出(空=正常;zero_exception=capacity=0 异常行) */
    qc_status?: string
}

/** 「最新一天」/「近 N 天均值」摘要;无可用行时各字段为 null */
export interface OSSMetricSummary {
    date?: string
    storage_size: number | null
    object_count: number | null
}

/** GET /assets/oss/metrics 响应体(days[] 按日期升序) */
export interface OSSBucketMetricsView {
    bucket_name: string
    days: OSSMetricPoint[]
    latest: OSSMetricSummary | null
    average: OSSMetricSummary | null
}

/** 查询 OSS 单 bucket 近 N 天存储量/对象数趋势参数 */
export interface GetOSSMetricsParams {
    /** 存储桶名称(OSS asset_id 即 bucket_name) */
    bucket_name: string
    /** 云账号 ID(必填,服务端校验租户归属) */
    account_id: number
    /** 回看天数(缺省 30,限 1~90) */
    days?: number
}

/** 获取 OSS 存储桶近 N 天存储量/对象数趋势(读指标表,采集任务落库) */
export function getOssMetricsApi(params: GetOSSMetricsParams) {
    return instance.get<OSSBucketMetricsView>({
        url: `${API_SERVICE.CAM}/assets/oss/metrics`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** OSS Top 单项:按 bucket_name 去重后的代表行(最新一天)+ 近 N 天均值 */
export interface OSSTopItem {
    bucket_name: string
    provider: string
    /** 跨账号同 bucket 并存时为去重后的账号列表 */
    account_id: number[]
    /** ok | zero_exception */
    data_status: string
    qc_status?: string
    latest: OSSMetricSummary
    average: OSSMetricSummary
}

/** GET /assets/oss/top 响应体 */
export interface OSSTopView {
    total: number
    page: number
    page_size: number
    items: OSSTopItem[]
}

/** 查询 OSS 存储量/对象数 Top 参数(account_id 缺省 = 全部租户账号) */
export interface GetOSSTopParams {
    account_id?: number
    /** 回看天数(缺省 30,限 1~90) */
    days?: number
    /** 排序键:storage_size | object_count(近 N 天均值口径) */
    sort?: 'storage_size' | 'object_count'
    /** 返回条数(缺省 10,最大 50) */
    top?: number
    page?: number
    page_size?: number
}

/** 获取 OSS 存储量/对象数 Top(bucket_name 去重聚合,不跨账号求和/平均) */
export function getOssTopApi(params?: GetOSSTopParams) {
    return instance.get<OSSTopView>({
        url: `${API_SERVICE.CAM}/assets/oss/top`,
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

// ==================== LB (负载均衡) API ====================

/** 获取负载均衡实例列表 */
export function listLBAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/lb`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取负载均衡实例详情 */
export function getLBAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<{ code: number; data: Asset; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/lb/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== VSwitch (交换机/子网) API ====================

/** 获取交换机/子网列表 */
export function listVSwitchAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/vswitch`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取交换机/子网详情 */
export function getVSwitchAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/vswitch/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== CDN (内容分发网络) API ====================

/** 获取CDN加速域名列表 */
export function listCDNAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/cdn`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取CDN加速域名详情 */
export function getCDNAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<{ code: number; data: Asset; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/cdn/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** CDN 缓存规则(统一格式;ttl: >0 秒 / 0 不缓存 / -1 跟随源站) */
export interface CDNCacheRule {
    path: string
    type: string
    ttl: number
    priority?: number
    /** 高级缓存行为(阿里云 swift_* 开关;status_code/query_filter 规则专用字段) */
    follow_origin_cache?: boolean
    force_revalidate?: boolean
    no_cache_low_freq?: boolean
    cache_high_freq?: boolean
    code_string?: string
    query_args?: string
}

/** 按需查询CDN域名缓存配置(实时经厂商 API,不落库) */
export function getCDNCacheConfigApi(params: { account_id: number; domain_name?: string; domain_id?: string }) {
    return instance.get<{ code: number; data: { domain: string; rules: CDNCacheRule[] }; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/cdn/cache-config`,
        params,
    })
}

/** CDN 域名功能配置项(enabled: true/false 启停可判定;undefined=该项不适用) */
export interface CDNConfigSetting {
    key: string
    name: string
    enabled?: boolean
    summary: string
    params?: Record<string, string>
}

/** CDN 功能分组(按语义归类:访问控制/流量限制/性能优化/HTTPS/重定向/回源/基础) */
export interface CDNConfigGroup {
    category: string
    label: string
    items: CDNConfigSetting[]
}

/** CDN 域名功能配置全景 */
export interface CDNDomainSettings {
    domain: string
    groups: CDNConfigGroup[]
}

/** 按需查询CDN域名功能配置全景(实时经厂商 API,不落库) */
export function getCDNDomainSettingsApi(params: { account_id: number; domain_name?: string; domain_id?: string }) {
    return instance.get<{ code: number; data: CDNDomainSettings; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/cdn/domain-settings`,
        params,
    })
}

// ==================== CDN 成本 API ====================

/** CDN 单月成本(cdn 与 dcdn 分列) */
export interface CDNMonthCost {
    month: string
    cdn_amount: number
    dcdn_amount: number
}

/** CDN 按账号维度成本(一期 account_name 为空,展示层补充) */
export interface CDNAccountCost {
    account_id: number
    account_name: string
    amount: number
    share: number
}

/** CDN 域名成本分摊项(二期接流量指标后生效,一期为空数组) */
export interface CDNDomainCost {
    domain: string
    amount_est: number
    bytes: number
    is_estimate: boolean
}

/** GET /cost/cdn 响应体 */
export interface CDNCostView {
    monthly: CDNMonthCost[]
    by_account: CDNAccountCost[]
    domain_cost: CDNDomainCost[]
}

/** 查询 CDN 经营成本参数 */
export interface GetCDNCostParams {
    /** 起始月 YYYY-MM,缺省取当前月 */
    start_month?: string
    /** 回看月数(1-24,缺省 6) */
    months?: number
    /** 云账号 ID,>0 时按账号过滤 */
    account_id?: number
}

/** 获取多云 CDN 经营成本(月度趋势/账号占比/域名分摊) */
export function getCdnCostApi(params?: GetCDNCostParams) {
    return instance.get<CDNCostView>({
        url: `${API_SERVICE.CAM}/cost/cdn`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== CDN 流量指标 API ====================

/** CDN 域名单日流量指标 */
export interface CDNMetricItem {
    /** 日期 YYYY-MM-DD */
    date: string
    /** 当日流量合计(字节) */
    bytes: number
    /** 当日带宽峰值(bps) */
    bandwidth: number
    /** 命中率 0-1;-1 表示当日无数据(展示为「—」) */
    hit_rate: number
}

/** GET /assets/cdn/metrics 响应体 */
export interface CDNDomainMetricsView {
    domain: string
    items: CDNMetricItem[]
}

/** CDN 流量 Top 域名项 */
export interface CDNTopDomainItem {
    domain: string
    /** 近 N 天流量合计(字节) */
    bytes: number
}

/** GET /assets/cdn/top 响应体 */
export interface CDNTopDomainsView {
    items: CDNTopDomainItem[]
}

/** 查询 CDN 域名近 N 天单日指标参数 */
export interface GetCDNMetricsParams {
    account_id: number
    domain_name: string
    /** 回看天数(缺省 30) */
    days?: number
}

/** 获取 CDN 域名近 N 天单日流量/命中率指标(读指标表,采集任务落库) */
export function getCdnMetricsApi(params: GetCDNMetricsParams) {
    return instance.get<CDNDomainMetricsView>({
        url: `${API_SERVICE.CAM}/assets/cdn/metrics`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 查询 CDN 流量 Top 域名参数 */
export interface GetCDNTopDomainsParams {
    /** 指标(一期仅支持 bytes) */
    metric?: 'bytes'
    /** 回看天数(缺省 7) */
    days?: number
    /** 返回条数(缺省 10) */
    limit?: number
}

/** 获取 CDN 流量 Top 域名(近 N 天字节合计降序) */
export function getCdnTopDomainsApi(params?: GetCDNTopDomainsParams) {
    return instance.get<CDNTopDomainsView>({
        url: `${API_SERVICE.CAM}/assets/cdn/top`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== WAF (Web应用防火墙) API ====================

/** 获取WAF实例列表 */
export function listWAFAssetsApi(params?: ListAssetsParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/waf`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取WAF实例详情 */
export function getWAFAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<{ code: number; data: Asset; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/waf/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== Image (镜像) API ====================

/** 镜像列表查询参数 */
export interface ListImageParams extends ListAssetsParams {
    image_owner_alias?: string  // system, self, others, marketplace
    os_type?: string            // linux, windows
    platform?: string           // CentOS, Ubuntu, Windows Server
    architecture?: string       // x86_64, arm64
}

/** 镜像统计响应 */
export interface ImageStatsResponse {
    total: number
    system: number
    custom: number
    shared: number
    /** 周趋势(当前值 - 7 天前基线),无基线时缺省 */
    trend?: {
        baseline_date: string
        total: number
        system: number
        custom: number
        shared: number
    }
}

/** 获取镜像列表 */
export function listImageAssetsApi(params?: ListImageParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/image`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取镜像详情 */
export function getImageAssetApi(assetId: string, params?: { provider?: string }) {
    return instance.get<Asset>({
        url: `${API_SERVICE.CAM}/assets/image/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取镜像统计 */
export function getImageStatsApi(params?: { account_id?: number; provider?: string }) {
    return instance.get<ImageStatsResponse>({
        url: `${API_SERVICE.CAM}/assets/image/stats`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

// ==================== ENI (弹性网卡) API ====================

/** ENI 列表查询参数 */
export interface ListENIParams extends ListAssetsParams {
    type?: string       // Primary / Secondary
    vpc_id?: string
    instance_id?: string
}

/** 获取弹性网卡列表 */
export function listENIAssetsApi(params?: ListENIParams) {
    return instance.get<AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets/eni`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}

/** 获取弹性网卡详情 */
export function getENIAssetApi(assetId: string, params?: { tenant_id?: string; provider?: string }) {
    return instance.get<{ code: number; data: Asset; msg: string }>({
        url: `${API_SERVICE.CAM}/assets/eni/${assetId}`,
        params,
        interceptorsToOnce: createAssetApiInterceptor()
    })
}
