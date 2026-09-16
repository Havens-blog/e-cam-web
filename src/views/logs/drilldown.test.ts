/**
 * TopN 下钻纯逻辑(任务 6):
 * - topnDrilldownField:图当前维度 → 筛选字段(默认维度按类型映射,自定义维度透传);
 * - applyDrilldown:同字段 eq 行更新值不重复加行;超上限不生效;
 * - stripDrilldown:仅移除带下钻标记的行,用户手动条件原样保留。
 */
import { describe, expect, it } from 'vitest'
import { applyDrilldown, stripDrilldown, topnDrilldownField } from './drilldown'
import type { FieldFilterRow } from './drilldown'

describe('topnDrilldownField(维度映射)', () => {
    it('采样回退(聚合 topn 未生效)时用默认维度:非 waf → host', () => {
        expect(topnDrilldownField(false, '', 'cdn')).toBe('host')
        expect(topnDrilldownField(false, '', 'slb')).toBe('host')
    })

    it('采样回退时即使填了自定义维度也用默认维度(图实际展示的是默认 TopN)', () => {
        expect(topnDrilldownField(false, 'real_client_ip', 'cdn')).toBe('host')
    })

    it('默认维度 waf → rule_name', () => {
        expect(topnDrilldownField(false, '', 'waf')).toBe('rule_name')
        expect(topnDrilldownField(true, '', 'waf')).toBe('rule_name')
    })

    it('聚合 topn 生效且选了自定义维度 → 原始列同名透传(如 real_client_ip)', () => {
        expect(topnDrilldownField(true, 'real_client_ip', 'cdn')).toBe('real_client_ip')
    })

    it('聚合 topn 生效但维度为空(默认)→ 按类型映射', () => {
        expect(topnDrilldownField(true, '', 'cdn')).toBe('host')
    })
})

describe('applyDrilldown(写入下钻筛选行)', () => {
    it('无同字段条件时新增一行(field/op/value 齐全,带下钻标记),不改原数组', () => {
        const rows: FieldFilterRow[] = [{ field: 'status', op: 'eq', value: '404' }]
        const next = applyDrilldown(rows, 'host', 'a.com', 4)
        expect(next).toEqual([
            { field: 'status', op: 'eq', value: '404' },
            { field: 'host', op: 'eq', value: 'a.com', drilldown: true },
        ])
        // 不可变:原数组不被改写
        expect(rows).toHaveLength(1)
    })

    it('已存在同字段 eq 条件 → 更新该行 value 并打标记,不重复加行', () => {
        const rows: FieldFilterRow[] = [{ field: 'host', op: 'eq', value: 'a.com' }]
        const next = applyDrilldown(rows, 'host', 'b.com', 4)
        expect(next).toEqual([{ field: 'host', op: 'eq', value: 'b.com', drilldown: true }])
    })

    it('同字段但操作符不同的行不复用(如 host=contains 时仍新增 eq 行)', () => {
        const rows: FieldFilterRow[] = [{ field: 'host', op: 'contains', value: 'a' }]
        const next = applyDrilldown(rows, 'host', 'b.com', 4)
        expect(next).toHaveLength(2)
        expect(next![1]).toEqual({ field: 'host', op: 'eq', value: 'b.com', drilldown: true })
    })

    it('行数达上限且无同字段 eq 行 → 返回 null(不生效,由调用方提示)', () => {
        const rows: FieldFilterRow[] = [
            { field: 'status', op: 'eq', value: '404' },
            { field: 'client_ip', op: 'prefix', value: '1.' },
            { field: 'method', op: 'eq', value: 'GET' },
            { field: 'action', op: 'eq', value: 'block' },
        ]
        expect(applyDrilldown(rows, 'host', 'a.com', 4)).toBeNull()
    })
})

describe('stripDrilldown(清除下钻)', () => {
    it('仅移除带下钻标记的行,用户手动条件与顺序原样保留', () => {
        const rows: FieldFilterRow[] = [
            { field: 'status', op: 'eq', value: '404' },
            { field: 'host', op: 'eq', value: 'a.com', drilldown: true },
            { field: 'client_ip', op: 'prefix', value: '1.', drilldown: false },
            { field: 'host', op: 'eq', value: 'b.com', drilldown: true },
        ]
        expect(stripDrilldown(rows)).toEqual([
            { field: 'status', op: 'eq', value: '404' },
            { field: 'client_ip', op: 'prefix', value: '1.', drilldown: false },
        ])
    })

    it('无下钻标记行时返回 null(无变化,调用方不重查)', () => {
        const rows: FieldFilterRow[] = [{ field: 'host', op: 'eq', value: 'a.com' }]
        expect(stripDrilldown(rows)).toBeNull()
        expect(stripDrilldown([])).toBeNull()
    })
})
