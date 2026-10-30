/**
 * 云账号视图「厂商展示名」用例。
 *
 * 缺陷（实测 2026-10-30，真实后端）：
 *   云账号接口对火山云账号返回 provider = `volcengine`；
 *   accounts/utils.ts 原实现 `PROVIDER_CONFIGS[provider]?.displayName || provider`
 *   是**直接查配置**，`volcengine` 不在配置表的键里 ⇒ 回退原值 ⇒ 列表/卡片视图
 *   渲染成裸英文 `volcengine`，而同页腾讯云等是中文名、详情抽屉（走 getProviderLabel）
 *   也是中文名，前后不一致。
 *
 * 修复后统一走 utils/constants 的展示名单源（转发 @haven/ui/provider.getProviderLabel，
 * 该实现已认 volcengine/bytedance 等别名）。
 */
import { describe, expect, it } from 'vitest'
import { getProviderLabel } from '@/utils/constants'
import { getProviderName } from './utils'

describe('云账号视图 getProviderName（厂商展示名）', () => {
    it('**回归**：火山云账号（provider=volcengine）显示中文名，不显示裸英文', () => {
        const name = getProviderName('volcengine')
        expect(name).not.toBe('volcengine')
        expect(name).toBe(getProviderLabel('volcengine'))
    })

    it('规范厂商名与详情抽屉（getProviderLabel）保持一致', () => {
        for (const p of ['aliyun', 'aws', 'tencent', 'huawei', 'volcano']) {
            expect(getProviderName(p)).toBe(getProviderLabel(p))
        }
    })

    it('空值仍回退占位符 "-"（沿用原行为）', () => {
        expect(getProviderName('')).toBe('-')
    })

    it('未知厂商原样返回，便于诊断（不静默吞掉）', () => {
        expect(getProviderName('some-new-cloud')).toBe('some-new-cloud')
    })
})
