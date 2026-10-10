/**
 * rdsMetrics 纯逻辑单测:zero_exception 识别 / 格式化(百分比、连接数)。
 * 数据来源口径:ecam_rds_metric 指标表(蓝本 storage/nas/nasMetrics.test.ts)。
 */
import type { RDSMetricPoint } from '@/api/asset'
import { describe, expect, it } from 'vitest'
import {
    formatConnections,
    formatPercent,
    hasZeroException,
    RDS_COLLECT_TASK_TYPE,
} from './rdsMetrics'

const point = (overrides: Partial<RDSMetricPoint> = {}): RDSMetricPoint => ({
    date: '2026-09-18',
    cpu_percent: 12.3,
    memory_percent: 45.6,
    disk_percent: 7.8,
    connections: 21,
    data_status: 'ok',
    qc_status: '',
    ...overrides,
})

describe('hasZeroException', () => {
    it('qc_status=zero_exception(四指标全 0 异常行)命中', () => {
        expect(hasZeroException([point({ qc_status: 'zero_exception', data_status: 'ok' })])).toBe(true)
    })

    it('data_status=zero_exception(读取侧判定)命中', () => {
        expect(hasZeroException([point({ data_status: 'zero_exception' })])).toBe(true)
    })

    it('无异常行/空窗口 → false', () => {
        expect(hasZeroException([point(), point({ date: '2026-09-19' })])).toBe(false)
        expect(hasZeroException([])).toBe(false)
    })

    it('防御式:非法元素不抛错', () => {
        expect(hasZeroException([point(), null as never, undefined as never])).toBe(false)
    })
})

describe('formatPercent', () => {
    it('百分比数值 → 一位小数 + %', () => {
        expect(formatPercent(12.34)).toBe('12.3%')
        expect(formatPercent(0)).toBe('0%')
        expect(formatPercent(100)).toBe('100%')
    })

    it('null/undefined/非法 → 长破折号(当日无数据)', () => {
        expect(formatPercent(null)).toBe('—')
        expect(formatPercent(undefined)).toBe('—')
        expect(formatPercent(Number.NaN)).toBe('—')
    })
})

describe('formatConnections', () => {
    it('连接数绝对值 → 取整展示', () => {
        expect(formatConnections(21)).toBe('21')
        expect(formatConnections(0)).toBe('0')
    })

    it('null/undefined/非法 → 长破折号(当日无数据)', () => {
        expect(formatConnections(null)).toBe('—')
        expect(formatConnections(undefined)).toBe('—')
        expect(formatConnections(Number.NaN)).toBe('—')
    })
})

describe('RDS_COLLECT_TASK_TYPE', () => {
    it('任务类型字面量与后端 rds:collect_metrics 一致', () => {
        expect(RDS_COLLECT_TASK_TYPE).toBe('rds:collect_metrics')
    })
})