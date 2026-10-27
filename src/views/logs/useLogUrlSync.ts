/**
 * URL 查询条件同步：刷新还原（hydrate）/ 防抖写地址栏（sync）/ 复制分享链接。
 *
 * 拆分来源：原 `src/views/logs/index.vue` 的 URL 同步区块。
 * 边界理由：本模块是「查询条件 ↔ 地址栏」的双向映射，其输入输出就是**全部查询条件
 * 的引用集合**，逻辑自洽且不产生新的业务状态（只持有一个 `urlHydrated` 门闩）。
 * 它天然要求拿到所有条件 ref，因此放在页面脚本里会与其它逻辑混在一屏；独立成
 * composable 后，条件清单（哪些字段参与分享）一眼可见、便于审计。
 *
 * 顺序约束（拆分时保留）：`hydrateFromUrl()` 必须在 `resetTimeRange()` 之后调用 ——
 * 先落默认值，再用 URL 覆盖；否则默认时间窗会盖掉链接里的时间范围。
 */
import { ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { LogType, LogTypeMeta } from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import type { FieldFilterRow } from './drilldown'
import { decodeUrlState, encodeUrlState, clampWindow } from './url-state'
import type { LogQueryState } from './url-state'
import { METRIC_OPTS } from './useLogFilters'

export interface UseLogUrlSyncOptions {
    activeType: Ref<LogType>
    timeRange: Ref<[Date, Date] | null>
    selectedClouds: Ref<string[]>
    selectedResources: Ref<string[]>
    keyword: Ref<string>
    fieldFilters: Ref<FieldFilterRow[]>
    aggrDimension: Ref<string>
    aggrMetric: Ref<string>
    limit: Ref<number>
    cloudsTouched: Ref<boolean>
    /** 当前类型元数据（时间窗上限钳制用） */
    currentMeta: ComputedRef<LogTypeMeta | undefined>
    /** 采样上限候选（URL 里的 limit 必须在白名单内才生效） */
    limitOptions: readonly number[]
}

export function useLogUrlSync(opts: UseLogUrlSyncOptions) {
    const {
        activeType,
        timeRange,
        selectedClouds,
        selectedResources,
        keyword,
        fieldFilters,
        aggrDimension,
        aggrMetric,
        limit,
        cloudsTouched,
        currentMeta,
        limitOptions,
    } = opts

    /** 是否已从 URL 水合过（未水合前不写地址栏，避免把默认态洗进 URL） */
    const urlHydrated = ref(false)
    let urlTimer: ReturnType<typeof setTimeout> | null = null

    /** 当前查询条件 → URL 状态（供写地址栏/复制链接） */
    function currentUrlState(): LogQueryState {
        return {
            t: activeType.value,
            startMs: timeRange.value?.[0].getTime() ?? null,
            endMs: timeRange.value?.[1].getTime() ?? null,
            clouds: selectedClouds.value,
            resources: selectedResources.value,
            kw: keyword.value,
            filters: fieldFilters.value,
            dim: aggrDimension.value,
            metric: aggrMetric.value,
            limit: limit.value,
        }
    }

    /** 首帧：URL 参数覆盖状态（必须在 resetTimeRange 之后调用，先落默认值再覆盖） */
    function hydrateFromUrl() {
        const s = decodeUrlState(new URLSearchParams(window.location.search))
        activeType.value = s.t
        if (s.startMs != null && s.endMs != null) {
            // 统一钳制逻辑(clampWindow):meta 未加载时按 7d 兜底,
            // 字典到位后 index.vue 会用真实上限复钳一次
            const [clampedStart, clampedEnd] = clampWindow(s.startMs, s.endMs, currentMeta.value?.max_window_days ?? 7)
            timeRange.value = [new Date(clampedStart), new Date(clampedEnd)]
        }
        if (s.clouds.length) {
            selectedClouds.value = s.clouds
            cloudsTouched.value = true
        }
        selectedResources.value = s.resources
        keyword.value = s.kw
        fieldFilters.value = s.filters.map((f) => ({ ...f }))
        aggrDimension.value = s.dim
        if (METRIC_OPTS.some((m) => m.value === s.metric)) aggrMetric.value = s.metric
        if (s.limit != null && limitOptions.includes(s.limit as never)) limit.value = s.limit
        urlHydrated.value = true
    }

    /** 状态变化 → 防抖写 URL（仅 hydrate 完成后，避免把默认态洗进地址栏） */
    function syncUrl() {
        if (!urlHydrated.value) return
        if (urlTimer) clearTimeout(urlTimer)
        urlTimer = setTimeout(() => {
            const qs = encodeUrlState(currentUrlState()).toString()
            window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
        }, 400)
    }

    watch(
        [activeType, timeRange, selectedClouds, selectedResources, keyword, fieldFilters, aggrDimension, aggrMetric, limit],
        syncUrl,
        { deep: true },
    )

    /** 复制当前查询链接（协作者打开即还原条件并自动查询） */
    async function copyQueryLink() {
        const qs = encodeUrlState(currentUrlState()).toString()
        const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ''}`
        try {
            await navigator.clipboard.writeText(url)
            ElMessage.success('查询链接已复制,打开即可还原当前条件')
        } catch {
            ElMessage.error('复制失败,请手动复制地址栏')
        }
    }

    return { urlHydrated, currentUrlState, hydrateFromUrl, syncUrl, copyQueryLink }
}
