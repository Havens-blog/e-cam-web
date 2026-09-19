/**
 * nasMetrics 纯逻辑单测:运营卡聚合 / 空态判定顺序 / zero_exception 识别 / 格式化。
 * 数据来源口径:ecam_nas_metric 指标表(单位 GB 二进制 GiB)。
 */
import type { NASTopItem, NASMetricPoint } from '@/api/asset'
import { describe, expect, it } from 'vitest'
import {
    deriveNasCardState,
    extractNasCollectFailures,
    formatCapacityGB,
    formatUtilization,
    hasZeroException,
    NAS_COLLECT_TASK_TYPE,
    summarizeNasTop,
} from './nasMetrics'

const topItem = (overrides: Partial<NASTopItem> = {}): NASTopItem => ({
    fs_id: 'fs-1',
    fs_name: '测试文件系统',
    provider: 'aliyun',
    account_id: [3],
    data_status: 'ok',
    latest: { date: '2026-09-18', capacity: 10240, used: 3072, utilization: 0.3 },
    average: { capacity: 10240, used: 3072, utilization: 0.3 },
    ...overrides,
})

describe('summarizeNasTop', () => {
    it('对多个 fs 的 latest 求和并计算平均使用率', () => {
        const items = [
            topItem({ latest: { date: '2026-09-18', capacity: 10240, used: 3072, utilization: 0.3 } }),
            topItem({ fs_id: 'fs-2', latest: { date: '2026-09-18', capacity: 20480, used: 10240, utilization: 0.5 } }),
        ]
        const s = summarizeNasTop(items)
        expect(s.totalCapacity).toBe(30720)
        expect(s.totalUsed).toBe(13312)
        expect(s.avgUtilization).toBeCloseTo(0.4)
        expect(s.fsCount).toBe(2)
    })

    it('utilization 为 null 的异常/无数据实例跳过,不参与均值(不记 0 拉低)', () => {
        const items = [
            topItem({ latest: { date: '2026-09-18', capacity: 10240, used: 5120, utilization: 0.5 } }),
            topItem({ fs_id: 'fs-zero', data_status: 'zero_exception', latest: { capacity: 0, used: 0, utilization: null } }),
            topItem({ fs_id: 'fs-none', latest: { capacity: null, used: null, utilization: null } }),
        ]
        const s = summarizeNasTop(items)
        expect(s.avgUtilization).toBe(0.5)
        expect(s.fsCount).toBe(3)
    })

    it('空列表 → 0/null,不抛错', () => {
        expect(summarizeNasTop([])).toEqual({ totalCapacity: 0, totalUsed: 0, avgUtilization: null, fsCount: 0 })
    })

    it('latest 缺失或字段非法时防御式处理', () => {
        const s = summarizeNasTop([topItem({ latest: undefined as never }), topItem({ fs_id: 'x', latest: { capacity: Number.NaN, used: 100, utilization: Number.NaN } })])
        expect(s.totalCapacity).toBe(0)
        expect(s.totalUsed).toBe(100)
        expect(s.avgUtilization).toBeNull()
    })
})

describe('extractNasCollectFailures', () => {
    it('提取 error_count>0 的失败明细', () => {
        const task = {
            result: {
                failures: [
                    { provider: 'aws', account_id: 7, error_count: 3, last_error: 'AccessDenied' },
                    { provider: 'aliyun', account_id: 3, error_count: 0 },
                    'bad-shape',
                    null,
                ],
            },
        }
        expect(extractNasCollectFailures(task)).toEqual([
            { provider: 'aws', account_id: 7, error_count: 3, last_error: 'AccessDenied' },
        ])
    })

    it('任务缺失/Result 形态不符时返回空数组', () => {
        expect(extractNasCollectFailures(null)).toEqual([])
        expect(extractNasCollectFailures(undefined)).toEqual([])
        expect(extractNasCollectFailures('nope')).toEqual([])
        expect(extractNasCollectFailures({})).toEqual([])
        expect(extractNasCollectFailures({ result: { failures: 'not-array' } })).toEqual([])
    })
})

describe('deriveNasCardState', () => {
    const failures = [{ provider: 'aws', account_id: 7, error_count: 3 }]

    it('采集失败 → 警示,优先于 0 占位(即使 Top 无数据)', () => {
        expect(deriveNasCardState({ topFailed: false, itemCount: 0, failures })).toBe('warn')
    })

    it('Top 接口请求失败 → 警示', () => {
        expect(deriveNasCardState({ topFailed: true, itemCount: 0, failures: [] })).toBe('warn')
    })

    it('任务成功且无数据 → empty(0 占位分支)', () => {
        expect(deriveNasCardState({ topFailed: false, itemCount: 0, failures: [] })).toBe('empty')
    })

    it('有数据 → data', () => {
        expect(deriveNasCardState({ topFailed: false, itemCount: 5, failures: [] })).toBe('data')
    })
})

describe('hasZeroException', () => {
    const point = (overrides: Partial<NASMetricPoint> = {}): NASMetricPoint => ({
        date: '2026-09-18', capacity: 1024, used: 512, utilization: 0.5, data_status: 'ok', ...overrides,
    })

    it('data_status=zero_exception 识别为异常', () => {
        expect(hasZeroException([point(), point({ date: '2026-09-17', capacity: 0, used: 0, utilization: null, data_status: 'zero_exception' })])).toBe(true)
    })

    it('qc_status=zero_exception(仅原样透出字段)也识别', () => {
        expect(hasZeroException([point({ data_status: 'ok', qc_status: 'zero_exception' })])).toBe(true)
    })

    it('全部正常 → false;空数组 → false', () => {
        expect(hasZeroException([point(), point()])).toBe(false)
        expect(hasZeroException([])).toBe(false)
    })
})

describe('formatCapacityGB', () => {
    it('空值/非法值 → "-"', () => {
        expect(formatCapacityGB(null)).toBe('-')
        expect(formatCapacityGB(undefined)).toBe('-')
        expect(formatCapacityGB(Number.NaN)).toBe('-')
    })

    it('单位换算:GB/TB/PB(二进制口径)', () => {
        expect(formatCapacityGB(0)).toBe('0 MB')
        expect(formatCapacityGB(0.5)).toBe('512 MB')
        expect(formatCapacityGB(1023.96)).toBe('1024 GB')
        expect(formatCapacityGB(1024)).toBe('1.0 TB')
        expect(formatCapacityGB(10240)).toBe('10.0 TB')
        expect(formatCapacityGB(1024 * 1024)).toBe('1.00 PB')
    })
})

describe('formatUtilization', () => {
    it('0-1 → 百分比,保留一位小数', () => {
        expect(formatUtilization(0)).toBe('0%')
        expect(formatUtilization(0.3)).toBe('30%')
        expect(formatUtilization(0.1234)).toBe('12.3%')
    })

    it('null/负值 → "—"(当日无数据)', () => {
        expect(formatUtilization(null)).toBe('—')
        expect(formatUtilization(undefined)).toBe('—')
        expect(formatUtilization(-1)).toBe('—')
    })
})

describe('NAS_COLLECT_TASK_TYPE', () => {
    it('与后端执行器任务类型一致', () => {
        expect(NAS_COLLECT_TASK_TYPE).toBe('nas:collect_metrics')
    })
})
