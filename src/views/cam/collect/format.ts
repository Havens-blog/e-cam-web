/**
 * 采集日志的时间/耗时格式化（纯函数，便于单测）
 *
 * 背景：后端 `CollectLog` 的 JSON 契约是 `start_time`（RFC3339 UTC）+ `ctime`（毫秒时间戳），
 * 并没有 `create_time`。旧实现按 `create_time` 取「采集时间」，导致该列恒为空。
 *
 * 注意：`bill_start/bill_end` 的语义由写入方决定（定时采集是 [上次成功, 当前时间] 的增量窗口，
 * 补采脚本是本地月边界），前端不做时区换算，保持原样展示；数据口径统一属后端后续事项。
 */
import type { CollectLog } from '@/api/types/finops'

type CollectLogTimeFields = Partial<Pick<CollectLog, 'start_time' | 'ctime'>>
type CollectLogDurationFields = Partial<Pick<CollectLog, 'status' | 'start_time' | 'ctime' | 'duration_ms'>>

/** 秒/毫秒时间戳分界：大于该值的按毫秒处理 */
const MS_THRESHOLD = 1e12

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * `yyyy-MM-dd HH:mm:ss`。不传 timeZone 时用浏览器本地时区（用户看自己的时间）；
 * 传 IANA 时区（单测用 "Asia/Shanghai"/"UTC"）时结果与机器时区无关。
 */
export function formatDateTime(ms: number, timeZone?: string): string {
  if (!timeZone) {
    const d = new Date(ms)
    return (
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
      `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    )
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
    .formatToParts(new Date(ms))
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

/**
 * 采集开始时间（毫秒）。`start_time` 优先；缺失或为零值时回退 `ctime`（兼容秒/毫秒）。
 * 后端未开始采集时 `start_time` 可能是 `0001-01-01T00:00:00Z`，按无效值处理。
 */
export function collectStartedAt(log: CollectLogTimeFields | null | undefined): number {
  const raw = log?.start_time
  if (raw) {
    const ms = Date.parse(raw)
    if (Number.isFinite(ms) && new Date(ms).getFullYear() > 1970) return ms
  }
  const ctime = log?.ctime
  if (typeof ctime === 'number' && Number.isFinite(ctime) && ctime > 0) {
    return ctime > MS_THRESHOLD ? ctime : ctime * 1000
  }
  return 0
}

/** 「采集时间」列：本地时区 yyyy-MM-dd HH:mm:ss，无有效时间时返回 '-' */
export function formatCollectStartedAt(
  log: CollectLogTimeFields | null | undefined,
  timeZone?: string
): string {
  const ms = collectStartedAt(log)
  return ms ? formatDateTime(ms, timeZone) : '-'
}

/** 人性化时长：< 1 分钟用秒，< 1 小时用「X分YY秒」，否则「X小时YY分」 */
export function formatHumanDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}秒`
  if (totalSeconds < 3600) {
    return `${Math.floor(totalSeconds / 60)}分${pad2(totalSeconds % 60)}秒`
  }
  return `${Math.floor(totalSeconds / 3600)}小时${pad2(Math.floor((totalSeconds % 3600) / 60))}分`
}

/**
 * 「耗时」列：运行中按开始时间实时计算「已运行 X分YY秒」；
 * 已结束按后端 duration_ms 展示（沿用既有 `x.xs` 口径）；其余为 '-'。
 */
export function formatElapsed(
  log: CollectLogDurationFields | null | undefined,
  now: number = Date.now()
): string {
  if (!log) return '-'
  if (log.status === 'running') {
    const started = collectStartedAt(log)
    if (!started) return '进行中'
    return `已运行 ${formatHumanDuration(Math.max(0, now - started))}`
  }
  const duration = log.duration_ms
  if (typeof duration === 'number' && duration > 0) return `${(duration / 1000).toFixed(1)}s`
  return '-'
}


/**
 * 长时长文案：>=1 天用「X天Y小时」，否则沿用 formatHumanDuration（分/秒）。
 * 用于「运行中 N 条 · 最长已运行 X」这类跨天僵尸任务汇总。
 */
export function formatLongDuration(ms: number): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '0秒'
  const safe = Math.max(0, Math.floor(ms))
  const days = Math.floor(safe / 86_400_000)
  if (days >= 1) return `${days}天${Math.floor((safe % 86_400_000) / 3_600_000)}小时`
  return formatHumanDuration(safe)
}

export interface RunningSummary {
  count: number
  /** 最早一条运行中任务的开始时间（毫秒），无有效时间时为 0 */
  oldestStartedAt: number
  /** 最长已运行时长（毫秒） */
  maxElapsedMs: number
  /** 最长已运行时长文案，无数据时为空串 */
  maxElapsedText: string
}

/**
 * 汇总运行中的采集任务：只统计 status=running，忽略缺失/非法开始时间。
 * 纯展示用途，不改变任何任务状态。
 */
export function summarizeRunningLogs(
  logs: Array<Partial<CollectLog>> | null | undefined,
  now: number = Date.now()
): RunningSummary {
  let count = 0
  let oldestStartedAt = 0
  let maxElapsedMs = 0
  for (const log of logs ?? []) {
    if (!log || log.status !== 'running') continue
    count += 1
    const started = collectStartedAt(log)
    if (!started) continue
    if (!oldestStartedAt || started < oldestStartedAt) oldestStartedAt = started
    maxElapsedMs = Math.max(maxElapsedMs, Math.max(0, now - started))
  }
  return {
    count,
    oldestStartedAt,
    maxElapsedMs,
    maxElapsedText: maxElapsedMs > 0 ? formatLongDuration(maxElapsedMs) : ''
  }
}
