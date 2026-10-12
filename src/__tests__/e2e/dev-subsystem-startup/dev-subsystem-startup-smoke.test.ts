// @vitest-environment happy-dom
/**
 * Journey: dev-subsystem-startup | Smoke Test (web happy path)
 * Source: journey.md (Step 5 web path)
 * @feature: watchalert-subproject-integration
 * @web-e2e
 *
 * Evidence tier: CONTRACT — tests the complete web happy path:
 * valid session → Bearer token attached → API returns code=0 → response returned.
 *
 * Covers the web-interactive portion of Step 5 success outcome.
 *
 * Journey Invariants:
 * - Backend and frontend started via single command
 * - watch-alert subproject managed under same surface registry
 * - Compile failures always prominently marked
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

// --- Mock setup ---

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

function getResponseSuccessInterceptor(idx: number): Function {
    const calls = axiosMock.instances[idx]!.interceptors.response.use.mock
        .calls as unknown as Function[][]
    const lastCall = calls[calls.length - 1]!
    return lastCall[0] as Function
}

function getRequestSuccessInterceptor(idx: number): Function {
    const calls = axiosMock.instances[idx]!.interceptors.request.use.mock
        .calls as unknown as Function[][]
    const lastCall = calls[calls.length - 1]!
    return lastCall[0] as Function
}

afterEach(() => {
    restoreLocation(realLocation)
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.resetModules()
    clearCookies()
    axiosMock.instances.length = 0
})

// --- Smoke test ---

describe('dev-subsystem-startup / Smoke: web happy path', () => {
    it('developer accesses platform with valid session and starts work', async () => {
        vi.resetModules()
        vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
        const platformUrl = 'http://localhost:8888/cam/dashboard'
        stubLocation(platformUrl)
        setTokenCookie('eiam-valid-session-token')

        const { default: HttpRequest } = await import('@/api/request/index')
        new HttpRequest({ baseURL: '/api/v1' })

        // Step 5 success: request interceptor attaches Bearer token
        const requestInterceptor = getRequestSuccessInterceptor(0)
        const requestConfig = { headers: {} as Record<string, string> }
        const processedConfig = requestInterceptor(requestConfig)

        // Behavioral: Bearer token from shared cookie attached to request
        expect(processedConfig.headers.Authorization).toBe(
            'Bearer eiam-valid-session-token',
        )

        // Step 5 success: response interceptor returns data for code=0
        const successInterceptor = getResponseSuccessInterceptor(0)
        const mockResponse = {
            data: {
                code: 0,
                data: { dashboard: 'ready', alertRules: 5 },
                message: 'ok',
            },
            status: 200,
            config: { headers: { 'X-Request-ID': 'req-smoke' } },
            request: { responseType: undefined },
        }

        const result = successInterceptor(mockResponse)
        // Behavioral: response returned (platform loaded successfully)
        expect(result).toBe(mockResponse)

        // Deep: no redirect (session valid, platform accessible)
        expect(window.location.href).toBe(platformUrl)
        // Deep: no error toast (success path, no errors)
        expect((mocks.ElMessage as any).error).not.toHaveBeenCalled()
        expect((mocks.ElMessage as any).warning).not.toHaveBeenCalled()
        // Deep: session cookie still present
        expect(getTokenCookie()).toBe('eiam-valid-session-token')
    })
})
