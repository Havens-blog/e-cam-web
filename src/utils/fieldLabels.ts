/**
 * 字段展示文案单源（fieldLabels）
 *
 * 背景：字段文案一致性审计（docs/features/ecam-web-ui-audit/reports/field-consistency.md）
 * 发现 CDN 业务类型 / 加速区域 / 计费类型三个枚举域在「列表列、详情抽屉、导出、筛选」
 * 各自手写映射，导致：键集不齐（CDN 三处 map 均缺 `dcdn` → 列表/抽屉/导出裸值直出）、
 * 同值不同词（`overseas` 列表为「海外加速」而导出为「海外」）、大小写变体不一致
 * （`Prepaid` / `PrePaid` / `prepaid` 三种写法只在部分 map 里兜住）。
 *
 * 本模块是这三个域的唯一映射源：列表 / 抽屉 / 导出统一 import，新增取值只改这里。
 * 渲染侧请配合下方 `labelOf` / `labelOfLenient` 使用。
 *
 * 注意：`business_type` / `service_area` / `charge_type` 的真实取值域尚未由后端类型或
 * fixture 完全支撑（见 field-consistency.md §2「待接口核实清单」），因此这三个域目前
 * 一律使用 `labelOfLenient`：未命中的真实取值仍原样展示，而不是被吞成 `-`。
 */

// ==================== CDN 业务类型（business_type） ====================

/**
 * CDN 加速域名业务类型 → 展示文案。
 *
 * 待接口核实: wholeSite/vodDomainName/page/api 是否为后端真实取值 —— 现有键集沿自
 * 前端自造命名（`attributes.business_type` 在 src/api/types/cmdb.ts 中是无约束 string）；
 * `dcdn` 已由 cert 链路确认存在（src/api/cert.ts CloudProduct），与 `wholeSite` 同义
 * 均为「全站加速」。cert/detail/format.ts 的 PRODUCT_LABELS（dcdn→'DCDN'）是云产品名
 * 域，与业务类型不同义，勿混用。
 */
export const BUSINESS_TYPE_LABELS: Record<string, string> = {
    web: '网页加速',
    page: '网页加速',
    download: '下载加速',
    media: '流媒体',
    dcdn: '全站加速',
    wholeSite: '全站加速',
    vodDomainName: '点播',
    api: 'API加速',
}

// ==================== 加速区域（service_area） ====================

/**
 * CDN 加速区域 → 展示文案（与列表/详情抽屉既有措辞对齐）。
 *
 * 待接口核实: `mainland` 变体是否真实下发（现有 map 均防御性收了该键）。
 */
export const SERVICE_AREA_LABELS: Record<string, string> = {
    domestic: '中国大陆',
    mainland: '中国大陆',
    overseas: '海外加速',
    global: '全球加速',
}

// ==================== 计费类型（charge_type） ====================

/**
 * 计费类型 → 展示文案（含三种大小写变体）。
 *
 * 待接口核实: 是否存在第三态（如包月/PackageYear）以及实际下发的大小写
 * （src/api/types/database.ts 的 PayType 只声明 PrePaid/PostPaid，EIP 链路
 * 实际观测到 `Prepaid`，故三种写法都收）。
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
 * 适用于取值域已完全由后端类型/枚举支撑的字段 —— 宁可显示 `-` 也不把未知
 * 原始值透出（如表单汇总、导出单元格）。
 */
export function labelOf(map: Record<string, string>, value: string | undefined | null, fallback = '-'): string {
    if (!value) return fallback
    return map[value] ?? fallback
}

/**
 * 宽松查表：命中返回文案，未命中但确有原始值时透出原始值，仅空值返回 `fallback`。
 *
 * 适用于取值域待接口核实的字段（business_type / service_area / charge_type 目前
 * 即是）—— 后端未来新增的合法取值依旧可读，而不是被兜底文案误导。
 */
export function labelOfLenient(map: Record<string, string>, value: string | undefined | null, fallback = '-'): string {
    if (!value) return fallback
    return map[value] ?? value
}
