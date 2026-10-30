/**
 * 「未捕获 Promise 异常」的用户提示节流。
 *
 * 背景（真实实测）：`unhandledrejection` 每触发一次就弹一条「操作失败，请重试」。
 * 当一次交互里同时冒出多个未捕获 rejection（例如并发请求全部漏 catch、组件批量卸载），
 * 屏幕上会连弹数条重复 toast，遮挡内容且毫无信息增量 —— 实测 5 个 rejection → 5 条 toast。
 *
 * 策略：**日志一条不少**（诊断能力不变），只对用户提示做时间窗节流：
 * 窗口内只弹第一条，后续静默丢弃。
 */

/** 同一条提示的最小间隔：10s。窗口内重复的 rejection 不再弹 toast。 */
export const REJECTION_TOAST_INTERVAL_MS = 10_000

/**
 * 本次是否应该弹提示。
 *
 * @param now        当前时间戳（ms）
 * @param lastToastAt 上一次弹提示的时间戳（ms）；0 表示从未弹过
 * @param interval   节流窗口（ms），默认 {@link REJECTION_TOAST_INTERVAL_MS}
 */
export function shouldToastRejection(
    now: number,
    lastToastAt: number,
    interval: number = REJECTION_TOAST_INTERVAL_MS,
): boolean {
    if (!Number.isFinite(now)) return false
    if (lastToastAt <= 0) return true
    // 时钟回拨（now < lastToastAt）时也允许弹一次，避免永久静默
    if (now < lastToastAt) return true
    return now - lastToastAt >= interval
}
