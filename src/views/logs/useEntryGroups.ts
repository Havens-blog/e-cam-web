/**
 * 明细「云·账号」折叠分组、组内源状态、采样标注。
 *
 * 拆分来源：原 `src/views/logs/index.vue` 的分组区块。
 * 边界理由：本单元是**纯派生展示逻辑** —— 全部产物都由 `allEntries` / `resp` /
 * `timeRange` / `limit` 推导而来，自身只持有一个纯 UI 态 `collapsedGroups`，
 * 不发起任何请求、不触发查询，适合独立成 composable 并被单独推演。
 *
 * 关键不变式（拆分时逐字保留）：
 * - 分组键 = `meta.cloud + '·' + meta.account_name`；`allEntries` 本身时间倒序，
 *   过滤进组天然保持组内倒序，翻页追加后 computed 自动重算；
 * - 失败且无样本的源也要补出组头（0 条 + 失败 tag），避免整组失败被隐藏；
 * - 组序按 CLOUD_ORDER 固定云序，与上方日志源下拉分组一致。
 */
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { LogEntry, LogSearchResponse, LogSourceOutcome } from '@/api/types/logs'
import { groupRank } from './cloud-order'
import { cloudLabel, formatLogTime, formatSpanMs } from './format'

export interface UseEntryGroupsOptions {
    /** 累积明细（跨页追加，时间倒序） */
    allEntries: Ref<LogEntry[]>
    /** 最近一次查询响应（提供 per-source 状态与失败源列表） */
    resp: Ref<LogSearchResponse | null>
    /** 当前查询时间窗（采样标注用） */
    timeRange: Ref<[Date, Date] | null>
    /** 每日志源采样上限（采样标注用） */
    limit: Ref<number>
}

export function useEntryGroups(opts: UseEntryGroupsOptions) {
    const { allEntries, resp, timeRange, limit } = opts

    /**
     * 分组键 = meta.cloud + meta.account_name；组数据 = allEntries 过滤 —— allEntries
     * 本身时间倒序，过滤天然保持组内倒序不变；翻页追加后 computed 自动重算。
     * 组序按 cloudOrder 固定云序，与上方日志源下拉分组一致。
     */
    const entryGroups = computed(() => {
        const map = new Map<string, { cloud: string; accountName: string; entries: LogEntry[] }>()
        for (const e of allEntries.value) {
            const key = `${e.meta.cloud}·${e.meta.account_name}`
            if (!map.has(key)) map.set(key, { cloud: e.meta.cloud, accountName: e.meta.account_name, entries: [] })
            map.get(key)!.entries.push(e)
        }
        // 失败且无样本的源也要有组头可标注（0 条 + 失败 tag），避免整组失败被隐藏
        for (const o of resp.value?.sources ?? []) {
            const key = `${o.cloud}·${o.account_name}`
            if (!map.has(key)) map.set(key, { cloud: o.cloud, accountName: o.account_name, entries: [] })
        }
        return Array.from(map.entries())
            .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
            .map(([key, g]) => ({ key, label: `${cloudLabel(g.cloud)}·${g.accountName}`, entries: g.entries }))
    })

    /** 组 → 单源状态（失败/耗时，来自 resp.sources；翻页后随当前页刷新） */
    const groupOutcomes = computed<Map<string, LogSourceOutcome[]>>(() => {
        const map = new Map<string, LogSourceOutcome[]>()
        for (const o of resp.value?.sources ?? []) {
            const key = `${o.cloud}·${o.account_name}`
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(o)
        }
        return map
    })

    /** 组头 title：该组失败源错误原因（hover 可查） */
    function groupErrorText(key: string): string {
        return (groupOutcomes.value.get(key) ?? [])
            .filter((o) => o.error)
            .map((o) => o.error)
            .join(';')
    }

    /** 折叠态（默认空 = 全展开）；键随组稳定，翻页不重置，切类型重置 */
    const collapsedGroups = ref<Set<string>>(new Set())

    function toggleGroup(key: string) {
        const next = new Set(collapsedGroups.value)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        collapsedGroups.value = next
    }

    const allGroupsCollapsed = computed(() =>
        entryGroups.value.length > 0 && entryGroups.value.every((g) => collapsedGroups.value.has(g.key)),
    )

    function toggleAllGroups() {
        collapsedGroups.value = allGroupsCollapsed.value ? new Set() : new Set(entryGroups.value.map((g) => g.key))
    }

    /** 切类型时重置折叠态（组键跨类型语义不同） */
    function resetCollapsed() {
        collapsedGroups.value = new Set()
    }

    /**
     * 明细采样标注：表格只展示最新 limit 条/源，高流量源仅覆盖数秒~数分钟，远小于
     * 查询窗口时给出可见提示，避免被误读为「窗口内只有这么点数据」。明细已覆盖
     * 整窗或空表时不显示（allEntries 时间倒序：头=最新，尾=最旧）。
     */
    const detailSampleNote = computed(() => {
        if (!timeRange.value || allEntries.value.length === 0) return ''
        const newest = allEntries.value[0]?.timestamp
        const oldest = allEntries.value[allEntries.value.length - 1]?.timestamp
        if (typeof newest !== 'number' || typeof oldest !== 'number') return ''
        const coveredMs = newest - oldest
        const windowMs = timeRange.value[1].getTime() - timeRange.value[0].getTime()
        if (coveredMs >= windowMs) return '' // 明细已覆盖整窗,无需标注
        const span = formatSpanMs(coveredMs) || '极短'
        return `明细为最新 ${allEntries.value.length} 条采样(每源上限 ${limit.value} 条),覆盖 ${formatLogTime(oldest)} → ${formatLogTime(newest)},约 ${span};完整窗口分布见上方统计,可点「加载更早日志」向前翻页`
    })

    return {
        entryGroups,
        groupOutcomes,
        groupErrorText,
        collapsedGroups,
        toggleGroup,
        allGroupsCollapsed,
        toggleAllGroups,
        resetCollapsed,
        detailSampleNote,
    }
}
