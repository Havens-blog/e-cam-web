/**
 * CMDB (配置管理数据�? API
 * 资源模型和实例管理接�?
 */

import type { AxiosResponse } from 'axios'
import instance from './request/service'
import type * as cmdb from './types/cmdb'

// CMDB API 响应拦截�?
function createCmdbApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data

            if (data.code === 200) {
                response.data = {
                    code: 0,
                    data: data.data,
                    message: data.msg || data.message || 'success'
                }
                return response
            }

            if (data.code === 0) {
                return response
            }

            if (data.code === undefined) {
                response.data = {
                    code: 0,
                    data: data,
                    message: 'success'
                }
                return response
            }

            return response
        }
    }
}

// ==================== 模型管理 API ====================

/** 创建模型 */
export function createCmdbModelApi(data: cmdb.CreateModelReq) {
    return instance.post<cmdb.CreateModelResp>({
        url: `/cam/cmdb/models`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型列表 */
export function listCmdbModelsApi(params: cmdb.ListModelsParams) {
    return instance.get<cmdb.ModelListResp>({
        url: `/cam/cmdb/models`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型详情 */
export function getCmdbModelApi(uid: string) {
    return instance.get<cmdb.ModelResp>({
        url: `/cam/cmdb/models/${uid}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新模型 */
export function updateCmdbModelApi(uid: string, data: cmdb.UpdateModelReq) {
    return instance.put<cmdb.SuccessResp>({
        url: `/cam/cmdb/models/${uid}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除模型 */
export function deleteCmdbModelApi(uid: string) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/models/${uid}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 模型分组管理 API ====================

/** 创建模型分组 */
export function createModelGroupApi(data: cmdb.CreateModelGroupReq) {
    return instance.post<cmdb.CreateIDResp>({
        url: `/cam/cmdb/model-groups`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型分组列表 */
export function listModelGroupsApi(params?: { offset?: number; limit?: number }) {
    return instance.get<cmdb.ModelGroupListResp>({
        url: `/cam/cmdb/model-groups`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取分组列表及其下的模型 */
export function listModelGroupsWithModelsApi() {
    return instance.get<cmdb.ModelGroupWithModelsListResp>({
        url: `/cam/cmdb/model-groups/with-models`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 初始化内置分�?*/
export function initBuiltinModelGroupsApi() {
    return instance.post<cmdb.SuccessResp>({
        url: `/cam/cmdb/model-groups/init`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型分组详情 */
export function getModelGroupApi(uid: string) {
    return instance.get<cmdb.ModelGroupResp>({
        url: `/cam/cmdb/model-groups/${uid}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新模型分组 */
export function updateModelGroupApi(uid: string, data: cmdb.UpdateModelGroupReq) {
    return instance.put<cmdb.SuccessResp>({
        url: `/cam/cmdb/model-groups/${uid}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除模型分组 */
export function deleteModelGroupApi(uid: string) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/model-groups/${uid}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 实例管理 API ====================

/** 创建实例 */
export function createCmdbInstanceApi(data: cmdb.CreateInstanceReq) {
    return instance.post<cmdb.CreateInstanceResp>({
        url: `/cam/cmdb/instances`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取实例列表 */
export function listCmdbInstancesApi(params: cmdb.ListInstancesParams) {
    return instance.get<cmdb.InstanceListResp>({
        url: `/cam/instances`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 批量创建实例 */
export function createCmdbInstanceBatchApi(data: cmdb.CreateBatchInstanceReq) {
    return instance.post<cmdb.BatchCreateResp>({
        url: `/cam/cmdb/instances/batch`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新或插入实�?*/
export function upsertCmdbInstanceApi(data: cmdb.UpsertInstanceReq) {
    return instance.post<cmdb.SuccessResp>({
        url: `/cam/cmdb/instances/upsert`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 批量更新或插入实�?*/
export function upsertCmdbInstanceBatchApi(data: cmdb.UpsertBatchInstanceReq) {
    return instance.post<cmdb.SuccessResp>({
        url: `/cam/cmdb/instances/upsert-batch`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取实例详情 */
export function getCmdbInstanceApi(id: number) {
    return instance.get<cmdb.InstanceResp>({
        url: `/cam/cmdb/instances/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新实例 */
export function updateCmdbInstanceApi(id: number, data: cmdb.UpdateInstanceReq) {
    return instance.put<cmdb.SuccessResp>({
        url: `/cam/cmdb/instances/${id}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除实例 */
export function deleteCmdbInstanceApi(id: number) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/instances/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}


// ==================== 模型关系类型 API ====================

/** 创建模型关系类型 */
export function createModelRelationApi(data: cmdb.CreateModelRelationReq) {
    return instance.post<cmdb.CreateIDResp>({
        url: `/cam/cmdb/model-relations`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型关系类型列表 */
export function listModelRelationsApi(params: cmdb.ListModelRelationsParams) {
    return instance.get<cmdb.ModelRelationListResp>({
        url: `/cam/cmdb/model-relations`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型关系类型详情 */
export function getModelRelationApi(uid: string) {
    return instance.get<cmdb.ModelRelationResp>({
        url: `/cam/cmdb/model-relations/${uid}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新模型关系类型 */
export function updateModelRelationApi(uid: string, data: cmdb.UpdateModelRelationReq) {
    return instance.put<cmdb.SuccessResp>({
        url: `/cam/cmdb/model-relations/${uid}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除模型关系类型 */
export function deleteModelRelationApi(uid: string) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/model-relations/${uid}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 实例关系 API ====================

/** 创建实例关系 */
export function createInstanceRelationApi(data: cmdb.CreateInstanceRelationReq) {
    return instance.post<cmdb.CreateIDResp>({
        url: `/cam/cmdb/instance-relations`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取实例关系列表 */
export function listInstanceRelationsApi(params: cmdb.ListInstanceRelationsParams) {
    return instance.get<cmdb.InstanceRelationListResp>({
        url: `/cam/cmdb/instance-relations`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 批量创建实例关系 */
export function createBatchInstanceRelationApi(data: cmdb.CreateBatchInstanceRelationReq) {
    return instance.post<cmdb.BatchCreateResp>({
        url: `/cam/cmdb/instance-relations/batch`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除实例关系 */
export function deleteInstanceRelationApi(id: number) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/instance-relations/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 拓扑 API ====================

/** 获取实例拓扑�?*/
export function getInstanceTopologyApi(id: number, params?: cmdb.GetInstanceTopologyParams) {
    return instance.get<cmdb.TopologyGraphResp>({
        url: `/cam/cmdb/topology/instance/${id}`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型拓扑�?*/
export function getModelTopologyApi(provider?: string) {
    return instance.get<cmdb.ModelTopologyGraphResp>({
        url: `/cam/cmdb/topology/model`,
        params: provider ? { provider } : undefined,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取关联实例列表 */
export function getRelatedInstancesApi(id: number, relationTypeUid?: string) {
    return instance.get<cmdb.RelatedInstancesResp>({
        url: `/cam/cmdb/topology/related/${id}`,
        params: relationTypeUid ? { relation_type_uid: relationTypeUid } : undefined,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 字段类型 API ====================

/** 获取字段类型列表 */
export function getFieldTypesApi() {
    return instance.get<cmdb.FieldTypesResp>({
        url: `/cam/cmdb/field-types`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 模型属�?API ====================

/** 创建模型属�?*/
export function createAttributeApi(modelUid: string, data: cmdb.CreateAttributeReq) {
    return instance.post<cmdb.CreateIDResp>({
        url: `/cam/cmdb/models/${modelUid}/attributes`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取模型属性列�?*/
export function listAttributesApi(modelUid: string, params?: cmdb.ListAttributesParams) {
    return instance.get<cmdb.AttributeListResp>({
        url: `/cam/cmdb/models/${modelUid}/attributes`,
        params,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取分组后的属性列�?*/
export function listAttributesWithGroupsApi(modelUid: string) {
    return instance.get<cmdb.AttributeGroupWithAttrsListResp>({
        url: `/cam/cmdb/models/${modelUid}/attributes/grouped`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取属性详�?*/
export function getAttributeApi(modelUid: string, id: number) {
    return instance.get<cmdb.AttributeResp>({
        url: `/cam/cmdb/models/${modelUid}/attributes/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新属�?*/
export function updateAttributeApi(modelUid: string, id: number, data: cmdb.UpdateAttributeReq) {
    return instance.put<cmdb.SuccessResp>({
        url: `/cam/cmdb/models/${modelUid}/attributes/${id}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除属�?*/
export function deleteAttributeApi(modelUid: string, id: number) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/models/${modelUid}/attributes/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

// ==================== 属性分�?API ====================

/** 创建属性分�?*/
export function createAttributeGroupApi(modelUid: string, data: cmdb.CreateAttributeGroupReq) {
    return instance.post<cmdb.CreateIDResp>({
        url: `/cam/cmdb/models/${modelUid}/attribute-groups`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取属性分组列�?*/
export function listAttributeGroupsApi(modelUid: string) {
    return instance.get<cmdb.AttributeGroupListResp>({
        url: `/cam/cmdb/models/${modelUid}/attribute-groups`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 获取属性分组详�?*/
export function getAttributeGroupApi(modelUid: string, id: number) {
    return instance.get<cmdb.AttributeGroupResp>({
        url: `/cam/cmdb/models/${modelUid}/attribute-groups/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 更新属性分�?*/
export function updateAttributeGroupApi(modelUid: string, id: number, data: cmdb.UpdateAttributeGroupReq) {
    return instance.put<cmdb.SuccessResp>({
        url: `/cam/cmdb/models/${modelUid}/attribute-groups/${id}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}

/** 删除属性分�?*/
export function deleteAttributeGroupApi(modelUid: string, id: number) {
    return instance.delete<cmdb.SuccessResp>({
        url: `/cam/cmdb/models/${modelUid}/attribute-groups/${id}`,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}
