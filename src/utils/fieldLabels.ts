/**
 * 字段展示文案单源（fieldLabels）— 计费类型域
 *
 * 背景：字段文案一致性审计（docs/features/ecam-web-ui-audit/reports/field-consistency.md §2 域4）
 * 发现计费类型 `charge_type` 在 eip/ecs/cmdb/rds/redis/mongodb/nas/template/provision
 * 的列表列、详情抽屉、导出共 11+ 处各自手写映射：键集不齐（有的只认 `PrePaid`/`PostPaid`，
 * 有的额外收 `prepaid`/`postpaid` 小写变体）、空值/未知值被吞成错误文案
 * （eip 列表把空值也显示成「按量付费」）、导出链路直接裸出 `PrePaid`。
 *
 * 本模块是计费类型的唯一映射源：各位点统一 import，新增取值只改这里。
 * 渲染侧请配合下方 `labelOf` / `labelOfLenient` 使用。
 *
 * 同类单源：CDN 的业务类型/服务区域/状态已由 src/utils/cdn.ts 收口（后端 26c0758
 * 已归一化为统一枚举 + 历史原始值兼容），不要在本模块重复定义。
 */

// ==================== 计费类型（charge_type） ====================

/**
 * 计费类型 → 展示文案（含三种大小写变体）。
 *
 * 待接口核实: 是否存在第三态（如包月/PackageYear）以及实际下发的大小写
 * —— src/api/types/database.ts 的 PayType 只声明 `PrePaid`/`PostPaid`，
 * EIP 链路实际观测到 `Prepaid`，故三种写法都收，未知值由 labelOfLenient 原样透出。
 */
export const CHARGE_TYPE_LABELS: Record<string, string> = {
    PrePaid: '包年包月',
    prepaid: '包年包月',
    Prepaid: '包年包月',
    PostPaid: '按量付费',
    postpaid: '按量付费',
    Postpaid: '按量付费',
}

// ==================== 查表助手 ====================

/**
 * 严格查表：命中返回文案，未命中返回 `fallback`（默认 `-`）。
 *
 * 适用于取值域已完全由后端类型/枚举支撑的字段 —— 宁可显示 `-` 或既定兜底，
 * 也不把未知原始值透出（如表单汇总、导出单元格）。
 */
export function labelOf(map: Record<string, string>, value: string | undefined | null, fallback = '-'): string {
    if (!value) return fallback
    return map[value] ?? fallback
}

/**
 * 宽松查表：命中返回文案，未命中但确有原始值时透出原始值，仅空值返回 `fallback`。
 *
 * 适用于取值域待接口核实的字段（charge_type 目前即是）—— 后端未来新增的合法
 * 取值依旧可读，而不是被兜底文案误导。
 */
export function labelOfLenient(map: Record<string, string>, value: string | undefined | null, fallback = '-'): string {
    if (!value) return fallback
    return map[value] ?? value
}
