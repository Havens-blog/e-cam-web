// @vitest-environment happy-dom
/**
 * 「重试失败源」纯逻辑回归:失败账号提取 + 成功/失败源合并。
 */
import { describe, expect, it } from 'vitest'
import type { LogEntry, LogSourceOutcome } from '@/api/types/logs'
import { failedAccountIds, mergeRetryResult } from './retry'

function outcome(accountId: string, error = ''): LogSourceOutcome {
    return {
        cloud: 'aliyun',
        account_id: accountId,
        account_name: `acc-${accountId}`,
        count: error ? 0 : 5,
        error,
        duration_ms: 10,
    }
}

function entry(ts: number): LogEntry {
    return { meta: { cloud: 'aliyun', account_id: '1', account_name: 'a', region: 'cn', resource_id: 'r', source: 's' }, timestamp: ts } as LogEntry
}

describe('retry helpers', () => {
    it('extracts failed account ids', () => {
        const ids = failedAccountIds([outcome('1'), outcome('2', 'timeout'), outcome('3', 'boom')])
        expect(ids).toEqual([2, 3])
    })

    it('ignores empty/non-numeric account ids', () => {
        const ids = failedAccountIds([outcome('x', 'timeout') as LogSourceOutcome])
        expect(ids).toEqual([])
    })

    it('merges retry result: keeps success sources, replaces failed ones', () => {
        const prevSources = [outcome('1'), outcome('2', 'timeout')]
        const retrySources = [outcome('2')]
        const merged = mergeRetryResult(prevSources, retrySources, [entry(100)], [entry(200)], [2])
        expect(merged.sources.map((s) => s.account_id)).toEqual(['1', '2'])
        expect(merged.sources[1]?.error).toBe('')
        expect(merged.entries.map((e) => e.timestamp)).toEqual([200, 100])
    })

    it('sorts merged entries by timestamp desc', () => {
        const merged = mergeRetryResult([outcome('1')], [outcome('2')], [entry(50)], [entry(300), entry(150)], [2])
        expect(merged.entries.map((e) => e.timestamp)).toEqual([300, 150, 50])
    })
})
