import { describe, expect, it } from 'vitest'
import type { AxiosResponse } from 'axios'
import { CertRequestError, unwrapCertEnvelope } from './cert'
import type { CertEnvelope } from './cert'

/** 构造已 resolve 的 axios 响应（信封解包只关心 res.data） */
function ok<T>(data: T, meta?: unknown): Promise<AxiosResponse<CertEnvelope<T>>> {
    return Promise.resolve({
        data: { success: true, data, ...(meta !== undefined ? { meta } : {}) },
    } as AxiosResponse<CertEnvelope<T>>)
}

/** 构造非 2xx 的 rejected axios 错误（后端 WriteError 输出 {success:false,error}） */
function httpError(status: number, code: string, message: string): never {
    const err = new Error('Request failed with status code ' + status) as Error & {
        response: { status: number; data: CertEnvelope<never> }
    }
    err.response = { status, data: { success: false, error: { code, message } } }
    throw err
}

describe('unwrapCertEnvelope（{success,data,error,meta} 信封解包，任务 6.1 AC#4）', () => {
    it('success=true 返回 data 载荷', async () => {
        await expect(unwrapCertEnvelope(ok({ certId: 'a1', fingerprint: 'ab' }))).resolves.toEqual({
            certId: 'a1',
            fingerprint: 'ab',
        })
    })

    it('data 缺省（如 DELETE 类端点）解包为 undefined', async () => {
        await expect(unwrapCertEnvelope(ok<undefined>(undefined))).resolves.toBeUndefined()
    })

    it('success=false 的 2xx 业务错误抛 CertRequestError 且保留错误码', async () => {
        const p = Promise.resolve({
            data: { success: false, error: { code: 'CERT_HAS_REFS', message: 'has refs' } },
        } as AxiosResponse<CertEnvelope<never>>)
        await expect(unwrapCertEnvelope(p)).rejects.toMatchObject({
            code: 'CERT_HAS_REFS',
            message: 'has refs',
        })
    })

    it('非 2xx 错误信封（409 SCAN_IN_PROGRESS 族）转译为 CertRequestError 供页面分支处理', async () => {
        const p = (async () => httpError(409, 'SCAN_IN_PROGRESS', 'scan already in progress'))()
        await expect(unwrapCertEnvelope(p)).rejects.toBeInstanceOf(CertRequestError)
        await expect(
            unwrapCertEnvelope((async () => httpError(409, 'SCAN_IN_PROGRESS', 'x'))()),
        ).rejects.toMatchObject({ code: 'SCAN_IN_PROGRESS' })
    })

    it('网络错误/无信封载荷原样抛出（不吞错）', async () => {
        const networkErr = new Error('Network Error') as Error & { response?: undefined }
        await expect(unwrapCertEnvelope(Promise.reject(networkErr))).rejects.toBe(networkErr)
        const badBody = Promise.resolve({ data: 'not-an-envelope' } as unknown as AxiosResponse<CertEnvelope>)
        await expect(unwrapCertEnvelope(badBody)).rejects.toBeInstanceOf(CertRequestError)
    })

    it('结构化 meta 随错误透传（删除拦截 409 CERT_HAS_REFS 的 refCount/protectUntil，任务 6.2）', async () => {
        // success=false 的 2xx 业务错误
        const p2xx = Promise.resolve({
            data: {
                success: false,
                error: { code: 'CERT_HAS_REFS', message: 'blocked' },
                meta: { refCount: 12, protectUntil: '2026-08-25T00:00:00Z' },
            },
        } as AxiosResponse<CertEnvelope<never>>)
        await expect(unwrapCertEnvelope(p2xx)).rejects.toMatchObject({
            code: 'CERT_HAS_REFS',
            meta: { refCount: 12 },
        })
        // 非 2xx 错误信封（后端 DeleteCert 拦截路径）
        const p409 = (async () => httpError(409, 'CERT_HAS_REFS', 'blocked'))() as Promise<never>
        await expect(unwrapCertEnvelope(p409)).rejects.toMatchObject({ code: 'CERT_HAS_REFS' })
    })

    it('CertRequestError 是 Error 子类（ElMessage.error 可直接消费 message）', () => {
        const e = new CertRequestError('CERT_PARSE_FAIL', 'parse failed')
        expect(e).toBeInstanceOf(Error)
        expect(e.name).toBe('CertRequestError')
        expect(e.code).toBe('CERT_PARSE_FAIL')
    })
})
