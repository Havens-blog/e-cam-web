/**
 * 跨应用跳转 URL 构造（从 AppSidebar.vue 抽出，便于单测）。
 *
 * 【背景】
 * CMDB 已拆分为独立应用 e-cmdb-web（nginx /cmdb/），平台侧边栏对这些路径
 * 统一新窗口打开（SPA 内 router.push 会命中 404）。
 *
 * 【为什么必须携带 tenant_id】
 * e-cmdb-web 的路由守卫要求 URL 携带 ?tenant_id=（feat/cmdb-tenant-context）：
 * 缺失或非法会被弹回控制台登录页。平台在 6f3088f 引入外开时未拼租户，
 * 导致「平台 → CMDB」跳转链路断在租户校验——本模块即修复点。
 *
 * 租户来源：useUserStore().currentTenantId（eiam 会话下发，TenantSelector 同源）。
 * 未选定租户（0）时不拼参数，交由目标应用守卫按既有语义兜底（弹回登录选租户）。
 */

/** 跨应用菜单前缀：命中即新窗口打开，不做 SPA 内路由 */
export const EXTERNAL_APP_PREFIXES = ['/cmdb/']

/**
 * 构造跨应用跳转 URL：为拆分应用路径拼上当前会话租户。
 *
 * @param path 菜单项路径（如 /cmdb/models），可能已带查询串
 * @param tenantId 当前会话租户 id；<=0 视为未选定，原样返回
 */
export function buildCrossAppUrl(path: string, tenantId: number): string {
    if (tenantId <= 0) return path
    const sep = path.includes('?') ? '&' : '?'
    return `${path}${sep}tenant_id=${tenantId}`
}

/**
 * 菜单点击的统一分流：跨应用前缀走新窗口（带租户），其余 SPA 内路由。
 * 供 AppSidebar（及未来同类入口）复用，避免分流规则散落。
 *
 * @returns 应打开的 URL；null 表示不走外开、由调用方 router.push
 */
export function resolveMenuTarget(path: string, tenantId: number): string | null {
    if (EXTERNAL_APP_PREFIXES.some((p) => path.startsWith(p))) {
        return buildCrossAppUrl(path, tenantId)
    }
    return null
}
