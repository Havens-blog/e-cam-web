/**
 * 审计日志时间格式化。
 *
 * 接口契约：`ctime` 是毫秒（后端自审计模块初始提交起只用 `time.Now().UnixMilli()`）。
 * 历史缺陷是前端固定 `new Date(ts * 1000)` 又放大 1000 倍，渲染成 `58794-10-05`。
 *
 * 这里按量级归一，是为了对「误传秒值 / 旧数据」兜底，而不是因为接口存在两种格式。
 * 注意：本函数与 `src/views/logs/format.ts` 的同名逻辑刻意不同（那边输出 MM-dd HH:mm:ss），
 * 故命名为 `formatAuditTime` 以避免 grep 歧义。
 */

/** 1e11 毫秒 ≈ 1973-03；秒级要到 5138 年才达到，故本系统（数据自 2026）可安全区分 */
const MS_THRESHOLD = 1e11

export function normalizeEpochMs(value: number | string | null | undefined): number | null {
    const ts = typeof value === 'string' ? Number(value) : value
    if (ts == null || !Number.isFinite(ts) || ts <= 0) return null
    return ts >= MS_THRESHOLD ? ts : ts * 1000
}

export function formatAuditTime(value: number | string | null | undefined): string {
    const ms = normalizeEpochMs(value)
    if (ms == null) return '-'
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return '-'
    // 用 UTC 年份判断越界：本地时区在 9999-12-31 附近会把年份推到 10000，造成误判
    const year = d.getUTCFullYear()
    if (year > 9999) {
        if (import.meta.env.DEV) console.warn('[audit] 时间戳超出可显示范围（疑似单位错误）', value)
        return '-'
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${year}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
