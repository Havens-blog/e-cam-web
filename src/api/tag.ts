/**
 * 多云标签管理 API
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type {
    BatchResult,
    BindTagsReq,
    ComplianceFilter,
    ComplianceResponse,
    CreatePolicyReq,
    PolicyFilter,
    TagFilter,
    TagPolicy,
    TagResource,
    TagResourceFilter,
    TagStats,
    TagSummary,
    UnbindTagsReq,
    UpdatePolicyReq
} from './types/tag'

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

// ==================== 标签查询 API ====================

/** 获取标签列表 */
export function listTagsApi(params?: TagFilter) {
    return instance.get<{ items: TagSummary[]; total: number }>({
        url: `${API_SERVICE.CAM}/tags`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取标签统计 */
export function getTagStatsApi() {
    return instance.get<TagStats>({
        url: `${API_SERVICE.CAM}/tags/stats`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取标签关联资源 */
export function listTagResourcesApi(params: TagResourceFilter) {
    return instance.get<{ items: TagResource[]; total: number }>({
        url: `${API_SERVICE.CAM}/tags/resources`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 标签操作 API ====================

/** 绑定标签 */
export function bindTagsApi(data: BindTagsReq) {
    return instance.post<BatchResult>({
        url: `${API_SERVICE.CAM}/tags/bindResource`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 解绑标签 */
export function unbindTagsApi(data: UnbindTagsReq) {
    return instance.post<BatchResult>({
        url: `${API_SERVICE.CAM}/tags/unbindResource`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 标签策略 API ====================

/** 创建标签策略 */
export function createPolicyApi(data: CreatePolicyReq) {
    return instance.post<TagPolicy>({
        url: `${API_SERVICE.CAM}/tags/policies`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取标签策略列表 */
export function listPoliciesApi(params?: PolicyFilter) {
    return instance.get<{ items: TagPolicy[]; total: number }>({
        url: `${API_SERVICE.CAM}/tags/policies`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新标签策略 */
export function updatePolicyApi(id: number, data: UpdatePolicyReq) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/tags/policies/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除标签策略 */
export function deletePolicyApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/tags/policies/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 合规检查 API ====================

/** 合规检查 */
export function checkComplianceApi(params?: ComplianceFilter) {
    return instance.get<ComplianceResponse>({
        url: `${API_SERVICE.CAM}/tags/compliance`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 自动打标规则 API ====================

/** 创建自动打标规则 */
export function createRuleApi(data: import('./types/tag').CreateRuleReq) {
    return instance.post<import('./types/tag').TagRule>({
        url: `${API_SERVICE.CAM}/tags/rules`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取自动打标规则列表 */
export function listRulesApi(params?: import('./types/tag').RuleFilter) {
    return instance.get<{ items: import('./types/tag').TagRule[]; total: number }>({
        url: `${API_SERVICE.CAM}/tags/rules`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新自动打标规则 */
export function updateRuleApi(id: number, data: import('./types/tag').UpdateRuleReq) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/tags/rules/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除自动打标规则 */
export function deleteRuleApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/tags/rules/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 预览规则匹配结果 */
export function previewRulesApi(ruleIds: number[]) {
    return instance.post<{ items: import('./types/tag').RulePreviewResult[] }>({
        url: `${API_SERVICE.CAM}/tags/rules/preview`,
        data: { rule_ids: ruleIds },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 执行自动打标规则 */
export function executeRulesApi(ruleIds: number[]) {
    return instance.post<{ items: import('./types/tag').RuleExecuteResult[] }>({
        url: `${API_SERVICE.CAM}/tags/rules/execute`,
        data: { rule_ids: ruleIds },
        interceptorsToOnce: createCamApiInterceptor()
    })
}
