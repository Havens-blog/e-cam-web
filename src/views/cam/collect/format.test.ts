import { describe, expect, it } from 'vitest'
import {
    collectStartedAt,
    formatBillRange,
    formatCollectStartedAt,
    formatElapsed,
    formatHumanDuration,
} from './format'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 用本地时区字段构造期望值，避免测试依赖运行机器的时区 */
function expectLocalDateTime(ms: number): string {
    const d = new Date(ms)
    return (
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
        `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    )
}

function expectLocalDate(ms: number): string {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

describe('collectStartedAt', () => {
    it('优先使用 start_time（RFC3339）', () => {
        const start = '2026-10-27T03:19:19.240Z'
        expect(collectStartedAt({ start_time: start, ctime: 1793071159246 })).toBe(Date.parse(start))
    })

    it('start_time 为 Go 零值（0001-01-01）时回退 ctime 毫秒', () => {
        const ctime = 1793071159246
        expect(collectStartedAt({ start_time: '0001-01-01T00:00:00Z', ctime })).toBe(ctime)
    })

    it('ctime 为秒级时间戳时转毫秒', () => {
        expect(collectStartedAt({ start_time: '', ctime: 1793071159 })).toBe(1793071159000)
    })

    it('没有任何有效时间时返回 0', () => {
        expect(collectStartedAt({ start_time: '', ctime: 0 })).toBe(0)
        expect(collectStartedAt(null)).toBe(0)
    })
})

describe('formatCollectStartedAt', () => {
    it('按本地时区展示采集时间，而不是恒为空', () => {
        const start = '2026-10-27T03:19:19Z'
        expect(formatCollectStartedAt({ start_time: start, ctime: 0 })).toBe(
            expectLocalDateTime(Date.parse(start))
        )
    })

    it('无有效时间返回 -', () => {
        expect(formatCollectStartedAt({ start_time: '', ctime: 0 })).toBe('-')
    })
})

describe('formatBillRange', () => {
    it('账期按本地时区展示：UTC 零点不再截断成前一天', () => {
        const start = '2026-05-31T16:00:00Z' // 北京时间 2026-06-01 00:00
        const end = '2026-06-30T15:59:59Z' // 北京时间 2026-06-30 23:59:59
        expect(formatBillRange(start, end)).toBe(
            `${expectLocalDate(Date.parse(start))} ~ ${expectLocalDate(Date.parse(end))}`
        )
    })

    it('北京时间下 6 月账期显示为 6 月 1 日 ~ 6 月 30 日', () => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (tz !== 'Asia/Shanghai') return
        expect(formatBillRange('2026-05-31T16:00:00Z', '2026-06-30T15:59:59Z')).toBe(
            '2026-06-01 ~ 2026-06-30'
        )
    })

    it('缺失一端时保留另一端的可读性', () => {
        expect(formatBillRange(undefined, '2026-06-30T15:59:59Z')).toContain('~')
        expect(formatBillRange(undefined, undefined)).toBe('-')
    })
})

describe('formatHumanDuration / formatElapsed', () => {
    it('时长分档展示', () => {
        expect(formatHumanDuration(45_000)).toBe('45秒')
        expect(formatHumanDuration(332_000)).toBe('5分32秒')
        expect(formatHumanDuration(3_725_000)).toBe('1小时02分')
    })

    it('运行中记录显示已运行时长，不再显示 -', () => {
        const start = '2026-10-27T03:19:19Z'
        const now = Date.parse(start) + 332_000
        expect(formatElapsed({ status: 'running', start_time: start, duration_ms: 0 }, now)).toBe(
            '已运行 5分32秒'
        )
    })

    it('运行中但缺少开始时间时显示「进行中」', () => {
        expect(formatElapsed({ status: 'running', start_time: '', ctime: 0 }, Date.now())).toBe(
            '进行中'
        )
    })

    it('已结束记录沿用后端耗时（秒，保留一位小数）', () => {
        expect(formatElapsed({ status: 'success', duration_ms: 266_220 })).toBe('266.2s')
        expect(formatElapsed({ status: 'failed', duration_ms: 0 })).toBe('-')
    })
})
