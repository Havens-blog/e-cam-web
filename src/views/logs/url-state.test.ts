import { describe, expect, it } from 'vitest'

import { decodeUrlState, encodeUrlState, hasQueryParams } from './url-state'

describe('encodeUrlState(仅写非默认值)', () => {
    it('全默认 → 空参数串', () => {
        const p = encodeUrlState({ t: 'cdn', startMs: null, endMs: null, clouds: [], resources: [], kw: '', filters: [], dim: '', metric: 'count', limit: null })
        expect([...p.entries()]).toEqual([])
    })
    it('完整状态 → 各参数编码', () => {
        const p = encodeUrlState({
            t: 'waf', startMs: 1000, endMs: 2000, clouds: ['aliyun', 'huawei'], resources: ['hwyun-waf-logs/attack'],
            kw: 'status:404', filters: [{ field: 'uri', op: 'contains', value: '/api/a?b=1', drilldown: true }],
            dim: 'host', metric: 'avg_latency', limit: 500,
        })
        expect(p.get('t')).toBe('waf')
        expect(p.get('st')).toBe('1000')
        expect(p.get('c')).toBe('aliyun,huawei')
        expect(p.get('r')).toBe(encodeURIComponent('hwyun-waf-logs/attack'))
        expect(p.get('f')).toBe(`uri:contains:${encodeURIComponent('/api/a?b=1')}`)
        expect(p.get('d')).toBe('host')
        expect(p.get('m')).toBe('avg_latency')
        expect(p.get('n')).toBe('500')
    })
})

describe('decodeUrlState', () => {
    it('roundtrip:encode → decode 不丢信息(含 / : | 字符的值)', () => {
        const src = {
            t: 'slb' as const, startMs: 111, endMs: 222, clouds: ['aliyun'], resources: ['a/b'],
            kw: '改', filters: [{ field: 'uri', op: 'contains', value: '/api/x?y=1|2:3', drilldown: false }],
            dim: 'client_ip', metric: 'count', limit: 100,
        }
        const p = encodeUrlState(src)
        const got = decodeUrlState(p)
        expect(got).toEqual(src)
    })
    it('缺失/非法项回退默认', () => {
        const got = decodeUrlState(new URLSearchParams('t=xxx&st=abc&et=&n=99999&f=bad'))
        expect(got.t).toBe('cdn')
        expect(got.startMs).toBeNull()
        expect(got.endMs).toBeNull()
        expect(got.limit).toBeNull()
        expect(got.filters).toEqual([])
    })
    it('只保留合法 op 与完整段的筛选', () => {
        const got = decodeUrlState(new URLSearchParams(`f=${encodeURIComponent('a:eq:1|b:bad:x|c::v')}`))
        expect(got.filters).toEqual([{ field: 'a', op: 'eq', value: '1', drilldown: false }])
    })
})

describe('hasQueryParams(分享进入是否自动查询)', () => {
    it('有窗口/关键词/筛选/云任一即 true', () => {
        expect(hasQueryParams(new URLSearchParams('st=1'))).toBe(true)
        expect(hasQueryParams(new URLSearchParams('kw=x'))).toBe(true)
        expect(hasQueryParams(new URLSearchParams('c=aliyun'))).toBe(true)
        expect(hasQueryParams(new URLSearchParams('t=waf'))).toBe(true)
    })
    it('空/纯默认参数为 false', () => {
        expect(hasQueryParams(new URLSearchParams(''))).toBe(false)
        expect(hasQueryParams(new URLSearchParams('d=host'))).toBe(false)
        expect(hasQueryParams(new URLSearchParams('m=count'))).toBe(false)
    })
})