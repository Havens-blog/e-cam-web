/**
 * FinOps 多云成本分析 API
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type {
    AllocationRule,
    BudgetProgress,
    BudgetRule,
    CollectLog,
    ComparisonResult,
    CostAnomaly,
    CostDistItem,
    CostDistributionParams,
    CostFilterParams,
    CostSummary,
    CostTrendParams,
    CostTrendPoint,
    CreateAllocationRuleRequest,
    CreateBudgetRequest,
    ManualCollectRequest,
    Recommendation
} from './types/finops'

// CAM API 响应拦截器
function createCamApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data
            if (data.code === 200) {
                response.data = { code: 0, data: data.data, message: data.msg || data.message || 'success' }
                return response
            }
            if (data.code === 0) return response
            if (data.code === undefined) {
                response.data = { code: 0, data: data, message: 'success' }
                return response
            }
            return response
        }
    }
}

// ==================== 成本分析 API ====================

/** 获取成本概览 */
export function getCostSummaryApi(params: CostFilterParams) {
    return instance.get<CostSummary>({
        url: `${API_SERVICE.CAM}/cost/summary`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取成本趋势 */
export function getCostTrendApi(params: CostTrendParams) {
    return instance.get<CostTrendPoint[]>({
        url: `${API_SERVICE.CAM}/cost/trend`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取成本分布 */
export function getCostDistributionApi(params: CostDistributionParams) {
    return instance.get<CostDistItem[]>({
        url: `${API_SERVICE.CAM}/cost/distribution`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取同比环比对比 */
export function getCostComparisonApi(params: CostFilterParams) {
    return instance.get<ComparisonResult>({
        url: `${API_SERVICE.CAM}/cost/comparison`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 异常检测 API ====================

/** 获取异常事件列表 */
export function getCostAnomaliesApi(params: CostFilterParams & { severity?: string }) {
    return instance.get<{ items: CostAnomaly[]; total: number }>({
        url: `${API_SERVICE.CAM}/cost/anomalies`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 手动触发异常检测 */
export function triggerAnomalyDetectionApi() {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/cost/anomalies/detect`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 优化建议 API ====================

/** 获取优化建议列表 */
export function getRecommendationsApi(params: CostFilterParams & { type?: string }) {
    return instance.get<{ items: Recommendation[]; total: number }>({
        url: `${API_SERVICE.CAM}/cost/recommendations`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 忽略优化建议 */
export function dismissRecommendationApi(id: number) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/cost/recommendations/${id}/dismiss`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 预算管理 API ====================

/** 创建预算规则 */
export function createBudgetApi(data: CreateBudgetRequest) {
    return instance.post<{ id: number }>({
        url: `${API_SERVICE.CAM}/budget`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取预算规则列表 */
export function listBudgetsApi() {
    return instance.get<{ items: BudgetRule[]; total: number }>({
        url: `${API_SERVICE.CAM}/budget`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取预算消耗进度 */
export function getBudgetProgressApi(id: number) {
    return instance.get<BudgetProgress>({
        url: `${API_SERVICE.CAM}/budget/${id}/progress`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新预算规则 */
export function updateBudgetApi(id: number, data: CreateBudgetRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/budget/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除预算规则 */
export function deleteBudgetApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/budget/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 成本分摊 API ====================

/** 创建分摊规则 */
export function createAllocationRuleApi(data: CreateAllocationRuleRequest) {
    return instance.post<{ id: number }>({
        url: `${API_SERVICE.CAM}/allocation/rules`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新分摊规则 */
export function updateAllocationRuleApi(id: number, data: CreateAllocationRuleRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/allocation/rules/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取分摊规则列表 */
export function listAllocationRulesApi() {
    return instance.get<{ items: AllocationRule[]; total: number }>({
        url: `${API_SERVICE.CAM}/allocation/rules`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 按维度查询分摊 */
export function getAllocationByDimensionApi(params: { dim_type: string; dim_value: string; period: string }) {
    return instance.get<any>({
        url: `${API_SERVICE.CAM}/allocation/by-dimension`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取分摊树形视图 */
export function getAllocationTreeApi(params: { dim_type: string; root_id: string; period: string }) {
    return instance.get<any>({
        url: `${API_SERVICE.CAM}/allocation/tree`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除分摊规则 */
export function deleteAllocationRuleApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/allocation/rules/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 执行分摊计算（异步） */
export function reallocateCostsApi(period: string) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/allocation/reallocate`,
        data: { period },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 设置默认分摊策略 */
export function setDefaultAllocationPolicyApi(data: { default_node_id: string; default_node_name: string }) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/allocation/default-policy`,
        data: {
            target_id: data.default_node_id,
            target_name: data.default_node_name
        },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 采集管理 API ====================

/** 手动触发采集 */
export function triggerCollectApi(data: ManualCollectRequest) {
    // 后端期望 start_time / end_time 为 RFC3339 格式
    const body = {
        account_id: data.account_id,
        start_time: data.start_date + 'T00:00:00Z',
        end_time: data.end_date + 'T23:59:59Z',
    }
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/cost/collect`,
        data: body,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取采集日志列表 */
export function listCollectLogsApi(params?: { account_id?: number; offset?: number; limit?: number }) {
    return instance.get<{ items: CollectLog[]; total: number }>({
        url: `${API_SERVICE.CAM}/cost/collect/logs`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}
