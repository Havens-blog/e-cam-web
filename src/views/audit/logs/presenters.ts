/**
 * 操作审计页展示层纯函数:操作类型标签/颜色、结果文案。
 * 独立成模块便于单测(el-table 在 happy-dom 下与 MutationObserver 冲突,
 * 展示规则从组件里抽出来直测,不依赖 DOM)。
 */

export type OpTagType = 'success' | 'primary' | 'warning' | 'danger' | 'info' | ''

const opTagMap: Record<string, OpTagType> = {
    create: 'success',
    update: 'warning',
    delete: 'danger',
    sync: 'info',
    import: 'info',
    export: 'info',
    log_search: 'primary',
}

export function opTypeTag(type: string): OpTagType {
    return opTagMap[type] || ''
}

export function opTypeLabel(type: string, options: { value: string; label: string }[]): string {
    if (type === 'log_search') return '日志查询'
    const found = options.find((o) => o.value === type)
    return found ? found.label : type
}

export function resultLabel(result: string): string {
    if (result === 'success') return '成功'
    if (result === 'partial') return '部分成功'
    return '失败'
}
