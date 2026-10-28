/**
 * stats 纯函数:
 * - entryService/buildTopServices:app 第三图回退态按服务分组(与下钻字段 service 对齐,
 *   修复"app 点 TopN 条目生成 host 筛选 → 字典无 host → 明细恒空");
 * - buildTopHosts 对照:app 条目无 host,不应混入服务图;
 * - buildKpis('app'):RCA 语义 KPI(条数/错误占比/涉及服务数/exception 计数),
 *   口径确认 2026-10-28。
 */
import { describe, expect, it } from 'vitest'

import { buildKpis, buildTopHosts, buildTopServices, entryService } from './stats'
import type { AppLogEntry, LogEntry } from '@/api/types/logs'

function appEntry(service: string, overrides?: Partial<AppLogEntry>): AppLogEntry {
    return {
        meta: { cloud: 'aliyun', account_id: 'acc-1', account_name: '阿里A', region: 'cn-hangzhou', resource_id: 'order-business', source: 'app/order-business' },
        timestamp: 1_800_000_000_000,
        service,
        level: 'error',
        message: 'boom',
        exception: 'NullPointerException',
        trace_id: 't1',
        raw: {},
        ...overrides,
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

describe("buildKpis('app')(RCA 语义 KPI,口径确认 2026-10-28)", () => {
    it('四指标:条数/错误占比/涉及服务数/exception 条数;app 不再误用 CDN 缓存命中率', () => {
        const entries = [
            appEntry('order-business'),
            appEntry('order-business'),
            appEntry('user-business', { level: 'warn', exception: '' }),
            appEntry('', { level: 'info', exception: '' }),
        ]
        const kpis = buildKpis('app', entries)
        expect(kpis.map((k) => k.label)).toEqual(['日志条数', '错误占比', '涉及服务数', 'exception 条数'])
        expect(kpis[0]!.value).toBe('4')
        // 2 error / 4 条 = 50%
        expect(kpis[1]!.value).toBe('50%')
        // 去重 service:order-business + user-business(空串不计)
        expect(kpis[2]!.value).toBe('2')
        expect(kpis[3]!.value).toBe('2')
    })
    it('错误占比 ≥5% 标 danger', () => {
        const entries = [appEntry('order-business'), appEntry('user-business', { level: 'info', exception: '' })]
        expect(buildKpis('app', entries)[1]!.tone).toBe('danger')
    })
    it('空数据:占比显示 -,服务数/exception 计数 0,无 danger', () => {
        const kpis = buildKpis('app', [])
        expect(kpis.map((k) => k.value)).toEqual(['0', '-', '0', '0'])
        expect(kpis[1]!.tone).toBeUndefined()
    })
    it('聚合精确总数覆盖:displayTotal 与采样分母不同时,条数 hint 注明精确', () => {
        const entries = [appEntry('order-business')]
        const kpis = buildKpis('app', entries, 1234)
        expect(kpis[0]!.value).toBe('1,234')
        expect(kpis[0]!.hint).toBe('窗口精确总数(服务端聚合)')
        // 错误占比分母仍为采样条数(1 条 → 100%),不被大分母稀释
        expect(kpis[1]!.value).toBe('100%')
    })
})
