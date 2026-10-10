/**
 * 服务树全局资产统计 API（云管 dashboard 资产类别统计专用）
 *
 * 说明：服务树/CMDB/拓扑页面已迁出至独立仓库 e-cmdb-web，service-tree.ts 一并迁出。
 * 但「全局资产统计」接口（GET /api/v1/cam/service-tree/assets/stats）后端仍在
 * e-cam-service，且云管 dashboard 的「资产类别」统计卡片依赖它，故在 e-cam-web
 * 保留此精简版，避免 dashboard 反向依赖已迁出的 service-tree 模块。
 */
import instance, { API_SERVICE } from './request/service'
import type { RequestConfig } from './request/types'

export interface NodeAssetStatsParams {
    include_children?: boolean
}

export interface AssetStatsVO {
    total: number
    by_asset_type: Record<string, number>
    by_provider: Record<string, number>
}

const BASE_URL = `${API_SERVICE.CAM}/service-tree`

/** 查询全局资产统计（按产品类别聚合） */
export const getGlobalAssetStatsApi = (params?: NodeAssetStatsParams) => {
    return instance.get<AssetStatsVO>({ url: `${BASE_URL}/assets/stats`, params } as RequestConfig)
}
