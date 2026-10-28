/**
 * 云序一致性（`cloud-order.ts`）：
 * - 云 id 变体归一：日志接口火山账号返回 `volcengine`，排序表用 `volcano`；
 * - 关键不变式「同屏云序一致」：云/账号下拉（`cloudRank`）与源分组/明细分组
 *   （`groupRank`）对同一朵云必须给出相同权重 —— 修复前 `volcengine` 下拉排最前
 *   （indexOf=-1）、分组排最后（length），同屏自相矛盾。
 */
import { describe, expect, it } from 'vitest'

import { CLOUD_ORDER, cloudRank, groupRank, normalizeCloud } from './cloud-order'

describe('cloud-order(云序一致性)', () => {
    it('normalizeCloud:火山变体归一到 volcano,其余原样', () => {
        expect(normalizeCloud('volcengine')).toBe('volcano')
        expect(normalizeCloud('volc')).toBe('volcano')
        expect(normalizeCloud('aliyun')).toBe('aliyun')
        expect(normalizeCloud('unknown-cloud')).toBe('unknown-cloud')
    })

    it('cloudRank:已登记云按表序;火山变体与 volcano 同权重;未知云排最后', () => {
        expect(cloudRank('aliyun')).toBe(0)
        expect(cloudRank('aws')).toBe(CLOUD_ORDER.indexOf('aws'))
        expect(cloudRank('volcano')).toBe(CLOUD_ORDER.indexOf('volcano'))
        // 变体归一:两者同权重(修复前 volcengine 为 -1 → 排最前)
        expect(cloudRank('volcengine')).toBe(cloudRank('volcano'))
        expect(cloudRank('volc')).toBe(cloudRank('volcano'))
        // 未知云统一排到最后(不再出现 -1 排最前)
        expect(cloudRank('unknown-cloud')).toBe(CLOUD_ORDER.length)
    })

    it('groupRank:组键取云段归一;变体组键与 volcano 组键同权重', () => {
        expect(groupRank('aliyun·阿里A')).toBe(0)
        expect(groupRank('volcano·集团-火山云')).toBe(CLOUD_ORDER.indexOf('volcano'))
        expect(groupRank('volcengine·集团-火山云')).toBe(groupRank('volcano·集团-火山云'))
        // 直接传云 id 亦可(无分隔符时整串即云段)
        expect(groupRank('volcengine')).toBe(cloudRank('volcano'))
        // 云段未识别 → 最后
        expect(groupRank('mystery-cloud·某账号')).toBe(CLOUD_ORDER.length)
    })

    it('同屏云序一致:同一朵云在下拉权重与分组权重上完全相等(核心不变式)', () => {
        for (const cloud of ['aliyun', 'huawei', 'aws', 'tencent', 'volcano', 'volcengine', 'volc', 'unknown-cloud']) {
            expect(cloudRank(cloud)).toBe(groupRank(`${cloud}·账号X`))
        }
    })

    it('真实场景:阿里云源与火山云源同屏时,火山云不再排到阿里云之前', () => {
        const clouds = ['volcengine', 'aliyun', 'volcengine']
        const ordered = [...new Set(clouds)].sort((a, b) => cloudRank(a) - cloudRank(b))
        expect(ordered).toEqual(['aliyun', 'volcengine'])
    })
})
