// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useListError } from './useListError'

describe('useListError（列表请求的持久错误态）', () => {
    it('成功：返回结果且清空错误态', async () => {
        const { errorInfo, run } = useListError()
        const result = await run(async () => ({ items: [1, 2] }), '获取列表失败')

        expect(result).toEqual({ items: [1, 2] })
        expect(errorInfo.value).toBeNull()
    })

    it('失败：置 ErrorInfo 并返回 undefined（调用方据此清空列表，而不是渲染「暂无数据」）', async () => {
        const { errorInfo, run } = useListError()
        const result = await run(async () => {
            throw { response: { status: 500, data: { message: 'boom' } } }
        }, '获取快照列表失败')

        expect(result).toBeUndefined()
        expect(errorInfo.value).not.toBeNull()
        expect(errorInfo.value?.message).toBe('获取快照列表失败')
        expect(String(errorInfo.value?.code)).toContain('500')
    })

    it('失败后再次成功：错误态被清空（重试恢复的关键语义）', async () => {
        const { errorInfo, run } = useListError()

        await run(async () => {
            throw new Error('network down')
        }, '获取列表失败')
        expect(errorInfo.value).not.toBeNull()

        const ok = await run(async () => 'data', '获取列表失败')
        expect(ok).toBe('data')
        expect(errorInfo.value).toBeNull()
    })

    it('reset 可手动清空（重试前复位）', async () => {
        const { errorInfo, run, reset } = useListError()
        await run(async () => {
            throw new Error('x')
        }, '失败')
        expect(errorInfo.value).not.toBeNull()

        reset()
        expect(errorInfo.value).toBeNull()
    })

})
