/**
 * 策略模板详情页纯逻辑用例。
 *
 * 重点锚定本轮真实修复的语义：
 * 1. **"不存在"必须是 404/404013**（后端此前误报 500，前端无从区分）⇒ 详情页要给出"返回列表"而不是"重试"；
 * 2. 错误信息只取**可展示文案**（响应体 msg → Error.message），不铺原始堆栈；
 * 3. 解包兼容"信封/直返"两种形状，且**残缺对象不得被当成有效模板**（否则页面会渲染半张空表）。
 */
import { describe, expect, it } from 'vitest'
import {
    TEMPLATE_NOT_FOUND_CODE,
    isTemplateNotFound,
    policyRows,
    templateErrorMessage,
    unpackTemplateDetail,
} from './detail-data'
import type { PermissionPolicy, PolicyTemplate } from '@/api/types/iam'

function tpl(partial: Partial<PolicyTemplate> = {}): PolicyTemplate {
    return {
        id: 7,
        name: '只读权限模板',
        category: 'read_only',
        description: 'desc',
        cloud_platforms: ['aliyun'],
        policies: [],
        is_built_in: true,
        tenant_id: '3',
        create_time: '2026-10-31T00:00:00Z',
        update_time: '2026-10-31T00:00:00Z',
        ...partial,
    } as PolicyTemplate
}

describe('isTemplateNotFound', () => {
    it('**回归**：HTTP 404 视为不存在（后端修复后即此语义）', () => {
        expect(isTemplateNotFound({ response: { status: 404 } })).toBe(true)
    })

    it('**回归**：领域码 404013 也视为不存在（兼容后端仍返回 500 的旧行为）', () => {
        expect(isTemplateNotFound({ response: { status: 500, data: { code: TEMPLATE_NOT_FOUND_CODE } } })).toBe(true)
    })

    it('其他错误不当作不存在（应走"重试"分支）', () => {
        expect(isTemplateNotFound({ response: { status: 500, data: { code: 500 } } })).toBe(false)
        expect(isTemplateNotFound(new Error('network'))).toBe(false)
        expect(isTemplateNotFound(null)).toBe(false)
    })
})

describe('templateErrorMessage', () => {
    it('优先使用响应体 msg（后端可读文案）', () => {
        expect(templateErrorMessage({ response: { data: { msg: 'policy template not found' } } })).toBe('policy template not found')
    })

    it('退到 Error.message，最后才是兜底文案', () => {
        expect(templateErrorMessage({ message: 'Network Error' })).toBe('Network Error')
        expect(templateErrorMessage({})).toBe('模板详情加载失败')
        expect(templateErrorMessage(undefined, '自定义兜底')).toBe('自定义兜底')
    })

    it('空白 msg 不得当成有效信息', () => {
        expect(templateErrorMessage({ response: { data: { msg: '   ' } }, message: 'boom' })).toBe('boom')
    })
})

describe('unpackTemplateDetail', () => {
    it('兼容信封 {code,msg,data}', () => {
        expect(unpackTemplateDetail({ code: 200, data: tpl() })?.id).toBe(7)
    })

    it('兼容直返模板对象', () => {
        expect(unpackTemplateDetail(tpl())?.name).toBe('只读权限模板')
    })

    it('**回归**：残缺对象/空响应不得当作有效模板', () => {
        expect(unpackTemplateDetail({ code: 200, data: { id: 7 } })).toBeNull()
        expect(unpackTemplateDetail({ code: 200 })).toBeNull()
        expect(unpackTemplateDetail(null)).toBeNull()
    })
})

describe('policyRows', () => {
    const p = (id: string): PermissionPolicy => ({ policy_id: id, policy_name: id, policy_type: 'custom' as never, policy_document: '{}', provider: 'aliyun' as never })

    it('按策略 ID 稳定排序（同一份数据每次渲染顺序一致）', () => {
        expect(policyRows([p('b'), p('a'), p('c')]).map((x) => x.policy_id)).toEqual(['a', 'b', 'c'])
    })

    it('入参缺失/非数组时返回空数组（页面渲染空表而不是崩）', () => {
        expect(policyRows(undefined)).toEqual([])
        expect(policyRows(null)).toEqual([])
    })
})
