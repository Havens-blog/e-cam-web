/**
 * 云顺序（分组排序用）。
 *
 * 拆分来源：原 `src/views/logs/index.vue` 内联的 `cloudOrder` 常量与 `groupRank()`。
 * 抽取理由：这两者被**两类互不相同的分组**同时使用 ——
 *   1. 「日志源」下拉的云·账号分组（`useLogSources` 的 `sourceGroups`）；
 *   2. 「明细」表格的云·账号折叠分组（`useEntryGroups` 的 `entryGroups`）。
 * 若把顺序表留在任一侧，另一侧就得反向依赖它（或各自复制一份顺序，
 * 埋下两处排序不一致的隐患），故抽为共享模块，保证「同屏云序一致」。
 */

/** 云排序权重表：未列出的云统一排到最后（不参与排序优先级） */
export const CLOUD_ORDER: string[] = ['aliyun', 'huawei', 'aws', 'tencent', 'volcano']

/**
 * 云 id 变体归一（排序口径；与 `format.ts` 的 `CLOUD_LABELS` 别名保持一致）。
 *
 * 日志接口的 `cloud` 直接取账号 provider：火山账号返回 `volcengine`，而排序表
 * 用的是 `volcano`。不归一时同一朵云在两处得到不同权重 —— 云/账号下拉走
 * `CLOUD_ORDER.indexOf`（未命中为 -1）会**排到最前**，而源分组/明细分组走
 * `groupRank`（未命中为 length）会**排到最后**，同屏云序自相矛盾。
 */
const CLOUD_ALIASES: Record<string, string> = {
    volcengine: 'volcano',
    volc: 'volcano',
}

/** 云 id 变体归一（未登记变体原样返回） */
export function normalizeCloud(cloud: string): string {
    return CLOUD_ALIASES[cloud] ?? cloud
}

/**
 * 云的排序权重：变体归一后按 CLOUD_ORDER 取下标；未知云返回
 * `CLOUD_ORDER.length`（排到所有已知云之后，与 groupRank 语义一致）。
 */
export function cloudRank(cloud: string): number {
    const idx = CLOUD_ORDER.indexOf(normalizeCloud(cloud))
    return idx < 0 ? CLOUD_ORDER.length : idx
}

/**
 * 组键（形如 `aliyun·阿里A`）的排序权重：取键内云段做变体归一后按 CLOUD_ORDER
 * 取下标，未知云返回 `CLOUD_ORDER.length`（即排到所有已知云之后）。
 * 入参也可直接传云 id（无分隔符时整串即云段）。
 */
export function groupRank(groupKey: string): number {
    const cloud = groupKey.split('·')[0] ?? groupKey
    const rank = cloudRank(cloud)
    if (rank < CLOUD_ORDER.length) return rank
    // 云段未识别时退回前缀兜底，兼容历史组键（如带空格的键）
    const idx = CLOUD_ORDER.findIndex((c) => groupKey.startsWith(c))
    return idx < 0 ? CLOUD_ORDER.length : idx
}
