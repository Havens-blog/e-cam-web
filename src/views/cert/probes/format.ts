/**
 * 探测结果列表页纯展示逻辑（无 Vue/DOM 运行时依赖，可单测导入）。
 * 复用 dashboard/format 的 probeBadge 与 ledger/format 的 truncateFingerprint/copyText。
 */

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
