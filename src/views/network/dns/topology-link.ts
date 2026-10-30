/**
 * DNS 域名 → CMDB 拓扑页的跨应用链接构造（纯函数，便于单测）。
 *
 * 【背景】拓扑页已随 CMDB 迁移到独立应用 e-cmdb-web（nginx /cmdb/）。本仓的路由表里没有拓扑路由，
 * 早先那版实现直接做**仓内**跳转，会命中 404 兜底页 —— 属"点击即失效"的死链。
 *
 * 【约定】与侧边栏一致：走 `/cmdb/` 前缀（EXTERNAL_APP_PREFIXES）+ **必须带 ?tenant_id=**
 * （e-cmdb-web 的路由守卫要求，缺失或非法会被弹回控制台登录页）。
 */
import { buildCrossAppUrl } from '@/layouts/external-app'

/** 域名可能为空（表格兜底行），构造时按空串处理，避免出现 `domain=undefined`。 */
export function buildDomainTopologyUrl(domainName: string | null | undefined, tenantId: number): string {
    const domain = encodeURIComponent(domainName ?? '')
    return buildCrossAppUrl(`/cmdb/topology?domain=${domain}`, tenantId)
}
