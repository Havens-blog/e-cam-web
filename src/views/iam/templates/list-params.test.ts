/**
 * 策略模板列表的纯逻辑用例。
 *
 * 重点锚定三件容易回归的事：
 * 1. **空筛选项不得上报**（否则后端把 '' 当有效分类，列表会莫名变空）；
 * 2. 分页默认值与后端一致（size=20）；
 * 3. 响应解包同时兼容"信封"与"直返"两种形状（仓内两种都存在）。
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATE_PAGE_SIZE, buildTemplateListParams, policyCount, unpackTemplateList } from './list-params'
import type { PolicyTemplate } from '@/api/types/iam'

function tpl(partial: Partial<PolicyTemplate> = {}): PolicyTemplate {
    return {
        id: 1,
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

describe('buildTemplateListParams', () => {
    it('**回归**：未选择的筛选（空串/undefined）不得出现在请求参数里', () => {
        const p = buildTemplateListParams({ keyword: '  ', category: '', isBuiltIn: '' }, 1)
        expect(p).toEqual({ page: 1, size: TEMPLATE_PAGE_SIZE })
        expect('keyword' in p).toBe(false)
        expect('category' in p).toBe(false)
        expect('is_built_in' in p).toBe(false)
    })

    it('关键字去空格后才上报', () => {
        expect(buildTemplateListParams({ keyword: '  只读  ' }, 1).keyword).toBe('只读')
    })

    it('分类与"是否内置"按选中值上报（false 也是有效值，不能丢）', () => {
        const p = buildTemplateListParams({ category: 'admin', isBuiltIn: false }, 2)
        expect(p.category).toBe('admin')
        expect(p.is_built_in).toBe(false)
        expect(p.page).toBe(2)
    })

    it('页码非法时回退到第 1 页；size 非法时回退默认 20', () => {
        expect(buildTemplateListParams({}, 0).page).toBe(1)
        expect(buildTemplateListParams({}, -3).page).toBe(1)
        expect(buildTemplateListParams({}, 1, 0).size).toBe(TEMPLATE_PAGE_SIZE)
    })
})

describe('unpackTemplateList', () => {
    it('兼容信封形状 {code,data:{data,total}}', () => {
        const r = unpackTemplateList({ code: 200, data: { data: [tpl()], total: 7, page: 1, size: 20 } })
        expect(r.rows).toHaveLength(1)
        expect(r.total).toBe(7)
    })

    it('兼容直返形状 {data,total}', () => {
        const r = unpackTemplateList({ data: [tpl(), tpl({ id: 2 })], total: 2 })
        expect(r.rows).toHaveLength(2)
        expect(r.total).toBe(2)
    })

    it('兼容直接返回数组（total 退化为数组长度）', () => {
        const r = unpackTemplateList([tpl()])
        expect(r.total).toBe(1)
    })

    it('**回归**：total 缺省/非法时不得出现 NaN（表格分页会因此失效）', () => {
        expect(unpackTemplateList({ data: [tpl()] }).total).toBe(1)
        expect(unpackTemplateList({ data: [tpl()], total: 'abc' }).total).toBe(1)
        expect(unpackTemplateList(null).total).toBe(0)
    })
})

describe('policyCount', () => {
    it('策略数为数组长度；缺失按 0（避免表格渲染出 undefined）', () => {
        expect(policyCount(tpl({ policies: [{} as never, {} as never] }))).toBe(2)
        expect(policyCount(tpl({ policies: [] }))).toBe(0)
        expect(policyCount(undefined)).toBe(0)
    })
})
