// @vitest-environment happy-dom
/**
 * showApiError：统一错误提示入口。
 *
 * 约定：请求层弹过提示的错误带 __apiErrorNotified 标记，这里不再重复弹；
 * 未标记的错误用 error.message（或 fallback）补一条。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('element-plus', () => ({
    ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}))

import { ElMessage } from 'element-plus'
import { isErrorNotified, markErrorNotified, showApiError } from './index'

const errorMock = vi.mocked(ElMessage.error)

afterEach(() => {
    errorMock.mockClear()
})

describe('showApiError', () => {
    it('未标记的错误：用 message 弹一次', () => {
        showApiError(new Error('导出失败'))
        expect(errorMock).toHaveBeenCalledTimes(1)
        expect(errorMock.mock.calls[0]?.[0]).toBe('导出失败')
    })

    it('已标记的错误：不再弹（请求层已提示过）', () => {
        showApiError(markErrorNotified(new Error('Request failed with status code 403')))
        expect(errorMock).not.toHaveBeenCalled()
    })

    it('非 Error / 空 message：回落到 fallback', () => {
        showApiError('boom', '操作失败')
        expect(errorMock.mock.calls[0]?.[0]).toBe('操作失败')
        showApiError(new Error(''), '加载失败')
        expect(errorMock.mock.calls[1]?.[0]).toBe('加载失败')
    })

    it('失败路径不影响标记语义', () => {
        const err = markErrorNotified(new Error('x'))
        showApiError(err)
        expect(isErrorNotified(err)).toBe(true)
        expect(errorMock).not.toHaveBeenCalled()
    })
})
