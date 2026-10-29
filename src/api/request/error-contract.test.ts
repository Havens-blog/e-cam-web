// @vitest-environment happy-dom
/**
 * 装配级契约：一个失败请求 → 恰好一条用户提示。
 *
 * 上一轮审查指出：只单测 helper 时「删掉拦截器里的 markErrorNotified 仍全绿」。
 * 这里用自定义 axios adapter 走真实 interceptor 链，断言：
 *  - 403 / 业务错误 / 无 code / 5xx：恰好一条提示（5xx 走 handleApiError 的函数式 ElMessage，必须能观测到）；
 *  - 401：只 warning 不 error，且错误带「已提示」标记；
 *  - 成功：不提示；
 *  - 被标记的错误交给 showApiError 时不再补弹（去重契约的下游一半）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

// ElMessage 既可调用（handleApiError 走 ElMessage({...})），也带 error/warning/success 方法
vi.mock('element-plus', async (importOriginal) => {
    const actual = await importOriginal<typeof import('element-plus')>()
    const callable = Object.assign(vi.fn(), {
        error: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
        closeAll: vi.fn(),
    })
    return { ...actual, ElMessage: callable, ElNotification: vi.fn() }
})

import { ElMessage } from 'element-plus'
import HttpRequest, { isErrorNotified, showApiError } from './index'

const callableMock = vi.mocked(ElMessage as unknown as ReturnType<typeof vi.fn>)
const errorMock = vi.mocked((ElMessage as unknown as { error: ReturnType<typeof vi.fn> }).error)
const warningMock = vi.mocked((ElMessage as unknown as { warning: ReturnType<typeof vi.fn> }).warning)

const jsonAdapter = (status: number, body: unknown): AxiosAdapter => async (config) => {
    const response = {
        data: body,
        status,
        statusText: String(status),
        headers: { 'content-type': 'application/json' },
        config,
    }
    if (status >= 400) {
        const err = Object.assign(new Error(`Request failed with status code ${status}`), { response, config })
        throw err
    }
    return response
}

const client = (adapter: AxiosAdapter) => new HttpRequest({ baseURL: '/api/v1', adapter })
const totalToasts = () => callableMock.mock.calls.length + errorMock.mock.calls.length + warningMock.mock.calls.length

let realLocation: Location

beforeEach(() => {
    callableMock.mockClear()
    errorMock.mockClear()
    warningMock.mockClear()
    // 401 分支会真的跳转登录页，用仓库既有的替身（按浏览器语义解析相对地址）
    realLocation = window.location
    stubLocation('http://localhost/cam/audit')
})

afterEach(() => {
    restoreLocation(realLocation)
    vi.restoreAllMocks()
})

describe('失败请求的提示契约（装配级）', () => {
    it('403：只提示一次，错误带已提示标记', async () => {
        const c = client(jsonAdapter(403, {}))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        expect(errorMock).toHaveBeenCalledTimes(1)
        expect(errorMock.mock.calls[0]?.[0]).toBe('权限不足，请联系管理员')
        expect(isErrorNotified(err)).toBe(true)
        // 下游去重：交给 showApiError 不应再补一条
        showApiError(err)
        expect(totalToasts()).toBe(1)
    })

    it('响应无 code：只提示一次', async () => {
        const c = client(jsonAdapter(200, { foo: 'bar' }))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        expect(errorMock).toHaveBeenCalledTimes(1)
        expect(errorMock.mock.calls[0]?.[0]).toBe('接口响应格式错误')
        expect(isErrorNotified(err)).toBe(true)
    })

    it('业务错误（code 非 0/200）：只提示一次且用后端 msg', async () => {
        const c = client(jsonAdapter(200, { code: 500, msg: '业务失败' }))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        expect(errorMock).toHaveBeenCalledTimes(1)
        expect(errorMock.mock.calls[0]?.[0]).toBe('业务失败')
        expect(isErrorNotified(err)).toBe(true)
    })

    it('5xx（handleApiError 兜底）：只有一条提示，且被标记', async () => {
        const c = client(jsonAdapter(500, { code: 500, msg: '服务器内部错误' }))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        // handleApiError 走函数式 ElMessage({...})，不是 ElMessage.error
        expect(errorMock).not.toHaveBeenCalled()
        expect(callableMock).toHaveBeenCalledTimes(1)
        expect(isErrorNotified(err)).toBe(true)
        showApiError(err)
        expect(totalToasts()).toBe(1)
    })

    it('401：只 warning 不 error，跳转登录页，且错误带标记', async () => {
        const c = client(jsonAdapter(401, {}))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        expect(errorMock).not.toHaveBeenCalled()
        expect(warningMock).toHaveBeenCalledTimes(1)
        // 只弹这一条：任何额外的 callable/error 提示都应让本断言失败
        expect(totalToasts()).toBe(1)
        expect(String((window.location as unknown as { href: string }).href)).toContain('/console/login')
        expect(isErrorNotified(err)).toBe(true)
    })

    it('成功响应：不弹任何提示；无 once 拦截器时 resolve 得到的是响应体（含信封）', async () => {
        // 记录既有行为：request() 末尾是 resolve(res.data)，没有 once 拦截器时调用方拿到的是整个响应体，
        // 而不是 ResponseData<T> 声明的 data 字段（类型声明与实际不符，属既有问题，此处仅钉住现状）。
        const c = client(jsonAdapter(200, { code: 0, data: { ok: true } }))
        const res = await c.get<{ ok: boolean }>({ url: '/x' })
        expect(totalToasts()).toBe(0)
        expect(res).toEqual({ code: 0, data: { ok: true } })
    })
})
