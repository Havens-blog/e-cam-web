import { describe, expect, it } from 'vitest'
import { accountDisplayName, buildCollectLogQuery, clampPage, hasActiveFilters } from './filters'

describe('buildCollectLogQuery', () => {
    it('空筛选只下发分页参数', () => {
        expect(buildCollectLogQuery({}, 1, 20)).toEqual({ offset: 0, limit: 20 })
        expect(buildCollectLogQuery({}, 3, 20)).toEqual({ offset: 40, limit: 20 })
    })

    it('账号与状态筛选按后端参数名下发', () => {
        expect(buildCollectLogQuery({ account_id: 5, status: 'failed' }, 1, 20)).toEqual({
            offset: 0,
            limit: 20,
            account_id: 5,
            status: 'failed',
        })
    })

    it('翻页与筛选可同时下发', () => {
        expect(buildCollectLogQuery({ account_id: 5, status: 'failed' }, 2, 20)).toEqual({
            offset: 20,
            limit: 20,
            account_id: 5,
            status: 'failed',
        })
    })

    it('账号 0 / 空状态视为未筛选（清空路径）', () => {
        expect(buildCollectLogQuery({ account_id: 0, status: undefined }, 1, 20)).toEqual({
            offset: 0,
            limit: 20,
        })
    })

    it('页码小于 1 时按第 1 页处理', () => {
        expect(buildCollectLogQuery({}, 0, 20)).toEqual({ offset: 0, limit: 20 })
    })
})

describe('hasActiveFilters', () => {
    it('识别生效筛选', () => {
        expect(hasActiveFilters({})).toBe(false)
        expect(hasActiveFilters({ account_id: 0 })).toBe(false)
        expect(hasActiveFilters({ account_id: 5 })).toBe(true)
        expect(hasActiveFilters({ status: 'running' })).toBe(true)
    })
})

describe('accountDisplayName', () => {
    it('命中账号名', () => {
        expect(accountDisplayName(5, { 5: '集团-火山云' })).toBe('集团-火山云')
    })

    it('未知/已删除/空名账号回退为「未知账号」', () => {
        expect(accountDisplayName(99, { 5: '集团-火山云' })).toBe('未知账号')
        expect(accountDisplayName(5, {})).toBe('未知账号')
        expect(accountDisplayName(5, { 5: '' })).toBe('未知账号')
    })
})

describe('clampPage', () => {
    it('total 缩小时把越界页码收敛到最后一页', () => {
        expect(clampPage(3, 29, 20)).toBe(2)
        expect(clampPage(2, 20, 20)).toBe(1)
        expect(clampPage(5, 0, 20)).toBe(1)
    })

    it('正常页码保持不变', () => {
        expect(clampPage(2, 1959, 20)).toBe(2)
        expect(clampPage(1, 0, 20)).toBe(1)
    })

    it('非法页码回落到第 1 页', () => {
        expect(clampPage(0, 100, 20)).toBe(1)
        expect(clampPage(Number.NaN, 100, 20)).toBe(1)
    })
})
