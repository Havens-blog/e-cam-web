// @vitest-environment happy-dom
/**
 * 错误提示去重：请求层已弹过提示的错误要带标记，调用方据此不再重复弹。
 *
 * 背景：403 / 业务错误由请求层 ElMessage.error（中文），对话框 catch 又 ElMessage.error(error.message)
 * （英文 axios 串），两条 toast 坐标完全重叠 → 中文提示被英文盖住（QA peakLive=2 实测）。
 */
import { describe, expect, it } from 'vitest'
import { isErrorNotified, markErrorNotified, normalizeRequestError } from './index'

describe('错误提示标记', () => {
    it('标记后 isErrorNotified 为 true，未标记为 false', () => {
        const err = markErrorNotified(new Error('权限不足'))
        expect(isErrorNotified(err)).toBe(true)
        expect(isErrorNotified(new Error('x'))).toBe(false)
    })

    it('非对象/空值不抛错', () => {
        expect(isErrorNotified(undefined)).toBe(false)
        expect(isErrorNotified(null)).toBe(false)
        expect(isErrorNotified('x')).toBe(false)
        expect(markErrorNotified('x')).toBe('x')
    })

    it('normalizeRequestError 归一后仍保留标记（调用方据此不再重复提示）', () => {
        const axiosLike = Object.assign(new Error('Request failed with status code 403'), {
            response: { status: 403, data: { code: 403, msg: '权限不足，请联系管理员' } },
        })
        markErrorNotified(axiosLike)
        const normalized = normalizeRequestError(axiosLike)
        expect(normalized).not.toBe(axiosLike)
        expect(isErrorNotified(normalized)).toBe(true)
    })

    it('未标记的错误归一后也不带标记', () => {
        const axiosLike = Object.assign(new Error('boom'), {
            response: { status: 500, data: { code: 500, msg: '服务器内部错误' } },
        })
        expect(isErrorNotified(normalizeRequestError(axiosLike))).toBe(false)
    })

    it('无 HTTP 响应的错误原样透传且标记保留', () => {
        const err = markErrorNotified(new Error('导出失败'))
        expect(normalizeRequestError(err)).toBe(err)
        expect(isErrorNotified(err)).toBe(true)
    })
})
