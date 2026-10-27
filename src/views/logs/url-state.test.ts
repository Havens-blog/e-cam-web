import { describe, expect, it } from 'vitest'

import { decodeUrlState, encodeUrlState, clampWindow, hasQueryParams } from './url-state'

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
        // 解码层只做正整数校验(99999 原样透传);采纳与否由 useLogUrlSync 的 limitOptions 白名单决定
        expect(got.limit).toBe(99999)
        expect(got.filters).toEqual([])
        expect(decodeUrlState(new URLSearchParams('n=abc')).limit).toBeNull()
        expect(decodeUrlState(new URLSearchParams('n=1.5')).limit).toBeNull()
        expect(decodeUrlState(new URLSearchParams('n=0')).limit).toBeNull()
    })
    it('app 类型链接往返还原(encode 可写 decode 必认,漏认会静默落 cdn)', () => {
        const p = encodeUrlState({ t: 'app', startMs: null, endMs: null, clouds: [], resources: [], kw: '', filters: [], dim: '', metric: 'count', limit: null })
        expect(p.get('t')).toBe('app')
        expect(decodeUrlState(p).t).toBe('app')
    })
    it('各类型链接往返还原', () => {
        for (const t of ['cdn', 'waf', 'slb', 'access', 'app'] as const) {
            expect(decodeUrlState(new URLSearchParams(`t=${t}`)).t).toBe(t)
        }
    })
    it('只保留合法 op 与完整段的筛选', () => {
        const got = decodeUrlState(new URLSearchParams(`f=${encodeURIComponent('a:eq:1|b:bad:x|c::v')}`))
        expect(got.filters).toEqual([{ field: 'a', op: 'eq', value: '1', drilldown: false }])
    })
})

describe('clampWindow(按类型上限收紧时间窗)', () => {
    const NOW = 1_800_000_000_000
    const DAY = 24 * 3600_000

    it('未超窗原样保留(cdn 7d 窗口不受影响)', () => {
        const start = NOW - 5 * DAY
        expect(clampWindow(start, NOW, 7, NOW)).toEqual([start, NOW])
    })
    it('3d 类型分享长窗链接打开即收紧(end 对齐,start=end-3d)', () => {
        const start = NOW - 6 * DAY
        expect(clampWindow(start, NOW, 3, NOW)).toEqual([NOW - 3 * DAY, NOW])
    })
    it('end 超出现在钳到 now 再收紧', () => {
        const start = NOW - 6 * DAY
        const end = NOW + 2 * DAY
        expect(clampWindow(start, end, 3, NOW)).toEqual([NOW - 3 * DAY, NOW])
    })
    it('陈旧分享(end 在更早的历史)保持 end 对齐的历史窗口', () => {
        // 3d 上限下 end=5d 前仍合法:start 收紧到 end-3d,窗口整体留在历史
        expect(clampWindow(NOW - 8 * DAY, NOW - 5 * DAY, 3, NOW)).toEqual([NOW - 8 * DAY, NOW - 5 * DAY])
    })
    it('倒挂(URL start 晚于 end)回退最近 1 小时', () => {
        expect(clampWindow(NOW - 2 * 3600_000, NOW - 3 * 3600_000, 3, NOW)).toEqual([NOW - 3600_000, NOW])
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