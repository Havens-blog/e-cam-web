/**
 * TopN 分组图点击下钻的纯逻辑(任务 6):维度映射 / 下钻行写入 / 清除下钻。
 * 下钻标记(drilldown)只存在于前端筛选行,buildFilters 提交时剥除,不进请求契约。
 */
import type { FieldFilter, LogType } from '@/api/types/logs'

/** 带下钻标记的字段筛选行(页面内使用;drilldown=true 表示该行由 TopN 图下钻产生/更新) */
export interface FieldFilterRow extends FieldFilter {
    drilldown?: boolean
}

/** 默认维度 → 筛选字段:非 waf(域名 Top)→ host,waf(规则 Top)→ rule_name */
function defaultTopnField(logType: LogType): string {
    return logType === 'waf' ? 'rule_name' : 'host'
}

/**
 * TopN 图当前维度 → 下钻筛选字段。
 * 注意以「聚合 topn 是否实际生效」为准:聚合失败/无 topn 时图回退为采样默认 TopN,
 * 即使选了自定义维度也应映射到默认字段,否则筛选字段与图上展示的分组对不上。
 */
export function topnDrilldownField(hasAggregateTopn: boolean, aggrDimension: string, logType: LogType): string {
    if (!hasAggregateTopn) return defaultTopnField(logType)
    return aggrDimension || defaultTopnField(logType)
}

/**
 * 应用一次下钻点击:
 * - 已有同字段 eq 行 → 更新该行 value 并打标记(值已来自下钻,可被「清除下钻」一并移除);
 * - 否则新增一行(行数达上限 max 时返回 null,由调用方提示,不静默丢条件)。
 * 不可变操作:返回新数组,不改写入参。
 */
export function applyDrilldown(rows: FieldFilterRow[], field: string, value: string, max: number): FieldFilterRow[] | null {
    const idx = rows.findIndex((f) => f.field === field && f.op === 'eq')
    if (idx >= 0) {
        return rows.map((f, i) => (i === idx ? { ...f, value, drilldown: true } : f))
    }
    if (rows.length >= max) return null
    return [...rows, { field, op: 'eq', value, drilldown: true }]
}

/**
 * 清除下钻:仅移除带下钻标记的行(用户手动加的条件原样保留)。
 * 无标记行时返回 null(无变化,调用方不必重查)。
 */
export function stripDrilldown(rows: FieldFilterRow[]): FieldFilterRow[] | null {
    if (!rows.some((f) => f.drilldown)) return null
    return rows.filter((f) => !f.drilldown)
}
