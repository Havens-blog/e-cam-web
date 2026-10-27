import { describe, expect, it } from 'vitest'
import { accountDisplayName, buildCollectLogQuery, hasActiveFilters } from './filters'

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

    it('账号 0 / 空状态视为未筛选', () => {
        expect(buildCollectLogQuery({ account_id: 0, status: '' }, 1, 20)).toEqual({
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
        expect(hasActiveFilters({ account_id: 5 })).toBe(true)
        expect(hasActiveFilters({ status: 'running' })).toBe(true)
    })
})

describe('accountDisplayName', () => {
    it('命中账号名', () => {
        expect(accountDisplayName(5, { 5: '集团-火山云' })).toBe('集团-火山云')
    })

    it('未知/已删除账号回退为「未知账号」', () => {
        expect(accountDisplayName(99, { 5: '集团-火山云' })).toBe('未知账号')
    })
})
