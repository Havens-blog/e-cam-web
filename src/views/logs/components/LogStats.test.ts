// @vitest-environment happy-dom
/**
 * LogStats 图表口径单测(浏览器实测问题回归):
 * K8s 事件页曾显示「状态码分布(采样)」(仅剩"其他")与「延迟分布(采样)」(空白)——
 * 事件模型无状态码/延迟量纲,图一应为级别分布、图二应为原因分布。
 * app 业务日志同源问题:图二不是延迟分布。
 */
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it } from 'vitest'

import LogStats from './LogStats.vue'
import type { LogEntry, LogType } from '@/api/types/logs'

type EntryLogType = LogType

function entry(fields: Record<string, unknown>): LogEntry {
    return {
        meta: {
            cloud: 'aliyun',
            account_id: 'acc-1',
            account_name: '阿里A',
            region: 'cn-shenzhen',
            resource_id: 'r1',
            source: 'k8s-log-r1/k8s-event',
        },
        timestamp: 1_800_000_000_000,
        ...fields,
    } as unknown as LogEntry
}

function chartTitles(logType: EntryLogType, entries: LogEntry[]): string[] {
    const w = mount(LogStats, {
        props: { entries, logType, aggregate: null },
        global: {
            plugins: [ElementPlus],
            // ChartCard 真实现会动态 import echarts + 轮询 getInstance() 绑下钻监听,
            // happy-dom 下只需一个带 getInstance() 的桩(否则 mounted 抛未处理异常)
            stubs: {
                ChartCard: {
                    template: '<div class="chart-card-stub" />',
                    methods: { getInstance: () => ({ on() {}, off() {} }) },
                },
            },
        },
    })
    return w.findAll('.chart-title').map((t) => t.text())
}

describe('LogStats 图表口径按类型分派', () => {
    const k8sEntries = [
        entry({ level: 'warning', reason: 'FailedGetScale' }),
        entry({ level: 'info', reason: 'Started' }),
    ]

    it('k8s-event:级别分布 + 原因分布 + 原因 Top(无状态码/延迟图)', () => {
        const titles = chartTitles('k8s-event', k8sEntries)
        expect(titles).toEqual(['级别分布(采样)', '原因分布(采样)', '原因 Top(采样)', '时间趋势(采样)'])
        expect(titles).not.toContain('状态码分布(采样)')
        expect(titles).not.toContain('延迟分布(采样)')
    })

    it('app:级别分布 + 服务分布(不再出现延迟分布)', () => {
        const titles = chartTitles('app', [entry({ level: 'error', service: 'svc-a' })])
        expect(titles).toEqual(['级别分布(采样)', '服务分布(采样)', '服务 Top(采样)', '时间趋势(采样)'])
        expect(titles).not.toContain('延迟分布(采样)')
    })

    it('cdn 等访问类类型口径不变(状态码 + 缓存/延迟)', () => {
        expect(chartTitles('cdn', [entry({ status: 200, cache_hit: 'hit' })])).toEqual([
            '状态码分布(采样)',
            '缓存命中分布(采样)',
            '域名 Top(采样)',
            '时间趋势(采样)',
        ])
        expect(chartTitles('slb', [entry({ status: 200, latency_ms: 12 })])).toEqual([
            '状态码分布(采样)',
            '延迟分布(采样)',
            '域名 Top(采样)',
            '时间趋势(采样)',
        ])
    })
})
