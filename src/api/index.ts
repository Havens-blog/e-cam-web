/**
 * CAM (Cloud Asset Management) API
 * 多云资产管理 API 接口
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type * as account from './types/account'
import type * as asset from './types/asset'
import type * as cost from './types/cost'
import type * as field from './types/field'
import type * as model from './types/model'
import type * as statistics from './types/statistics'
import type * as task from './types/task'

// CAM API 响应拦截器 - 处理不同的响应格式
function createCamApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data

            // CAM API 使用 code: 200 表示成功，需要转换为系统标准的 code: 0
            if (data.code === 200) {
                response.data = {
                    code: 0,
                    data: data.data,
                    message: data.msg || data.message || 'success'
                }
                return response
            }

            // 如果已经是标准格式（code: 0），直接返回
            if (data.code === 0) {
                return response
            }

            // 如果没有 code 字段，将整个响应包装成标准格式
            if (data.code === undefined) {
                response.data = {
                    code: 0,
                    data: data,
                    message: 'success'
                }
                return response
            }

            // 其他情况直接返回，让全局拦截器处理
            return response
        }
    }
}

// ==================== 云账号管理 API ====================

/** 查询云账号列表 */
export function listCloudAccountsApi(params: account.ListAccountsParams) {
    return instance.get<account.ListAccountsResponse>({
        url: `${API_SERVICE.CAM}/cloud-accounts`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 创建云账号 */
export function createCloudAccountApi(data: account.CreateAccountRequest) {
    return instance.post<account.CreateAccountResponse>({
        url: `${API_SERVICE.CAM}/cloud-accounts`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新云账号 */
export function updateCloudAccountApi(id: number, data: account.UpdateAccountRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除云账号 */
export function deleteCloudAccountApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取云账号详情 */
export function getCloudAccountApi(id: number) {
    return instance.get<account.CloudAccount>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 测试云账号连接 */
export function testConnectionApi(id: number) {
    return instance.post<account.TestConnectionResponse>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}/test-connection`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 启用云账号 */
export function enableCloudAccountApi(id: number) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}/enable`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 禁用云账号 */
export function disableCloudAccountApi(id: number) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}/disable`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 同步云账号资产 */
export function syncCloudAccountApi(id: number, data: account.SyncRequest) {
    return instance.post<account.SyncResponse>({
        url: `${API_SERVICE.CAM}/cloud-accounts/${id}/sync`,
        data,
        timeout: 300000, // 5分钟超时，同步资产可能需要较长时间
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 资产管理 API ====================

/** 查询资产列表 */
export function listAssetsApi(params: asset.ListAssetsParams) {
    return instance.get<asset.AssetListResponse>({
        url: `${API_SERVICE.CAM}/assets`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取资产详情 */
export function getAssetDetailApi(id: number) {
    return instance.get<asset.Asset>({
        url: `${API_SERVICE.CAM}/assets/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新资产信息 */
export function updateAssetApi(id: number, data: Partial<asset.Asset>) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/assets/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除资产 */
export function deleteAssetApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/assets/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 统计 API ====================

/** 获取统计数据 */
export function getStatisticsApi() {
    return instance.get<statistics.StatisticsResponse>({
        url: `${API_SERVICE.CAM}/assets/statistics`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 成本分析 API ====================

/** 获取成本分析数据 */
export function getCostAnalysisApi(params: cost.CostAnalysisParams) {
    return instance.get<cost.CostAnalysisResponse>({
        url: `${API_SERVICE.CAM}/assets/cost-analysis`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 异步任务管理 API ====================

/** 获取任务列表 */
export function listTasksApi(params: task.ListTasksParams) {
    return instance.get<task.TaskListResponse>({
        url: `${API_SERVICE.CAM}/tasks`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取任务详情 */
export function getTaskDetailApi(id: string) {
    return instance.get<task.TaskDetailResponse>({
        url: `${API_SERVICE.CAM}/tasks/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 提交同步资产任务 */
export function submitSyncAssetsTaskApi(data: task.SubmitSyncAssetsTaskRequest) {
    return instance.post<task.SubmitTaskResponse>({
        url: `${API_SERVICE.CAM}/tasks/sync-assets`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 提交发现资产任务 */
export function submitDiscoverAssetsTaskApi(data: task.SubmitDiscoverAssetsTaskRequest) {
    return instance.post<task.SubmitTaskResponse>({
        url: `${API_SERVICE.CAM}/tasks/discover-assets`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 取消任务 */
export function cancelTaskApi(id: string) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/tasks/${id}/cancel`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除任务 */
export function deleteTaskApi(id: string) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/tasks/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 模型管理 API ====================

/** 获取模型列表 */
export function listModelsApi(params: model.ListModelsParams) {
    return instance.get<model.ListModelsResponse>({
        url: `${API_SERVICE.CAM}/models`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取模型详情 */
export function getModelDetailApi(uid: string) {
    return instance.get<model.Model>({
        url: `${API_SERVICE.CAM}/models/${uid}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 创建模型 */
export function createModelApi(data: model.CreateModelRequest) {
    return instance.post<model.Model>({
        url: `${API_SERVICE.CAM}/models`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新模型 */
export function updateModelApi(uid: string, data: model.UpdateModelRequest) {
    return instance.put<model.Model>({
        url: `${API_SERVICE.CAM}/models/${uid}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除模型 */
export function deleteModelApi(uid: string) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/models/${uid}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 字段管理 API ====================

/** 获取模型字段列表 */
export function listModelFieldsApi(modelUid: string) {
    return instance.get<field.ModelField[]>({
        url: `${API_SERVICE.CAM}/models/${modelUid}/fields`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 创建字段 */
export function createFieldApi(modelUid: string, data: field.CreateFieldRequest) {
    return instance.post<field.ModelField>({
        url: `${API_SERVICE.CAM}/models/${modelUid}/fields`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新字段 */
export function updateFieldApi(fieldUid: string, data: field.UpdateFieldRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/fields/${fieldUid}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除字段 */
export function deleteFieldApi(fieldUid: string) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/fields/${fieldUid}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 获取字段分组列表 */
export function listFieldGroupsApi(modelUid: string) {
    return instance.get<field.ModelFieldGroup[]>({
        url: `${API_SERVICE.CAM}/models/${modelUid}/field-groups`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 创建字段分组 */
export function createFieldGroupApi(modelUid: string, data: field.CreateFieldGroupRequest) {
    return instance.post<field.ModelFieldGroup>({
        url: `${API_SERVICE.CAM}/models/${modelUid}/field-groups`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 更新字段分组 */
export function updateFieldGroupApi(id: number, data: field.UpdateFieldGroupRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/field-groups/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

/** 删除字段分组 */
export function deleteFieldGroupApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/field-groups/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== CMDB 管理 API ====================

export {
    createBatchInstanceRelationApi,
    createCmdbInstanceApi,
    createCmdbInstanceBatchApi,
    createCmdbModelApi,
    createInstanceRelationApi,
    createModelGroupApi,
    createModelRelationApi,
    deleteCmdbInstanceApi,
    deleteCmdbModelApi,
    deleteInstanceRelationApi,
    deleteModelGroupApi,
    deleteModelRelationApi,
    getCmdbInstanceApi,
    getCmdbModelApi,
    getInstanceTopologyApi,
    getModelGroupApi,
    getModelRelationApi,
    getModelTopologyApi,
    getRelatedInstancesApi,
    initBuiltinModelGroupsApi,
    listCmdbInstancesApi,
    listCmdbModelsApi,
    listInstanceRelationsApi,
    listModelGroupsApi,
    listModelGroupsWithModelsApi,
    listModelRelationsApi,
    updateCmdbInstanceApi,
    updateCmdbModelApi,
    updateModelGroupApi,
    updateModelRelationApi,
    upsertCmdbInstanceApi,
    upsertCmdbInstanceBatchApi
} from './cmdb'

// ==================== IAM 用户管理 API ====================

export {
    batchAssignGroupsApi, createUserApi, deleteUserApi, getUserDetailApi, listUsersApi, syncUsersApi, updateUserApi
} from './iam'

// ==================== IAM 权限组管理 API ====================

export {
    createGroupApi, deleteGroupApi, getGroupDetailApi, getGroupMembersApi, listGroupsApi, syncGroupsApi, updateGroupApi, updateGroupPoliciesApi
} from './iam'

// ==================== IAM 策略模板管理 API ====================

export {
    createTemplateApi,
    createTemplateFromGroupApi, deleteTemplateApi, getTemplateDetailApi, listTemplatesApi, updateTemplateApi
} from './iam'

// ==================== IAM 审计日志 API ====================

export {
    exportAuditLogsApi,
    generateAuditReportApi, listAuditLogsApi
} from './iam'

// ==================== IAM 同步任务管理 API ====================

export {
    createSyncTaskApi,
    getSyncTaskStatusApi, listSyncTasksApi, retrySyncTaskApi
} from './iam'

