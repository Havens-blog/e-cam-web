// @vitest-environment happy-dom
/**
 * 查询条件保存纯函数回归:localStorage 持久化 / 名称与数量校验 / 状态脱敏落库。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteQuery, listSavedQueries, MAX_SAVED_QUERIES, saveQuery } from './saved-queries'
import type { SavedQueryState } from './saved-queries'

function state(over: Partial<SavedQueryState> = {}): SavedQueryState {
    return {
        t: 'cdn',
        startMs: 1700000000000,
        endMs: 1700003600000,
        clouds: ['aliyun'],
        accounts: [1, 2],
        resources: ['a.example.com'],
        kw: 'error',
        filters: [{ field: 'status', op: 'eq', value: '500' }],
        dim: '',
        metric: 'count',
        limit: 1000,
        ...over,
    }
}

beforeEach(() => {
    localStorage.clear()
})

describe('saved-queries', () => {
    it('saves and lists in newest-first order', () => {
        saveQuery('first', state())
        saveQuery('second', state({ kw: 'timeout' }))
        const list = listSavedQueries()
        expect(list).toHaveLength(2)
        expect(list[0]?.name).toBe('second')
        expect(list[1]?.name).toBe('first')
    })

    it('persists across listSavedQueries calls', () => {
        saveQuery('keep', state())
        expect(listSavedQueries()).toHaveLength(1)
        expect(listSavedQueries()[0]?.state.accounts).toEqual([1, 2])
    })

    it('rejects empty and over-long names', () => {
        expect(() => saveQuery('   ', state())).toThrow('查询名称不能为空')
        expect(() => saveQuery('x'.repeat(41), state())).toThrow('查询名称不能超过 40 字')
    })

    it('enforces save limit', () => {
        for (let i = 0; i < MAX_SAVED_QUERIES; i++) {
            saveQuery(`q${i}`, state())
        }
        expect(() => saveQuery('overflow', state())).toThrow('最多保存')
    })

    it('deletes by id', () => {
        const list = saveQuery('a', state())
        const id = list[0]?.id
        if (id) deleteQuery(id)
        expect(listSavedQueries()).toHaveLength(0)
    })

    it('sanitizes invalid state fields on save', () => {
        const saved = saveQuery('sanitize', state({
            t: 'bogus' as never,
            accounts: [1, 'x' as never],
            filters: [{ field: 'status', op: 'regex' as never, value: '500' }],
            limit: -1,
        }))[0]
        expect(saved?.state.t).toBe('cdn')
        expect(saved?.state.accounts).toEqual([1])
        expect(saved?.state.filters).toEqual([])
        expect(saved?.state.limit).toBeNull()
    })
})
