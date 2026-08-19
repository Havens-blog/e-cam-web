import { describe, expect, it } from 'vitest'
import {
    CERT_MANAGE_PERMISSION,
    CERT_VIEWER_BLOCKED_MESSAGE,
    CERT_VIEWER_FALLBACK_PATH,
    hasCertManageAccess,
} from './cert-permission'

describe('hasCertManageAccess（证书管理角色判定，任务 6.1）', () => {
    it('is_admin 用户直通（无授权码也可访问台账/变更/配置）', () => {
        expect(hasCertManageAccess({ isAdmin: true, permissions: [] })).toBe(true)
    })

    it('持有 cert 管理授权码的非管理员可访问', () => {
        expect(
            hasCertManageAccess({
                isAdmin: false,
                permissions: ['cam:asset:view', CERT_MANAGE_PERMISSION],
            }),
        ).toBe(true)
    })

    it('无授权码的非管理员视为只读查看者（deny-by-default，与后端 RequireRoles 一致）', () => {
        expect(
            hasCertManageAccess({ isAdmin: false, permissions: ['cam:asset:view'] }),
        ).toBe(false)
        expect(hasCertManageAccess({ isAdmin: false, permissions: [] })).toBe(false)
    })

    it('拦截提示文案与回退路径为 UI 设计固定值', () => {
        expect(CERT_VIEWER_BLOCKED_MESSAGE).toBe('无权限访问，仅到期看板可见')
        expect(CERT_VIEWER_FALLBACK_PATH).toBe('/certs/dashboard')
    })
})
