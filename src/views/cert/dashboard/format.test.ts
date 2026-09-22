import { describe, expect, it } from 'vitest'
import type { CertProbeResult, DashboardItem } from '@/api/cert'
import {
    DASHBOARD_LEVEL_CARDS,
    DASHBOARD_HIDDEN_EXPANDED_KEY,
    EMPTY_DASHBOARD_FILTER,
    SAN_FOLD_LIMIT,
    buildSanProbeEntries,
    cloudFilterOptions,
    diffSummaryText,
    filterAnnouncement,
    filterDashboardItems,
    isExemptRow,
    isRiskFilterActive,
    loadHiddenExpanded,
    probeBadge,
    probeReason,
    probeSeverityRank,
    referenceStatusLabel,
    relativeTimeDash,
    resolveDashboardHiddenViewState,
    saveHiddenExpanded,
} from './format'

// ==================== 测试夹具（六态探测 + 未探测 + 各分级/托管/云组合） ====================

function item(over: Partial<DashboardItem>): DashboardItem {
    return {
        certId: 'cert-001',
        fingerprint: 'aa11223344556677…8899aabbccddeeff',
        commonName: 'a.example.com',
        sans: ['a.example.com'],
        issuer: "Let's Encrypt R3",
        daysLeft: 45,
        level: 'gt30',
        hostingType: 'complete',
        referenceStatus: 'has_refs',
        referencedClouds: [],
        probeStatus: '',
        lastProbeAt: null,
        onlineFingerprint: '',
        lastScanAt: null,
        hidden: false,
        ...over,
    }
}

const FIXTURES: DashboardItem[] = [
    item({ certId: 'c1', commonName: 'api.example.com', sans: ['api.example.com'], daysLeft: 12, level: 'le14', probeStatus: 'diff', referencedClouds: ['aliyun', 'tencent'], lastProbeAt: '2026-08-19T03:00:00Z', onlineFingerprint: 'ff0011223344556677889900aabbccdd' }),
    item({ certId: 'c2', commonName: 'intranet.example.com', sans: ['intranet.example.com'], daysLeft: 45, level: 'gt30', probeStatus: 'exempt', referencedClouds: ['aliyun'], hostingType: 'fingerprint_only' }),
    item({ certId: 'c3', commonName: 'legacy.example.com', sans: ['legacy.example.com'], daysLeft: 30, level: 'le30', probeStatus: 'unreachable', referencedClouds: ['aliyun'], hostingType: 'fingerprint_only' }),
    item({ certId: 'c4', commonName: 'www.example.com', sans: ['www.example.com'], daysLeft: 74, level: 'gt30', probeStatus: 'consistent', referencedClouds: ['aliyun', 'tencent'] }),
    item({ certId: 'c5', commonName: 'shop.example.com', sans: ['shop.example.com'], daysLeft: 5, level: 'le7', probeStatus: 'change_linked_diff', referencedClouds: ['tencent'] }),
    item({ certId: 'c6', commonName: '*.wild.example.com', sans: ['*.wild.example.com'], daysLeft: 20, level: 'le30', probeStatus: 'wildcard_skipped', referencedClouds: ['k8s'] }),
    item({ certId: 'c7', commonName: 'fresh.example.com', sans: ['fresh.example.com'], daysLeft: 60, level: 'gt30', probeStatus: '', referencedClouds: [] }),
    item({ certId: 'c8', commonName: 'old.example.com', sans: ['old.example.com'], daysLeft: -3, level: 'expired', probeStatus: 'diff', referencedClouds: ['huawei'] }),
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
        expect(out.map((i) => i.commonName)).toEqual(['api.example.com'])
    })

    it('差异告警卡：仅常规 diff 计入（Hard Rule：不可达/豁免/通配符/变更关联/一致/未探测均不计）', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, special: 'diff' })
        expect(out.map((i) => i.commonName).sort()).toEqual(['api.example.com', 'old.example.com'])
    })

    it('探测豁免卡：仅 probeStatus=exempt 命中', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, special: 'exempt' })
        expect(out.map((i) => i.commonName)).toEqual(['intranet.example.com'])
    })

    it('云多选按 referencedClouds 命中其一即显示', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, clouds: ['tencent', 'k8s'] })
        expect(out.map((i) => i.commonName).sort()).toEqual(['*.wild.example.com', 'api.example.com', 'shop.example.com', 'www.example.com'])
    })

    it('托管类型过滤：fingerprint_only 命中', () => {
        const out = filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, hosting: 'fingerprint_only' })
        expect(out.map((i) => i.commonName).sort()).toEqual(['intranet.example.com', 'legacy.example.com'])
    })

    it('多维度 AND 组合：差异卡 ∩ 云=huawei ∩ 托管=complete', () => {
        const out = filterDashboardItems(FIXTURES, {
            ...EMPTY_DASHBOARD_FILTER,
            special: 'diff',
            clouds: ['huawei'],
            hosting: 'complete',
        })
        expect(out.map((i) => i.commonName)).toEqual(['old.example.com'])
    })

    it('无匹配返回空数组（表格空态）', () => {
        expect(filterDashboardItems(FIXTURES, { ...EMPTY_DASHBOARD_FILTER, level: 'le7', clouds: ['huawei'] })).toEqual([])
    })
})

// ==================== AC2：表格筛选选项 / 豁免列 ====================

describe('cloudFilterOptions（云筛选选项：可见行派生 + 去重 + 字典序，AC2）', () => {
    it('去重排序输出', () => {
        expect(cloudFilterOptions(FIXTURES)).toEqual(['aliyun', 'huawei', 'k8s', 'tencent'])
    })

    it('无引用行 → 空选项', () => {
        expect(cloudFilterOptions([FIXTURES[6]!])).toEqual([])
    })

    it('隐藏态：hidden 行（被隐藏孤儿）所属云不入选项（选中即空态反例锁定）', () => {
        const orphan = item({ certId: 'orphan', commonName: 'orphan.example.com', daysLeft: -9, level: 'expired', referenceStatus: 'no_refs_scanned', referencedClouds: ['huawei'], hidden: true })
        const visible = item({ certId: 'v', commonName: 'v.example.com', referencedClouds: ['aliyun'] })
        expect(cloudFilterOptions([orphan, visible])).toEqual(['aliyun'])
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
        expect(probeBadge('unreachable')).toMatchObject({ label: '不可达', tone: 'secondary', icon: '⚠' })
        expect(probeBadge('unreachable').tooltip).toContain('不参与差异告警')
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

describe('diffSummaryText（复制差异摘要：证书/探测时间/线上指纹/差异说明，AC4）', () => {
    const now = new Date('2026-08-19T06:00:00Z')

    it('四要素逐行齐备（差异行）', () => {
        const text = diffSummaryText(FIXTURES[0]!, now)
        expect(text).toContain('证书: api.example.com')
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

// ==================== 孤儿隐藏：开关状态机 + localStorage 持久化（任务 2） ====================

function fakeStorage(): Storage {
    const m = new Map<string, string>()
    return {
        get length() {
            return m.size
        },
        clear: () => m.clear(),
        getItem: (k: string) => m.get(k) ?? null,
        key: () => null,
        removeItem: (k: string) => void m.delete(k),
        setItem: (k: string, v: string) => void m.set(k, v),
    }
}

describe('resolveDashboardHiddenViewState（「查看全部」开关状态机，任务 2）', () => {
    it('默认态：开关关 + hiddenCount=0 → 不显示横幅（无 0 噪音）', () => {
        expect(resolveDashboardHiddenViewState({ expanded: false, exemptActive: false, hiddenCount: 0 })).toEqual({
            showAll: false,
            showBanner: false,
            switchDisabled: false,
        })
    })

    it('默认态 + hiddenCount>0 → 显示「已隐藏 N 张」横幅（非静默吞行）', () => {
        const s = resolveDashboardHiddenViewState({ expanded: false, exemptActive: false, hiddenCount: 3 })
        expect(s).toEqual({ showAll: false, showBanner: true, switchDisabled: false })
    })

    it('开关展开：showAll=true 且横幅恒显（服务端 include 路径 hiddenCount 无意义）', () => {
        const s = resolveDashboardHiddenViewState({ expanded: true, exemptActive: false, hiddenCount: 0 })
        expect(s).toEqual({ showAll: true, showBanner: true, switchDisabled: false })
    })

    it('风险维度卡激活（豁免）：强制 showAll + 开关禁用（expanded 原值不动）', () => {
        const s = resolveDashboardHiddenViewState({ expanded: false, exemptActive: true, hiddenCount: 2 })
        expect(s).toEqual({ showAll: true, showBanner: true, switchDisabled: true })
    })

    it('豁免清除后恢复原开关态（expanded=false → 回默认隐藏）', () => {
        const s = resolveDashboardHiddenViewState({ expanded: false, exemptActive: false, hiddenCount: 2 })
        expect(s.showAll).toBe(false)
        expect(s.switchDisabled).toBe(false)
    })
})

describe('isRiskFilterActive（总规则：豁免仅由风险维度搜索触发）', () => {
    it('分级卡 / diff / exempt 激活 → 豁免；云/托管等属性维度不豁免', () => {
        expect(isRiskFilterActive(EMPTY_DASHBOARD_FILTER)).toBe(false)
        expect(isRiskFilterActive({ ...EMPTY_DASHBOARD_FILTER, level: 'expired' })).toBe(true)
        expect(isRiskFilterActive({ ...EMPTY_DASHBOARD_FILTER, special: 'diff' })).toBe(true)
        expect(isRiskFilterActive({ ...EMPTY_DASHBOARD_FILTER, special: 'exempt' })).toBe(true)
        expect(isRiskFilterActive({ ...EMPTY_DASHBOARD_FILTER, clouds: ['aliyun'] })).toBe(false)
        expect(isRiskFilterActive({ ...EMPTY_DASHBOARD_FILTER, hosting: 'complete' })).toBe(false)
    })
})

describe('loadHiddenExpanded / saveHiddenExpanded（localStorage 持久化，命名空间键）', () => {
    it('键名带 cert. 命名空间（eval 残留 #12）', () => {
        expect(DASHBOARD_HIDDEN_EXPANDED_KEY).toBe('cert.dashboard.hiddenExpanded')
    })

    it('无记录 / storage 不可用 → false（默认隐藏孤儿，前端回退旧版本无异常行为）', () => {
        expect(loadHiddenExpanded(fakeStorage())).toBe(false)
        expect(loadHiddenExpanded(null)).toBe(false)
    })

    it('save(true) 持久化为「1」，save(false) 清除；round-trip 恢复开关态', () => {
        const s = fakeStorage()
        saveHiddenExpanded(true, s)
        expect(s.getItem(DASHBOARD_HIDDEN_EXPANDED_KEY)).toBe('1')
        expect(loadHiddenExpanded(s)).toBe(true)
        saveHiddenExpanded(false, s)
        expect(s.getItem(DASHBOARD_HIDDEN_EXPANDED_KEY)).toBeNull()
        expect(loadHiddenExpanded(s)).toBe(false)
    })
})

// ==================== 证书多 SAN 视图：最差优先排序 + 折叠阈值（任务 2） ====================

function probe(domain: string, status: string, over: Partial<CertProbeResult> = {}): CertProbeResult {
    return { domain, status, probeAt: '2026-08-19T03:00:00Z', ...over }
}

describe('probeSeverityRank（最差优先序：diff > change_linked_diff > unreachable > wildcard_skipped > exempt > 一致；未探测尾）', () => {
    it('全序严格递增', () => {
        const order = ['diff', 'change_linked_diff', 'unreachable', 'wildcard_skipped', 'exempt', 'consistent', ''] as const
        for (let i = 1; i < order.length; i++) {
            expect(probeSeverityRank(order[i]!)).toBeGreaterThan(probeSeverityRank(order[i - 1]!))
        }
    })

    it('并列同态同秩（不细分）', () => {
        expect(probeSeverityRank('diff')).toBe(probeSeverityRank('diff'))
    })
})

describe('buildSanProbeEntries（证书 SAN → 最差优先条目，stable）', () => {
    it('按最差优先重排；未探测 SAN 排序尾；并列保持原 SAN 序', () => {
        const sans = ['a.example.com', 'b.example.com', 'c.example.com', 'd.example.com']
        const map = new Map([
            ['a.example.com', probe('a.example.com', 'consistent')],
            ['b.example.com', probe('b.example.com', 'diff')],
            ['c.example.com', probe('c.example.com', 'unreachable')],
        ])
        const out = buildSanProbeEntries(sans, map)
        expect(out.map((e) => e.san)).toEqual(['b.example.com', 'c.example.com', 'a.example.com', 'd.example.com'])
        expect(out[3]!.probe).toBeNull()
    })

    it('并列同态保持 SAN 原序（stable，解析序不抖动）', () => {
        const sans = ['x.example.com', 'y.example.com', 'z.example.com']
        const map = new Map([
            ['z.example.com', probe('z.example.com', 'diff')],
            ['y.example.com', probe('y.example.com', 'diff')],
        ])
        expect(buildSanProbeEntries(sans, map).map((e) => e.san)).toEqual(['y.example.com', 'z.example.com', 'x.example.com'])
    })

    it('SAN_FOLD_LIMIT 折叠阈值锚定为 20（NFR）', () => {
        expect(SAN_FOLD_LIMIT).toBe(20)
    })
})

// ==================== 引用三态文案（任务 2） ====================

describe('referenceStatusLabel（引用三态展示文案）', () => {
    it('has_refs=有引用 / no_refs_scanned=未发现引用 / blind_spot=扫描盲区', () => {
        expect(referenceStatusLabel('has_refs')).toBe('有引用')
        expect(referenceStatusLabel('no_refs_scanned')).toBe('未发现引用')
        expect(referenceStatusLabel('blind_spot')).toBe('扫描盲区')
    })
})
