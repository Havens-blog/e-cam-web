/**
 * 查询条件保存/复用的状态封装:localStorage 预设列表 + 保存/应用/删除。
 * 纯存储逻辑在 saved-queries.ts(可单测),本模块只做响应式列表与页面状态回填。
 */
import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { LogType, LogTypeMeta } from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import type { FieldFilterRow } from './drilldown'
import { deleteQuery, listSavedQueries, saveQuery } from './saved-queries'
import type { SavedQuery, SavedQueryState } from './saved-queries'
import { clampWindow } from './url-state'
import { METRIC_OPTS } from './useLogFilters'

export interface UseSavedQueriesOptions {
    activeType: Ref<LogType>
    timeRange: Ref<[Date, Date] | null>
    selectedClouds: Ref<string[]>
    selectedAccounts: Ref<number[]>
    selectedResources: Ref<string[]>
    keyword: Ref<string>
    fieldFilters: Ref<FieldFilterRow[]>
    aggrDimension: Ref<string>
    aggrMetric: Ref<string>
    limit: Ref<number>
    cloudsTouched: Ref<boolean>
    currentMeta: ComputedRef<LogTypeMeta | undefined>
    limitOptions: readonly number[]
}

export function useSavedQueries(opts: UseSavedQueriesOptions) {
    const {
        activeType,
        timeRange,
        selectedClouds,
        selectedAccounts,
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

    const savedQueries = ref<SavedQuery[]>(listSavedQueries())

    /** 捕获当前查询条件(账号筛选也纳入,虽不进 URL 分享) */
    function captureState(): SavedQueryState {
        return {
            t: activeType.value,
            startMs: timeRange.value?.[0].getTime() ?? null,
            endMs: timeRange.value?.[1].getTime() ?? null,
            clouds: selectedClouds.value,
            accounts: selectedAccounts.value,
            resources: selectedResources.value,
            kw: keyword.value,
            filters: fieldFilters.value.map((f) => ({ field: f.field, op: f.op, value: f.value })),
            dim: aggrDimension.value,
            metric: aggrMetric.value,
            limit: limit.value,
        }
    }

    /** 保存当前条件;返回是否成功(调用方据结果决定是否刷新列表/提示) */
    function saveCurrent(name: string): boolean {
        if (!name.trim()) {
            ElMessage.warning('请输入查询名称')
            return false
        }
        try {
            savedQueries.value = saveQuery(name, captureState())
            ElMessage.success(`已保存查询「${name.trim()}」`)
            return true
        } catch (e) {
            ElMessage.error(e instanceof Error ? e.message : '保存失败')
            return false
        }
    }

    /** 把已保存条件回填到页面状态(不触发查询;是否重查由页面编排决定) */
    function applyQuery(state: SavedQueryState): void {
        activeType.value = state.t
        if (state.startMs != null && state.endMs != null) {
            const [start, end] = clampWindow(state.startMs, state.endMs, currentMeta.value?.max_window_days ?? 7)
            timeRange.value = [new Date(start), new Date(end)]
        }
        // 显式回填(含空值):保存了「全部云/全部账号/全部源」也应还原为全选,
        // 而非保留页面当前选择。cloudsTouched 置位避免又自动收敛回默认云。
        selectedClouds.value = [...state.clouds]
        cloudsTouched.value = true
        selectedAccounts.value = [...state.accounts]
        selectedResources.value = [...state.resources]
        keyword.value = state.kw
        fieldFilters.value = state.filters.map((f) => ({ ...f }))
        aggrDimension.value = state.dim
        if (METRIC_OPTS.some((m) => m.value === state.metric)) aggrMetric.value = state.metric
        if (state.limit != null && limitOptions.includes(state.limit as never)) limit.value = state.limit
    }

    function removeQuery(id: string): void {
        savedQueries.value = deleteQuery(id)
        ElMessage.success('已删除查询')
    }

    return { savedQueries, captureState, saveCurrent, applyQuery, removeQuery }
}
