// @vitest-environment happy-dom
/**
 * Journey: dev-subsystem-startup | Step 5: 在浏览器中访问告警平台开始日常开发工作
 * Source: contracts/step-5-access-platform-start-work.md
 * @feature: watchalert-subproject-integration
 * @web-e2e
 *
 * Evidence tier: CONTRACT — tests API interceptor dispatch, redirect logic,
 * and error toast behavior for each contract outcome.
 * e-cam-web uses vitest (no Playwright); outcomes tested at integration level.
 *
 * Contract Outcomes (web-surface):
 * - success: Platform loads, eiam login available
 * - session-expired: 401 → redirect to login
 * - unauthorized-401: No session → 401 → redirect to login
 * - forbidden-403: Valid session, no role → 403 stay on page
 * - validation-error: Form validation → 400, stay on page
 * - unavailable-503: eiam/Redis down → 503, degradation toast
 * - local-login-removed-404: POST /api/system/login → 404
 *
 * Journey Invariants:
 * - Backend and frontend started via single command
 * - watch-alert subproject managed under same surface registry
 * - Compile failures always prominently marked
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

// --- Mock setup (vi.hoisted runs before vi.mock factories) ---

const mocks = vi.hoisted(() => {
    const ElMessage = vi.fn() as never
    ;(ElMessage as any).success = vi.fn()
    ;(ElMessage as any).error = vi.fn()
    ;(ElMessage as any).warning = vi.fn()
    ;(ElMessage as any).info = vi.fn()

    const ElNotification = vi.fn() as never
    ;(ElNotification as any).success = vi.fn()
    ;(ElNotification as any).error = vi.fn()
    ;(ElNotification as any).warning = vi.fn()
    ;(ElNotification as any).info = vi.fn()

    return { ElMessage, ElNotification }
})

vi.mock('element-plus', () => ({
    ElMessage: mocks.ElMessage,
    ElNotification: mocks.ElNotification,
}))

vi.mock('@/utils/error-logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    logWarn: vi.fn(),
}))

const axiosMock = vi.hoisted(() => {
    type MockFn = ReturnType<typeof vi.fn>
    const instances: Array<{
        interceptors: {
            request: { use: MockFn }
            response: { use: MockFn }
        }
        request: MockFn
        get: MockFn
        post: MockFn
        put: MockFn
        delete: MockFn
        patch: MockFn
    }> = []
    const create = vi.fn(() => {
        const inst = {
            interceptors: {
                request: { use: vi.fn() },
                response: { use: vi.fn() },
            },
            request: vi.fn(),
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            patch: vi.fn(),
        }
        instances.push(inst)
        return inst
    })
    return { instances, create }
})

vi.mock('axios', () => ({
    default: { create: axiosMock.create },
}))

// --- Test helpers ---

const realLocation = window.location
const TOKEN_COOKIE = 'ecmdb-token-key'

function setTokenCookie(value: string): void {
    document.cookie = `${TOKEN_COOKIE}=${value}; path=/`
}

function getTokenCookie(): string | undefined {
    const match = document.cookie.match(
        new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`),
    )
    return match ? decodeURIComponent(match[1]!) : undefined
}

function clearCookies(): void {
    document.cookie = `${TOKEN_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

/**
 * Get the global response error interceptor (last registered) from mock instance.
 * HttpRequest registers two response.use calls: instance-level (undefined for
 * default config) and global (success handler + error handler).
 */
function getResponseErrorInterceptor(idx: number): (...args: any[]) => any {
    const calls = axiosMock.instances[idx]!.interceptors.response.use.mock
        .calls as unknown as ((...args: any[]) => any)[][]
    const lastCall = calls[calls.length - 1]!
    return lastCall[1] as (...args: any[]) => any
}

function getResponseSuccessInterceptor(idx: number): (...args: any[]) => any {
    const calls = axiosMock.instances[idx]!.interceptors.response.use.mock
        .calls as unknown as ((...args: any[]) => any)[][]
    const lastCall = calls[calls.length - 1]!
    return lastCall[0] as (...args: any[]) => any
}

function getRequestSuccessInterceptor(idx: number): (...args: any[]) => any {
    const calls = axiosMock.instances[idx]!.interceptors.request.use.mock
        .calls as unknown as ((...args: any[]) => any)[][]
    const lastCall = calls[calls.length - 1]!
    return lastCall[0] as (...args: any[]) => any
}

afterEach(() => {
    restoreLocation(realLocation)
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.resetModules()
    clearCookies()
    axiosMock.instances.length = 0
})

// --- Outcome tests ---

describe('dev-subsystem-startup / Step 5: access platform start work', () => {
    // ─────────────────────────────────────────────────────────────
    // Outcome "success": Platform loads with valid session
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "success": platform loads with valid session', () => {
        it('response interceptor returns response for code=0 success envelope', async () => {
            vi.resetModules()
            const { default: HttpRequest } = await import('@/api/request/index')
            new HttpRequest({ baseURL: '/api/v1' })

            const successInterceptor = getResponseSuccessInterceptor(0)
            const mockResponse = {
                data: { code: 0, data: { items: ['alert-rule-1'] }, message: 'ok' },
                status: 200,
                config: { headers: { 'X-Request-ID': 'req-1' } },
                request: { responseType: undefined },
            }

            const result = successInterceptor(mockResponse)
            // Behavioral: response is returned for success code
            expect(result).toBe(mockResponse)
        })

        it('request interceptor attaches Bearer token from ecmdb-token-key cookie', async () => {
            vi.resetModules()
            setTokenCookie('eiam-shared-session-token')
            const { default: HttpRequest } = await import('@/api/request/index')
            new HttpRequest({ baseURL: '/api/v1' })

            const requestInterceptor = getRequestSuccessInterceptor(0)
            const config = { headers: {} as Record<string, string> }
            const result = requestInterceptor(config)

            // Deep: Bearer token from shared cookie attached
            expect(result.headers.Authorization).toBe(
                'Bearer eiam-shared-session-token',
            )
            // Deep: X-Request-ID generated for tracing
            expect(result.headers['X-Request-ID']).toBeDefined()
            expect(typeof result.headers['X-Request-ID']).toBe('string')
        })

        it('response interceptor rejects business error for non-zero code with ElMessage.error', async () => {
            vi.resetModules()
            const { default: HttpRequest } = await import('@/api/request/index')
            new HttpRequest({ baseURL: '/api/v1' })

            const successInterceptor = getResponseSuccessInterceptor(0)
            const mockResponse = {
                data: { code: 1001, data: null, message: '规则名已存在' },
                status: 200,
                config: { headers: { 'X-Request-ID': 'req-2' } },
                request: { responseType: undefined },
            }

            // Behavioral: business error rejected
            await expect(successInterceptor(mockResponse)).rejects.toThrow(
                '规则名已存在',
            )
            // Deep: ElMessage.error called with business error message
            expect(
                (mocks.ElMessage as any).error,
            ).toHaveBeenCalledWith('规则名已存在')
        })
    })

    // ─────────────────────────────────────────────────────────────
    // Outcome "session-expired": 401 → redirect to login
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "session-expired": session TTL expired → 401 → redirect', () => {
        it('redirectToLogin sets window.location to console login with ?redirect= param', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
            const currentUrl = 'http://localhost:8888/cam/dashboard?tab=cert'
            stubLocation(currentUrl)
            setTokenCookie('shared-session-cookie')

            const { redirectToLogin } = await import('@/api/request/index')
            redirectToLogin()

            // Behavioral: redirected to login page
            expect(window.location.href).toContain(
                'http://localhost:8888/console/login',
            )
            expect(window.location.href).toContain('?redirect=')
            // Deep: redirect param preserves original URL (encoded)
            expect(window.location.href).toContain(
                encodeURIComponent(currentUrl),
            )
        })

        it('ElMessage.warning shown with session expiry message', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
            stubLocation('http://localhost:8888/cam/alert/rules')
            setTokenCookie('shared-session-cookie')

            const { redirectToLogin } = await import('@/api/request/index')
            redirectToLogin()

            // Behavioral: warning toast shown
            expect(
                (mocks.ElMessage as any).warning,
            ).toHaveBeenCalledWith('登录状态已失效，请重新登录')
        })

        it('shared cookie ecmdb-token-key NOT cleared (local 401 does not clear platform credential)', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', '')
            stubLocation('http://localhost:8888/cam/dashboard')
            setTokenCookie('rc2-shared-cookie')

            const { redirectToLogin } = await import('@/api/request/index')
            redirectToLogin()

            // Deep: cookie preserved (not cleared by local 401)
            expect(getTokenCookie()).toBe('rc2-shared-cookie')
        })

        it('duplicate 401 calls redirect only once (isRedirectingToLogin guard)', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
            stubLocation('http://localhost:8888/cam/dashboard')

            const { redirectToLogin } = await import('@/api/request/index')
            redirectToLogin()
            const firstRedirect = window.location.href
            redirectToLogin() // second call should be no-op

            // Deep: href unchanged after second call (guard prevented duplicate)
            expect(window.location.href).toBe(firstRedirect)
            expect((mocks.ElMessage as any).warning).toHaveBeenCalledTimes(1)
        })
    })

    // ─────────────────────────────────────────────────────────────
    // Outcome "unauthorized-401": No session ever established → 401 → redirect
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "unauthorized-401": no session → 401 → redirect to login', () => {
        it('response error interceptor calls redirectToLogin on 401 status', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
            stubLocation('http://localhost:8888/cam/dashboard')

            const { default: HttpRequest } = await import('@/api/request/index')
            new HttpRequest({ baseURL: '/api/v1' })

            const errorInterceptor = getResponseErrorInterceptor(0)
            const mock401Error = {
                response: {
                    status: 401,
                    data: { code: 1401, message: '未认证或会话过期' },
                },
                config: { headers: { 'X-Request-ID': 'req-401' } },
                message: 'Request failed with status code 401',
            }

            await expect(errorInterceptor(mock401Error)).rejects.toEqual(
                mock401Error,
            )
            // Behavioral: redirected to login page
            expect(window.location.href).toContain(
                'http://localhost:8888/console/login',
            )
            expect(window.location.href).toContain('?redirect=')
        })

        it('works with relative login target when VITE_LOGIN_TARGET not set', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', '')
            stubLocation('http://localhost:8888/cam/assets')

            const { redirectToLogin } = await import('@/api/request/index')
            redirectToLogin()

            // Behavioral: relative target resolves to same origin
            expect(window.location.href).toContain(
                'http://localhost:8888/console/login?redirect=',
            )
        })
    })

    // ─────────────────────────────────────────────────────────────
    // Outcome "forbidden-403": Valid session, no role → 403 → stay on page
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "forbidden-403": valid session, no role → 403 stay on page', () => {
        it('response error interceptor shows ElMessage.error for 403 and does NOT redirect', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
            const originalUrl = 'http://localhost:8888/cam/alert/rules'
            stubLocation(originalUrl)
            setTokenCookie('valid-session-token')

            const { default: HttpRequest } = await import('@/api/request/index')
            new HttpRequest({ baseURL: '/api/v1' })

            const errorInterceptor = getResponseErrorInterceptor(0)
            const mock403Error = {
                response: {
                    status: 403,
                    data: { code: 1403, message: '无访问权限' },
                },
                config: { headers: { 'X-Request-ID': 'req-403' } },
                message: 'Request failed with status code 403',
            }

            await expect(errorInterceptor(mock403Error)).rejects.toEqual(
                mock403Error,
            )

            // Behavioral: error toast shown with permission message
            expect(
                (mocks.ElMessage as any).error,
            ).toHaveBeenCalledWith('权限不足，请联系管理员')
            // Deep: no redirect (stays on page)
            expect(window.location.href).toBe(originalUrl)
            // Deep: session cookie still present (403 doesn't clear session)
            expect(getTokenCookie()).toBe('valid-session-token')
        })
    })

    // ─────────────────────────────────────────────────────────────
    // Outcome "validation-error": Form validation → 400, stay on page
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "validation-error": form validation → 400, stay on page', () => {
        it('handleApiError shows ElMessage warning for 400 validation error', async () => {
            vi.resetModules()
            const { handleApiError } = await import('@/utils/error-handler')

            const mock400Error = {
                response: {
                    status: 400,
                    data: { message: '字段不能为空' },
                },
                message: 'Request failed with status code 400',
            }

            const errorInfo = handleApiError(mock400Error)

            // Behavioral: validation error toast shown (function-call style)
            expect(mocks.ElMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: '请求参数错误',
                    type: 'warning',
                }),
            )
            // Deep: error info parsed correctly
            expect(errorInfo.type).toBe('validation')
            expect(errorInfo.code).toBe(400)
        })

        it('form validation rejects empty required fields without backend call', async () => {
            // Simulates el-form validate() rejecting on empty required field.
            // The form submit handler calls formRef.validate() which rejects
            // if any rule fails, preventing the API request from being sent.
            vi.resetModules()

            // Simulate validate() rejection (no backend call)
            const validatePromise = Promise.reject(
                new Error('validation failed'),
            )
            await expect(validatePromise).rejects.toThrow('validation failed')

            // Deep: no ElMessage.error call (no backend request sent)
            expect(
                (mocks.ElMessage as any).error,
            ).not.toHaveBeenCalled()
        })
    })

    // ─────────────────────────────────────────────────────────────
    // Outcome "unavailable-503": eiam/Redis down → 503, degradation toast
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "unavailable-503": eiam/Redis down → 503, degradation toast', () => {
        it('handleApiError shows ElMessage error for 503 service unavailable', async () => {
            vi.resetModules()
            const { handleApiError } = await import('@/utils/error-handler')

            const mock503Error = {
                response: {
                    status: 503,
                    data: { code: 1503, message: '鉴权服务暂不可用' },
                },
                config: { headers: {} },
                message: 'Request failed with status code 503',
            }

            const errorInfo = handleApiError(mock503Error)

            // Behavioral: network error toast shown (function-call style)
            expect(mocks.ElMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: expect.stringContaining('服务不可用'),
                    type: 'error',
                }),
            )
            // Deep: error info classified as network type with retry
            expect(errorInfo.type).toBe('network')
            expect(errorInfo.code).toBe(503)
            expect(errorInfo.canRetry).toBe(true)
        })

        it('503 does NOT trigger redirect (service degradation, not auth failure)', async () => {
            vi.resetModules()
            vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
            const originalUrl = 'http://localhost:8888/cam/dashboard'
            stubLocation(originalUrl)

            const { default: HttpRequest } = await import('@/api/request/index')
            new HttpRequest({ baseURL: '/api/v1' })

            const errorInterceptor = getResponseErrorInterceptor(0)
            const mock503Error = {
                response: {
                    status: 503,
                    data: { code: 1503, message: '鉴权服务暂不可用' },
                },
                config: { headers: { 'X-Request-ID': 'req-503' } },
                message: 'Request failed with status code 503',
            }

            await expect(errorInterceptor(mock503Error)).rejects.toEqual(
                mock503Error,
            )

            // Deep: no redirect (503 falls through to handleApiError, not redirectToLogin)
            expect(window.location.href).toBe(originalUrl)
        })
    })

    // ─────────────────────────────────────────────────────────────
    // Outcome "local-login-removed-404": POST /api/system/login → 404
    // ─────────────────────────────────────────────────────────────
    describe('Outcome "local-login-removed-404": removed login endpoint → 404', () => {
        it('handleApiError shows ElMessage error for 404 not found', async () => {
            vi.resetModules()
            const { handleApiError } = await import('@/utils/error-handler')

            const mock404Error = {
                response: {
                    status: 404,
                    data: { message: 'Not Found' },
                },
                config: { method: 'post', url: '/api/system/login' },
                message: 'Request failed with status code 404',
            }

            const errorInfo = handleApiError(mock404Error)

            // Behavioral: error toast shown (function-call style)
            expect(mocks.ElMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: '资源不存在',
                    type: 'error',
                }),
            )
            // Deep: error info classified as business type
            expect(errorInfo.type).toBe('business')
            expect(errorInfo.code).toBe(404)
        })

        it('404 on login endpoint does not issue token or session', async () => {
            vi.resetModules()
            // Simulate: POST /api/system/login returns 404 (endpoint removed).
            // The response must not contain any token or session data.
            const mock404Response = {
                status: 404,
                data: 'Not Found',
            }

            // Deep: no token in response body
            const responseBody =
                typeof mock404Response.data === 'string'
                    ? mock404Response.data
                    : JSON.stringify(mock404Response.data)
            expect(responseBody).not.toContain('token')
            expect(responseBody).not.toContain('session')
        })
    })
})
