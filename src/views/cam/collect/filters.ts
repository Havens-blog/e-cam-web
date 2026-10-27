/**
 * 采集日志筛选的纯函数（便于单测）
 */
import type { CollectLogQuery } from '@/api/finops'

export interface CollectLogFilters {
    account_id?: number
    status?: string
}

/** 把页面筛选条件转成接口参数：空值不下发，分页从 1 开始 */
export function buildCollectLogQuery(
    filters: CollectLogFilters,
    page: number,
    pageSize: number
): CollectLogQuery {
    const query: CollectLogQuery = {
        offset: Math.max(0, page - 1) * pageSize,
        limit: pageSize,
    }
    if (filters.account_id) query.account_id = filters.account_id
    if (filters.status) query.status = filters.status
    return query
}

/** 是否存在生效的筛选条件 */
export function hasActiveFilters(filters: CollectLogFilters): boolean {
    return Boolean(filters.account_id || filters.status)
}

/** 账号展示名：未加载到（或已删除）的账号回退为「未知账号」，ID 另行展示 */
export function accountDisplayName(
    accountId: number,
    names: Record<number, string>
): string {
    return names[accountId] || '未知账号'
}
