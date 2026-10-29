/**
 * 契约测试：IAM 审计的时间范围必须按后端可解析的 "YYYY-MM-DD HH:mm:ss"（UTC 墙钟）传递。
 *
 * 后端 audit_handler.go 用 time.Parse("2006-01-02 15:04:05")，Go 无时区标识按 UTC 解释：
 *  - 传 toISOString()（带 T/Z）→ 400；
 *  - 传本地墙钟 → 整体偏移 8 小时（UTC+8）。
 * 列表、导出、报告三个入口共用同一格式，任一漏改都会 400，故扫描整个 iam/audit 目录。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toBackendDateTime } from '@/utils/epoch'

const ROOT = __dirname

function collectVue(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) collectVue(full, acc)
        else if (entry.endsWith('.vue')) acc.push(full)
    }
    return acc
}

const files = collectVue(ROOT)

describe('IAM 审计时间范围格式', () => {
    it('覆盖列表页与两个对话框', () => {
        const names = files.map((f) => f.replace(ROOT, ''))
        expect(names.some((n) => n.includes('index.vue'))).toBe(true)
        expect(names.some((n) => n.includes('ExportDialog.vue'))).toBe(true)
        expect(names.some((n) => n.includes('ReportDialog.vue'))).toBe(true)
    })

    it('任何 Vue 文件都不再把 toISOString() 直接作为查询参数', () => {
        const offenders = files.filter((f) => {
            const src = readFileSync(f, 'utf8')
            return src.split('\n').some((line) => (line.includes('start_time') || line.includes('end_time')) && line.includes('toISOString'))
        })
        expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([])
    })

    it('三处都使用 toBackendDateTime', () => {
        for (const f of files) {
            const src = readFileSync(f, 'utf8')
            if (src.includes('start_time') || src.includes('end_time')) {
                expect(src, f).toContain('toBackendDateTime')
            }
        }
    })

    it('生成的串能被后端 Go 布局解析，且是 UTC 墙钟', () => {
        const out = toBackendDateTime(Date.UTC(2026, 9, 29, 8, 30, 0))
        expect(out).toBe('2026-10-29 08:30:00')
        expect(out).not.toContain('T')
        expect(out).not.toContain('Z')
    })
})
