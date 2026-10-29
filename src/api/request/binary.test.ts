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
})
