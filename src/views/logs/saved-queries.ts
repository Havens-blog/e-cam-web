/**
 * 日志查询条件保存与复用(纯函数,localStorage 客户端持久化)。
 *
 * 与 URL 分享(useLogUrlSync)互补:URL 适合一次性的协作者分享,而命名保存的
 * 查询预设适合个人反复使用同一套筛选组合。存储在本机浏览器,不落服务端 ——
 * logquery 是只读域(ADR D1,无 repository),查询条件保存不应引入新的持久化面。
 *
 * 约定:保存的是「查询条件」而非「查询结果」;加载时恢复条件并由页面触发重查,
 * 查询仍走后端权限与租户隔离,不会因复用条件而绕过任何鉴权。
 */
import type { LogQueryState } from './url-state'

/** 保存的查询条件 = URL 状态 + 云账号筛选(账号当前不进 URL,但属查询条件) */
export interface SavedQueryState extends LogQueryState {
    accounts: number[]
}

export interface SavedQuery {
    id: string
    name: string
    createdAt: number
    state: SavedQueryState
}

const STORAGE_KEY = 'ecam:log-query:presets'
/** 保存上限:避免 localStorage 无限膨胀 */
export const MAX_SAVED_QUERIES = 20

const LOG_TYPES = new Set<string>(['cdn', 'waf', 'slb', 'access', 'app', 'k8s-event'])
const FILTER_OPS = new Set(['eq', 'neq', 'contains', 'prefix'])

function readAll(): SavedQuery[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isSavedQuery).map(normalizeSavedQuery)
    } catch {
        return []
    }
}

function writeAll(list: SavedQuery[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function listSavedQueries(): SavedQuery[] {
    return readAll()
}

export function saveQuery(name: string, state: SavedQueryState): SavedQuery[] {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('查询名称不能为空')
    if (trimmed.length > 40) throw new Error('查询名称不能超过 40 字')

    const list = readAll()
    if (list.length >= MAX_SAVED_QUERIES) {
        throw new Error(`最多保存 ${MAX_SAVED_QUERIES} 个查询,请先删除不再使用的预设`)
    }

    const saved: SavedQuery = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        createdAt: Date.now(),
        state: sanitizeState(state),
    }
    const next = [saved, ...list]
    writeAll(next)
    return next
}

export function deleteQuery(id: string): SavedQuery[] {
    const next = readAll().filter((q) => q.id !== id)
    writeAll(next)
    return next
}

function sanitizeState(s: SavedQueryState): SavedQueryState {
    return {
        t: LOG_TYPES.has(s.t) ? s.t : 'cdn',
        startMs: typeof s.startMs === 'number' && s.startMs > 0 ? s.startMs : null,
        endMs: typeof s.endMs === 'number' && s.endMs > 0 ? s.endMs : null,
        clouds: pickStrings(s.clouds),
        accounts: pickNumbers(s.accounts),
        resources: pickStrings(s.resources),
        kw: typeof s.kw === 'string' ? s.kw : '',
        filters: pickFilters(s.filters),
        dim: typeof s.dim === 'string' ? s.dim : '',
        metric: typeof s.metric === 'string' ? s.metric : 'count',
        limit: typeof s.limit === 'number' && s.limit > 0 ? s.limit : null,
    }
}

function isSavedQuery(q: unknown): q is SavedQuery {
    if (!q || typeof q !== 'object') return false
    const o = q as Record<string, unknown>
    return typeof o.id === 'string' && o.id !== '' && typeof o.name === 'string' && o.name !== '' && typeof o.createdAt === 'number' && !!o.state && typeof o.state === 'object'
}

function normalizeSavedQuery(q: SavedQuery): SavedQuery {
    return { ...q, state: sanitizeState(q.state) }
}

function pickStrings(v: unknown): string[] {
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function pickNumbers(v: unknown): number[] {
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
}

function pickFilters(v: unknown): LogQueryState['filters'] {
    if (!Array.isArray(v)) return []
    return v
        .filter((x): x is { field: string; op: string; value: string } => {
            if (!x || typeof x !== 'object') return false
            const f = x as Record<string, unknown>
            return typeof f.field === 'string' && f.field !== '' && typeof f.op === 'string' && FILTER_OPS.has(f.op) && typeof f.value === 'string' && f.value !== ''
        })
        .map((f) => ({ field: f.field, op: f.op, value: f.value }))
}
