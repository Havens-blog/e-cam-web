/**
 * 到期看板页纯展示逻辑（任务 6.4，UF-3）。
 *
 * 无 Vue / DOM 运行时依赖，可被 node 环境单测直接导入
 * （同 src/views/cert/ledger/format.ts、src/views/cert/detail/format.ts 约定）。
 *
 * 依据：docs/features/ssl-cert-management/ui/ui-design.md「Component: 到期看板页」
 * （Layout/States/Interactions/Data Binding + probeStatus 渲染定义与只读说明）、
 * prd/prd-ui-functions.md UF-3、design/tech-design.md（探测目标域来源与通配符处置、
 * wildcardSkippedCount 看板口径）、ui/prototype/dashboard.html（抽屉差异说明文案）。
 *
 * Hard Rules：
 * - 不可达不得计入差异告警渲染（差异告警卡仅常规 diff，unreachable/exempt/
 *   wildcard_skipped/change_linked_diff 均不计）。
 * - 只读角色页面无变更类操作入口（组件层约束，本模块差异摘要为纯文本复制）。
 */

import type { CertProbeResult, DashboardItem, DaysLeftTier, HostingStatus, ProbeStatus, ReferenceStatus } from '@/api/cert'
import { cloudLabel } from '../detail/format'
import { hostingStatusMeta } from '../ledger/format'

// ==================== 探测徽章（probeStatus 渲染定义） ====================

/** 探测徽章色调（ui-design Design System；本页无 Verifying 紫） */
export type ProbeTone = 'success' | 'error' | 'warning' | 'secondary'

export interface ProbeBadge {
    /** 徽章文字（非色觉通道之一） */
    label: string
    tone: ProbeTone
    /** 图标通道（✓/✗/⚠ 等，非色觉通道之二） */
    icon: string
    /** 悬浮/键盘焦点说明（差异态附最近探测时间由组件层拼装） */
    tooltip: string
}

/**
 * probeStatus 徽章渲染。四态口径（ui-design 渲染定义）：
 * 一致=Success ✓；差异=Error ✗；不可达=Text Secondary ⚠（不参与差异告警，
 * 区别于豁免=人工排除）；豁免=Secondary ✓。
 * 补充枚举（api-handbook ProbeStatus 6 值 + 空串未探测）：
 * wildcard_skipped=通配符 SAN 跳过拨测（Secondary，计数可见不计差异）；
 * change_linked_diff=验证窗口内预期切换（Warning，非事故差异、不走常规告警）；
 * 空串=尚未探测（Secondary）。
 */
export function probeBadge(status: ProbeStatus | ''): ProbeBadge {
    switch (status) {
        case 'consistent':
            return { label: '一致', tone: 'success', icon: '✓', tooltip: '线上指纹与台账一致' }
        case 'diff':
            return { label: '差异', tone: 'error', icon: '✗', tooltip: '线上证书与台账不一致（线上≠台账），走常规差异告警' }
        case 'change_linked_diff':
            return {
                label: '变更关联',
                tone: 'warning',
                icon: '⚠',
                tooltip: '验证窗口内预期切换（线上=新证书），走变更关联告警通道，非常规差异',
            }
        case 'unreachable':
            return {
                label: '不可达',
                tone: 'secondary',
                icon: '⚠',
                tooltip: '探测失败（端口不通 / DNS 无法解析 / 超时），不参与差异告警，巡检侧仍重试',
            }
        case 'exempt':
            return { label: '豁免', tone: 'secondary', icon: '✓', tooltip: '探测豁免（人工排除），不参与常规差异' }
        case 'wildcard_skipped':
            return {
                label: '通配符跳过',
                tone: 'secondary',
                icon: '◇',
                tooltip: '通配符 SAN 无法直接 DNS 解析/SNI 拨测，默认跳过（计数可见，不参与差异告警）',
            }
        default:
            return { label: '未探测', tone: 'secondary', icon: '○', tooltip: '尚未探测，等待下一次巡检' }
    }
}

// ==================== 差异说明（抽屉，按状态文案——原型口径） ====================

/**
 * 探测详情抽屉「差异说明」文案：ProbeResult 无服务端 reason 字段
 * （er-diagram/tech-design），按状态给出解释性文案（原型 dashboard.html 口径）。
 */
export function probeReason(status: ProbeStatus | ''): string {
    switch (status) {
        case 'diff':
            return '线上证书与台账不一致，疑似未生效更换或残留旧证书'
        case 'consistent':
            return '线上与台账一致'
        case 'change_linked_diff':
            return '验证窗口内变更关联差异（预期切换，非事故差异）'
        case 'unreachable':
            return '端口不通 / DNS 无法解析 / 超时（探测失败，不参与差异告警，巡检侧仍重试）'
        case 'exempt':
            return '已加入探测豁免清单（人工排除，不参与告警）'
        case 'wildcard_skipped':
            return '通配符 SAN 无法直接拨测，默认跳过；可在全局配置指定具体子域名替代探测'
        default:
            return '尚未探测，等待下一次巡检'
    }
}

// ==================== 筛选（客户端状态：卡片联动 + 工具栏三维） ====================

/** 差异告警卡 / 豁免卡联动维度（与状态分级正交） */
export type DashboardSpecialFilter = '' | 'diff' | 'exempt'

export interface DashboardFilter {
    /** 状态分级（5 级卡与工具栏下拉共用同一状态源） */
    level: DaysLeftTier | ''
    /** 云多选（按 referencedClouds 过滤，命中其一即显示） */
    clouds: string[]
    /** 托管类型 */
    hosting: HostingStatus | ''
    /** 差异告警卡（diff）/ 探测豁免卡（exempt）联动 */
    special: DashboardSpecialFilter
}

export const EMPTY_DASHBOARD_FILTER: DashboardFilter = { level: '', clouds: [], hosting: '', special: '' }

/**
 * 看板行过滤（全部客户端执行，ui-design Data Binding「客户端状态」）：
 * level 互斥桶精确匹配；clouds 命中其一；hosting 精确；special 仅常规 diff
 * （Hard Rule：不可达/豁免/通配符/变更关联均不计差异告警）与 exempt。
 */
export function filterDashboardItems(items: readonly DashboardItem[], filter: DashboardFilter): DashboardItem[] {
    return items.filter((it) => {
        if (filter.level && it.level !== filter.level) return false
        if (filter.clouds.length > 0 && !it.referencedClouds.some((c) => filter.clouds.includes(c))) return false
        if (filter.hosting && it.hostingType !== filter.hosting) return false
        if (filter.special === 'diff' && it.probeStatus !== 'diff') return false
        if (filter.special === 'exempt' && it.probeStatus !== 'exempt') return false
        return true
    })
}

/** 豁免列 ✓ 判定（probeStatus=exempt；不可达/未探测不属豁免） */
export function isExemptRow(item: DashboardItem): boolean {
    return item.probeStatus === 'exempt'
}

// ==================== 总览卡（5 级卡序） ====================

export interface LevelCardDef {
    tier: DaysLeftTier
    label: string
}

/** 5 级总览卡（countsByLevel 数组序：[gt30, le30, le14, le7, expired]） */
export const DASHBOARD_LEVEL_CARDS: LevelCardDef[] = [
    { tier: 'gt30', label: '>30 天' },
    { tier: 'le30', label: '≤30 天' },
    { tier: 'le14', label: '≤14 天' },
    { tier: 'le7', label: '≤7 天' },
    { tier: 'expired', label: '已过期' },
]

// ==================== 云筛选选项 ====================

/**
 * 云筛选选项：当前可见行 referencedClouds 去重 + 字典序（原始标识，展示经 cloudLabel）。
 * 可见行 = 非 hidden 行（服务端隐藏谓词命中；includeHidden=true 豁免态下被隐藏孤儿
 * 所属云不得入选项，否则选中即空态——proposal Key Risk 行 key/云选项失效项）。
 */
export function cloudFilterOptions(items: readonly DashboardItem[]): string[] {
    const set = new Set<string>()
    for (const it of items) {
        if (it.hidden) continue
        for (const c of it.referencedClouds) set.add(c)
    }
    return [...set].sort()
}

// ==================== 相对时间（最近巡检 / 最近探测） ====================

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

/** 相对时间（看板口径）：刚刚 / N 分钟前 / Nh 前 / N 天前；null/非法 → 「—」 */
export function relativeTimeDash(iso: string | null | undefined, now: Date = new Date()): string {
    if (!iso) return '—'
    const t = Date.parse(iso)
    if (Number.isNaN(t)) return '—'
    const diff = now.getTime() - t
    if (diff < MS_PER_MINUTE) return '刚刚'
    if (diff < MS_PER_HOUR) return `${Math.floor(diff / MS_PER_MINUTE)} 分钟前`
    if (diff < MS_PER_DAY) return `${Math.floor(diff / MS_PER_HOUR)}h 前`
    return `${Math.floor(diff / MS_PER_DAY)} 天前`
}

// ==================== 复制差异摘要（抽屉，只读可用的两个入口之一） ====================

/** 差异摘要四要素纯文本（证书粒度：证书/探测时间/线上指纹/差异说明） */
export function diffSummaryText(item: DashboardItem, now: Date = new Date()): string {
    const probedAt = item.lastProbeAt ? relativeTimeDash(item.lastProbeAt, now) : '尚未探测'
    const onlineFp = item.onlineFingerprint || '—'
    return [
        `证书: ${item.commonName}`,
        `探测时间: ${probedAt}`,
        `线上指纹: ${onlineFp}`,
        `差异说明: ${probeReason(item.probeStatus)}`,
    ].join('\n')
}

// ==================== a11y 通告（筛选变化 aria-live polite） ====================

function levelLabel(tier: DaysLeftTier): string {
    return DASHBOARD_LEVEL_CARDS.find((c) => c.tier === tier)?.label ?? tier
}

/**
 * 筛选变化通告文案（状态卡 aria-live polite）：拼装已生效维度与当前计数；
 * 空过滤输出「已取消筛选」。total 基准为可见行数（不含被隐藏孤儿，NFR a11y）。
 */
export function filterAnnouncement(filter: DashboardFilter, shown: number, total: number): string {
    const parts: string[] = []
    if (filter.level) parts.push(levelLabel(filter.level))
    if (filter.clouds.length > 0) parts.push(`云（${filter.clouds.map(cloudLabel).join('、')}）`)
    if (filter.hosting) parts.push(`托管类型（${hostingStatusMeta(filter.hosting).label}）`)
    if (filter.special === 'diff') return `已按差异告警过滤，显示 ${shown}/${total} 条`
    if (filter.special === 'exempt') return `已按探测豁免过滤，显示 ${shown}/${total} 条`
    if (parts.length === 0) return `已取消筛选，显示全部 ${total} 条`
    return `已按 ${parts.join('、')} 过滤，显示 ${shown}/${total} 条`
}

// ==================== 孤儿隐藏：开关状态机 + localStorage 持久化 ====================

/**
 * 隐藏判定语义（proposal，与台账同构）：仅「已过期且 referenceStatus=no_refs_scanned」
 * 由服务端隐藏；has_refs/blind_spot 恒可见。Hard Rule：前端不重写三态判定，
 * 只消费服务端 visible 行 + hiddenCount + 行级 hidden 标记。
 */

/** localStorage 键（带 cert. 命名空间，eval 残留 #12）：看板「查看全部」开关态（按用户持久化，对账刷新不丢） */
export const DASHBOARD_HIDDEN_EXPANDED_KEY = 'cert.dashboard.hiddenExpanded'

/** 读取看板开关持久化态；storage 不可用或无记录 → false（默认隐藏孤儿） */
export function loadHiddenExpanded(storage: Storage | null | undefined): boolean {
    try {
        return storage?.getItem(DASHBOARD_HIDDEN_EXPANDED_KEY) === '1'
    } catch {
        return false
    }
}

/** 持久化看板开关态；storage 不可用静默忽略（隐私模式放弃持久化不影响当次会话） */
export function saveHiddenExpanded(expanded: boolean, storage: Storage | null | undefined): void {
    try {
        if (expanded) storage?.setItem(DASHBOARD_HIDDEN_EXPANDED_KEY, '1')
        else storage?.removeItem(DASHBOARD_HIDDEN_EXPANDED_KEY)
    } catch {
        /* 放弃持久化 */
    }
}

/**
 * 总规则（豁免仅由风险维度搜索触发）：到期分级卡（filter.level，卡与工具栏下拉
 * 同一状态源）或 diff/exempt 探测卡激活即豁免孤儿隐藏；云/托管等属性维度不豁免。
 */
export function isRiskFilterActive(filter: DashboardFilter): boolean {
    return filter.level !== '' || filter.special !== ''
}

export interface DashboardHiddenViewState {
    /** 当前生效视图：true=显示全部（含被隐藏孤儿；includeHidden=true 重拉） */
    showAll: boolean
    /** 横幅可见（非静默吞行：空态下仍保留「查看全部」入口） */
    showBanner: boolean
    /** 风险维度卡激活时开关强制开启并禁用（清除筛选恢复原开关态） */
    switchDisabled: boolean
}

/**
 * 开关态 × 豁免态状态机：
 * - 豁免激活（风险维度卡）→ 强制 showAll 且开关禁用（expanded 原值不动，清除后自动恢复）；
 * - 展开态恒显示横幅；未展开时仅 hiddenCount>0 显示「已隐藏 N 张」（无 0 噪音）。
 */
export function resolveDashboardHiddenViewState(args: {
    expanded: boolean
    exemptActive: boolean
    hiddenCount: number
}): DashboardHiddenViewState {
    const showAll = args.exemptActive || args.expanded
    return {
        showAll,
        showBanner: args.exemptActive || args.expanded || args.hiddenCount > 0,
        switchDisabled: args.exemptActive,
    }
}

// ==================== 探测徽标最差优先序（行聚合 / 抽屉 SAN 排序共用） ====================

/**
 * 最差优先序（proposal 锚定）：diff > change_linked_diff > unreachable >
 * wildcard_skipped > exempt > 一致；未探测（空串）排序尾。并列同态不细分（同秩）。
 */
export function probeSeverityRank(status: ProbeStatus | ''): number {
    switch (status) {
        case 'diff':
            return 0
        case 'change_linked_diff':
            return 1
        case 'unreachable':
            return 2
        case 'wildcard_skipped':
            return 3
        case 'exempt':
            return 4
        case 'consistent':
            return 5
        default:
            return 6
    }
}

/** 抽屉 SAN 探测条目（san + 该 SAN 最近探测结果；未探测 probe=null） */
export interface SanProbeEntry {
    san: string
    probe: CertProbeResult | null
}

/**
 * 证书 SAN 列表 → 最差优先探测条目（stable：并列同秩保持原 SAN 序，
 * 证书 SAN 顺序即解析序，不因排序抖动）。探测数据源 = probes.LatestPerDomain
 * （GET /certs/probes，探测按域名、证书按张的 1:N 附着在抽屉侧展开）。
 */
export function buildSanProbeEntries(
    sans: readonly string[],
    probeByDomain: ReadonlyMap<string, CertProbeResult>,
): SanProbeEntry[] {
    const entries: SanProbeEntry[] = sans.map((san) => ({ san, probe: probeByDomain.get(san) ?? null }))
    return entries
        .map((e, i) => ({ e, i }))
        .sort((a, b) => {
            const d = probeSeverityRank(a.e.probe?.status as ProbeStatus | '') - probeSeverityRank(b.e.probe?.status as ProbeStatus | '')
            return d !== 0 ? d : a.i - b.i
        })
        .map((x) => x.e)
}

/** SAN 折叠阈值（NFR 锚定 20）：超阈默认折叠为最差优先前 20，其余可展开 */
export const SAN_FOLD_LIMIT = 20

// ==================== 引用三态文案（行/抽屉展示） ====================

/** 引用三态展示文案（台账同口径：「未发现引用」≠「无引用」） */
export function referenceStatusLabel(status: ReferenceStatus): string {
    switch (status) {
        case 'has_refs':
            return '有引用'
        case 'no_refs_scanned':
            return '未发现引用'
        case 'blind_spot':
            return '扫描盲区'
        default:
            return status
    }
}
