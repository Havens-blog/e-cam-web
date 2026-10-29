/**
 * DNS 展示格式化（纯函数，便于单测）。
 */

/**
 * 权重展示：有值显示数值，无值（不支持权重的云 / 云端未返回 / 字段缺省）显示 `-`。
 *
 * 为什么必须区分 `-` 与 `0`：各家云对"无权重概念"的记录一律返回 0（或干脆不返回），
 * 若直接展示 0 会把"该云不支持权重"误报成"权重为 0"，属误导性展示（口径要求：
 * 可支持云显示数值、其余显示 `-`）。
 */
export function formatWeight(weight?: number | null): string {
    if (weight === null || weight === undefined) return '-'
    if (!Number.isFinite(weight)) return '-'
    return String(weight)
}
