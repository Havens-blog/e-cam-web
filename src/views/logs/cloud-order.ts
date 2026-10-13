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
 * 组键（形如 `aliyun·阿里A`）的排序权重：按 CLOUD_ORDER 顺序取下标，
 * 未知云返回 `CLOUD_ORDER.length`（即排到所有已知云之后）。
 */
export function groupRank(groupKey: string): number {
    const idx = CLOUD_ORDER.findIndex((c) => groupKey.startsWith(c))
    return idx < 0 ? CLOUD_ORDER.length : idx
}
