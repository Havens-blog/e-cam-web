import { eiamAxios } from './request/eiam'

/**
 * 切换当前 session 的激活租户。
 *
 * eiam `POST /api/tenant/switch`（经 nginx /api/iam/tenant/switch），
 * 通过 JSON body 的 `tenant_id` 字段指定目标租户（后端 SwitchTenantReq 绑定
 * `binding:"required,gt=0"`，不再使用 X-Active-Tenant-ID 头）。eiam 销毁旧 session
 * 并重签 JWT，后续 cam 请求自动落到新租户（后端从 JWT session 取 tenant_id）。
 *
 * 成功后调用方应 reload 页面，让路由守卫重新 fetchUserInfo 取新租户上下文。
 */
export async function switchTenant(targetTenantId: number): Promise<void> {
    await eiamAxios.post('/api/iam/tenant/switch', { tenant_id: targetTenantId })
}
