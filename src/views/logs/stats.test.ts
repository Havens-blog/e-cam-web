/**
 * stats 纯函数采样 TopN:
 * - entryService/buildTopServices:app 第三图回退态按服务分组(与下钻字段 service 对齐,
 *   修复"app 点 TopN 条目生成 host 筛选 → 字典无 host → 明细恒空");
 * - buildTopHosts 对照:app 条目无 host,不应混入服务图。
 */
import { describe, expect, it } from 'vitest'

import { buildTopHosts, buildTopServices, entryService } from './stats'
import type { AppLogEntry, LogEntry } from '@/api/types/logs'

function appEntry(service: string): AppLogEntry {
    return {
        meta: { cloud: 'aliyun', account_id: 'acc-1', account_name: '阿里A', region: 'cn-hangzhou', resource_id: 'order-business', source: 'app/order-business' },
        timestamp: 1_800_000_000_000,
        service,
        level: 'error',
        message: 'boom',
        exception: 'NullPointerException',
        trace_id: 't1',
        raw: {},
    }
}

function cdnEntry(host: string): LogEntry {
    return {
        meta: { cloud: 'aliyun', account_id: 'acc-1', account_name: '阿里A', region: 'cn-hangzhou', resource_id: 'd1', source: 'sls/project/logstore' },
        timestamp: 1_800_000_000_000,
        client_ip: '1.2.3.4',
        method: 'GET',
        url: '/a',
        host,
        status: 200,
        bytes_sent: 10,
        cache_hit: 'hit',
        latency_ms: 5,
        referer: '',
        user_agent: 'ua',
        edge_node: '',
        request_id: 'r1',
        raw: {},
    }
}

describe('entryService/buildTopServices(app 采样 TopN)', () => {
    it('取 service 字段;非 app 条目无该字段返回空', () => {
        expect(entryService(appEntry('order-business'))).toBe('order-business')
        expect(entryService(cdnEntry('a.com'))).toBe('')
    })
    it('按服务计数并倒序截断;空 service 条目不计入', () => {
        const entries = [
            appEntry('order-business'),
            appEntry('order-business'),
            appEntry('user-business'),
            appEntry(''),
        ]
        expect(buildTopServices(entries)).toEqual([
            { name: 'order-business', value: 2 },
            { name: 'user-business', value: 1 },
        ])
    })
    it('app 条目不混入 host 采样图(无 host 字段,entryHost 回退 resource_id,与服务图维度不同)', () => {
        const entries = [appEntry('order-business')]
        expect(buildTopHosts(entries)).toEqual([{ name: 'order-business', value: 1 }])
        expect(buildTopServices(entries)).toEqual([{ name: 'order-business', value: 1 }])
    })
})
