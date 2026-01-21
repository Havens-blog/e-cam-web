/**
 * IAM (Identity and Access Management) API
 * 身份与访问管理 API 接口
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type * as iam from './types/iam'

// IAM API 响应拦截器 - 处理不同的响应格式
function createIamApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data

            // IAM API 使用 code: 200 表示成功，需要转换为系统标准的 code: 0
            if (data.code === 200) {
                // 保留 total、page、size 等分页信息
                const { msg, message, data: responseData, ...rest } = data
                response.data = {
                    code: 0,
                    data: { data: responseData, ...rest },
                    message: msg || message || 'success'
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

// ==================== 租户管理 API ====================

/** 查询租户列表 */
export function listTenantsApi(params: iam.ListTenantsParams) {
    return instance.get<iam.ListTenantsResponse>({
        url: `${API_SERVICE.CAM}/iam/tenants`,
        params,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 创建租户 */
export function createTenantApi(data: iam.CreateTenantRequest) {
    return instance.post<iam.Tenant>({
        url: `${API_SERVICE.CAM}/iam/tenants`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取租户详情 */
export function getTenantDetailApi(tenantId: string) {
    return instance.get<iam.Tenant>({
        url: `${API_SERVICE.CAM}/iam/tenants/${tenantId}`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 更新租户信息 */
export function updateTenantApi(tenantId: string, data: iam.UpdateTenantRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/iam/tenants/${tenantId}`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 删除租户 */
export function deleteTenantApi(tenantId: string) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/iam/tenants/${tenantId}`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取租户统计信息 */
export function getTenantStatsApi(tenantId: string) {
    return instance.get<iam.TenantStats>({
        url: `${API_SERVICE.CAM}/iam/tenants/${tenantId}/stats`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

// ==================== 用户管理 API ====================

/** 查询用户列表 */
export function listUsersApi(params: iam.ListUsersParams) {
    const { tenant_id, ...restParams } = params
    return instance.get<iam.ListUsersResponse>({
        url: `${API_SERVICE.CAM}/iam/users`,
        params: restParams,
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}


/** 创建云用户 */
export function createUserApi(data: iam.CreateUserRequest) {
    const { tenant_id, ...restData } = data
    return instance.post<iam.CloudUser>({
        url: `${API_SERVICE.CAM}/iam/users`,
        data: restData,
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取用户详情 */
export function getUserDetailApi(id: number, tenantId?: string) {
    return instance.get<iam.CloudUser>({
        url: `${API_SERVICE.CAM}/iam/users/${id}`,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 更新用户信息 */
export function updateUserApi(id: number, data: iam.UpdateUserRequest, tenantId?: string) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/iam/users/${id}`,
        data,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 删除用户 */
export function deleteUserApi(id: number, tenantId?: string) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/iam/users/${id}`,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 同步云平台用户 */
export function syncUsersApi(data: iam.SyncUsersRequest) {
    const { tenant_id, cloud_account_id } = data
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/iam/users/sync`,
        params: { cloud_account_id },
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 批量分配权限组 */
export function batchAssignGroupsApi(data: iam.BatchAssignRequest) {
    const { tenant_id, ...restData } = data
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/iam/users/batch-assign`,
        data: restData,
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

// ==================== 权限组管理 API ====================

/** 查询权限组列表 */
export function listGroupsApi(params: iam.ListGroupsParams) {
    const { tenant_id, ...restParams } = params
    return instance.get<iam.ListGroupsResponse>({
        url: `${API_SERVICE.CAM}/iam/groups`,
        params: restParams,
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 创建权限组 */
export function createGroupApi(data: iam.CreateGroupRequest) {
    const { tenant_id, ...restData } = data
    return instance.post<iam.PermissionGroup>({
        url: `${API_SERVICE.CAM}/iam/groups`,
        data: restData,
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取权限组详情 */
export function getGroupDetailApi(id: number, tenantId?: string) {
    return instance.get<iam.PermissionGroup>({
        url: `${API_SERVICE.CAM}/iam/groups/${id}`,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 更新权限组信息 */
export function updateGroupApi(id: number, data: iam.UpdateGroupRequest, tenantId?: string) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/iam/groups/${id}`,
        data,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 删除权限组 */
export function deleteGroupApi(id: number, tenantId?: string) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/iam/groups/${id}`,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 更新权限组的权限策略 */
export function updateGroupPoliciesApi(id: number, data: iam.UpdatePoliciesRequest, tenantId?: string) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/iam/groups/${id}/policies`,
        data,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 同步云平台用户组 */
export function syncGroupsApi(data: { tenant_id?: string; cloud_account_id: number }) {
    const { tenant_id, cloud_account_id } = data
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/iam/groups/sync`,
        params: { cloud_account_id },
        headers: tenant_id ? { 'X-Tenant-ID': tenant_id } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取用户组成员列表 */
export function getGroupMembersApi(id: number, tenantId?: string) {
    return instance.get<iam.CloudUser[]>({
        url: `${API_SERVICE.CAM}/iam/groups/${id}/members`,
        headers: tenantId ? { 'X-Tenant-ID': tenantId } : undefined,
        interceptorsToOnce: createIamApiInterceptor()
    })
}


// ==================== 策略模板管理 API ====================

/** 查询策略模板列表 */
export function listTemplatesApi(params: iam.ListTemplatesParams) {
    return instance.get<iam.ListTemplatesResponse>({
        url: `${API_SERVICE.CAM}/iam/templates`,
        params,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 创建策略模板 */
export function createTemplateApi(data: iam.CreateTemplateRequest) {
    return instance.post<iam.PolicyTemplate>({
        url: `${API_SERVICE.CAM}/iam/templates`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 从权限组创建策略模板 */
export function createTemplateFromGroupApi(data: iam.CreateFromGroupRequest) {
    return instance.post<iam.PolicyTemplate>({
        url: `${API_SERVICE.CAM}/iam/templates/from-group`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取策略模板详情 */
export function getTemplateDetailApi(id: number) {
    return instance.get<iam.PolicyTemplate>({
        url: `${API_SERVICE.CAM}/iam/templates/${id}`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 更新策略模板信息 */
export function updateTemplateApi(id: number, data: iam.UpdateTemplateRequest) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/iam/templates/${id}`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 删除策略模板 */
export function deleteTemplateApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/iam/templates/${id}`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

// ==================== 审计日志 API ====================

/** 查询审计日志列表 */
export function listAuditLogsApi(params: iam.ListAuditLogsParams) {
    return instance.get<iam.ListAuditLogsResponse>({
        url: `${API_SERVICE.CAM}/iam/audit/logs`,
        params,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 导出审计日志 */
export function exportAuditLogsApi(params: iam.ExportAuditLogsParams) {
    return instance.get<Blob>({
        url: `${API_SERVICE.CAM}/iam/audit/logs/export`,
        params,
        responseType: 'blob',
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 生成审计报告 */
export function generateAuditReportApi(data: iam.GenerateAuditReportRequest) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/iam/audit/reports`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}


// ==================== 同步任务管理 API ====================

/** 查询同步任务列表 */
export function listSyncTasksApi(params: iam.ListSyncTasksParams) {
    return instance.get<iam.ListSyncTasksResponse>({
        url: `${API_SERVICE.CAM}/iam/sync/tasks`,
        params,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 创建同步任务 */
export function createSyncTaskApi(data: iam.CreateSyncTaskRequest) {
    return instance.post<iam.SyncTask>({
        url: `${API_SERVICE.CAM}/iam/sync/tasks`,
        data,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 获取同步任务状态 */
export function getSyncTaskStatusApi(id: number) {
    return instance.get<iam.SyncTaskStatusResponse>({
        url: `${API_SERVICE.CAM}/iam/sync/tasks/${id}`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}

/** 重试失败的同步任务 */
export function retrySyncTaskApi(id: number) {
    return instance.post<void>({
        url: `${API_SERVICE.CAM}/iam/sync/tasks/${id}/retry`,
        interceptorsToOnce: createIamApiInterceptor()
    })
}
