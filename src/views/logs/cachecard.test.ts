/**
 * CDN 缓存分析卡展示辅助(纯函数)单测:
 * 标签/枚举与后端 e-cam-service internal/logquery/cdncache 引擎约定对齐
 * (grade / direction / action / confidence)。
 */
import { describe, expect, it } from 'vitest'
import type { CacheOptimizationItem } from '@/api/types/logs'
import {
    cacheDirectionLabel,
    cacheDirectionTagType,
    cacheGradeLabel,
    cacheGradeTagType,
    confidenceLabel,
    coveredSourceText,
    formatCacheBytes,
    formatPrevBase,
    formatRate,
    isScanConfirmError,
    missingSourceNames,
    optimizationActionLabel,
    optimizationCopyText,
    splitOptimizations,
} from './cachecard'

describe('cacheGradeLabel/TagType(健康档位,与引擎 grade 对齐)', () => {
    it('good→优/success、fair→中/warning、poor→差/danger、unknown→未知/info', () => {
        expect(cacheGradeLabel('good')).toBe('优')
        expect(cacheGradeLabel('fair')).toBe('中')
        expect(cacheGradeLabel('poor')).toBe('差')
        expect(cacheGradeLabel('unknown')).toBe('未知')
        expect(cacheGradeLabel('other')).toBe('other')
        expect(cacheGradeTagType('good')).toBe('success')
        expect(cacheGradeTagType('fair')).toBe('warning')
        expect(cacheGradeTagType('poor')).toBe('danger')
        expect(cacheGradeTagType('unknown')).toBe('info')
    })
})

describe('formatRate(0-1 → 百分比)', () => {
    it('一位小数百分比;非法值占位', () => {
        expect(formatRate(0.723)).toBe('72.3%')
        expect(formatRate(0)).toBe('0.0%')
        expect(formatRate(1)).toBe('100.0%')
        expect(formatRate(undefined)).toBe('—')
        expect(formatRate(Number.NaN)).toBe('—')
    })
})

describe('cacheDirectionLabel/TagType(前窗趋势)', () => {
    it('up→↑上升/success、down→↓下降、flat→→持平、未知占位', () => {
        expect(cacheDirectionLabel('up')).toBe('↑ 上升')
        expect(cacheDirectionLabel('down')).toBe('↓ 下降')
        expect(cacheDirectionLabel('flat')).toBe('→ 持平')
        expect(cacheDirectionLabel('other')).toBe('—')
        expect(cacheDirectionTagType('up')).toBe('success')
        // 下降未达告警阈值:warning;达阈值:danger
        expect(cacheDirectionTagType('down', false)).toBe('warning')
        expect(cacheDirectionTagType('down', true)).toBe('danger')
        expect(cacheDirectionTagType('flat')).toBe('info')
        expect(cacheDirectionTagType('up', true)).toBe('success')
    })
})

describe('optimizationActionLabel(建议动作,与引擎 action 枚举对齐)', () => {
    it('四种动作映射 + 未知透传', () => {
        expect(optimizationActionLabel('add_cache_rule')).toBe('加缓存规则')
        expect(optimizationActionLabel('tune_ttl')).toBe('调整 TTL')
        expect(optimizationActionLabel('ignore_query_string')).toBe('忽略查询串')
        expect(optimizationActionLabel('origin_verify')).toBe('回源校验')
        expect(optimizationActionLabel('custom')).toBe('custom')
    })
})

describe('confidenceLabel(可信度分级)', () => {
    it('high/medium/low → 高/中/低可信', () => {
        expect(confidenceLabel('high')).toBe('高可信')
        expect(confidenceLabel('medium')).toBe('中可信')
        expect(confidenceLabel('low')).toBe('低可信')
        expect(confidenceLabel('x')).toBe('x')
    })
})

describe('splitOptimizations(低可信度默认折叠)', () => {
    const items: CacheOptimizationItem[] = [
        { action: 'add_cache_rule', miss_traffic_ratio: 0.4, confidence: 'high', low_confidence: false, evidence: 'e1' },
        { action: 'tune_ttl', miss_traffic_ratio: 0.3, confidence: 'medium', low_confidence: false, evidence: 'e2' },
        { action: 'ignore_query_string', miss_traffic_ratio: 0.2, confidence: 'low', low_confidence: true, evidence: 'e3' },
        // 兜底:后端只给 confidence=low 未打 low_confidence 标记时同样折叠
        { action: 'origin_verify', miss_traffic_ratio: 0.1, confidence: 'low', low_confidence: false, evidence: 'e4' },
    ]

    it('low_confidence=true 或 confidence=low 归入折叠组,其余保持原序', () => {
        const { visible, more } = splitOptimizations(items)
        expect(visible.map((o) => o.action)).toEqual(['add_cache_rule', 'tune_ttl'])
        expect(more.map((o) => o.action)).toEqual(['ignore_query_string', 'origin_verify'])
    })

    it('空输入两组皆空', () => {
        expect(splitOptimizations([])).toEqual({ visible: [], more: [] })
    })
})

describe('optimizationCopyText(纯文本清单,可复制)', () => {
    it('含统一标注/序号/目标/动作/占比/可信度/证据', () => {
        const text = optimizationCopyText([
            { domain: 'a.com', uri_prefix: '/api/', action: 'add_cache_rule', miss_traffic_ratio: 0.35, confidence: 'high', low_confidence: false, evidence: 'URI /api/list 未命中 12,000 次' },
            { action: 'tune_ttl', miss_traffic_ratio: 0.2, confidence: 'medium', low_confidence: false, evidence: '' },
        ])
        expect(text).toContain('建议,执行前请验证')
        expect(text).toContain('1. a.com · /api/ → 加缓存规则(未命中流量占比 35.0%,可信度:高可信)')
        expect(text).toContain('证据:URI /api/list 未命中 12,000 次')
        // 全局项:域名缺省为"全局"
        expect(text).toContain('2. 全局 → 调整 TTL(未命中流量占比 20.0%,可信度:中可信)')
        expect(text).not.toContain('证据: ')
    })
})

describe('formatCacheBytes(字节量人类可读)', () => {
    it('B/KB/MB/GB/TB 逐档', () => {
        expect(formatCacheBytes(0)).toBe('0 B')
        expect(formatCacheBytes(1023)).toBe('1,023 B')
        expect(formatCacheBytes(1024)).toBe('1.0 KB')
        expect(formatCacheBytes(5 * 1024 * 1024)).toBe('5.0 MB')
        expect(formatCacheBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB')
        expect(formatCacheBytes(2 * 1024 * 1024 * 1024 * 1024)).toBe('2.0 TB')
        expect(formatCacheBytes(undefined)).toBe('—')
        expect(formatCacheBytes(Number.NaN)).toBe('—')
    })
})

describe('coveredSourceText/missingSourceNames(趋势"基于 X/Y 源")', () => {
    const sources = [
        { cloud: 'aliyun', account_id: 'a1', account_name: '阿里A', total: 1, error: '', duration_ms: 1 },
        { cloud: 'aws', account_id: 'a2', account_name: 'AWS B', total: 0, error: 'boom', duration_ms: 1 },
    ]

    it('成功源/总源比例;空数组返回空串(调用方不渲染)', () => {
        expect(coveredSourceText(sources)).toBe('基于 1/2 源')
        expect(coveredSourceText([{ ...sources[0]!, error: '' }])).toBe('基于 1/1 源')
        expect(coveredSourceText([])).toBe('')
    })

    it('缺失源列出 云·账号 名', () => {
        expect(missingSourceNames(sources)).toEqual(['AWS·AWS B'])
        expect(missingSourceNames([])).toEqual([])
    })
})

describe('formatPrevBase(对比基期:前一 N)', () => {
    it('秒/分钟/小时三档', () => {
        expect(formatPrevBase(59)).toBe('前一 59 秒')
        expect(formatPrevBase(60)).toBe('前一 1 分钟')
        expect(formatPrevBase(3600)).toBe('前一 60 分钟')
        expect(formatPrevBase(5400)).toBe('前一 90 分钟')
        expect(formatPrevBase(7200)).toBe('前一 2 小时')
        expect(formatPrevBase(0)).toBe('')
    })
})

describe('isScanConfirmError(预估扫描量拦截识别)', () => {
    it('命中 confirm=true 提示或预估文案;普通错误不误判', () => {
        expect(isScanConfirmError('estimated scan volume is high: window 7h0m0s × 2 frames; confirm with confirm=true to proceed')).toBe(true)
        expect(isScanConfirmError('预估扫描量超限,请确认后重试')).toBe(true)
        expect(isScanConfirmError('cache-analyze only supports cdn log type')).toBe(false)
        expect(isScanConfirmError('')).toBe(false)
    })
})
