// @vitest-environment happy-dom
/**
 * 日志导出权限判定回归:admin/权限码/默认放行三态。
 */
import { describe, expect, it } from 'vitest'
import { CAM_LOGS_EXPORT_PERMISSION, canExportLogs } from './export-permission'

describe('canExportLogs', () => {
    it('admin 默认可导出', () => {
        expect(canExportLogs(true, [])).toBe(true)
        expect(canExportLogs(true, ['other:code'])).toBe(true)
    })

    it('持有 cam:logs:export 权限码可导出', () => {
        expect(canExportLogs(false, [CAM_LOGS_EXPORT_PERMISSION])).toBe(true)
    })

    it('默认放行:权限清单为空时向后兼容,不阻断', () => {
        expect(canExportLogs(false, [])).toBe(true)
    })

    it('非 admin 且权限清单非空、不含导出码时拒绝', () => {
        expect(canExportLogs(false, ['cam:asset:view'])).toBe(false)
    })
})
