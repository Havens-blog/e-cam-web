/**
 * 时间游标翻页的边界判定(纯函数可单测)。
 * 翻页窗口上界 = 当前最旧一条 - EARLIER_STEP_MS(1 秒):WAF3 等秒级时间戳源
 * 整批迁移,-1ms 会把整个秒批次跳过;毫秒级源丢 1 秒无感知。
 */
export const EARLIER_STEP_MS = 1000

/**
 * 是否还能向前翻一页:至少还剩完整一步的窗口(上界 - step 仍大于窗口起点)。
 * 若不满足,直接判为「到底」,避免把上界推到窗口起点之前触发后端 end<=start。
 */
export function canLoadEarlierTs(oldestTs: number, windowStartMs: number, pageBottom: boolean): boolean {
    return !pageBottom && oldestTs - EARLIER_STEP_MS > windowStartMs
}

/** 翻页请求的上界(最旧一条 - step);已到边界时返回 null 表示无更早窗口 */
export function earlierEndMs(oldestTs: number, windowStartMs: number): number | null {
    const end = oldestTs - EARLIER_STEP_MS
    return end > windowStartMs ? end : null
}
