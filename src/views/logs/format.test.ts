import { describe, expect, it } from 'vitest'

import type { LogSourceOutcome, WAFLogEntry } from '@/api/types/logs'
import {
    actionTagType,
    cacheHitTagType,
    cellValue,
    cloudLabel,
    dashIfEmpty,
    formatBytes,
    formatLogTime,
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
