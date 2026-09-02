/**
 * 探测结果列表页纯展示逻辑（无 Vue/DOM 运行时依赖，可单测导入）。
 * 复用 dashboard/format 的 probeBadge 与 ledger/format 的 truncateFingerprint/copyText。
 * 根域分组：DNS 源全量轮可达数千子域名，平铺不可读，按根域折叠展开。
 */
import type { CertProbeResult } from '@/api/cert' 

/** linked_resource 链路层标签（DNS 源探测：cdn/waf/external；SAN 探测缺省=—） */
export function linkedResourceLabel(lr?: string): string {
    switch (lr) {
        case 'cdn':
            return 'CDN 边缘'
        case 'waf':
            return 'WAF'
        case 'external':
            return '源站/外部'
        case undefined:
        case '':
            return '—'
        default:
            return lr
    }
}

/** 按状态过滤选项（全/一致/差异/不可达/豁免） */
export const PROBE_STATUS_FILTERS = [
    { value: '', label: '全部' },
    { value: 'consistent', label: '一致' },
    { value: 'diff', label: '差异' },
    { value: 'change_linked_diff', label: '变更关联' },
    { value: 'unreachable', label: '不可达' },
    { value: 'exempt', label: '豁免' },
] as const

/** 按链路层过滤选项（全/CDN/WAF/源站/SAN 探测） */
export const PROBE_LINK_FILTERS = [
    { value: '', label: '全部' },
    { value: 'cdn', label: 'CDN 边缘' },
    { value: 'waf', label: 'WAF' },
    { value: 'external', label: '源站/外部' },
    { value: 'san', label: 'SAN 探测' },
] as const

/** 域名搜索（子串大小写不敏感） */
export function matchDomain(domain: string, kw: string): boolean {
    if (!kw) return true
    return domain.toLowerCase().includes(kw.toLowerCase())
}

/** 探测徽章 class（tone-{success/error/warning/secondary}），避免模板内联模板字面量 */
export function probeBadgeClass(status: string): string {
    return 'tone-' + probeTone(status)
}

// probeTone 镜像 dashboard/format 的 probeBadge.tone（避免跨文件导出类型耦合）
function probeTone(status: string): string {
    switch (status) {
        case 'consistent':
            return 'success'
        case 'diff':
            return 'error'
        case 'change_linked_diff':
            return 'warning'
        case 'unreachable':
        case 'exempt':
        case 'wildcard_skipped':
        default:
            return 'secondary'
    }
}


// ---------------------------------------------------------------------
// 根域分组（DNS 源全量轮数千子域名按根域折叠展示）
// ---------------------------------------------------------------------

/** 二段式公共后缀简表（仅覆盖 fleet 实际出现的国家/二级域；未列出按末两段取根域） */
const MULTI_PART_SUFFIXES = new Set([
    'com.cn', 'net.cn', 'org.cn', 'gov.cn',
    'co.uk', 'com.hk', 'com.tw', 'co.jp', 'com.au', 'com.sg',
])

/**
 * 从探测结果 domain 提取根域（eTLD+1）：
 *   - 通配符行（*.x.com）归入 x.com 组
 *   - 二段式后缀（com.cn 等）取末三段
 *   - 单标签/裸根域原样返回
 */
export function rootDomainOf(domain: string): string {
    const bare = domain.replace(/^\*\./, '').toLowerCase().trim()
    const labels = bare.split('.').filter(Boolean)
    if (labels.length <= 2) return bare
    const last2 = labels.slice(-2).join('.')
    if (MULTI_PART_SUFFIXES.has(last2)) return labels.slice(-3).join('.')
    return last2
}

/** 根域分组：组内排序=根域行 -> 通配符行 -> 子域名字典序；组间按根域字典序 */
export interface ProbeResultGroup {
    root: string
    rows: CertProbeResult[]
}

export function groupProbeResults(rows: CertProbeResult[]): ProbeResultGroup[] {
    const byRoot = new Map<string, CertProbeResult[]>()
    for (const r of rows) {
        const root = rootDomainOf(r.domain)
        const bucket = byRoot.get(root)
        if (bucket) bucket.push(r)
        else byRoot.set(root, [r])
    }
    const groups: ProbeResultGroup[] = []
    for (const [root, bucket] of byRoot) {
        bucket.sort((a, b) => {
            const rank = (d: string) => (d === root ? 0 : d === '*.' + root ? 1 : 2)
            const ra = rank(a.domain)
            const rb = rank(b.domain)
            if (ra !== rb) return ra - rb
            return a.domain.localeCompare(b.domain)
        })
        groups.push({ root, rows: bucket })
    }
    groups.sort((a, b) => a.root.localeCompare(b.root))
    return groups
}

/** 组头状态摘要：N 项 · X 一致 · Y 差异 · Z 不可达（其余状态不单列） */
export function groupSummary(rows: CertProbeResult[]): string {
    const count = (st: string) => rows.filter((r) => r.status === st).length
    const parts = [`${rows.length} 项`]
    const consistent = count('consistent')
    const diff = count('diff')
    const unreachable = count('unreachable')
    if (consistent) parts.push(`${consistent} 一致`)
    if (diff) parts.push(`${diff} 差异`)
    if (unreachable) parts.push(`${unreachable} 不可达`)
    return parts.join(' · ')
}

/** 搜索/状态/链路任一筛选激活（供分组视图决定全展开） */
export function isProbeFilterActive(keyword: string, status: string, link: string): boolean {
    return keyword.trim() !== '' || status !== '' || link !== ''
}
