import { normalizeEpochMs } from '@/utils/epoch'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH_30 = 30 * DAY

/**
 * 模板卡片时间：30 天内显示相对时间，否则显示本地日期。
 *
 * 注意 `created_at` 是毫秒（后端 UnixMilli）；历史实现误乘 1000，
 * 导致 diff 为负、渲染出 `-29562457753 分钟前`。
 * 对未来时间戳（时钟偏移）夹到 0，显示「刚刚」而不是负数。
 */
export function formatTemplateTime(value: number | null | undefined, now: number = Date.now()): string {
    const ms = normalizeEpochMs(value)
    if (ms == null) return ''
    const diff = Math.max(0, now - ms)
    if (diff < MINUTE) return '刚刚'
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
    if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
    if (diff < MONTH_30) return `${Math.floor(diff / DAY)} 天前`
    return new Date(ms).toLocaleDateString()
}
