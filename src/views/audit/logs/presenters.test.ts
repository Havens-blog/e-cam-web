/**
 * 操作审计页展示层纯函数回归:log_search 标签/颜色与「部分成功」结果文案。
 * 从组件抽离为纯函数后无需挂载 el-table(其 MutationObserver 与 happy-dom
 * 存在私有成员兼容冲突),直接在无 DOM 环境下断言展示规则。
 */
import { describe, expect, it } from 'vitest'
import { opTypeLabel, opTypeTag, resultLabel } from './presenters'

describe('audit logs presenters', () => {
    it('maps log_search to 日志查询 with primary tag', () => {
        expect(opTypeLabel('log_search', [])).toBe('日志查询')
        expect(opTypeTag('log_search')).toBe('primary')
    })

    it('falls back to dictionary label for known types', () => {
        const options = [{ value: 'api_account_create', label: '创建云账号' }]
        expect(opTypeLabel('api_account_create', options)).toBe('创建云账号')
        expect(opTypeLabel('unknown', options)).toBe('unknown')
    })

    it('maps result to readable status', () => {
        expect(resultLabel('success')).toBe('成功')
        expect(resultLabel('partial')).toBe('部分成功')
        expect(resultLabel('failed')).toBe('失败')
    })
})
