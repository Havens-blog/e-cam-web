/**
 * 统计相关类型定义
 */

export interface Statistics {
    total_assets: number
    provider_stats: Record<string, number>
    asset_type_stats: Record<string, number>
    region_stats: Record<string, number>
    status_stats: Record<string, number>
    total_cost: number
    last_discover_time?: string
}

export interface StatisticsResponse extends Statistics { }
