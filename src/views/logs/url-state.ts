/**
 * 日志查询条件 ⇄ URL query 编解码(刷新还原 / 复制链接分享,纯函数可单测)。
 * 约定:
 * - t=日志类型;st/et=窗口起止(Unix ms,绝对时间刷新跨小时可还原);
 *   c/r=云/源(逗号连,项内 encodeURIComponent 防 `/` `,` 冲突);
 *   kw=关键词;f=筛选(field:op:encodedValue 由 | 连,value 可含 `:`/`|`/`/`);
 *   d/m=分组维度/指标;n=单源上限。全默认时不写任何冗余参数。
 * 注意只读写 query,不动 hash(路由为 history 模式)。
 */
import type { LogType } from '@/api/types/logs'
import type { FieldFilterRow } from './drilldown'

export interface LogQueryState {
    t: LogType
    /** 窗口起点 Unix ms;null = 用默认窗口(最近 1 小时) */
    startMs: number | null
    /** 窗口终点 Unix ms;null = 当前时间 */
    endMs: number | null
    clouds: string[]
    resources: string[]
    kw: string
    filters: FieldFilterRow[]
    dim: string
    metric: string
    limit: number | null
}

const FILTER_OPS = new Set(['eq', 'neq', 'contains', 'prefix'])

/** 状态 → URLSearchParams(仅写非默认值) */
export function encodeUrlState(s: LogQueryState): URLSearchParams {
    const p = new URLSearchParams()
    if (s.t !== 'cdn') p.set('t', s.t)
    if (s.startMs != null) p.set('st', String(s.startMs))
    if (s.endMs != null) p.set('et', String(s.endMs))
    if (s.clouds.length) p.set('c', s.clouds.map(encodeURIComponent).join(','))
    if (s.resources.length) p.set('r', s.resources.map(encodeURIComponent).join(','))
    if (s.kw) p.set('kw', s.kw)
    if (s.filters.length) {
        p.set(
            'f',
            s.filters
                .filter((x) => x.field && x.op && x.value)
                .map((x) => `${x.field}:${x.op}:${encodeURIComponent(x.value)}`)
                .join('|'),
        )
    }
    if (s.dim) p.set('d', s.dim)
    if (s.metric && s.metric !== 'count') p.set('m', s.metric)
    if (s.limit != null && s.limit !== 1000) p.set('n', String(s.limit))
    return p
}

/** URLSearchParams → 状态(非法/缺失项回退默认;filters 只保留合法 op) */
export function decodeUrlState(params: URLSearchParams): LogQueryState {
    const state: LogQueryState = {
        t: params.get('t') === 'waf' || params.get('t') === 'slb' ? (params.get('t') as LogType) : 'cdn',
        startMs: parseMs(params.get('st')),
        endMs: parseMs(params.get('et')),
        clouds: splitEncoded(params.get('c')),
        resources: splitEncoded(params.get('r')),
        kw: params.get('kw') || '',
        filters: [],
        dim: params.get('d') || '',
        metric: params.get('m') || 'count',
        limit: null,
    }
    if (params.get('n') != null) {
        const n = Number(params.get('n'))
        state.limit = Number.isInteger(n) && n >= 100 && n <= 2000 ? n : null
    }
    for (const seg of (params.get('f') || '').split('|')) {
        if (!seg) continue
        const i1 = seg.indexOf(':')
        if (i1 <= 0) continue
        const i2 = seg.indexOf(':', i1 + 1)
        if (i2 <= i1) continue
        const field = seg.slice(0, i1)
        const op = seg.slice(i1 + 1, i2)
        const value = decodeURIComponent(seg.slice(i2 + 1))
        if (!field || !value || !FILTER_OPS.has(op)) continue
        state.filters.push({ field, op, value, drilldown: false })
    }
    return state
}

/** 状态是否携带「协作信息」:有则分享进入后自动跑查询 */
export function hasQueryParams(params: URLSearchParams): boolean {
    return ['st', 'et', 'kw', 'f', 'c', 'r', 't'].some((k) => params.has(k) && (params.get(k) || '') !== '')
}

function parseMs(v: string | null): number | null {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
}

function splitEncoded(v: string | null): string[] {
    if (!v) return []
    return v
        .split(',')
        .filter(Boolean)
        .map((x) => {
            try {
                return decodeURIComponent(x)
            } catch {
                return x
            }
        })
}