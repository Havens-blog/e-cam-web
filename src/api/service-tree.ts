/**
 * 服务树 API
 */
import instance, { API_SERVICE } from './request/service'
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
    return instance.post({ url: `${BASE_URL}/environments/init` })
}

/** 获取环境列表 */
export const listEnvironmentsApi = (params?: EnvironmentListParams) => {
    return instance.get<ListResponse<Environment>>({ url: `${BASE_URL}/environments`, params })
}

/** 创建环境 */
export const createEnvironmentApi = (data: EnvironmentCreateParams) => {
    return instance.post<Environment>({ url: `${BASE_URL}/environments`, data })
}

/** 更新环境 */
export const updateEnvironmentApi = (id: number, data: EnvironmentUpdateParams) => {
    return instance.put<Environment>({ url: `${BASE_URL}/environments/${id}`, data })
}

/** 删除环境 */
export const deleteEnvironmentApi = (id: number) => {
    return instance.delete({ url: `${BASE_URL}/environments/${id}` })
}

// ==================== 服务树节点管理 ====================

/** 获取节点列表 */
export const listNodesApi = (params?: ServiceTreeNodeListParams) => {
    return instance.get<ListResponse<ServiceTreeNode>>({ url: `${BASE_URL}/nodes`, params })
}

/** 获取树结构 */
export const getTreeApi = (rootId?: number) => {
    return instance.get<ServiceTreeNode>({ url: `${BASE_URL}/tree`, params: { root_id: rootId } })
}

/** 获取节点详情 */
export const getNodeApi = (id: number) => {
    return instance.get<ServiceTreeNode>({ url: `${BASE_URL}/nodes/${id}` })
}

/** 创建节点 */
export const createNodeApi = (data: ServiceTreeNodeCreateParams) => {
    return instance.post<ServiceTreeNode>({ url: `${BASE_URL}/nodes`, data })
}

/** 更新节点 */
export const updateNodeApi = (id: number, data: ServiceTreeNodeUpdateParams) => {
    return instance.put<ServiceTreeNode>({ url: `${BASE_URL}/nodes/${id}`, data })
}

/** 删除节点 */
export const deleteNodeApi = (id: number) => {
    return instance.delete({ url: `${BASE_URL}/nodes/${id}` })
}

/** 移动节点 */
export const moveNodeApi = (id: number, newParentId: number) => {
    return instance.put({ url: `${BASE_URL}/nodes/${id}/move`, data: { new_parent_id: newParentId } })
}

// ==================== 资源绑定 ====================

/** 绑定资源到节点 */
export const bindResourceApi = (nodeId: number, data: ResourceBindingCreateParams) => {
    return instance.post<ResourceBinding>({ url: `${BASE_URL}/nodes/${nodeId}/bindings`, data })
}

/** 批量绑定资源 */
export const batchBindResourceApi = (nodeId: number, data: ResourceBindingBatchParams) => {
    return instance.post({ url: `${BASE_URL}/nodes/${nodeId}/bindings/batch`, data })
}

/** 获取节点绑定的资源 */
export const listNodeBindingsApi = (nodeId: number, params?: ResourceBindingListParams) => {
    return instance.get<ListResponse<ResourceBinding>>({ url: `${BASE_URL}/nodes/${nodeId}/bindings`, params })
}

/** 解绑资源 */
export const unbindResourceApi = (bindingId: number) => {
    return instance.delete({ url: `${BASE_URL}/bindings/${bindingId}` })
}

/** 查询资源所属节点 */
export const getResourceNodeApi = (type: string, resourceId: number) => {
    return instance.get<ServiceTreeNode>({ url: `${BASE_URL}/resources/${type}/${resourceId}/node` })
}

// ==================== 绑定规则 ====================

/** 获取规则列表 */
export const listRulesApi = (params?: BindingRuleListParams) => {
    return instance.get<ListResponse<BindingRule>>({ url: `${BASE_URL}/rules`, params })
}

/** 创建规则 */
export const createRuleApi = (data: BindingRuleCreateParams) => {
    return instance.post<BindingRule>({ url: `${BASE_URL}/rules`, data })
}

/** 更新规则 */
export const updateRuleApi = (id: number, data: BindingRuleUpdateParams) => {
    return instance.put<BindingRule>({ url: `${BASE_URL}/rules/${id}`, data })
}

/** 删除规则 */
export const deleteRuleApi = (id: number) => {
    return instance.delete({ url: `${BASE_URL}/rules/${id}` })
}

/** 执行规则匹配 */
export const executeRulesApi = () => {
    return instance.post({ url: `${BASE_URL}/rules/execute` })
}
