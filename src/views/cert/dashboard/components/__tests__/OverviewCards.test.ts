// @vitest-environment happy-dom
/**
 * OverviewCards 组件用例（dashboard-cert-granularity 任务 3）：
 * - 分级卡页内筛选两态：选中高亮（selected class）+ aria-pressed 选中/未选各有断言；
 * - 点击上抛 select-level（页内筛选，再点取消由父级 toggle）；
 * - 未激活副文案「可见 N · 隐藏 M」（countsByLevel 双口径），无「跳转台账」静态文案；
 * - 特殊卡 diff/exempt 副标题含「域名计数」+ 两态 aria-pressed。
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { DashboardSummary } from '@/api/cert'
import OverviewCards from '../OverviewCards.vue'

const SUMMARY: DashboardSummary = {
    countsByLevel: [
        { total: 10, visible: 8, hidden: 2 }, // gt30
        { total: 5, visible: 5, hidden: 0 }, // le30
        { total: 3, visible: 3, hidden: 0 }, // le14
        { total: 2, visible: 1, hidden: 1 }, // le7
        { total: 4, visible: 3, hidden: 1 }, // expired
    ],
    hiddenCount: 3,
    diffAlertCount: 1,
    exemptCount: 2,
    wildcardSkippedCount: 0,
    registrationRate: 1,
    replaceableRate: 0.5,
    fingerprintOnlyRate: 0.5,
}

function mountCards(over: { summary?: DashboardSummary | null; selectedLevel?: string; selectedSpecial?: string } = {}) {
    return mount(OverviewCards, {
        props: {
            summary: over.summary === undefined ? SUMMARY : over.summary,
            selectedLevel: (over.selectedLevel ?? '') as never,
            selectedSpecial: (over.selectedSpecial ?? '') as never,
        },
    })
}

describe('OverviewCards 分级卡（页内筛选两态，任务 3）', () => {
    it('5 张分级卡：卡值取 total；未激活副文案「可见 N · 隐藏 M」且 aria-pressed=false', () => {
        const w = mountCards()
        const cards = w.findAll('.level-grid .stat-card')
        expect(cards).toHaveLength(5)
        expect(cards[0]!.find('.stat-value').text()).toBe('10')
        expect(cards[0]!.find('.stat-sub').text()).toBe('可见 8 · 隐藏 2')
        expect(cards[0]!.attributes('aria-pressed')).toBe('false')
    })

    it('激活卡：aria-pressed="true" + selected 高亮；其余卡保持 aria-pressed="false"', () => {
        const w = mountCards({ selectedLevel: 'expired' })
        const cards = w.findAll('.level-grid .stat-card')
        expect(cards[4]!.attributes('aria-pressed')).toBe('true')
        expect(cards[4]!.classes()).toContain('selected')
        expect(cards[0]!.attributes('aria-pressed')).toBe('false')
    })

    it('点击分级卡上抛 select-level（页内筛选；再点取消由父级 toggle）', async () => {
        const w = mountCards()
        await w.findAll('.level-grid .stat-card')[2]!.trigger('click')
        expect(w.emitted('select-level')).toEqual([['le14']])
    })

    it('summary 为 null（刷新中）：卡值与副文案降级且卡片保持可点', () => {
        const w = mountCards({ summary: null })
        const cards = w.findAll('.level-grid .stat-card')
        expect(cards[0]!.find('.stat-value').text()).toBe('—')
        expect(cards[0]!.find('.stat-sub').text()).toBe('')
    })

    it('无静态跳转文案（移除「点击跳转台账」残留）', () => {
        const w = mountCards()
        expect(w.text()).not.toContain('跳转台账')
    })
})

describe('OverviewCards 特殊卡（域名计数副标题 + 两态，任务 3）', () => {
    it('diff/exempt 副标题含「域名计数」（用户理解卡值 < 筛出行数的关键文案）', () => {
        const w = mountCards()
        const subs = w.findAll('.special-grid .stat-sub')
        expect(subs[0]!.text()).toContain('域名计数')
        expect(subs[1]!.text()).toContain('域名计数')
    })

    it('选中态 aria-pressed 两态 + 点击上抛 select-special', async () => {
        const w = mountCards({ selectedSpecial: 'diff' })
        const cards = w.findAll('.special-grid .stat-card')
        expect(cards[0]!.attributes('aria-pressed')).toBe('true')
        expect(cards[0]!.classes()).toContain('selected')
        expect(cards[1]!.attributes('aria-pressed')).toBe('false')
        await cards[1]!.trigger('click')
        expect(w.emitted('select-special')).toEqual([['exempt']])
    })
})
