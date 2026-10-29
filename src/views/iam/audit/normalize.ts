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
}

const isZeroTime = (value?: string) => !value || value.startsWith('0001-01-01')

export function normalizeAuditLog(raw: RawAuditLog): AuditLog {
    const time =
        !isZeroTime(raw.operation_time) ? String(raw.operation_time) : formatEpochDateTime(raw.ctime ?? null)

    return {
        ...(raw as AuditLog),
        operator: raw.operator || raw.operator_name || raw.operator_id || '-',
        operation_time: time === '-' ? '-' : time,
        operation_result: (raw.operation_result || raw.result || '') as AuditLog['operation_result'],
    }
}

export function normalizeAuditLogs(list: RawAuditLog[] | null | undefined): AuditLog[] {
    return Array.isArray(list) ? list.map(normalizeAuditLog) : []
}
