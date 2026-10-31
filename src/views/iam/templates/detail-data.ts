/**
 * 策略模板**详情页**的纯逻辑（便于单测；页面只管渲染）。
 *
 * 契约：`GET /api/v1/cam/iam/templates/{id}` → `{ code, msg, data: PolicyTemplate }`。
 * 错误语义（由后端 #214 修正）：**模板不存在 → HTTP 404 + code 404013**（此前误报 500）。
 * 详情页必须能区分三种情况：加载失败（可重试）／不存在（给"返回列表"）／正常。
 */
import type { PermissionPolicy, PolicyTemplate } from '@/api/types/iam'

/** 「模板不存在」的领域错误码（internal/cam/errs：404013 policy template not found）。 */
export const TEMPLATE_NOT_FOUND_CODE = 404013

type MaybeAxiosError = {
    response?: { status?: number; data?: { code?: number } }
    message?: string
}

/** HTTP 404（或领域码 404013）都视为"不存在"。 */
export function isTemplateNotFound(err: unknown): boolean {
    const e = err as MaybeAxiosError | null
    if (!e) return false
    if (e.response?.status === 404) return true
    return e.response?.data?.code === TEMPLATE_NOT_FOUND_CODE
}

/** 从任意 motrix/axios 错误里提取**可展示**的错误信息（不要把原始技术堆栈铺到页面上）。 */
export function templateErrorMessage(err: unknown, fallback = '模板详情加载失败'): string {
    const e = err as MaybeAxiosError | null
    const payload = e?.response?.data as { msg?: string } | undefined
    if (payload && typeof payload.msg === 'string' && payload.msg.trim()) return payload.msg.trim()
    if (e?.message && typeof e.message === 'string' && e.message.trim()) return e.message.trim()
    return fallback
}

/** 解包详情响应：兼容"信封 {code,msg,data}"与"直返模板对象"两种形状。 */
export function unpackTemplateDetail(res: unknown): PolicyTemplate | null {
    const envelope = res as { data?: unknown } | null
    const payload = (envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : res) as PolicyTemplate | null
    if (!payload || typeof payload !== 'object') return null
    // 信封里 data 也可能是模板本身；只要求有 id 与 name 才算有效模板
    if ('id' in payload && 'name' in payload) return payload as PolicyTemplate
    return null
}

/** 策略行（按策略 ID 稳定排序，便于对照与测试）。 */
export function policyRows(policies?: PermissionPolicy[] | null): PermissionPolicy[] {
    const list = Array.isArray(policies) ? [...policies] : []
    return list.sort((a, b) => String(a?.policy_id ?? '').localeCompare(String(b?.policy_id ?? '')))
}
