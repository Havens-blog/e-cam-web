/**
 * 「重试失败源」纯逻辑:从 per-source 状态提取失败账号,并把重试结果与
 * 既有成功源结果合并(成功源保留,失败源用重试结果替换;明细按时间倒序归并)。
 */
import type { LogEntry, LogSourceOutcome } from '@/api/types/logs'

export function failedAccountIds(sources: LogSourceOutcome[]): number[] {
    return sources
        .filter((s) => s.error !== '')
        .map((s) => Number(s.account_id))
        .filter((n) => Number.isInteger(n) && n > 0)
}

export function mergeRetryResult(
    prevSources: LogSourceOutcome[],
    retrySources: LogSourceOutcome[],
    prevEntries: LogEntry[],
    retryEntries: LogEntry[],
    failedIds: number[],
): { sources: LogSourceOutcome[]; entries: LogEntry[] } {
    const retrySet = new Set(failedIds.map(String))
    const sources = [...prevSources.filter((s) => !retrySet.has(s.account_id)), ...retrySources]
    const entries = [...prevEntries, ...retryEntries].sort((a, b) => b.timestamp - a.timestamp)
    return { sources, entries }
}
