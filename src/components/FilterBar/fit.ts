/**
 * FilterBar 折叠布局的纯计算模块。
 *
 * 给定各字段的固有宽度与容器宽度，求一行可容纳的字段数以及是否需要
 * 「展开/收起」切换按钮。折叠阈值由容器宽度测量（ResizeObserver）驱动，
 * 而非固定条数；字段宽度是内容驱动的固有宽度，与容器宽度无关，
 * 因此可缓存复用。
 */

/** 字段条目横向间距 px（与 FilterBar 样式中的 flex column-gap 保持一致） */
export const FILTER_BAR_GAP = 16

/** 「展开/收起」按钮未渲染时的预估占位宽度 px（渲染后用实测宽度） */
export const FILTER_BAR_TOGGLE_WIDTH = 88

/** 折叠布局计算结果 */
export interface FilterBarLayout {
    /** 一行可容纳的字段数（折叠态展示前 visibleCount 个） */
    visibleCount: number
    /** 是否需要「展开/收起」切换按钮 */
    needToggle: boolean
}

/**
 * 计算折叠布局。
 *
 * 规则：
 * 1. 容器不可测量（containerWidth<=0，如初始挂载/隐藏容器）或全部字段
 *    连间距一起放得下 → 不折叠；
 * 2. 否则按「累计字段宽 + 间距 + 尾部预留（切换按钮/操作区）」求解一行
 *    可容纳的最大字段数，需要折叠时预留生效；
 * 3. 一行连一个字段加预留都放不下 → 放弃折叠（换行展示全部），
 *    避免折叠出空筛选栏。
 *
 * @param widths 各字段条目的固有宽度（px，按渲染顺序）
 * @param containerWidth 容器可用宽度（px）
 * @param gap 相邻条目横向间距（px）
 * @param reserveWidth 折叠时需在行尾预留的宽度（px，切换按钮 + 操作区 + 尾间距）
 */
export function computeFitLayout(
    widths: number[],
    containerWidth: number,
    gap: number = FILTER_BAR_GAP,
    reserveWidth: number = FILTER_BAR_TOGGLE_WIDTH,
): FilterBarLayout {
    const count = widths.length
    if (count === 0) {
        return { visibleCount: 0, needToggle: false }
    }

    const totalWithGaps = widths.reduce((sum, width) => sum + width, 0) + (count - 1) * gap
    if (containerWidth <= 0 || totalWithGaps <= containerWidth) {
        return { visibleCount: count, needToggle: false }
    }

    let acc = 0
    let fit = 0
    for (const width of widths) {
        const step = fit === 0 ? width : width + gap
        if (acc + step + reserveWidth > containerWidth) {
            break
        }
        acc += step
        fit += 1
    }

    if (fit === 0) {
        return { visibleCount: count, needToggle: false }
    }
    return { visibleCount: fit, needToggle: true }
}
