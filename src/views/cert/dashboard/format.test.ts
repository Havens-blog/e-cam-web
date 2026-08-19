import { describe, expect, it } from 'vitest'
import type { DashboardItem } from '@/api/cert'
import {
    DASHBOARD_LEVEL_CARDS,
    EMPTY_DASHBOARD_FILTER,
    cloudFilterOptions,
    diffSummaryText,
    filterAnnouncement,
    filterDashboardItems,
    isExemptRow,
    probeBadge,
    probeReason,
    relativeTimeDash,
} from './format'

// ==================== 测试夹具（六态探测 + 未探测 + 各分级/托管/云组合） ====================

function item(over: Partial<DashboardItem>): DashboardItem {
    return {
        domain: 'a.example.com',
        daysLeft: 45,
        level: 'gt30',
        hostingType: 'complete',
        probeStatus: '',
        referencedClouds: [],
        certId: 'cert-001',
        fingerprint: 'aa11223344556677…8899aabbccddeeff',
        lastProbeAt: null,
        onlineFingerprint: '',
        ...over,
    }
}

const FIXTURES: DashboardItem[] = [
    item({ domain: 'api.example.com', daysLeft: 12, level: 'le14', probeStatus: 'diff', referencedClouds: ['aliyun', 'tencent'], lastProbeAt: '2026-08-19T03:00:00Z', onlineFingerprint: 'ff0011223344556677889900aabbccdd' }),
    item({ domain: 'intranet.example.com', daysLeft: 45, level: 'gt30', probeStatus: 'exempt', referencedClouds: ['aliyun'], hostingType: 'fingerprint_only' }),
    item({ domain: 'legacy.example.com', daysLeft: 30, level: 'le30', probeStatus: 'unreachable', referencedClouds: ['aliyun'], hostingType: 'fingerprint_only' }),
    item({ domain: 'www.example.com', daysLeft: 74, level: 'gt30', probeStatus: 'consistent', referencedClouds: ['aliyun', 'tencent'] }),
    item({ domain: 'shop.example.com', daysLeft: 5, level: 'le7', probeStatus: 'change_linked_diff', referencedClouds: ['tencent'] }),
    item({ domain: '*.wild.example.com', daysLeft: 20, level: 'le30', probeStatus: 'wildcard_skipped', referencedClouds: ['k8s'] }),
    item({ domain: 'fresh.example.com', daysLeft: 60, level: 'gt30', probeStatus: '', referencedClouds: [] }),
    item({ domain: 'old.example.com', daysLeft: -3, level: 'expired', probeStatus: 'diff', referencedClouds: ['huawei'] }),
]

// ==================== AC1：5 级总览卡 + 差异/豁免卡联动筛选 ====================

describe('DASHBOARD_LEVEL_CARDS（5 级卡序与文案，AC1）', () => {
    it('五档互斥桶按 UI 卡序排列', () => {
        expect(DASHBOARD_LEVEL_CARDS.map((c) => c.tier)).toEqual(['gt30', 'le30', 'le14', 'le7', 'expired'])
        expect(DASHBOARD_LEVEL_CARDS.map((c) => c.label)).toEqual(['>30 天', '≤30 天', '≤14 天', '≤7 天', '已过期'])
    })
})

describe('filterDashboardItems（卡片/筛选器联动，AC1/AC2）', () => {
    it('空过滤 = 全量（点击卡再点取消）', () => {
        expect(filterDashboardItems(FIXTURES, EMPTY_DASHBOARD_FILTER)).toHaveLength(FIXTURES.length)
    })

    it('状态分级过滤：按 level 互斥桶命中', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, level: 'le14' })
        expect(out.map((i) => i.domain)).toEqual(['api.example.com'])
    })

    it('差异告警卡：仅常规 diff 计入（Hard Rule：不可达/豁免/通配符/变更关联/一致/未探测均不计）', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, special: 'diff' })
        expect(out.map((i) => i.domain).sort()).toEqual(['api.example.com', 'old.example.com'])
    })

    it('探测豁免卡：仅 probeStatus=exempt 命中', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, special: 'exempt' })
        expect(out.map((i) => i.domain)).toEqual(['intranet.example.com'])
    })

    it('云多选按 referencedClouds 命中其一即显示', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, clouds: ['tencent', 'k8s'] })
        expect(out.map((i) => i.domain).sort()).toEqual(['*.wild.example.com', 'api.example.com', 'shop.example.com', 'www.example.com'])
    })

    it('托管类型过滤：fingerprint_only 命中', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, hosting: 'fingerprint_only' })
        expect(out.map((i) => i.domain).sort()).toEqual(['intranet.example.com', 'legacy.example.com'])
    })

    it('多维度 AND 组合：差异卡 ∩ 云=huawei ∩ 托管=complete', () => {
        const out = filterDashboardItems(FIXTURES, {
            ...EMPTY_DASHBOARD_FILTER,
            special: 'diff',
            clouds: ['huawei'],
            hosting: 'complete',
        })
        expect(out.map((i) => i.domain)).toEqual(['old.example.com'])
    })

    it('无匹配返回空数组（表格空态）', () => {
        expect(filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, level: 'le7', clouds: ['huawei'] })).toEqual([])
    })
})

// ==================== AC2：表格筛选选项 / 豁免列 ====================

describe('cloudFilterOptions（云筛选选项：referencedClouds 去重 + 字典序，AC2）', () => {
    it('去重排序输出', () => {
        expect(cloudFilterOptions(FIXTURES)).toEqual(['aliyun', 'huawei', 'k8s', 'tencent'])
    })

    it('无引用行 → 空选项', () => {
        expect(cloudFilterOptions([FIXTURES[6]!])).toEqual([])
    })
})

describe('isExemptRow（豁免列 ✓ 判定，AC2）', () => {
    it('仅 probeStatus=exempt 为豁免行', () => {
        expect(isExemptRow(FIXTURES[1]!)).toBe(true)
        expect(isExemptRow(FIXTURES[0]!)).toBe(false)
        expect(isExemptRow(FIXTURES[2]!)).toBe(false)
    })
})

// ==================== AC3：probeStatus 渲染（四态 + 补充枚举，非色觉通道） ====================

describe('probeBadge（探测徽章：色 + 图标 + 文字三通道，AC3）', () => {
    it('一致 = Success 绿 + ✓ + 「一致」', () => {
        expect(probeBadge('consistent')).toMatchObject({ label: '一致', tone: 'success', icon: '✓' })
    })

    it('差异 = Error + ✗ + 「差异」（tooltip 含最近探测说明）', () => {
        const b = probeBadge('diff')
        expect(b).toMatchObject({ label: '差异', tone: 'error', icon: '✗' })
        expect(b.tooltip).toContain('线上')
    })

    it('不可达 = Text Secondary + ⚠ + 「不可达」（tooltip 声明不参与差异告警）', () => {
        const b = probeBadge('unreachable')
        expect(b).toMatchObject({ label: '不可达', tone: 'secondary', icon: '⚠' })
        expect(b.tooltip).toContain('不参与差异告警')
    })

    it('豁免 = Secondary + ✓ + 「豁免」（人工排除）', () => {
        expect(probeBadge('exempt')).toMatchObject({ label: '豁免', tone: 'secondary', icon: '✓' })
    })

    it('通配符跳过 = Secondary + 「通配符跳过」（不参与差异告警）', () => {
        const b = probeBadge('wildcard_skipped')
        expect(b).toMatchObject({ tone: 'secondary' })
        expect(b.label).toContain('跳过')
        expect(b.tooltip).toContain('不参与差异告警')
    })

    it('变更关联差异 = Warning + 「变更关联」（验证窗口预期切换，非 Error）', () => {
        const b = probeBadge('change_linked_diff')
        expect(b.tone).toBe('warning')
        expect(b.label).toContain('变更关联')
        expect(b.tooltip).toContain('预期切换')
    })

    it('未探测（空串）= Secondary + 「未探测」', () => {
        expect(probeBadge('')).toMatchObject({ label: '未探测', tone: 'secondary' })
    })

    it('全部态 label/icon/tooltip 非空（非色觉通道完备）', () => {
        for (const s of ['consistent', 'diff', 'change_linked_diff', 'unreachable', 'exempt', 'wildcard_skipped', ''] as const) {
            const b = probeBadge(s)
            expect(b.label.length).toBeGreaterThan(0)
            expect(b.icon.length).toBeGreaterThan(0)
            expect(b.tooltip.length).toBeGreaterThan(0)
        }
    })
})

// ==================== AC4：抽屉（差异说明 / 复制差异摘要） ====================

describe('probeReason（差异说明按状态文案，AC4）', () => {
    it('差异：说明线上≠台账', () => {
        expect(probeReason('diff')).toContain('不一致')
    })

    it('不可达：说明探测失败原因且不误导为差异', () => {
        expect(probeReason('unreachable')).toContain('端口不通')
    })

    it('豁免：人工排除口径', () => {
        expect(probeReason('exempt')).toContain('豁免')
    })

    it('未探测：等待巡检', () => {
        expect(probeReason('')).toContain('尚未探测')
    })
})

describe('diffSummaryText（复制差异摘要：域名/探测时间/线上指纹/差异说明，AC4）', () => {
    const now = new Date('2026-08-19T06:00:00Z')

    it('四要素逐行齐备（差异行）', () => {
        const text = diffSummaryText(FIXTURES[0]!, now)
        expect(text).toContain('域名: api.example.com')
        expect(text).toContain('探测时间: 3h 前')
        expect(text).toContain('线上指纹: ff0011223344556677889900aabbccdd')
        expect(text).toContain('差异说明: ')
        expect(text.split('\n')).toHaveLength(4)
    })

    it('未探测行：探测时间=尚未探测、线上指纹=—（仍可复制纯文本，只读无告警权限）', () => {
        const text = diffSummaryText(FIXTURES[6]!, now)
        expect(text).toContain('探测时间: 尚未探测')
        expect(text).toContain('线上指纹: —')
    })

    it('不可达行：线上指纹缺省为 —，说明含探测失败口径', () => {
        const text = diffSummaryText(FIXTURES[2]!, now)
        expect(text).toContain('线上指纹: —')
        expect(text).toContain('端口不通')
    })
})

// ==================== 相对时间（最近巡检 / 最近探测） ====================

describe('relativeTimeDash（相对时间：null/非法 → —）', () => {
    it('3 小时前 / 刚刚 / N 天前', () => {
        const now = new Date('2026-08-19T06:00:00Z')
        expect(relativeTimeDash('2026-08-19T03:00:00Z', now)).toBe('3h 前')
        expect(relativeTimeDash('2026-08-19T05:59:30Z', now)).toBe('刚刚')
        expect(relativeTimeDash('2026-08-16T06:00:00Z', now)).toBe('3 天前')
    })

    it('null / 非法 → —（未接线 lastInspectionAt=null 等）', () => {
        expect(relativeTimeDash(null)).toBe('—')
        expect(relativeTimeDash('not-a-date')).toBe('—')
    })
})

// ==================== AC6：a11y 通告（aria-live polite） ====================

describe('filterAnnouncement（筛选变化通告文案，AC6）', () => {
    it('状态分级卡：档位文案 + 计数', () => {
        expect(filterAnnouncement({ ...EMPTY_DASHBOARD_FILTER, level: 'le14' }, 1, 8)).toBe(
            '已按 ≤14 天 过滤，显示 1/8 条',
        )
    })

    it('差异告警卡 / 豁免卡', () => {
        expect(filterAnnouncement({ ...EMPTY_DASHBOARD_FILTER, special: 'diff' }, 2, 8)).toBe(
            '已按差异告警过滤，显示 2/8 条',
        )
        expect(filterAnnouncement({ ...EMPTY_DASHBOARD_FILTER, special: 'exempt' }, 1, 8)).toBe(
            '已按探测豁免过滤，显示 1/8 条',
        )
    })

    it('云多选：展示名顿号连接', () => {
        expect(filterAnnouncement({ ...EMPTY_DASHBOARD_FILTER, clouds: ['aliyun', 'tencent'] }, 4, 8)).toBe(
            '已按 云（阿里云、腾讯云） 过滤，显示 4/8 条',
        )
    })

    it('取消过滤：恢复全量', () => {
        expect(filterAnnouncement(EMPTY_DASHBOARD_FILTER, 8, 8)).toBe('已取消筛选，显示全部 8 条')
    })

    it('组合过滤：子句 「，」 连接', () => {
        expect(
            filterAnnouncement({ ...EMPTY_DASHBOARD_FILTER, level: 'gt30', hosting: 'complete' }, 2, 8),
        ).toBe('已按 >30 天、托管类型（完整托管） 过滤，显示 2/8 条')
    })
})
