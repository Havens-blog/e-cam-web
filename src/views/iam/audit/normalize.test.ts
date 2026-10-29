import { describe, expect, it } from 'vitest'
import { normalizeAuditLog, normalizeAuditLogs } from './normalize'

const RAW = {
    id: 6952,
    operation_type: 'api_log_create',
    operator_id: '1',
    operator_name: 'admin',
    target_type: '',
    target_name: '',
    result: 'success',
    ctime: 1793256138842,
    create_time: '0001-01-01T00:00:00Z',
} as never

describe('normalizeAuditLog', () => {
    it('操作人回填 operator_name（表格绑定的是 operator）', () => {
        const log = normalizeAuditLog(RAW)
        expect(log.operator).toBe('admin')
    })

    it('操作时间用毫秒 ctime，而不是零值 create_time', () => {
        const log = normalizeAuditLog(RAW)
        expect(log.operation_time).toMatch(/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        expect(log.operation_time).not.toContain('0001')
    })

    it('结果字段兼容 result', () => {
        expect(normalizeAuditLog(RAW).operation_result).toBe('success')
    })

    it('后端已给 operation_time 时保持原值', () => {
        const log = normalizeAuditLog({ ...(RAW as Record<string, unknown>), operation_time: '2026-10-29 12:00:00' } as never)
        expect(log.operation_time).toBe('2026-10-29 12:00:00')
    })

    it('缺失字段时用 - 兜底', () => {
        const log = normalizeAuditLog({ id: 1 } as never)
        expect(log.operator).toBe('-')
        expect(log.operation_time).toBe('-')
    })

    it('normalizeAuditLogs 处理空值', () => {
        expect(normalizeAuditLogs(null)).toEqual([])
        expect(normalizeAuditLogs([RAW])).toHaveLength(1)
    })
})
