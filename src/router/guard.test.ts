// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getEcmdbToken = vi.fn()
const redirectToLogin = vi.fn()
const fetchUserInfo = vi.fn()
const hasCertManageAccess = vi.fn()
const storeState = { isLoggedIn: true, isAdmin: false, permissions: [] as string[] }

vi.mock('@/utils/cookie', () => ({ getEcmdbToken: () => getEcmdbToken() }))
vi.mock('@/api/request', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/request')>()
    return {
        ...actual,
        redirectToLogin: (url?: string) => redirectToLogin(url),
    }
})
vi.mock('@/utils/cert-permission', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils/cert-permission')>()
    return { ...actual, hasCertManageAccess: () => hasCertManageAccess() }
})
vi.mock('@/stores/user', () => ({
    useUserStore: () => ({
        get isLoggedIn() {
            return storeState.isLoggedIn
        },
        get isAdmin() {
            return storeState.isAdmin
        },
        permissions: storeState.permissions,
        fetchUserInfo,
    }),
}))

type Guard = (to: never) => Promise<unknown>
let guard: Guard

const to = (path: string, meta: Record<string, unknown> = {}) => ({ path, fullPath: path, meta, hash: '' }) as never

beforeAll(async () => {
    // 首次 import 会构造 router 并触发路由懒加载探测，给足超时
    guard = (await import('./index')).authGuard as Guard
}, 30000)

describe('authGuard', () => {
    beforeEach(() => {
        storeState.isLoggedIn = true
        storeState.isAdmin = false
        storeState.permissions = []
    })

    it('形参个数必须 <= 2（>=3 且不调用 next 会触发 Invalid navigation guard）', () => {
        expect(guard.length).toBeLessThanOrEqual(2)
    })

    it('无 token：跳登录并返回 false 中止导航', async () => {
        getEcmdbToken.mockReturnValue('')
        redirectToLogin.mockClear()
        const result = await guard(to('/certs'))
        expect(redirectToLogin).toHaveBeenCalledTimes(1)
        expect(result).toBe(false)
    })

    it('有 token 且已登录：放行', async () => {
        getEcmdbToken.mockReturnValue('token-abc')
        redirectToLogin.mockClear()
        const result = await guard(to('/tasks'))
        expect(result).toBe(true)
        expect(redirectToLogin).not.toHaveBeenCalled()
    })

    it('证书管理页且无权限：返回到期看板路径', async () => {
        getEcmdbToken.mockReturnValue('token-abc')
        hasCertManageAccess.mockReturnValue(false)
        const result = await guard(to('/certs', { certManageOnly: true }))
        expect(result).toBe('/certs/dashboard')
    })
})
