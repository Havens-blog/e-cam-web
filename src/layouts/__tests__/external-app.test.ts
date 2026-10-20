/**
 * external-app 跨应用跳转 URL 构造单测。
 *
 * 背景：e-cmdb-web 路由守卫要求 URL 携带 ?tenant_id=，平台侧边栏外开 CMDB
 * 菜单时必须拼上当前会话租户（6f3088f 引入外开时漏拼，链路断在租户校验）。
 */
import { describe, expect, it } from 'vitest'
import { buildCrossAppUrl, EXTERNAL_APP_PREFIXES, resolveMenuTarget } from '../external-app'

describe('buildCrossAppUrl', () => {
    it('租户 > 0：路径拼上 ?tenant_id=', () => {
        expect(buildCrossAppUrl('/cmdb/models', 5)).toBe('/cmdb/models?tenant_id=5')
    })

    it('路径已带查询串：用 & 追加，不破坏既有参数', () => {
        expect(buildCrossAppUrl('/cmdb/instances?tab=cert', 7)).toBe(
            '/cmdb/instances?tab=cert&tenant_id=7'
        )
    })

    it('租户 0（未选定）：原样返回，交由目标应用守卫兜底', () => {
        expect(buildCrossAppUrl('/cmdb/models', 0)).toBe('/cmdb/models')
    })

    it('租户负数（异常态防御）：原样返回', () => {
        expect(buildCrossAppUrl('/cmdb/models', -3)).toBe('/cmdb/models')
    })
})

describe('resolveMenuTarget', () => {
    it('命中跨应用前缀：返回带租户的外开 URL', () => {
        expect(resolveMenuTarget('/cmdb/topology', 5)).toBe('/cmdb/topology?tenant_id=5')
    })

    it('未命中前缀：返回 null（调用方走 SPA 内 router.push）', () => {
        expect(resolveMenuTarget('/dashboard', 5)).toBeNull()
        expect(resolveMenuTarget('/tasks', 5)).toBeNull()
    })

    it('前缀匹配是 startsWith 语义：/cmdbx 不算跨应用', () => {
        expect(resolveMenuTarget('/cmdbx', 5)).toBeNull()
    })

    it('EXTERNAL_APP_PREFIXES 当前仅含 /cmdb/', () => {
        expect(EXTERNAL_APP_PREFIXES).toEqual(['/cmdb/'])
    })
})
