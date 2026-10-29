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
    // 年份取本地值（与后面输出的月/日/时分秒保持一致，避免跨年窗口错一年）
    const year = d.getFullYear()
    if (year < 1970 || year > 9999) {
        if (import.meta.env.DEV) console.warn('[epoch] 时间戳超出可显示范围（疑似单位错误）', value)
        return '-'
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}


/**
 * 后端查询参数用的时间串（UTC 墙钟，秒精度）。
 *
 * 后端用 `time.Parse("2006-01-02 15:04:05", v)` 解析，Go 在无时区标识时按 **UTC** 解释；
 * 因此这里必须输出 UTC 墙钟而不是本地墙钟（本地墙钟会被当 UTC，UTC+8 下整体偏移 8 小时）。
 * 也不要直接传 toISOString()（带 T/Z，后端解析直接 400）。
 */
export function toBackendDateTime(value: Date | number): string {
    const ms = value instanceof Date ? value.getTime() : value
    if (!Number.isFinite(ms)) return ''
    const d = new Date(ms)
    // new Date(NaN) / 越界值（如 ±1e17）不能直接 toISOString，会抛 RangeError
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 19).replace('T', ' ')
}
