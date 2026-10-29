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
        regions: ['cn-hangzhou'],
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
            regions: ['cn-hangzhou', 7 as never],
            filters: [{ field: 'status', op: 'regex' as never, value: '500' }],
            limit: -1,
        }))[0]
        expect(saved?.state.t).toBe('cdn')
        expect(saved?.state.accounts).toEqual([1])
        expect(saved?.state.regions).toEqual(['cn-hangzhou'])
        expect(saved?.state.filters).toEqual([])
        expect(saved?.state.limit).toBeNull()
    })

    it('区域筛选随预置保存与还原(#70 接缝:此前捕获项漏了 regions)', () => {
        saveQuery('带区域', state({ regions: ['cn-shenzhen', 'eu-central-1'] }))
        expect(listSavedQueries()[0]?.state.regions).toEqual(['cn-shenzhen', 'eu-central-1'])
        // 空区域 = 全部区域,同样应原样保存(还原为"全部")
        saveQuery('全区域', state({ regions: [] }))
        expect(listSavedQueries()[0]?.state.regions).toEqual([])
    })

    it('向后兼容:早期无 regions 字段的已保存条目归一为 [](不丢其余条件)', () => {
        // 直接写入"旧版"结构(#61 时期,无 regions)
        const legacy = [{
            id: 'legacy-1',
            name: '旧预置',
            createdAt: 1,
            state: {
                t: 'app', startMs: 1700000000000, endMs: 1700003600000,
                clouds: ['aliyun'], accounts: [5], resources: [],
                kw: 'boom', filters: [], dim: '', metric: 'count', limit: 100,
            },
        }]
        localStorage.setItem('ecam:log-query:presets', JSON.stringify(legacy))
        const got = listSavedQueries()[0]!
        expect(got.state.regions).toEqual([])
        expect(got.state.accounts).toEqual([5])
        expect(got.state.t).toBe('app')
        expect(got.state.kw).toBe('boom')
    })
})
