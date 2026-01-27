/**
 * 服务树 API
 */
import http, { API_SERVICE } from './request/service'
import type {
    BindingRule,
    BindingRuleCreateParams,
    BindingRuleListParams,
    BindingRuleUpdateParams,
    Environment,
    EnvironmentCreateParams,
    EnvironmentListParams,
    EnvironmentUpdateParams,
    ListResponse,
    ResourceBinding,
    ResourceBindingBatchParams,
    ResourceBindingCreateParams,
    ResourceBindingListParams,
    ServiceTreeNode,
    ServiceTreeNodeCreateParams,
    ServiceTreeNodeListParams,
    ServiceTreeNodeUpdateParams
} from './types/service-tree'

const BASE_URL = `${API_SERVICE.CAM}/service-tree`

// ==================== 环境管理 ====================

/** 初始化默认环境 */
export const initEnvironmentsApi = () => {
    return http.post(`${BASE_URL}/environments/init`)
}

/** 获取环境列表 */
export const listEnvironmentsApi = (params?: EnvironmentListParams) => {
    return http.get<ListResponse<Environment>>(`${BASE_URL}/environments`, { params })
}

/** 创建环境 */
export const createEnvironmentApi = (data: EnvironmentCreateParams) => {
    return http.post<Environment>(`${BASE_URL}/environments`, data)
}

/** 更新环境 */
export const updateEnvironmentApi = (id: number, data: EnvironmentUpdateParams) => {
    return http.put<Environment>(`${BASE_URL}/environments/${id}`, data)
}

/** 删除环境 */
export const deleteEnvironmentApi = (id: number) => {
    return http.delete(`${BASE_URL}/environments/${id}`)
}

// ==================== 服务树节点管理 ====================

/** 获取节点列表 */
export const listNodesApi = (params?: ServiceTreeNodeListParams) => {
    return http.get<ListResponse<ServiceTreeNode>>(`${BASE_URL}/nodes`, { params })
}

/** 获取树结构 */
export const getTreeApi = (rootId?: number) => {
    return http.get<ServiceTreeNode>(`${BASE_URL}/tree`, { params: { root_id: rootId } })
}

/** 获取节点详情 */
export const getNodeApi = (id: number) => {
    return http.get<ServiceTreeNode>(`${BASE_URL}/nodes/${id}`)
}

/** 创建节点 */
export const createNodeApi = (data: ServiceTreeNodeCreateParams) => {
    return http.post<ServiceTreeNode>(`${BASE_URL}/nodes`, data)
}

/** 更新节点 */
export const updateNodeApi = (id: number, data: ServiceTreeNodeUpdateParams) => {
    return http.put<ServiceTreeNode>(`${BASE_URL}/nodes/${id}`, data)
}

/** 删除节点 */
export const deleteNodeApi = (id: number) => {
    return http.delete(`${BASE_URL}/nodes/${id}`)
}

/** 移动节点 */
export const moveNodeApi = (id: number, newParentId: number) => {
    return http.put(`${BASE_URL}/nodes/${id}/move`, { new_parent_id: newParentId })
}

// ==================== 资源绑定 ====================

/** 绑定资源到节点 */
export const bindResourceApi = (nodeId: number, data: ResourceBindingCreateParams) => {
    return http.post<ResourceBinding>(`${BASE_URL}/nodes/${nodeId}/bindings`, data)
}

/** 批量绑定资源 */
export const batchBindResourceApi = (nodeId: number, data: ResourceBindingBatchParams) => {
    return http.post(`${BASE_URL}/nodes/${nodeId}/bindings/batch`, data)
}

/** 获取节点绑定的资源 */
export const listNodeBindingsApi = (nodeId: number, params?: ResourceBindingListParams) => {
    return http.get<ListResponse<ResourceBinding>>(`${BASE_URL}/nodes/${nodeId}/bindings`, { params })
}

/** 解绑资源 */
export const unbindResourceApi = (bindingId: number) => {
    return http.delete(`${BASE_URL}/bindings/${bindingId}`)
}

/** 查询资源所属节点 */
export const getResourceNodeApi = (type: string, resourceId: number) => {
    return http.get<ServiceTreeNode>(`${BASE_URL}/resources/${type}/${resourceId}/node`)
}

// ==================== 绑定规则 ====================

/** 获取规则列表 */
export const listRulesApi = (params?: BindingRuleListParams) => {
    return http.get<ListResponse<BindingRule>>(`${BASE_URL}/rules`, { params })
}

/** 创建规则 */
export const createRuleApi = (data: BindingRuleCreateParams) => {
    return http.post<BindingRule>(`${BASE_URL}/rules`, data)
}

/** 更新规则 */
export const updateRuleApi = (id: number, data: BindingRuleUpdateParams) => {
    return http.put<BindingRule>(`${BASE_URL}/rules/${id}`, data)
}

/** 删除规则 */
export const deleteRuleApi = (id: number) => {
    return http.delete(`${BASE_URL}/rules/${id}`)
}

/** 执行规则匹配 */
export const executeRulesApi = () => {
    return http.post(`${BASE_URL}/rules/execute`)
}
