/**
 * DNS 域名的"查看拓扑"跨应用链接用例。
 *
 * 这一条是**死链回归锚点**：早期实现是 `router.push('/topology?domain=...')`，
 * 而本仓没有 /topology 路由（拓扑页随 CMDB 迁到 e-cmdb-web）⇒ 点击命中 404 兜底页。
 * 现在必须：① 指向 `/cmdb/topology`；② 与侧边栏一致带上 `tenant_id`（e-cmdb-web 守卫要求）。
 */
import { describe, expect, it } from 'vitest'
import { buildDomainTopologyUrl } from './topology-link'

describe('buildDomainTopologyUrl（查看拓扑 → e-cmdb-web）', () => {
    it('指向跨应用的 /cmdb/topology 并携带 domain 与 tenant_id', () => {
        expect(buildDomainTopologyUrl('easyeda.com', 3)).toBe('/cmdb/topology?domain=easyeda.com&tenant_id=3')
    })

    it('域名做 URL 编码（避免特殊字符破坏查询串）', () => {
        expect(buildDomainTopologyUrl('a b.com', 3)).toBe('/cmdb/topology?domain=a%20b.com&tenant_id=3')
    })

    it('未选定租户(0)时不强拼 tenant_id（沿用 buildCrossAppUrl 语义，由目标应用兜底）', () => {
        expect(buildDomainTopologyUrl('easyeda.com', 0)).toBe('/cmdb/topology?domain=easyeda.com')
    })

    it('域名缺失时不出现 undefined（空串兜底）', () => {
        expect(buildDomainTopologyUrl(undefined, 3)).toBe('/cmdb/topology?domain=&tenant_id=3')
        expect(buildDomainTopologyUrl(null, 3)).not.toContain('undefined')
    })

    it('不得回退为本仓 /topology（该路由不存在）', () => {
        expect(buildDomainTopologyUrl('easyeda.com', 3)).not.toMatch(/^\/topology/)
    })
})
