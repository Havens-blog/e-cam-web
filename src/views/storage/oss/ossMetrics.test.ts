/**
 * ossMetrics 纯逻辑单测:运营卡聚合 / 近 7 天增速 / 空态判定顺序 / zero_exception 识别 / 格式化。
 * 数据来源口径:ecam_oss_metric 指标表(单位 GB 二进制 GiB / 个)。
 */
import type { OSSTopItem, OSSMetricPoint } from '@/api/asset'
import { describe, expect, it } from 'vitest'
import {
    computeStorageGrowth,
    deriveOssCardState,
    extractOssCollectFailures,
    formatCapacityGB,
    formatObjectCount,
    hasZeroException,
    OSS_COLLECT_TASK_TYPE,
    summarizeOssTop,
} from './ossMetrics'

const topItem = (overrides: Partial<OSSTopItem> = {}): OSSTopItem => ({
    bucket_name: 'bucket-1',
    provider: 'aliyun',
    account_id: [3],
    data_status: 'ok',
    latest: { date: '2026-09-18', storage_size: 10240, object_count: 1200 },
    average: { storage_size: 9216, object_count: 1000 },
    ...overrides,
})

describe('summarizeOssTop', () => {
    it('对多个 bucket 的 latest 求和(容量/对象数)并计数', () => {
        const items = [
            topItem({ latest: { date: '2026-09-18', storage_size: 10240, object_count: 1200 } }),
            topItem({ bucket_name: 'bucket-2', latest: { date: '2026-09-18', storage_size: 20480, object_count: 800 } }),
        ]
        const s = summarizeOssTop(items)
        expect(s.totalStorageSize).toBe(30720)
        expect(s.totalObjectCount).toBe(2000)
        expect(s.bucketCount).toBe(2)
    })

    it('latest 缺失或字段非法时防御式处理(null/NaN 跳过,不抛错)', () => {
        const s = summarizeOssTop([
            topItem({ latest: undefined as never }),
            topItem({ bucket_name: 'x', latest: { storage_size: Number.NaN, object_count: 100 } }),
        ])
        expect(s.totalStorageSize).toBe(0)
        expect(s.totalObjectCount).toBe(100)
        expect(s.bucketCount).toBe(2)
    })

    it('空列表 → 0,不抛错', () => {
        expect(summarizeOssTop([])).toEqual({ totalStorageSize: 0, totalObjectCount: 0, bucketCount: 0 })
    })
})

describe('computeStorageGrowth', () => {
    it('增速 = (最新 − 均值) / 均值,保留一位小数(百分比)', () => {
        expect(computeStorageGrowth(10240, 9216)).toBeCloseTo(11.1, 1)
        expect(computeStorageGrowth(1100, 1000)).toBe(10)
    })

    it('均值为 0/负值或任一缺失 → null(不算增速)', () => {
        expect(computeStorageGrowth(100, 0)).toBeNull()
        expect(computeStorageGrowth(100, -1)).toBeNull()
        expect(computeStorageGrowth(null, 100)).toBeNull()
        expect(computeStorageGrowth(100, null)).toBeNull()
        expect(computeStorageGrowth(Number.NaN, 100)).toBeNull()
    })
})

describe('extractOssCollectFailures', () => {
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
        expect(extractOssCollectFailures(task)).toEqual([
            { provider: 'aws', account_id: 7, error_count: 3, last_error: 'AccessDenied' },
        ])
    })

    it('任务缺失/Result 形态不符时返回空数组', () => {
        expect(extractOssCollectFailures(null)).toEqual([])
        expect(extractOssCollectFailures(undefined)).toEqual([])
        expect(extractOssCollectFailures('nope')).toEqual([])
        expect(extractOssCollectFailures({})).toEqual([])
        expect(extractOssCollectFailures({ result: { failures: 'not-array' } })).toEqual([])
    })
})

describe('deriveOssCardState', () => {
    const failures = [{ provider: 'aws', account_id: 7, error_count: 3 }]

    it('采集失败 → 警示,优先于 0 占位(即使 Top 无数据)', () => {
        expect(deriveOssCardState({ topFailed: false, itemCount: 0, failures })).toBe('warn')
    })

    it('Top 接口请求失败 → 警示', () => {
        expect(deriveOssCardState({ topFailed: true, itemCount: 0, failures: [] })).toBe('warn')
    })

    it('任务成功且无数据 → empty(0 占位分支)', () => {
        expect(deriveOssCardState({ topFailed: false, itemCount: 0, failures: [] })).toBe('empty')
    })

    it('有数据 → data', () => {
        expect(deriveOssCardState({ topFailed: false, itemCount: 5, failures: [] })).toBe('data')
    })
})

describe('hasZeroException', () => {
    const point = (overrides: Partial<OSSMetricPoint> = {}): OSSMetricPoint => ({
        date: '2026-09-18', storage_size: 1024, object_count: 10, data_status: 'ok', ...overrides,
    })

    it('data_status=zero_exception 识别为异常', () => {
        expect(hasZeroException([point(), point({ date: '2026-09-17', storage_size: 0, data_status: 'zero_exception' })])).toBe(true)
    })

    it('qc_status=zero_exception(仅原样透出字段)也识别', () => {
        expect(hasZeroException([point({ data_status: 'ok', qc_status: 'zero_exception' })])).toBe(true)
    })

    it('全部正常 → false;空数组 → false', () => {
        expect(hasZeroException([point(), point()])).toBe(false)
        expect(hasZeroException([])).toBe(false)
    })
})

describe('formatCapacityGB(经 ossMetrics 复用 nas 口径)', () => {
    it('空值 → "-";单位换算 GB/TB/PB(二进制口径)', () => {
        expect(formatCapacityGB(null)).toBe('-')
        expect(formatCapacityGB(0)).toBe('0 MB')
        expect(formatCapacityGB(1024)).toBe('1.0 TB')
        expect(formatCapacityGB(1024 * 1024)).toBe('1.00 PB')
    })
})

describe('formatObjectCount', () => {
    it('空值/非法值 → "-"', () => {
        expect(formatObjectCount(null)).toBe('-')
        expect(formatObjectCount(undefined)).toBe('-')
        expect(formatObjectCount(Number.NaN)).toBe('-')
    })

    it('数字千分位展示', () => {
        expect(formatObjectCount(0)).toBe('0')
        expect(formatObjectCount(1234567)).toBe('1,234,567')
    })
})

describe('OSS_COLLECT_TASK_TYPE', () => {
    it('与后端执行器任务类型一致', () => {
        expect(OSS_COLLECT_TASK_TYPE).toBe('oss:collect_metrics')
    })
})
