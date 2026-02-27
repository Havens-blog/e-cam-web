/**
 * 审计日志与变更历史 API
 */

import instance, { API_SERVICE } from './request/service'


// ==================== 类型定义 ====================

/** 审计日志 */
export interface AuditLog {
    id: number
    operation_type: string
    operator_id: string
    operator_name: string
    tenant_id: string
    http_method: string
    api_path: string
    request_body: string
    status_code: number
    result: string
    request_id: string
    duration_ms: number
    client_ip: string
    user_agent: string
    ctime: number
}

/** 审计日志查询参数 */
export interface AuditLogParams {
    operation_type?: string
    operator_id?: string
    http_method?: string
    api_path?: string
    request_id?: string
    status_code?: number
    start_time?: number
    end_time?: number
    offset?: number
    limit?: number
}

/** 审计报告 */
export interface AuditReport {
    tenant_id: string
    start_time: number
    end_time: number
    total_operations: number
    success_count: number
    failed_count: number
    by_operation_type: Record<string, number>
    by_http_method: Record<string, number>
    top_endpoints: { path: string; method: string; count: number }[]
    top_operators: { operator_id: string; operator_name: string; count: number }[]
}

/** 资产变更记录 */
export interface AssetChange {
    id: number
    asset_id: string
    asset_name: string
    model_uid: string
    tenant_id: string
    account_id: number
    provider: string
    region: string
    field_name: string
    old_value: string
    new_value: string
    change_source: string
    change_task_id: string
    ctime: number
}

/** 资产变更查询参数 */
export interface AssetChangeParams {
    field_name?: string
    start_time?: number
    end_time?: number
    offset?: number
    limit?: number
}

/** 变更统计汇总 */
export interface ChangeSummary {
    total: number
    by_resource_type: Record<string, number>
    by_field: Record<string, number>
    by_provider: Record<string, number>
}

interface ListResponse<T> {
    items: T[]
    total: number
}

// ==================== 审计日志 API ====================

/** 查询审计日志列表 */
export function listAuditLogsApi(params?: AuditLogParams) {
    return instance.get<ListResponse<AuditLog>>({
        url: `${API_SERVICE.CAM}/audit/logs`,
        params,
    })
}

/** 导出审计日志 */
export function exportAuditLogsApi(params?: AuditLogParams & { format?: 'csv' | 'json' }) {
    return instance.get<Blob>({
        url: `${API_SERVICE.CAM}/audit/logs/export`,
        params,
        responseType: 'blob',
    } as any)
}

/** 生成审计报告 */
export function generateAuditReportApi(data: { start_time: number; end_time: number }) {
    return instance.post<AuditReport>({
        url: `${API_SERVICE.CAM}/audit/reports`,
        data,
    })
}

// ==================== 资产变更历史 API ====================

/** 查询资产变更历史 */
export function listAssetChangesApi(assetId: string, params?: AssetChangeParams) {
    return instance.get<ListResponse<AssetChange>>({
        url: `${API_SERVICE.CAM}/audit/changes`,
        params: { ...params, asset_id: assetId },
    })
}

/** 获取变更统计汇总 */
export function getChangeSummaryApi(params?: {
    model_uid?: string
    provider?: string
    start_time?: number
    end_time?: number
}) {
    return instance.get<ChangeSummary>({
        url: `${API_SERVICE.CAM}/audit/changes/summary`,
        params,
    })
}
