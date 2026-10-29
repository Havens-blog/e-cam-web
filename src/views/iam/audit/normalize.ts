/**
 * IAM 审计日志字段归一。
 *
 * 后端 `/api/v1/cam/iam/audit/logs` 实际返回字段与前端表格绑定不一致：
 * - 操作人：后端 `operator_name`，表格绑定 `operator`（`operator_id` 为字符串 id）
 * - 时间：后端用的是毫秒 `ctime`；`create_time` 是零值 `0001-01-01T00:00:00Z`（不可用）
 * - 结果：后端 `result`（表格模板已按 `result` 渲染，`operation_result` 恒空）
 *
 * 这里统一成表格/详情使用的形状，避免页面各处分头兜底。
 */
import { formatEpochDateTime } from '@/utils/epoch'
import type { AuditLog } from '@/api/types/iam'

type RawAuditLog = Partial<AuditLog> & {
    operator_name?: string
    ctime?: number | string
    create_time?: string
    result?: string
    cloud_platform?: string
}

/** 后端零值 / 空串 / 纯空白都视为「没有时间」，数字等非字符串一律不解析 */
function isValidTime(value: unknown): value is string | number {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    return trimmed !== '' && !trimmed.startsWith('0001-01-01')
}

export function normalizeAuditLog(raw: RawAuditLog): AuditLog {
    const time = isValidTime(raw.operation_time)
        ? String(raw.operation_time)
        : formatEpochDateTime(raw.ctime ?? null)

    return {
        ...(raw as AuditLog),
        // 审计场景下「有 id 无名字」不能直接显示成 1，用 #id 明确这是标识而非人名
        operator: raw.operator || raw.operator_name || (raw.operator_id ? `#${raw.operator_id}` : '-'),
        operation_time: time,
        // 云平台：后端只给 cloud_platform，页面模板读 provider（同根因，一并归一）
        provider: (raw.provider || raw.cloud_platform) as AuditLog['provider'],
        cloud_platform: (raw.cloud_platform || raw.provider) as AuditLog['cloud_platform'],
        // 表格与详情都读 result；operation_result 保留同值以兼容旧绑定
        operation_result: (raw.operation_result || raw.result || '') as AuditLog['operation_result'],
    }
}

export function normalizeAuditLogs(list: RawAuditLog[] | null | undefined): AuditLog[] {
    return Array.isArray(list) ? list.map(normalizeAuditLog) : []
}
