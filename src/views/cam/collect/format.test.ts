import { describe, expect, it } from 'vitest'
import {
    collectStartedAt,
    formatCollectStartedAt,
    formatDateTime,
    formatElapsed,
    formatHumanDuration,
    formatLongDuration,
    summarizeRunningLogs,
} from './format'

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
    // 固定时区断言，避免在 UTC 的 CI 上出现「实现换成 UTC 也通过」的自证
    it('Asia/Shanghai 下按 +08 展示采集时间', () => {
        expect(
            formatCollectStartedAt({ start_time: '2026-10-27T03:19:19Z', ctime: 0 }, 'Asia/Shanghai')
        ).toBe('2026-10-27 11:19:19')
    })

    it('UTC 下同一时刻展示为 UTC（证明确实做了时区换算）', () => {
        expect(
            formatCollectStartedAt({ start_time: '2026-10-27T03:19:19Z', ctime: 0 }, 'UTC')
        ).toBe('2026-10-27 03:19:19')
    })

    it('start_time 缺失时用 ctime 兜底并格式化', () => {
        expect(
            formatCollectStartedAt({ start_time: '', ctime: 1793071159246 }, 'Asia/Shanghai')
        ).toBe('2026-10-27 11:19:19')
    })

    it('无有效时间返回 -', () => {
        expect(formatCollectStartedAt({ start_time: '', ctime: 0 })).toBe('-')
    })
})

describe('formatDateTime', () => {
    it('不传时区时与系统时区一致（本地 getter 与 Intl 两条路径互证）', () => {
        const ms = Date.parse('2026-01-02T03:04:05Z')
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        expect(formatDateTime(ms)).toBe(formatDateTime(ms, tz))
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

    it('运行中以 start_time 为准，不受 ctime 影响', () => {
        const start = '2026-10-27T03:19:19Z'
        const now = Date.parse(start) + 60_000
        expect(
            formatElapsed(
                { status: 'running', start_time: start, ctime: Date.parse(start) - 86_400_000, duration_ms: 0 },
                now
            )
        ).toBe('已运行 1分00秒')
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



describe('formatLongDuration', () => {
  it('跨天显示天与小时，未满一天沿用分/秒口径', () => {
    expect(formatLongDuration(236 * 86_400_000)).toBe('236天0小时')
    expect(formatLongDuration(2 * 86_400_000 + 3 * 3_600_000)).toBe('2天3小时')
    expect(formatLongDuration(90 * 60_000)).toBe('1小时30分')
    expect(formatLongDuration(30_000)).toBe('30秒')
  })
})

describe('summarizeRunningLogs', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')

  it('统计运行中数量与最长已运行', () => {
    const s = summarizeRunningLogs(
      [
        { status: 'running', start_time: '2026-10-27T11:00:00Z' },
        { status: 'running', start_time: '2026-10-25T12:00:00Z' },
        { status: 'success', start_time: '2026-10-27T10:00:00Z' },
        { status: 'running' }
      ] as any,
      now
    )
    expect(s.count).toBe(3)
    expect(s.maxElapsedMs).toBe(2 * 86_400_000)
    expect(s.maxElapsedText).toBe('2天0小时')
    expect(s.oldestStartedAt).toBe(Date.parse('2026-10-25T12:00:00Z'))
  })

  it('空值与全部非运行中返回 0', () => {
    expect(summarizeRunningLogs(null, now)).toEqual({
      count: 0,
      oldestStartedAt: 0,
      maxElapsedMs: 0,
      maxElapsedText: ''
    })
    expect(summarizeRunningLogs([{ status: 'success' }] as any, now).count).toBe(0)
  })

  it('回退 ctime（缺失 start_time）', () => {
    const s = summarizeRunningLogs(
      [{ status: 'running', ctime: Date.parse('2026-10-27T10:00:00Z') }] as any,
      now
    )
    expect(s.count).toBe(1)
    expect(s.maxElapsedText).toBe('2小时00分')
  })
})


describe('summarizeRunningLogs 边界', () => {
  const now = Date.parse('2026-10-27T12:00:00Z')

  it('空数组返回 0', () => {
    expect(summarizeRunningLogs([], now).count).toBe(0)
  })

  it('仅一条无时间运行中：计数 1、最长文案为空', () => {
    const s = summarizeRunningLogs([{ status: 'running' }] as any, now)
    expect(s.count).toBe(1)
    expect(s.maxElapsedText).toBe('')
    expect(s.oldestStartedAt).toBe(0)
  })

  it('未来 start_time 不计入时长（clamp 到 0）', () => {
    const s = summarizeRunningLogs(
      [{ status: 'running', start_time: '2026-10-28T12:00:00Z' }] as any,
      now
    )
    expect(s.count).toBe(1)
    expect(s.maxElapsedMs).toBe(0)
  })
})

describe('formatLongDuration 边界', () => {
  it('跨天边界与非法值', () => {
    expect(formatLongDuration(86_399_999)).toBe('23小时59分')
    expect(formatLongDuration(86_400_000)).toBe('1天0小时')
    expect(formatLongDuration(Number.NaN)).toBe('0秒')
  })
})
