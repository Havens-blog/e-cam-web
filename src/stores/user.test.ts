// @vitest-environment happy-dom
/**
 * RC#2（platform-console 任务 2.13）：登出跳转目标切换用例。
 * logout 是唯一应当主动清除共享凭证 ecmdb-token-key 的路径（user.ts 注释契约，
 * 前置条件是已通知 eiam 销毁会话）；其跳转目标由 ecmdb-web /login 切到控制台
 * /console/login（VITE_LOGIN_TARGET，经 resolveLoginTarget 统一取值）。
 * 401 路径（redirectToLogin）的"不清 cookie"契约在 src/api/request/index.test.ts。
 */
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eiamAxios } from '@/api/request/eiam'
import { useUserStore } from './user'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

vi.mock('@/api/request/eiam', () => ({
    eiamAxios: {
        get: vi.fn().mockResolvedValue({ data: { code: 1, msg: 'unauthenticated' } }),
        post: vi.fn().mockResolvedValue({ data: { code: 0, msg: 'ok' } })
    }
}))

const realLocation = window.location

beforeEach(() => {
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    document.cookie = 'ecmdb-token-key=rc2-shared-cookie; path=/'
    vi.mocked(eiamAxios.post).mockClear()
})

afterEach(() => {
    restoreLocation(realLocation)
    vi.unstubAllEnvs()
})

describe('logout（登出路径）', () => {
    it('通知 eiam 销毁会话后跳转控制台登录页（默认 /console/login）并清共享 cookie', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '')
        stubLocation('http://localhost:8888/cam/dashboard')
        const store = useUserStore()
        store.setUserInfo({ id: 1, username: 'rc2', displayName: 'RC2' })
        await store.logout()

        expect(eiamAxios.post).toHaveBeenCalledWith('/api/iam/user/logout')
        expect(window.location.href).toBe('http://localhost:8888/console/login')
        // logout 是唯一主动清共享凭证的路径（eiam 已销毁会话，本地残留必须清）
        expect(document.cookie).not.toContain('ecmdb-token-key=')
    })

    it('跳转目标使用 VITE_LOGIN_TARGET 注入值', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
        stubLocation('http://localhost:8888/cam/dashboard')
        const store = useUserStore()
        await store.logout()
        expect(window.location.href).toBe('http://localhost:8888/console/login')
    })

    it('登出接口失败时仍清理本地状态并兜底跳转', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '')
        vi.mocked(eiamAxios.post).mockRejectedValueOnce(new Error('network down'))
        stubLocation('http://localhost:8888/cam/dashboard')
        const store = useUserStore()
        await expect(store.logout()).resolves.toBeUndefined()
        expect(window.location.href).toBe('http://localhost:8888/console/login')
        expect(document.cookie).not.toContain('ecmdb-token-key=')
    })
})
