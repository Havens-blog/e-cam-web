/**
 * 采集日志的时间/耗时格式化（纯函数，便于单测）
 *
 * 背景：后端 `CollectLog` 的 JSON 契约是 `start_time`（RFC3339 UTC）+ `ctime`（毫秒时间戳），
 * 并没有 `create_time`。旧实现按 `create_time` 取「采集时间」，导致该列恒为空；
 * 账期则用 `toISOString().slice(0,10)` 截断，UTC 零点被显示成前一天。
 */
import type { CollectLog } from '@/api/types/finops'

type CollectLogTimeFields = Partial<Pick<CollectLog, 'start_time' | 'ctime'>>
type CollectLogDurationFields = Partial<Pick<CollectLog, 'status' | 'start_time' | 'ctime' | 'duration_ms'>>

/** 秒/毫秒时间戳分界：大于该值的按毫秒处理 */
const MS_THRESHOLD = 1e12

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 本地时区 yyyy-MM-dd HH:mm:ss */
export function formatLocalDateTime(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  )
}

/** 本地时区 yyyy-MM-dd */
export function formatLocalDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
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
export function formatCollectStartedAt(log: CollectLogTimeFields | null | undefined): string {
  const ms = collectStartedAt(log)
  return ms ? formatLocalDateTime(ms) : '-'
}

/** 账期范围：按本地时区展示，避免 UTC 零点被截断成前一天 */
export function formatBillRange(start: string | undefined, end: string | undefined): string {
  const startDate = toLocalDateText(start)
  const endDate = toLocalDateText(end)
  if (!startDate && !endDate) return '-'
  return `${startDate || '-'} ~ ${endDate || '-'}`
}

function toLocalDateText(value: string | undefined): string {
  if (!value) return ''
  const ms = Date.parse(value)
  // 无法解析时保留原始值，避免把有效信息吞成 '-'
  return Number.isFinite(ms) ? formatLocalDate(ms) : value
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
