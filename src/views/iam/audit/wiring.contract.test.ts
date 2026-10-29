/**
 * 接线契约：IAM 审计页必须消费 normalizeAuditLogs 的结果。
 *
 * 背景：后端返回 operator_name / ctime，表格绑定 operator / operation_time。
 * 只测 normalize.ts 无法防止「页面又把原始数据直接赋给 logList」这种回归
 * （Element Plus 表格在 happy-dom 下无法挂载，故用源码契约测试守护接线点）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, 'index.vue'), 'utf8')

describe('IAM 审计页字段归一接线', () => {
    it('列表赋值经过 normalizeAuditLogs', () => {
        expect(source).toMatch(/logList\.value\s*=\s*normalizeAuditLogs\(/)
    })

    it('不再直接把接口原始数组赋给 logList', () => {
        expect(source).not.toMatch(/logList\.value\s*=\s*res\.data\.data\s*\?\?/)
    })

    it('引入 normalize 模块', () => {
        expect(source).toMatch(/from '\.\/normalize'/)
    })
})
