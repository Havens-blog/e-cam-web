// @vitest-environment happy-dom
/**
 * 装配级契约：一个失败请求 → 恰好一条用户提示。
 *
 * 上一轮审查指出「去重契约只单测了 helper，删掉拦截器里的 markErrorNotified 仍全绿」。
 * 这里用自定义 axios adapter 走真实 interceptor 链，断言：
 *  - 403 / 业务错误 / 无 code：ElMessage.error 恰好 1 次；
 *  - 401：只 warning（来自 redirectToLogin）不 error，且错误对象带「已提示」标记；
 *  - 成功：不提示。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'

vi.mock('element-plus', async (importOriginal) => {
    const actual = await importOriginal<typeof import('element-plus')>()
    return {
        ...actual,
        ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
    }
})

import { ElMessage } from 'element-plus'
import HttpRequest, { isErrorNotified } from './index'

const errorMock = vi.mocked(ElMessage.error)
const warningMock = vi.mocked(ElMessage.warning)

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

beforeEach(() => {
    errorMock.mockClear()
    warningMock.mockClear()
    // 401 分支会真的跳转，这里替换 location 防止测试进程被导航
    vi.stubGlobal('location', { href: 'http://localhost/cam/', origin: 'http://localhost' })
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('失败请求的提示契约（装配级）', () => {
    it('403：只提示一次，错误带已提示标记', async () => {
        const c = client(jsonAdapter(403, {}))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        expect(errorMock).toHaveBeenCalledTimes(1)
        expect(errorMock.mock.calls[0]?.[0]).toBe('权限不足，请联系管理员')
        expect(isErrorNotified(err)).toBe(true)
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

    it('401：只 warning 不 error，且错误带标记', async () => {
        const c = client(jsonAdapter(401, {}))
        const err = await c.get({ url: '/x' }).catch((e) => e)
        expect(errorMock).not.toHaveBeenCalled()
        expect(warningMock).toHaveBeenCalledTimes(1)
        expect(isErrorNotified(err)).toBe(true)
    })

    it('成功响应：不弹任何提示', async () => {
        const c = client(jsonAdapter(200, { code: 0, data: { ok: true } }))
        await c.get({ url: '/x' })
        expect(errorMock).not.toHaveBeenCalled()
        expect(warningMock).not.toHaveBeenCalled()
    })
})
