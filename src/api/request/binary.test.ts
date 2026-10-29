// @vitest-environment happy-dom
/**
 * 二进制下载的业务信封嗅探。
 *
 * 背景：导出接口在 HTTP 200 时也可能返回 { code: 500, msg: '无权限' } 这类业务信封，
 * 旧实现直接落盘 → 得到内容为错误 JSON 的 .csv，并提示「导出成功」。
 * 反向约束：JSON 格式导出（format=json）本身是合法文件（顶层数组），不能被误判。
 */
import { describe, expect, it, vi } from 'vitest'
import type { AxiosResponse } from 'axios'
import { assertBinaryPayload } from './index'

const jsonBlob = (payload: unknown) => new Blob([JSON.stringify(payload)], { type: 'application/json' })
const csvBlob = () => new Blob(['ID,name\n1,admin\n'], { type: 'text/csv' })

const response = (data: Blob, contentType = ''): AxiosResponse =>
    ({ data, headers: contentType ? { 'content-type': contentType } : {} }) as unknown as AxiosResponse

describe('assertBinaryPayload（二进制下载的业务信封嗅探）', () => {
    it('CSV 文件原样返回', async () => {
        const res = response(csvBlob())
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('顶层数组的 JSON 导出视为合法文件', async () => {
        const res = response(jsonBlob([]))
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('业务错误信封 → reject，并提示后端 msg', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const res = response(jsonBlob({ code: 500, msg: '没有导出权限' }))
        await expect(assertBinaryPayload(res)).rejects.toThrow('没有导出权限')
        spy.mockRestore()
    })

    it('成功信封（code=200 但没有文件）也 reject，避免落盘成假文件', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const res = response(jsonBlob({ code: 200, data: null }))
        await expect(assertBinaryPayload(res)).rejects.toThrow('接口未返回文件')
        spy.mockRestore()
    })

    it('content-type 来自响应头也能识别', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const blob = new Blob([JSON.stringify({ code: 403, msg: 'forbidden' })])
        await expect(assertBinaryPayload(response(blob, 'application/json; charset=utf-8'))).rejects.toThrow('forbidden')
        spy.mockRestore()
    })

    it('非 Blob 数据不受影响（原样返回）', async () => {
        const res = { data: { code: 0, data: [] }, headers: {} } as unknown as AxiosResponse
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('非法 JSON 文本不当成信封', async () => {
        const res = response(new Blob(['not-json'], { type: 'application/json' }))
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('content-type 错配（text/plain）的信封同样被拦下', async () => {
        const blob = new Blob([JSON.stringify({ code: 500, msg: '网关错误' })], { type: 'text/plain' })
        await expect(assertBinaryPayload(response(blob))).rejects.toThrow('网关错误')
    })

    it('text/html 错误页不是 JSON，按文件放行（避免误报）', async () => {
        const res = response(new Blob(['<html>502 Bad Gateway</html>'], { type: 'text/html' }))
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('成功信封带真实数据时重建文件而不是判死', async () => {
        const res = response(jsonBlob({ code: 0, data: [{ id: 1 }, { id: 2 }] }))
        const out = await assertBinaryPayload(res)
        expect(out.data).toBeInstanceOf(Blob)
        expect(await (out.data as Blob).text()).toBe('[{"id":1},{"id":2}]')
    })

    it('标量或空对象的 data 不重建文件（避免产出坏文件）', async () => {
        for (const data of [0, false, '', {}, []]) {
            const res = response(jsonBlob({ code: 0, data }))
            await expect(assertBinaryPayload(res)).rejects.toThrow('接口未返回文件')
        }
    })

    it('字符串 code "0"/"200" 视为成功码', async () => {
        const emptyRes = response(jsonBlob({ code: '200', data: null }))
        await expect(assertBinaryPayload(emptyRes)).rejects.toThrow('接口未返回文件')

        const withData = response(jsonBlob({ code: '0', data: [{ id: 9 }] }))
        const out = await assertBinaryPayload(withData)
        expect(await (out.data as Blob).text()).toBe('[{"id":9}]')
    })

    it('前导空白超过头部窗口（600 空格）的信封仍被拦下', async () => {
        const body = ' '.repeat(600) + JSON.stringify({ code: 500, msg: '空白绕过' })
        const res = response(new Blob([body], { type: 'application/json' }))
        await expect(assertBinaryPayload(res)).rejects.toThrow('空白绕过')
    })

    it('顶层 code 非数字的合法导出不被误判（如 {"code":"CN","rows":[...]}）', async () => {
        const res = response(jsonBlob({ code: 'CN', rows: [{ id: 1 }] }))
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('大体积对象文件（>64KB、非 JSON 类型）按头部放行', async () => {
        const body = JSON.stringify({ rows: Array.from({ length: 8000 }, (_, i) => ({ id: i, name: 'r' + i })) })
        const res = response(new Blob([body], { type: 'text/plain' }))
        expect((res.data as Blob).size).toBeGreaterThan(64 * 1024)
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('大体积 JSON 对象（>PARSE_MAX_BYTES）直接放行，不做整份解析', async () => {
        const body = JSON.stringify({ rows: Array.from({ length: 30000 }, (_, i) => ({ id: i, name: 'r' + i })) })
        const blob = new Blob([body], { type: 'application/json' })
        expect(blob.size).toBeGreaterThan(256 * 1024)
        const spy = vi.spyOn(Blob.prototype, 'text')
        const res = response(blob)
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
        // 只允许读头部窗口，不允许整份读取
        expect(spy.mock.instances.every((b) => (b as Blob).size <= 512)).toBe(true)
        spy.mockRestore()
    })

    it('大体积顶层数组（>64KB）走头部预判，不解析全文', async () => {
        const rows = Array.from({ length: 12000 }, (_, i) => ({ id: i, name: 'row-' + i }))
        const blob = new Blob([JSON.stringify(rows)], { type: 'application/json' })
        const res = response(blob)
        expect(blob.size).toBeGreaterThan(64 * 1024)
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })

    it('大体积 CSV 不受影响', async () => {
        const blob = new Blob(['ID,name\n' + '1,admin\n'.repeat(20000)], { type: 'text/csv' })
        const res = response(blob)
        await expect(assertBinaryPayload(res)).resolves.toBe(res)
    })
})
