import { describe, expect, it } from 'vitest'
import { mapEiamProfile } from './user-mapper'

/** eiam GET /api/user/profile 的 data 部分（真实字段名，snake_case） */
function makeRawProfile(overrides: Record<string, unknown> = {}) {
    return {
        user: {
            id: 42,
            username: 'zhangsan',
            email: 'zhangsan@example.com',
            nickname: '张三',
            job_title: '运维工程师',
            avatar: '',
            phone: '',
            status: 'enabled',
            source: 'ldap',
        },
        tenants: [{ id: 1, name: '默认租户', code: 'default', domain: '' }],
        current_tenant_id: 1,
        must_select_tenant: false,
        is_admin: true,
        permissions: ['cam:asset:view', 'cam:cost:view'],
        ...overrides,
    }
}

describe('mapEiamProfile', () => {
    it('把 snake_case 字段映射为 camelCase 的 UserInfo', () => {
        const result = mapEiamProfile(makeRawProfile())

        expect(result?.userInfo).toEqual({
            id: 42,
            username: 'zhangsan',
            displayName: '张三',
            email: 'zhangsan@example.com',
            title: '运维工程师',
        })
    })

    it('permissions 原样透传为字符串数组', () => {
        const result = mapEiamProfile(makeRawProfile())

        expect(result?.permissions).toEqual(['cam:asset:view', 'cam:cost:view'])
    })

    it('保留租户上下文供后续租户切换使用', () => {
        const result = mapEiamProfile(makeRawProfile())

        expect(result?.currentTenantId).toBe(1)
        expect(result?.isAdmin).toBe(true)
        expect(result?.mustSelectTenant).toBe(false)
        expect(result?.tenants).toEqual([
            { id: 1, name: '默认租户', code: 'default', domain: '' },
        ])
    })

    it('缺失的可选字段降级为安全默认值而非 undefined 传播', () => {
        const result = mapEiamProfile({ user: { id: 7, username: 'lisi' } })

        expect(result?.userInfo).toEqual({
            id: 7,
            username: 'lisi',
            displayName: 'lisi',
            email: undefined,
            title: undefined,
        })
        expect(result?.permissions).toEqual([])
        expect(result?.tenants).toEqual([])
        expect(result?.currentTenantId).toBe(0)
        expect(result?.isAdmin).toBe(false)
    })

    it('nickname 为空串时 displayName 回退到 username', () => {
        const raw = makeRawProfile()
        ;(raw.user as Record<string, unknown>).nickname = ''

        expect(mapEiamProfile(raw)?.userInfo.displayName).toBe('zhangsan')
    })

    it('permissions 含非字符串元素时过滤掉，不污染 hasPermission', () => {
        const result = mapEiamProfile(
            makeRawProfile({ permissions: ['ok', 123, null, 'fine'] })
        )

        expect(result?.permissions).toEqual(['ok', 'fine'])
    })

    it('对无效输入返回 null 而非抛异常', () => {
        expect(mapEiamProfile(null)).toBeNull()
        expect(mapEiamProfile(undefined)).toBeNull()
        expect(mapEiamProfile('not an object')).toBeNull()
        expect(mapEiamProfile({})).toBeNull()
        expect(mapEiamProfile({ user: null })).toBeNull()
        expect(mapEiamProfile({ user: { username: 'no-id' } })).toBeNull()
    })

    it('tenants 不是数组时降级为空数组', () => {
        const result = mapEiamProfile(makeRawProfile({ tenants: 'broken' }))

        expect(result?.tenants).toEqual([])
    })

    it('current_tenant_id 为 0 表示尚未选择租户，如实保留', () => {
        const result = mapEiamProfile(
            makeRawProfile({ current_tenant_id: 0, must_select_tenant: true })
        )

        expect(result?.currentTenantId).toBe(0)
        expect(result?.mustSelectTenant).toBe(true)
    })
})
