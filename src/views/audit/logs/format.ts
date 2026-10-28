/**
 * 审计日志时间格式化。
 *
 * 后端 `ctime` 历史上出现过秒与毫秒两种量级（当前接口返回毫秒，
 * 旧数据/其它接口可能是秒）。直接 `new Date(ts * 1000)` 会把毫秒值放大一千倍，
 * 渲染成 `58794-10-05 …` 这类明显错误的年份，故按量级归一。
 */

/** 1e11 毫秒 ≈ 1973 年；秒级时间戳要到 5138 年才达到，故可安全区分 */
const MS_THRESHOLD = 1e11

export function normalizeEpochMs(value: number | string | null | undefined): number | null {
    const ts = typeof value === 'string' ? Number(value) : value
    if (ts == null || !Number.isFinite(ts) || ts <= 0) return null
    return ts >= MS_THRESHOLD ? ts : ts * 1000
}

export function formatLogTime(value: number | string | null | undefined): string {
    const ms = normalizeEpochMs(value)
    if (ms == null) return '-'
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return '-'
    // 年份越界（< 1970 或 > 9999）说明时间戳仍然异常，直接兜底
    const year = d.getFullYear()
    if (year < 1970 || year > 9999) return '-'
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
