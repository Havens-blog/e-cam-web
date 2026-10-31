/**
 * 策略模板列表页的**纯逻辑**（便于单测；页面只管渲染）。
 *
 * 契约来源（两侧已核对一致，见 e-cam-service/.kiro/specs/multi-cloud-iam/API_REFERENCE.md）：
 *   GET /api/v1/cam/iam/templates?category&is_built_in&keyword&page&size
 *   响应 { data: PolicyTemplate[], total, page, size }
 *
 * 本轮**只做只读列表**：不放新建/编辑/删除/应用模板等入口（业务规则未确认，见 PR 说明）。
 */
import type { PolicyTemplate, TemplateCategory } from '@/api/types/iam'

export interface TemplateListFilters {
    keyword?: string
    category?: TemplateCategory | ''
    /** '' = 全部；true = 仅内置；false = 仅自定义 */
    isBuiltIn?: boolean | ''
}

export interface TemplateListParams {
    page: number
    size: number
    keyword?: string
    category?: TemplateCategory
    is_built_in?: boolean
}

/** 默认每页条数：与后端 ListTemplates 的默认值一致（req.Size == 0 → 20）。 */
export const TEMPLATE_PAGE_SIZE = 20

/**
 * 组装请求参数：**只传有值的项**。
 * 空字符串/未选中的筛选项必须省略，否则后端会把 '' 当作有效分类/关键字处理。
 */
export function buildTemplateListParams(filters: TemplateListFilters, page: number, size = TEMPLATE_PAGE_SIZE): TemplateListParams {
    const params: TemplateListParams = { page: page > 0 ? page : 1, size: size > 0 ? size : TEMPLATE_PAGE_SIZE }
    const keyword = (filters.keyword || '').trim()
    if (keyword) params.keyword = keyword
    if (filters.category) params.category = filters.category
    if (typeof filters.isBuiltIn === 'boolean') params.is_built_in = filters.isBuiltIn
    return params
}

/** 后端响应可能是信封 {code,data:{data,total}} 或直返 {data,total}，统一解包。 */
export function unpackTemplateList(res: unknown): { rows: PolicyTemplate[]; total: number } {
    const envelope = res as { data?: unknown } | null
    const payload = (envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : res) as
        | { data?: unknown; total?: unknown }
        | PolicyTemplate[]
        | null
    const rows = Array.isArray(payload) ? payload : Array.isArray((payload as { data?: unknown })?.data) ? ((payload as { data: PolicyTemplate[] }).data) : []
    const totalRaw = Array.isArray(payload) ? rows.length : Number((payload as { total?: unknown })?.total)
    const total = Number.isFinite(totalRaw) && totalRaw >= 0 ? totalRaw : rows.length
    return { rows, total }
}

/** 策略条数（模板自带 policies，可能为空数组）。 */
export function policyCount(template: Pick<PolicyTemplate, 'policies'> | null | undefined): number {
    return Array.isArray(template?.policies) ? template!.policies!.length : 0
}
