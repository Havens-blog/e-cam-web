/**
 * diskMetrics 纯逻辑单测:运营卡聚合 / IO 繁忙判定 / 空态判定顺序 / zero_exception 识别 / 口径标注 / 格式化。
 * 数据来源口径:ecam_disk_metric 指标表(usage_percent 0~100 已是百分比;IOPS 次/秒;吞吐 MB/s)。
 */
import type { DiskMetricPoint, DiskTopItem } from '@/api/asset'
import { describe, expect, it } from 'vitest'
import {
    deriveDiskCardState,
    DISK_COLLECT_TASK_TYPE,
    DISK_IOPS_BUSY_THRESHOLD,
    DISK_USAGE_BUSY_PERCENT,
    extractDiskCollectFailures,
    formatIOPS,
    formatThroughputMBps,
    formatUsagePercent,
    hasZeroException,
    isBusyShareScope,
    isIoBusyDisk,
    summarizeDiskTop,
    usageScopeLabel,
} from './diskMetrics'

const topItem = (overrides: Partial<DiskTopItem> = {}): DiskTopItem => ({
    disk_id: 'd-1',
    disk_name: 'disk-1',
    provider: 'aliyun',
    usage_scope: 'instance_level',
    account_id: [3],
    data_status: 'ok',
    latest: { date: '2026-09-20', usage_percent: 60.7, iops: 120, throughput: 3.5 },
    average: { usage_percent: 55, iops: 100, throughput: 3 },
    ...overrides,
})

describe('summarizeDiskTop', () => {
    it('计数磁盘数,平均使用率对 latest 有效行求均值(保留原始精度)', () => {
        const s = summarizeDiskTop([
            topItem({ latest: { date: '2026-09-20', usage_percent: 60, iops: 100, throughput: 1 } }),
            topItem({ disk_id: 'd-2', latest: { date: '2026-09-20', usage_percent: 80, iops: 200, throughput: 2 } }),
        ])
        expect(s.diskCount).toBe(2)
        expect(s.avgUsagePercent).toBe(70)
        expect(s.ioBusyCount).toBe(0)
    })

    it('IO 繁忙盘数:usage_percent > 80 计数', () => {
        const s = summarizeDiskTop([
            topItem({ latest: { date: '2026-09-20', usage_percent: 88.6, iops: 10, throughput: 1 } }),
            topItem({ disk_id: 'd-2', latest: { date: '2026-09-20', usage_percent: 50, iops: 10, throughput: 1 } }),
        ])
        expect(s.ioBusyCount).toBe(1)
    })

    it('IO 繁忙盘数:IOPS 超阈值也计数(usage 低但 IO 高)', () => {
        const s = summarizeDiskTop([
            topItem({ latest: { date: '2026-09-20', usage_percent: 10, iops: DISK_IOPS_BUSY_THRESHOLD + 1, throughput: 1 } }),
        ])
        expect(s.ioBusyCount).toBe(1)
    })

    it('zero_exception 行(口径缺失 0)不参与均值也不计繁忙', () => {
        const s = summarizeDiskTop([
            topItem({ data_status: 'zero_exception', qc_status: 'zero_exception', latest: { date: '2026-09-20', usage_percent: 0, iops: 0, throughput: 0 } }),
            topItem({ disk_id: 'd-2', latest: { date: '2026-09-20', usage_percent: 70, iops: 0, throughput: 0 } }),
        ])
        expect(s.avgUsagePercent).toBe(70)
        expect(s.ioBusyCount).toBe(0)
    })

    it('busy_share 合法闲盘 0 参与均值(data_status=ok)', () => {
        const s = summarizeDiskTop([
            topItem({ usage_scope: 'busy_share', latest: { date: '2026-09-20', usage_percent: 0, iops: 5, throughput: 0.1 } }),
            topItem({ disk_id: 'd-2', latest: { date: '2026-09-20', usage_percent: 60, iops: 10, throughput: 1 } }),
        ])
        expect(s.avgUsagePercent).toBe(30)
    })

    it('latest 缺失/usage 非法时防御式跳过(不抛错)', () => {
        const s = summarizeDiskTop([
            topItem({ latest: undefined as never }),
            topItem({ disk_id: 'x', latest: { usage_percent: Number.NaN, iops: Number.NaN, throughput: Number.NaN } }),
        ])
        expect(s.diskCount).toBe(2)
        expect(s.avgUsagePercent).toBeNull()
        expect(s.ioBusyCount).toBe(0)
    })

    it('空列表 → 空汇总,不抛错', () => {
        expect(summarizeDiskTop([])).toEqual({ diskCount: 0, avgUsagePercent: null, ioBusyCount: 0 })
    })
})

describe('isIoBusyDisk', () => {
    it('usage_percent > 80 → true;恰好等于阈值 → false(严格大于)', () => {
        expect(isIoBusyDisk(topItem({ latest: { date: '2026-09-20', usage_percent: DISK_USAGE_BUSY_PERCENT + 0.5, iops: 0, throughput: 0 } }))).toBe(true)
        expect(isIoBusyDisk(topItem({ latest: { date: '2026-09-20', usage_percent: DISK_USAGE_BUSY_PERCENT, iops: 0, throughput: 0 } }))).toBe(false)
    })

    it('IOPS >= 阈值 → true(即使使用率低)', () => {
        expect(isIoBusyDisk(topItem({ latest: { date: '2026-09-20', usage_percent: 10, iops: DISK_IOPS_BUSY_THRESHOLD, throughput: 0 } }))).toBe(true)
        expect(isIoBusyDisk(topItem({ latest: { date: '2026-09-20', usage_percent: 10, iops: DISK_IOPS_BUSY_THRESHOLD - 1, throughput: 0 } }))).toBe(false)
    })

    it('zero_exception 行(口径缺失 0)不算繁忙;latest 缺失防御式 false', () => {
        expect(isIoBusyDisk(topItem({ data_status: 'zero_exception', latest: { date: '2026-09-20', usage_percent: 0, iops: 0, throughput: 0 } }))).toBe(false)
        expect(isIoBusyDisk(topItem({ latest: undefined as never }))).toBe(false)
    })
})

describe('extractDiskCollectFailures', () => {
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
        expect(extractDiskCollectFailures(task)).toEqual([
            { provider: 'aws', account_id: 7, error_count: 3, last_error: 'AccessDenied' },
        ])
    })

    it('任务缺失/Result 形态不符时返回空数组', () => {
        expect(extractDiskCollectFailures(null)).toEqual([])
        expect(extractDiskCollectFailures(undefined)).toEqual([])
        expect(extractDiskCollectFailures('nope')).toEqual([])
        expect(extractDiskCollectFailures({})).toEqual([])
        expect(extractDiskCollectFailures({ result: { failures: 'not-array' } })).toEqual([])
    })
})

describe('deriveDiskCardState', () => {
    const failures = [{ provider: 'aws', account_id: 7, error_count: 3 }]

    it('采集失败 → 警示,优先于 0 占位(即使 Top 无数据)', () => {
        expect(deriveDiskCardState({ topFailed: false, itemCount: 0, failures })).toBe('warn')
    })

    it('Top 接口请求失败 → 警示', () => {
        expect(deriveDiskCardState({ topFailed: true, itemCount: 0, failures: [] })).toBe('warn')
    })

    it('任务成功且无数据 → empty(0 占位分支)', () => {
        expect(deriveDiskCardState({ topFailed: false, itemCount: 0, failures: [] })).toBe('empty')
    })

    it('有数据 → data', () => {
        expect(deriveDiskCardState({ topFailed: false, itemCount: 5, failures: [] })).toBe('data')
    })
})

describe('hasZeroException', () => {
    const point = (overrides: Partial<DiskMetricPoint> = {}): DiskMetricPoint => ({
        date: '2026-09-20', usage_percent: 60, usage_scope: 'instance_level', iops: 100, throughput: 2, data_status: 'ok', ...overrides,
    })

    it('data_status=zero_exception 识别为异常', () => {
        expect(hasZeroException([point(), point({ date: '2026-09-19', usage_percent: 0, data_status: 'zero_exception' })])).toBe(true)
    })

    it('qc_status=zero_exception(仅原样透出字段)也识别', () => {
        expect(hasZeroException([point({ data_status: 'ok', qc_status: 'zero_exception' })])).toBe(true)
    })

    it('全部正常 → false;空数组 → false', () => {
        expect(hasZeroException([point(), point()])).toBe(false)
        expect(hasZeroException([])).toBe(false)
    })
})

describe('usageScopeLabel / isBusyShareScope(口径标注,前端区分容量水位 vs IO 忙闲)', () => {
    it('口径 → 中文标注;空/未知回退原文', () => {
        expect(usageScopeLabel('instance_level')).toBe('实例级')
        expect(usageScopeLabel('busy_share')).toBe('IO 繁忙占比')
        expect(usageScopeLabel('cloud_disk_level')).toBe('云盘级')
        expect(usageScopeLabel('')).toBe('-')
        expect(usageScopeLabel('unknown_scope')).toBe('unknown_scope')
    })

    it('busy_share 判定', () => {
        expect(isBusyShareScope('busy_share')).toBe(true)
        expect(isBusyShareScope('instance_level')).toBe(false)
        expect(isBusyShareScope('')).toBe(false)
    })
})

describe('formatUsagePercent(0~100 百分比口径,与 NAS 0-1 口径不同)', () => {
    it('空值/非法 → "—"', () => {
        expect(formatUsagePercent(null)).toBe('—')
        expect(formatUsagePercent(undefined)).toBe('—')
        expect(formatUsagePercent(Number.NaN)).toBe('—')
        expect(formatUsagePercent(-1)).toBe('—')
    })

    it('保留一位小数并带 %', () => {
        expect(formatUsagePercent(0)).toBe('0%')
        expect(formatUsagePercent(60.7)).toBe('60.7%')
        expect(formatUsagePercent(88.649)).toBe('88.6%')
        expect(formatUsagePercent(100)).toBe('100%')
    })
})

describe('formatIOPS / formatThroughputMBps', () => {
    it('空值/非法 → "-"', () => {
        expect(formatIOPS(null)).toBe('-')
        expect(formatIOPS(Number.NaN)).toBe('-')
        expect(formatThroughputMBps(null)).toBe('-')
        expect(formatThroughputMBps(Number.NaN)).toBe('-')
    })

    it('IOPS 千分位;吞吐保留一位小数', () => {
        expect(formatIOPS(0)).toBe('0')
        expect(formatIOPS(12345)).toBe('12,345')
        expect(formatThroughputMBps(0)).toBe('0 MB/s')
        expect(formatThroughputMBps(3.52)).toBe('3.5 MB/s')
    })
})

describe('DISK_COLLECT_TASK_TYPE / 阈值常量', () => {
    it('与后端执行器任务类型一致', () => {
        expect(DISK_COLLECT_TASK_TYPE).toBe('disk:collect_metrics')
    })

    it('IO 繁忙阈值为运营口径常量(usage 80 / IOPS 阈值为正数)', () => {
        expect(DISK_USAGE_BUSY_PERCENT).toBe(80)
        expect(DISK_IOPS_BUSY_THRESHOLD).toBeGreaterThan(0)
    })
})
