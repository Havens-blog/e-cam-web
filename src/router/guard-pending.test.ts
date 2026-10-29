// @vitest-environment happy-dom
/**
 * 守卫在「导航被拦截前」登记目标页：锁住 M1（401 拦截器先跳转时仍用目标页）。
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getEcmdbToken = vi.fn()
const redirectToLogin = vi.fn()
const setPendingRedirectTarget = vi.fn()
const fetchUserInfo = vi.fn()
const storeState = { isLoggedIn: true, isAdmin: false, permissions: [] as string[] }

vi.mock('@/utils/cookie', () => ({ getEcmdbToken: () => getEcmdbToken() }))
vi.mock('@/api/request', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/request')>()
    return {
        ...actual,
        redirectToLogin: (url?: string) => redirectToLogin(url),
        setPendingRedirectTarget: (url?: string) => setPendingRedirectTarget(url),
    }
})
vi.mock('@/utils/cert-permission', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils/cert-permission')>()
    return { ...actual, hasCertManageAccess: () => true }
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
    guard = (await import('./index')).authGuard as Guard
}, 30000)

beforeEach(() => {
    // 与真实部署一致：vite base=/cam/，vitest 默认 '/'
    vi.stubEnv('BASE_URL', '/cam/')
    storeState.isLoggedIn = true
    storeState.isAdmin = false
    storeState.permissions = []
    redirectToLogin.mockClear()
    setPendingRedirectTarget.mockClear()
    fetchUserInfo.mockReset()
})

describe('authGuard 目标页登记', () => {
    it('无 token：跳转入参是目标页绝对地址（含 /cam base）', async () => {
        getEcmdbToken.mockReturnValue('')
        await guard(to('/audit/logs'))
        expect(redirectToLogin).toHaveBeenCalledTimes(1)
        const arg = String(redirectToLogin.mock.calls[0]?.[0] ?? '')
        expect(arg).toContain('/cam/audit/logs')
        expect(arg.startsWith(window.location.origin)).toBe(true)
    })

    it('token 存在但已失效：登记发生在 fetchUserInfo 之前，且失败后跳转目标页', async () => {
        getEcmdbToken.mockReturnValue('token-expired')
        storeState.isLoggedIn = false
        fetchUserInfo.mockResolvedValue(false)

        const result = await guard(to('/tasks'))

        expect(result).toBe(false)
        expect(setPendingRedirectTarget).toHaveBeenCalled()
        expect(String(setPendingRedirectTarget.mock.calls[0]?.[0] ?? '')).toContain('/cam/tasks')
        // 关键顺序：登记必须先于 await fetchUserInfo（否则 401 拦截器抢先用了旧 URL）
        expect(setPendingRedirectTarget.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
            fetchUserInfo.mock.invocationCallOrder[0] ?? 0
        )
        expect(redirectToLogin).toHaveBeenCalledTimes(1)
        expect(String(redirectToLogin.mock.calls[0]?.[0] ?? '')).toContain('/cam/tasks')
    })

    it('导航成功时也登记（供后续 401 使用），且不跳转', async () => {
        getEcmdbToken.mockReturnValue('token-ok')
        const result = await guard(to('/certs'))
        expect(result).toBe(true)
        expect(redirectToLogin).not.toHaveBeenCalled()
        expect(String(setPendingRedirectTarget.mock.calls[0]?.[0] ?? '')).toContain('/cam/certs')
    })
})
