/**
 * useLogSources 账号选项推导(accountOptions):
 * - 由源清单去重推导,值为平台内账号 ID(number,与请求契约一致);
 * - 组序按 CLOUD_ORDER;非数字 account_id(NaN)跳过,不产生坏选项;
 * - 云选择收窄时选项随之收窄(filteredSources 联动)。
 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/api/logs', () => ({
    getLogSourcesApi: vi.fn(),
}))

import { useLogSources } from './useLogSources'
import type { LogSource } from '@/api/types/logs'

function s(cloud: string, accountId: string, accountName: string, resourceId: string): LogSource {
    return {
        cloud,
        account_id: accountId,
        account_name: accountName,
        region: 'r',
        log_type: 'cdn',
        resource_id: resourceId,
        name: resourceId,
        enabled: true,
        stale: false,
        note: '',
    }
}

function setup(sources: LogSource[], clouds: string[] = []) {
    const selectedClouds = ref<string[]>(clouds)
    const selectedResources = ref<string[]>([])
    const cloudsTouched = ref(true)
    const u = useLogSources({
        activeType: ref<'cdn'>('cdn'),
        selectedClouds,
        selectedResources,
        cloudsTouched,
        defaultClouds: ['aliyun'],
    })
    // 直接注入源清单(loadSources 走网络,此处只测推导)
    ;(u as unknown as { sources: { value: LogSource[] } }).sources.value = sources
    return u
}

describe('useLogSources.accountOptions(账号选项推导)', () => {
    it('按 account_id 去重,值为 number,标签含 云·账号', () => {
        const u = setup([
            s('aliyun', '1', '阿里A', 'd1'),
            s('aliyun', '1', '阿里A', 'd2'),
            s('aliyun', '2', '阿里B', 'd3'),
        ])
        expect(u.accountOptions.value).toEqual([
            { value: 1, label: '阿里云·阿里A', cloud: 'aliyun' },
            { value: 2, label: '阿里云·阿里B', cloud: 'aliyun' },
        ])
    })

    it('跨云按 CLOUD_ORDER 排序(aliyun → aws → volcano)', () => {
        const u = setup([
            s('volcano', '9', '火山C', 'v1'),
            s('aws', '5', 'AWS B', 'a1'),
            s('aliyun', '1', '阿里A', 'd1'),
        ])
        expect(u.accountOptions.value.map((a) => a.cloud)).toEqual(['aliyun', 'aws', 'volcano'])
    })

    it('非数字 account_id 跳过(不产生 NaN 选项);云筛选收窄联动', () => {
        const u = setup([
            s('aliyun', 'bad-id', '坏ID', 'd0'),
            s('aliyun', '1', '阿里A', 'd1'),
            s('aws', '5', 'AWS B', 'a1'),
        ])
        expect(u.accountOptions.value.map((a) => a.value)).toEqual([1, 5])
        // 收窄到 aws:aliyun 账号从选项消失
        const selectedClouds = ref<string[]>(['aws'])
        const selectedResources = ref<string[]>([])
        const cloudsTouched = ref(true)
        const u2 = useLogSources({
            activeType: ref<'cdn'>('cdn'),
            selectedClouds,
            selectedResources,
            cloudsTouched,
            defaultClouds: ['aliyun'],
        })
        ;(u2 as unknown as { sources: { value: LogSource[] } }).sources.value = [
            s('aliyun', '1', '阿里A', 'd1'),
            s('aws', '5', 'AWS B', 'a1'),
        ]
        selectedClouds.value = ['aws']
        expect(u2.accountOptions.value.map((a) => a.value)).toEqual([5])
    })
})

describe('useLogSources.sourceGroups(云·账号分组标签)', () => {
    it('标签用云展示名,组键保持原始云 id(身份/去重口径不变)', () => {
        const u = setup([
            s('volcengine', '5', '集团-火山云', 'v1'),
            s('volcengine', '5', '集团-火山云', 'v2'),
            s('aliyun', '1', '集团-阿里云', 'd1'),
        ])
        const groups = u.sourceGroups.value
        expect(groups.map((g) => g.label)).toEqual(['阿里云·集团-阿里云', '火山云·集团-火山云'])
        // 键仍是原始 id(volcengine 不归一),且同账号同云源合为一组
        expect(groups.map((g) => g.key)).toEqual(['aliyun·集团-阿里云', 'volcengine·集团-火山云'])
        expect(groups[1]!.sources.map((x) => x.resource_id)).toEqual(['v1', 'v2'])
    })

    it('与账号下拉标签同口径(同屏两组「云·账号」文案一致)', () => {
        const u = setup([
            s('volcengine', '5', '集团-火山云', 'v1'),
            s('aliyun', '1', '集团-阿里云', 'd1'),
        ])
        expect(u.sourceGroups.value.map((g) => g.label)).toEqual(
            u.accountOptions.value.map((a) => a.label),
        )
    })
})
