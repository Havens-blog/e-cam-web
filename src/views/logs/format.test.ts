import { describe, expect, it } from 'vitest'

import type { LogEntry, LogSourceOutcome, WAFLogEntry } from '@/api/types/logs'
import {
    actionTagType,
    cacheHitTagType,
    cellValue,
    cloudLabel,
    dashIfEmpty,
    formatBytes,
    formatLogTime,
    formatSpanMs,
    quickValuesFor,
    severityTagType,
    sourceSummary,
    sourcesHealth,
    statusTagType,
} from './format'

describe('cloudLabel', () => {
    it('maps known clouds to Chinese labels', () => {
        expect(cloudLabel('aliyun')).toBe('阿里云')
        expect(cloudLabel('huawei')).toBe('华为云')
        expect(cloudLabel('aws')).toBe('AWS')
    })
    it('passes through unknown clouds', () => {
        expect(cloudLabel('mystery')).toBe('mystery')
    })
})

describe('formatLogTime', () => {
    it('formats unix ms as MM-dd HH:mm:ss', () => {
        // 2026-08-27T17:56:02 本地时区由 Date 决定,只断言结构
        expect(formatLogTime(1787824562000)).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })
    it('returns dash for 0/invalid', () => {
        expect(formatLogTime(0)).toBe('—')
        expect(formatLogTime(Number.NaN)).toBe('—')
    })
})

describe('dashIfEmpty', () => {
    it('maps empty-ish values to dash', () => {
        expect(dashIfEmpty('')).toBe('—')
        expect(dashIfEmpty(undefined)).toBe('—')
        expect(dashIfEmpty(null)).toBe('—')
    })
    it('keeps meaningful values', () => {
        expect(dashIfEmpty(0)).toBe('0')
        expect(dashIfEmpty('x')).toBe('x')
    })
})

describe('tag types', () => {
    it('action/severity/cache/status map to semantic tag types', () => {
        expect(actionTagType('block')).toBe('danger')
        expect(actionTagType('alert')).toBe('warning')
        expect(actionTagType('allow')).toBe('success')
        expect(severityTagType('high')).toBe('danger')
        expect(severityTagType('low')).toBe('info')
        expect(cacheHitTagType('hit')).toBe('success')
        expect(cacheHitTagType('miss')).toBe('info')
        expect(statusTagType(200)).toBe('success')
        expect(statusTagType(502)).toBe('danger')
        expect(statusTagType(404)).toBe('warning')
    })
})

describe('formatBytes', () => {
    it('formats byte scales', () => {
        expect(formatBytes(0)).toBe('0 B')
        expect(formatBytes(1024)).toBe('1.0 KB')
        expect(formatBytes(1536 * 1024)).toBe('1.50 MB')
        expect(formatBytes(undefined)).toBe('—')
    })
})

describe('sourcesHealth', () => {
    const ok: LogSourceOutcome = { cloud: 'aliyun', account_id: '1', account_name: 'a', count: 3, error: '', duration_ms: 10 }
    const bad: LogSourceOutcome = { ...ok, count: 0, error: 'boom' }
    it('classifies aggregation health', () => {
        expect(sourcesHealth([])).toBe('empty')
        expect(sourcesHealth([ok, ok])).toBe('ok')
        expect(sourcesHealth([ok, bad])).toBe('partial')
        expect(sourcesHealth([bad, bad])).toBe('all-failed')
    })
    it('summarizes outcome text', () => {
        expect(sourceSummary(ok)).toBe('阿里云·a:3 条')
        expect(sourceSummary(bad)).toBe('阿里云·a:失败(boom)')
    })
})

describe('quickValuesFor(字段筛选快捷值:仅来自样本,零额外请求)', () => {
    function entryOf(values: Record<string, unknown>): LogEntry {
        return {
            meta: {
                cloud: 'aliyun',
                account_id: 'acc-1',
                account_name: '阿里A',
                region: 'r',
                resource_id: 'd1',
                source: 's',
            },
            timestamp: 1787824562000,
            ...values,
        } as unknown as LogEntry
    }

    it('按频率降序去重,返回 chip 值列表', () => {
        const entries = [
            entryOf({ host: 'a.com' }),
            entryOf({ host: 'a.com' }),
            entryOf({ host: 'b.com' }),
            entryOf({ host: 'a.com' }),
        ]
        expect(quickValuesFor(entries, 'host')).toEqual(['a.com', 'b.com'])
    })

    it('数值字段(状态码)与 meta.* 字段口径一致(统一走 cellValue)', () => {
        const entries = [
            entryOf({ status: 404 }),
            entryOf({ status: 404 }),
            entryOf({ status: 200 }),
            entryOf({}),
        ]
        expect(quickValuesFor(entries, 'status')).toEqual(['404', '200'])
        expect(quickValuesFor(entries, 'meta.cloud')).toEqual(['aliyun'])
    })

    it('跳过空串/缺失值,全空样本整洁降级为空列表', () => {
        const entries = [entryOf({ host: '' }), entryOf({}), entryOf({ host: null })]
        expect(quickValuesFor(entries, 'host')).toEqual([])
        expect(quickValuesFor([], 'status')).toEqual([])
    })

    it('上限 8 个:高频值优先保留', () => {
        const entries = Array.from({ length: 12 }, (_, i) => entryOf({ client_ip: i === 0 ? 'hot' : `ip-${i}` }))
        entries.unshift(...Array.from({ length: 5 }, () => entryOf({ client_ip: 'hot' })))
        const values = quickValuesFor(entries, 'client_ip')
        expect(values.length).toBe(8)
        expect(values[0]).toBe('hot')
        expect(values).toContain('ip-1')
        // 同频按字典序截断:ip-10/ip-11 排在 ip-2 前,被挤出的是 ip-6 之后
        expect(values).not.toContain('ip-6')
    })

    it('同频值排序稳定(字典序),多次调用结果一致', () => {
        const entries = [entryOf({ method: 'GET' }), entryOf({ method: 'POST' }), entryOf({ method: 'PUT' })]
        expect(quickValuesFor(entries, 'method')).toEqual(['GET', 'POST', 'PUT'])
        expect(quickValuesFor(entries, 'method')).toEqual(quickValuesFor(entries, 'method'))
    })
})

describe('formatSpanMs', () => {
    it('秒级(<60s):显示 X秒', () => {
        expect(formatSpanMs(5_000)).toBe('5秒')
        expect(formatSpanMs(59_400)).toBe('59秒')
    })
    it('分级(≥60s):分钟或分+秒', () => {
        expect(formatSpanMs(60_000)).toBe('1分钟')
        expect(formatSpanMs(150_000)).toBe('2分30秒')
        expect(formatSpanMs(3600_000)).toBe('60分钟')
    })
    it('非法/负值/零返回空串(调用方据此不渲染标注)', () => {
        expect(formatSpanMs(-1)).toBe('')
        expect(formatSpanMs(0)).toBe('')
        expect(formatSpanMs(Number.NaN)).toBe('')
        expect(formatSpanMs(Number.POSITIVE_INFINITY)).toBe('')
    })
})

describe('cellValue', () => {
    const row = {
        meta: { cloud: 'aliyun', resource_id: 'alb-1' },
        timestamp: 1787824562000,
        rule_name: '恶意爬虫2',
    } as unknown as WAFLogEntry
    it('resolves nested meta keys', () => {
        expect(cellValue(row, 'meta.cloud')).toBe('aliyun')
        expect(cellValue(row, 'meta.resource_id')).toBe('alb-1')
    })
    it('resolves top-level keys', () => {
        expect(cellValue(row, 'rule_name')).toBe('恶意爬虫2')
    })
})
