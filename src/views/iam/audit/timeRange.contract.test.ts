/**
 * 契约测试：IAM 审计时间范围必须按后端可解析的 "YYYY-MM-DD HH:mm:ss" 传递。
 *
 * 后端 audit_handler.go 用 time.Parse("2006-01-02 15:04:05")，前端若用
 * toISOString() 会直接 400（实测报 "开始时间格式错误: parsing time ..."）。
 * Element Plus 日期面板在 happy-dom 下无法稳定驱动，故用源码契约 + 纯函数断言守护。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatEpochDateTime } from '@/utils/epoch'

const source = readFileSync(join(__dirname, 'index.vue'), 'utf8')

describe('IAM 审计时间范围格式', () => {
    it('页面不再使用 toISOString() 传时间参数', () => {
        expect(source).not.toMatch(/toISOString\(\)\s*$/m)
        expect(source).not.toMatch(/filters\.start_time\s*=\s*[^\n]*toISOString/)
        expect(source).not.toMatch(/filters\.end_time\s*=\s*[^\n]*toISOString/)
    })

    it('改用 formatEpochDateTime 生成后端可解析格式', () => {
        expect(source).toMatch(/filters\.start_time\s*=\s*formatEpochDateTime\(/)
        expect(source).toMatch(/filters\.end_time\s*=\s*formatEpochDateTime\(/)
    })

    it('生成的时间串能被后端 Go 布局解析（形状校验）', () => {
        const out = formatEpochDateTime(Date.UTC(2026, 9, 29, 8, 30, 0))
        expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        expect(out).not.toContain('T')
        expect(out).not.toContain('Z')
    })
})
