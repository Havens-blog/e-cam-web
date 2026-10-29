// @vitest-environment happy-dom
/**
 * cert / eiam 两套独立 axios 客户端的失败归一（Option A 收尾）。
 *
 * 两个客户端此前只做 401 跳转后**原样 reject axios error**：
 *  - cert 侧非信封响应（网关错误等）在 `unwrapCertEnvelope` 里原样 rethrow，
 *    页面只能显示 axios 泛化文案（"Request failed with status code 4xx"）；
 *  - eiam 侧（switchTenant）同样丢失服务端原因。
 * 本用例经 **stub adapter** 走真实拦截器链，断言归一后的形态与既有契约不被破坏。
 */
import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import { certAxios } from './cert'
import { eiamAxios } from './eiam'

/** 构造一个「服务端返回了响应但状态码非 2xx」的 axios 拒绝（不触网） */
function rejectWith(status: number, data: unknown) {
    const err = new AxiosError(`Request failed with status code ${status}`)
    // @ts-expect-error 运行时补齐 axios 错误上拦截器会读取的字段
    err.response = { status, data, statusText: '', headers: {}, config: {} }
    err.config = { headers: {} } as never
    return err
}

const adapterRejecting = (status: number, data: unknown) => () => Promise.reject(rejectWith(status, data))

describe('certAxios 失败归一', () => {
    it('非信封响应体:message = 服务端 msg,并保留 response.data 供信封解包', async () => {
        const err = await certAxios
            .get('/certs/x', { adapter: adapterRejecting(403, { code: 403, msg: '权限不足，请联系管理员' }) })
            .catch((e) => e)

        expect(err).toBeInstanceOf(Error)
        expect(err.message).toBe('权限不足，请联系管理员')
        expect(err.status).toBe(403)
        expect(err.response?.data).toEqual({ code: 403, msg: '权限不足，请联系管理员' })
        expect(err.message).not.toContain('Request failed with status code')
    })

    it('cert 信封失败(非 2xx)仍可取到 error.message —— unwrapCertEnvelope 契约不变', async () => {
        const envelope = { success: false, error: { code: 'CERT_HAS_REFS', message: 'has refs' }, meta: { request_id: 'r1' } }
        const err = await certAxios.get('/certs/x', { adapter: adapterRejecting(409, envelope) }).catch((e) => e)

        // 信封原貌保留:unwrapCertEnvelope 仍会按 {success,error} 转 CertRequestError
        expect(err.response?.data).toEqual(envelope)
        // 归一 message 取信封可见文案(此处为作为兼容字段的 message)
        expect(err.message).toBe('has refs')
        expect(err.status).toBe(409)
    })

    it('取消(ERR_CANCELED)原样透传,不被包装', async () => {
        const canceled = new AxiosError('canceled', 'ERR_CANCELED')
        const err = await certAxios.get('/certs/x', { adapter: () => Promise.reject(canceled) }).catch((e) => e)
        expect(err).toBe(canceled)
    })
})

describe('eiamAxios 失败归一', () => {
    it('服务端 msg 透出(switchTenant 等消费方此前只有 axios 泛化文案)', async () => {
        const err = await eiamAxios
            .post('/api/iam/tenant/switch', {}, { adapter: adapterRejecting(404, { code: 404, msg: '租户不存在' }) })
            .catch((e) => e)

        expect(err).toBeInstanceOf(Error)
        expect(err.message).toBe('租户不存在')
        expect(err.status).toBe(404)
    })

    it('信封用 message 字段时同样可取', async () => {
        const err = await eiamAxios
            .get('/api/iam/user/profile', { adapter: adapterRejecting(500, { code: 500, message: '身份服务内部错误' }) })
            .catch((e) => e)
        expect(err.message).toBe('身份服务内部错误')
    })

    it('无响应(网络错误)原样透传,不改语义', async () => {
        const net = new AxiosError('Network Error', 'ERR_NETWORK')
        const err = await eiamAxios.get('/api/iam/user/profile', { adapter: () => Promise.reject(net) }).catch((e) => e)
        expect(err).toBe(net)
    })
})
