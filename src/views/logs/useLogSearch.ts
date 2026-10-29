/**
 * 查询引擎：联邦查询 / 时间游标翻页 / 取消 / 进度态 / 失败降级。
 *
 * 拆分来源：原 `src/views/logs/index.vue` 的查询与分页区块。
 * 边界理由：`doSearch`、`loadEarlier`、`cancelSearch` 三者共享同一套在飞请求控制
 * （`searchAbort` + `searching`/`pageLoading` 防并发）、同一套进度计时（`progressTimer`）
 * 与同一套错误归一（`isCanceled` / `friendlySearchError`）。它们是一个整体：
 * 任何一处单独外移都会留下"半份"并发控制。故合并为本模块。
 *
 * 与筛选模块的循环依赖以**参数注入**打破：本模块需要 `buildFilters()` 组装请求，
 * 但不 import 筛选模块；筛选模块需要"改完重查"，由页面把本模块的 `doSearch` 注入。
 *
 * 关键不变式（拆分时逐字保留）：
 * - 查询期间再次触发直接忽略（否则响应乱序时旧结果覆盖新结果）；
 * - 新查询重置分页游标并收敛回统计视图；翻页窗口上界取「当前最旧一条 - 1 秒」
 *   而非 -1ms（WAF3 等秒级时间戳源整批迁移，-1ms 会把整个秒批次跳过）。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { aggregateLogsApi, searchLogsApi } from '@/api/logs'
import type {
    FieldFilter,
    LogAggregateResponse,
    LogEntry,
    LogSearchResponse,
    LogSource,
    LogType,
} from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import { errorMessage } from './format'
import { canLoadEarlierTs, earlierEndMs } from './pagination'
import { failedAccountIds, mergeRetryResult } from './retry'

export interface UseLogSearchOptions {
    activeType: Ref<LogType>
    timeRange: Ref<[Date, Date] | null>
    keyword: Ref<string>
    selectedClouds: Ref<string[]>
    selectedResources: Ref<string[]>
    /** 账号级筛选(平台内 ID;空 = 全部;search/aggregate 请求均携带,2026-10-28 口径确认) */
    selectedAccounts: Ref<number[]>
    /** 区域级筛选(空 = 全部;search 请求携带,后端联邦层映射为资源过滤) */
    selectedRegions: Ref<string[]>
    limit: Ref<number>
    aggrDimension: Ref<string>
    aggrMetric: Ref<string>
    /** 当前云/资源选择下已开启投递的源（进度文案估算查询源数用） */
    filteredSources: ComputedRef<LogSource[]>
    /** 组装有效筛选条件（由筛选模块提供） */
    buildFilters: () => FieldFilter[] | undefined
    /**
     * 累积明细（跨页追加，时间倒序）。由页面持有并注入：查询引擎写它，
     * 筛选模块（字段快捷值、明细导出）与分组模块都读它，故不归单一 composable 所有。
     */
    allEntries: Ref<LogEntry[]>
    /** 服务端聚合结果（doSearch 与聚合按钮共享的同一个 ref） */
    aggregate: Ref<LogAggregateResponse | null>
    /** 明细折叠态：新查询收敛回统计视图时会置 false */
    detailVisible: Ref<boolean>
}

export function useLogSearch(opts: UseLogSearchOptions) {
    const {
        activeType,
        timeRange,
        keyword,
        selectedClouds,
        selectedResources,
        selectedAccounts,
        selectedRegions,
        limit,
        aggrDimension,
        aggrMetric,
        filteredSources,
        buildFilters,
        aggregate,
        allEntries,
        detailVisible,
    } = opts

    const searching = ref(false)
    const searchError = ref('')
    const resp = ref<LogSearchResponse | null>(null)
    const pageLoading = ref(false)
    /** 上次翻页增量（条）；null=尚未翻过页 */
    const pageInc = ref<number | null>(null)
    /** 已到底：窗口起点已无更早日志 */
    const pageBottom = ref(false)
    /** 累积明细最旧时间戳（时间倒序，末位即最旧）；无数据时 0 */
    const oldestTs = computed(() => (allEntries.value.length ? allEntries.value[allEntries.value.length - 1]!.timestamp : 0))
    const canLoadEarlier = computed(() => {
        if (!resp.value || !timeRange.value || allEntries.value.length === 0) return false
        return canLoadEarlierTs(oldestTs.value, timeRange.value[0].getTime(), pageBottom.value)
    })

    // ---- 查询进行中进度态（文字化回馈：源数/已耗时；不必轮询真实进度） ----
    const searchElapsed = ref(0)
    let progressTimer: ReturnType<typeof setInterval> | null = null
    /** 联邦长查询取消控制器（查询/加载更早共用；取消后 axios 抛 ERR_CANCELED） */
    const searchAbort = ref<AbortController | null>(null)

    /** 取消进行中的查询/翻页：立即中止所有在飞请求，进度态随 finally 清理 */
    function cancelSearch() {
        searchAbort.value?.abort()
    }

    /** 取消异常归一到「已取消」文案（axios CanceledError 的 code 即为 ERR_CANCELED） */
    function isCanceled(e: unknown): boolean {
        return !!e && typeof e === 'object' && (e as { code?: string }).code === 'ERR_CANCELED'
    }

    function startProgress() {
        stopProgress()
        searchElapsed.value = 0
        progressTimer = setInterval(() => {
            searchElapsed.value += 1
        }, 1000)
    }

    function stopProgress() {
        if (progressTimer) {
            clearInterval(progressTimer)
            progressTimer = null
        }
    }

    onBeforeUnmount(stopProgress)

    /**
     * 预期查询源数：当前云、账号、区域、资源选择下已开启投递的源（与后端联邦范围一致的前端近似）。
     * 区域筛选（#70）会随请求下发给后端缩小联邦范围，故计数必须同步排除区域外的源，
     * 否则进度文案会虚高（与实际查询范围不符）。
     */
    const querySourceCount = computed(() => {
        const enabled = filteredSources.value.filter((s) => s.enabled)
        const accounts = selectedAccounts.value
        const regions = selectedRegions.value
        const accountOk = (s: LogSource) => !accounts.length || accounts.includes(Number(s.account_id))
        const regionOk = (s: LogSource) => !regions.length || regions.includes(s.region)
        if (!selectedResources.value.length) return enabled.filter((s) => accountOk(s) && regionOk(s)).length
        const picked = new Set(selectedResources.value)
        return enabled.filter((s) => accountOk(s) && regionOk(s) && picked.has(s.resource_id)).length
    })

    const progressText = computed(() =>
        querySourceCount.value > 0 ? `正在查询 ${querySourceCount.value} 个云账号` : '正在查询所选日志源',
    )
    const progressAria = computed(() => `查询进行中:${progressText.value},已耗时 ${searchElapsed.value} 秒`)

    /** 整页失败原因映射：裸错误串转可读中文降级说明（原始串仍附在下方供排查） */
    function friendlySearchError(raw: string): string {
        const msg = raw.toLowerCase()
        if (msg.includes('timeout') || raw.includes('超时')) {
            return '查询超时:云端检索耗时过长,可缩小时间范围、减少所选源或降低条数上限后重试。'
        }
        if (msg.includes('truncat') || raw.includes('截断')) {
            return '结果被截断:命中数据超出单次查询上限,本次为采样视图;可缩小时间范围或加字段筛选后重试。'
        }
        if (msg.includes('network') || raw.includes('网络')) {
            return '网络异常:查询服务暂不可达,请检查网络连接后重试。'
        }
        return '查询失败:云端检索未正常返回,可缩小时间范围或放宽筛选条件后重试。'
    }

    // ---- 时间游标翻页（明细） ----
    function appendEntries(rows: LogEntry[]) {
        // 上游窗口严格前移（end = 上一页最旧秒 - 1s），页间无重复，直接追加
        allEntries.value = [...allEntries.value, ...rows]
    }

    async function doSearch() {
        // 按钮与回车共用入口：查询进行中（联邦跨多云，耗时可观）直接忽略再次触发，
        // 否则并发叠加请求且响应乱序时后返回的旧结果会覆盖新结果
        if (searching.value) return
        if (!timeRange.value) {
            // 时间范围被清空（datetimerange 默认可 clear）时给可见提示，而非静默无响应
            ElMessage.warning('请选择查询时间范围')
            return
        }
        searching.value = true
        searchError.value = ''
        startProgress()
        detailVisible.value = false // 新查询收敛到统计视图
        // 新查询重置分页游标（回到最新/首页）
        allEntries.value = []
        pageLoading.value = false
        pageInc.value = null
        pageBottom.value = false
        const filters = buildFilters()
        const params = {
            log_type: activeType.value,
            start_time: timeRange.value[0].getTime(),
            end_time: timeRange.value[1].getTime(),
            query: keyword.value || undefined,
            clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
            account_ids: selectedAccounts.value.length ? selectedAccounts.value : undefined,
            regions: selectedRegions.value.length ? selectedRegions.value : undefined,
            resources: selectedResources.value.length ? selectedResources.value : undefined,
            filters: filters as FieldFilter[] | undefined,
        }
        // 取消控制器：查询按钮旁出现「取消」，中止即停（见 cancelSearch）
        const ctrl = new AbortController()
        searchAbort.value = ctrl
        try {
            // search（采样明细）+ aggregate（全窗真实统计）并行；聚合失败降级采样视图
            const [searchRes, aggRes] = await Promise.all([
                searchLogsApi({ ...params, limit: limit.value }, { signal: ctrl.signal }),
                aggregateLogsApi({
                    ...params,
                    dimension: aggrDimension.value || undefined,
                    metric: aggrMetric.value === 'count' ? undefined : aggrMetric.value,
                }, { signal: ctrl.signal }).catch(() => null),
            ])
            resp.value = searchRes
            aggregate.value = aggRes
            appendEntries(searchRes.entries)
        } catch (e) {
            resp.value = null
            aggregate.value = null
            searchError.value = isCanceled(e) ? '查询已取消' : errorMessage(e)
        } finally {
            stopProgress()
            searching.value = false
            searchAbort.value = null
        }
    }

    async function loadEarlier() {
        if (pageLoading.value || !timeRange.value) return
        if (!resp.value) {
            await doSearch()
            return
        }
        // 翻页上界 = 最旧一条 - 1 秒;若已越过窗口起点则直接判「到底」,
        // 避免把上界推到 start 之前触发后端 end<=start 拒绝(游标边界)。
        const endTime = earlierEndMs(oldestTs.value, timeRange.value[0].getTime())
        if (endTime == null) {
            pageBottom.value = true
            ElMessage.info('已到窗口起点,没有更早的日志')
            return
        }
        if (!canLoadEarlier.value) {
            ElMessage.info('已到窗口起点,没有更早的日志')
            return
        }
        pageLoading.value = true
        startProgress()
        const ctrl = new AbortController()
        searchAbort.value = ctrl
        try {
            const pageRes = await searchLogsApi({
                log_type: activeType.value,
                start_time: timeRange.value[0].getTime(),
                // 窗口上界前移当前最旧一条 - 1 秒：WAF3 等秒级时间戳源整批完整
                // 迁移（1ms 前移会把整个秒批次跳过；毫秒级源丢 1 秒无感知）
                end_time: endTime,
                query: keyword.value || undefined,
                clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
                account_ids: selectedAccounts.value.length ? selectedAccounts.value : undefined,
            regions: selectedRegions.value.length ? selectedRegions.value : undefined,
                resources: selectedResources.value.length ? selectedResources.value : undefined,
                filters: buildFilters(),
                limit: limit.value,
            }, { signal: ctrl.signal })
            const before = allEntries.value.length
            appendEntries(pageRes.entries)
            pageInc.value = allEntries.value.length - before
            // per-source 状态条随当前页刷新（统计图仍整窗，不受影响）
            resp.value = pageRes
            // 该源剩余窗口已无数据（42 条即该源真实量的末页迹象）：扣一次到底
            if (pageRes.entries.length === 0 || oldestTs.value <= timeRange.value[0].getTime()) {
                pageBottom.value = true
                if (pageRes.entries.length === 0) ElMessage.info('没有更早的日志,已到窗口起点')
            }
        } catch (e) {
            if (!isCanceled(e)) {
                ElMessage.error(`加载更早失败: ${errorMessage(e)}`)
            }
        } finally {
            stopProgress()
            pageLoading.value = false
            searchAbort.value = null
        }
    }

    /** 重试失败源进行中（独立于 searching/pageLoading，避免与查询/翻页互斥语义混淆） */
    const retryingFailed = ref(false)

    const hasFailedSources = computed(() => failedAccountIds(resp.value?.sources ?? []).length > 0)

    /** 仅重试失败源：成功源结果保留，失败源按账号重查后合并回明细与状态条 */
    async function retryFailedSources() {
        if (retryingFailed.value || searching.value || pageLoading.value) return
        const failedIds = failedAccountIds(resp.value?.sources ?? [])
        if (!failedIds.length || !timeRange.value) return

        retryingFailed.value = true
        startProgress()
        const ctrl = new AbortController()
        searchAbort.value = ctrl
        try {
            const retryRes = await searchLogsApi({
                log_type: activeType.value,
                start_time: timeRange.value[0].getTime(),
                end_time: timeRange.value[1].getTime(),
                query: keyword.value || undefined,
                clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
                account_ids: failedIds,
                regions: selectedRegions.value.length ? selectedRegions.value : undefined,
                resources: selectedResources.value.length ? selectedResources.value : undefined,
                filters: buildFilters(),
                limit: limit.value,
            }, { signal: ctrl.signal })

            // 成功源结果原样保留;失败源用重试结果替换(失败源此前无明细,故直接追加)
            const merged = mergeRetryResult(
                resp.value?.sources ?? [],
                retryRes.sources,
                allEntries.value,
                retryRes.entries,
                failedIds,
            )
            resp.value = {
                ...retryRes,
                total: merged.entries.length,
                truncated: (resp.value?.truncated ?? false) || retryRes.truncated,
                entries: merged.entries,
                sources: merged.sources,
            }
            allEntries.value = merged.entries

            const stillFailed = retryRes.sources.filter((s) => s.error !== '').length
            if (stillFailed > 0) {
                ElMessage.warning(`重试后仍有 ${stillFailed} 个源失败`)
            } else {
                ElMessage.success('失败源已全部恢复')
            }
        } catch (e) {
            if (!isCanceled(e)) ElMessage.error(`重试失败源失败: ${errorMessage(e)}`)
        } finally {
            stopProgress()
            retryingFailed.value = false
            searchAbort.value = null
        }
    }

    /** 回到窗口起点重置为最新一批 */
    function backToLatest() {
        if (searching.value) return
        void doSearch()
    }

    /** 切类型时清空查询结果（分页游标由下一次 doSearch 重置） */
    function resetSearch() {
        resp.value = null
        allEntries.value = []
    }

    return {
        searching,
        searchError,
        resp,
        pageLoading,
        pageInc,
        pageBottom,
        oldestTs,
        canLoadEarlier,
        searchElapsed,
        searchAbort,
        querySourceCount,
        progressText,
        progressAria,
        friendlySearchError,
        cancelSearch,
        doSearch,
        loadEarlier,
        backToLatest,
        resetSearch,
        hasFailedSources,
        retryingFailed,
        retryFailedSources,
    }
}
