/**
 * 时间戳归一工具。
 *
 * 背景：后端多数接口返回 **毫秒**（`time.Now().UnixMilli()`），但历史上多个页面
 * 误按秒处理（`new Date(ts * 1000)`），把 2026 年放大成 58794 年或算出负的「分钟前」。
 * 这里统一按量级判断，秒/毫秒都能正确渲染。
 */

/**
 * 1e11 毫秒 ≈ 1973-03；秒级时间戳要到 5138 年才达到该值。
 * 本系统数据自 2026 年起，故以 1e11 为界可安全区分秒与毫秒。
 */
export const EPOCH_MS_THRESHOLD = 1e11

/** 归一为毫秒；空值/非法值/非正值返回 null */
export function normalizeEpochMs(value: number | string | null | undefined): number | null {
    const ts = typeof value === 'string' ? Number(value) : value
    if (ts == null || !Number.isFinite(ts) || ts <= 0) return null
    return ts >= EPOCH_MS_THRESHOLD ? ts : ts * 1000
}

/** 固定格式 `YYYY-MM-DD HH:mm:ss`（本地时区）；非法或越界返回 `-` */
export function formatEpochDateTime(value: number | string | null | undefined): string {
    const ms = normalizeEpochMs(value)
    if (ms == null) return '-'
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return '-'
    // 用 UTC 年份判断越界：本地时区在 9999-12-31 附近会把年份推到 10000
    const year = d.getUTCFullYear()
    if (year > 9999) {
        if (import.meta.env.DEV) console.warn('[epoch] 时间戳超出可显示范围（疑似单位错误）', value)
        return '-'
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
