/**
 * 成本分析相关类型定义
 */

export interface DailyCost {
    date: string
    cost: number
}

export interface AssetCost {
    asset_id: string
    asset_name: string
    asset_type: string
    cost: number
}

/**
 * 成本分析查询参数 (用于 GET 请求)
 */
export interface CostAnalysisParams {
    provider: string
    days: number
}

/**
 * @deprecated 使用 CostAnalysisParams 代替 (API 已改为 GET 方法)
 */
export interface CostAnalysisRequest extends CostAnalysisParams { }

export interface CostAnalysisResponse {
    provider: string
    total_cost: number
    daily_costs: DailyCost[]
    asset_costs: AssetCost[]
    region_costs: Record<string, number>
}
