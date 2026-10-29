// @vitest-environment happy-dom
/**
 * 守卫登记目标页（pendingRedirectTarget）优先级契约：
 * 401 拦截器常先于守卫的回调触发跳转，若只用 window.location.href（导航提交前的旧页），
 * 用户登录后会回到错误页面。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

const realLocation = window.location

beforeEach(() => {
    vi.stubEnv('VITE_LOGIN_TARGET', '')
})

afterEach(() => {
    restoreLocation(realLocation)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

async function freshModule() {
    vi.resetModules()
    return await import('./index')
}

describe('redirectToLogin 回跳优先级', () => {
    it('无 explicit / 无 pending：回退到当前 URL', { timeout: 30000 }, async () => {
        const current = 'http://localhost:8888/cam/certs/dashboard'
        stubLocation(current)
        const { redirectToLogin } = await freshModule()
        redirectToLogin()
        expect(window.location.href).toBe(
            `http://localhost:8888/console/login?redirect=${encodeURIComponent(current)}`
        )
    })

    it('pending target 覆盖当前 URL（401 抢答场景）', async () => {
        stubLocation('http://localhost:8888/cam/certs/dashboard')
        const { redirectToLogin, setPendingRedirectTarget } = await freshModule()
        setPendingRedirectTarget('http://localhost:8888/cam/tasks')
        redirectToLogin()
        expect(window.location.href).toBe(
            `http://localhost:8888/console/login?redirect=${encodeURIComponent('http://localhost:8888/cam/tasks')}`
        )
    })

    it('显式参数优先于 pending target', async () => {
        stubLocation('http://localhost:8888/cam/certs/dashboard')
        const { redirectToLogin, setPendingRedirectTarget } = await freshModule()
        setPendingRedirectTarget('http://localhost:8888/cam/tasks')
        redirectToLogin('http://localhost:8888/cam/iam/users')
        expect(window.location.href).toBe(
            `http://localhost:8888/console/login?redirect=${encodeURIComponent('http://localhost:8888/cam/iam/users')}`
        )
    })

    it('pending target 用后清空：第二次跳转不再复用它', async () => {
        stubLocation('http://localhost:8888/cam/certs/dashboard')
        const mod = await freshModule()
        mod.setPendingRedirectTarget('http://localhost:8888/cam/tasks')
        mod.redirectToLogin()
        expect(window.location.href).toContain(encodeURIComponent('http://localhost:8888/cam/tasks'))

        // 新模块实例模拟下一次会话：pending 已清空，应回退当前 URL
        stubLocation('http://localhost:8888/cam/assets')
        const mod2 = await freshModule()
        mod2.redirectToLogin()
        expect(window.location.href).toBe(
            `http://localhost:8888/console/login?redirect=${encodeURIComponent('http://localhost:8888/cam/assets')}`
        )
    })
})
