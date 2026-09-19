/**
 * WAF 流量诊断卡展示辅助(纯函数,单测覆盖)。
 * 标签/枚举与后端 e-cam-service internal/logquery/diagnose 包约定对齐
 * (LevelLabel / AttackTypeLabel / risk_level / attack_type)。
 */

/** 风险等级(none/low/medium/high,同后端) */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high'

/** 疑似攻击类型(normal/cc_flood/crawler/brute_force/normal_burst,同后端) */
export type AttackType = 'normal' | 'cc_flood' | 'crawler' | 'brute_force' | 'normal_burst'

/** 风险等级中文标签(与后端 LevelLabel 对齐) */
export function riskLevelLabel(level: string): string {
    switch (level) {
        case 'low':
            return '低风险'
        case 'medium':
            return '中风险'
        case 'high':
            return '高风险'
        case 'none':
            return '无风险'
        default:
            return level
    }
}

/** 风险等级徽标色(el-tag type):高=danger / 中=warning / 低=primary / 无=success */
export function riskLevelTagType(level: string): 'danger' | 'warning' | 'primary' | 'success' {
    switch (level) {
        case 'high':
            return 'danger'
        case 'medium':
            return 'warning'
        case 'low':
            return 'primary'
        default:
            return 'success'
    }
}

/** 是否攻击类判定(区别于 正常/正常高流量 两态) */
export function isAttackType(t: string): boolean {
    return t === 'cc_flood' || t === 'crawler' || t === 'brute_force'
}

/** 疑似攻击类型中文标签(与后端 AttackTypeLabel 对齐;未知兜底正常流量) */
export function attackTypeLabel(t: string): string {
    switch (t) {
        case 'cc_flood':
            return 'CC 刷量'
        case 'crawler':
            return '恶意爬虫'
        case 'brute_force':
            return '接口爆破'
        case 'normal_burst':
            return '正常高流量'
        default:
            return '正常流量'
    }
}

/** 攻击类型徽标色:攻击类 danger / 正常高流量 warning(需关注)/ 正常 success */
export function attackTypeTagType(t: string): 'danger' | 'warning' | 'success' {
    if (isAttackType(t)) return 'danger'
    if (t === 'normal_burst') return 'warning'
    return 'success'
}

/** 占比格式化(0-1 → "12.3%") */
export function formatShare(share: number): string {
    return `${(share * 100).toFixed(1)}%`
}

/**
 * 突增倍数格式化(后端 surge_multiplier:0 = 前窗无数据未计算 → "—";
 * >0 → 一位小数 + 倍)。
 */
export function formatSurge(multiplier: number | undefined): string {
    if (!multiplier || multiplier <= 0) return '—'
    return `${multiplier.toFixed(1)} 倍`
}

/** 大数计数千分位分组(手写分组,无 locale 依赖,渲染跨环境稳定) */
export function formatCount(n: number): string {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
