/**
 * 结构化字段筛选 / TopN 下钻 / 自定义分组聚合 / CSV 导出。
 *
 * 拆分来源：原 `src/views/logs/index.vue` 的筛选与聚合区块。
 * 边界理由：这四件事共享同一份「当前查询条件」语义（字段筛选行 `fieldFilters`
 * 既是筛选来源，也是图表下钻与诊断下钻的落点，还是 CSV 与聚合请求的入参），
 * 互为一体，拆开会产生三份互相引用的半成品，故合并为一个 composable。
 *
 * 与查询模块的循环依赖以**回调注入**打破：本模块需要「改完筛选后重查」，
 * 而查询模块需要本模块的 `buildFilters()` 组装请求。故本模块只接受
 * `triggerSearch`（页面传入的 doSearch），不反向 import 查询模块。
 */
import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { aggregateLogsApi } from '@/api/logs'
import type {
    FieldFilter,
    LogAggregateResponse,
    LogEntry,
    LogFieldDef,
    LogType,
    LogTypeMeta,
} from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import { csvSerialize, downloadCsv, entryRows } from './csv'
import { applyDrilldown, stripDrilldown, topnDrilldownField } from './drilldown'
import type { FieldFilterRow } from './drilldown'
import { formatLogTime, QUICK_VALUES_MAX, quickValuesFor } from './format'

/** 结构化字段筛选上限（超限时下钻/新增给出可见提示） */
export const FIELD_FILTER_MAX = 4

/** 字段筛选可用运算符 */
export const FILTER_OPS = [
    { value: 'eq', label: '等于' },
    { value: 'neq', label: '不等于' },
    { value: 'contains', label: '包含' },
    { value: 'prefix', label: '前缀' },
]

/** 分组维度输入提示（维度支持云上原始列名） */
export const DIM_TIP =
    '分组维度(下拉按可聚合性分组):\n' +
    '· 统一字段:host/status/URL/耗时 等已映射,直接选;\n' +
    '· 原始列:可输入云上字段名(如 real_client_ip / UA)按原始列聚合;\n' +
    '· 置灰项:多列拼接/归一化字段(如后端 IP),暂不可下推聚合'

/** 分组聚合指标选项 */
export const METRIC_OPTS = [
    { value: 'count', label: '计数' },
    { value: 'sum_bytes', label: '下行字节' },
    { value: 'avg_latency', label: '平均耗时' },
    { value: 'p99_latency', label: 'P99 耗时' },
]

export interface UseLogFiltersOptions {
    activeType: Ref<LogType>
    /** 当前类型字段字典（字段筛选/聚合白名单的基准） */
    currentFields: ComputedRef<LogFieldDef[]>
    /** 当前类型元数据（提供 aggregatable 分析索引白名单） */
    currentMeta: ComputedRef<LogTypeMeta | undefined>
    /** 已返回样本（字段快捷值来源） */
    allEntries: Ref<LogEntry[]>
    /**
     * 服务端聚合结果（真实总数/趋势/TopN；null=失败，统计图回退采样）。
     * 由页面持有并注入：本模块的「查分组」会写它，查询引擎的 doSearch 也会写它
     * （search + aggregate 并行发出），故不归任何单一 composable 所有。
     */
    aggregate: Ref<LogAggregateResponse | null>
    timeRange: Ref<[Date, Date] | null>
    keyword: Ref<string>
    selectedClouds: Ref<string[]>
    selectedResources: Ref<string[]>
    /** 页面注入的重查入口（改完筛选/下钻后触发） */
    triggerSearch: () => void
}

export function useLogFilters(opts: UseLogFiltersOptions) {
    const { activeType, currentFields, currentMeta, allEntries, aggregate, timeRange, keyword, selectedClouds, selectedResources, triggerSearch } = opts

    // ---- 结构化字段筛选（多条件 AND；与 keyword 叠加） ----
    const fieldFilters = ref<FieldFilterRow[]>([])

    /** 可筛选字段：字段字典中非固定列（剔除 meta.* / 时间） */
    const filterableFields = computed(() =>
        currentFields.value.filter((f) => !f.key.startsWith('meta.') && f.key !== 'timestamp'),
    )

    // ---- 分组聚合维度白名单（后端索引探测：列必须开过 KV 分析索引才能 group by） ----
    /** 当前类型可聚合字段清单（空 = 探测失败/无账号 → 维度下拉回退全量字典，不劣化） */
    const aggregatableFields = computed(() => currentMeta.value?.aggregatable ?? [])
    const aggregatableSet = computed(() => new Set(aggregatableFields.value))
    /** 白名单内的统一字段（带中文标签，可直接选） */
    const aggregatableDictFields = computed(() =>
        filterableFields.value.filter((f) => aggregatableSet.value.has(f.key)),
    )
    /** 白名单内的云上原始列（非统一字段，按列名展示；allow-create 亦可输） */
    const aggregatableRawFields = computed(() =>
        aggregatableFields.value.filter((k) => !filterableFields.value.some((f) => f.key === k)),
    )
    /** 字典中不在白名单的字段（未开分析索引）：禁用展示说明，不再盲选撞错 */
    const nonAggregatableDictFields = computed(() => {
        if (!aggregatableFields.value.length) return []
        return filterableFields.value.filter((f) => !aggregatableSet.value.has(f.key))
    })

    function addFilterRow() {
        if (fieldFilters.value.length >= FIELD_FILTER_MAX) return
        fieldFilters.value.push({ field: filterableFields.value[0]?.key ?? '', op: 'eq', value: '' })
    }

    /**
     * {field: quickValues} 映射：对每个可筛选字段从当前样本聚合高频值（频率降序去重，
     * 上限 QUICK_VALUES_MAX）。依赖 allEntries + filterableFields，样本/类型/字段变化
     * 自动重算，不残留旧值；未加载数据或字段无可抽取值时为空 → chips 区整行隐藏。
     */
    const quickValuesByField = computed<Map<string, string[]>>(() => {
        const map = new Map<string, string[]>()
        if (allEntries.value.length === 0) return map
        for (const f of filterableFields.value) {
            map.set(f.key, quickValuesFor(allEntries.value, f.key, QUICK_VALUES_MAX))
        }
        return map
    })

    function fieldLabel(fieldKey: string): string {
        return filterableFields.value.find((f) => f.key === fieldKey)?.label ?? fieldKey
    }

    /** 点选快捷值：已选中则取消（toggle 清空 value，该行退出筛选组合），随后按当前筛选组合重查 */
    function applyQuickValue(f: FieldFilter, value: string) {
        f.value = f.value.trim() === value ? '' : value
        triggerSearch()
    }

    /** 组装有效筛选（字段与值齐全的行；空值行不参与，避免误过滤；下钻标记为前端态，提交时剥除） */
    function buildFilters(): FieldFilter[] | undefined {
        const valid = fieldFilters.value.filter((f) => f.field && f.value.trim() !== '')
        return valid.length
            ? valid.map((f) => ({ field: f.field, op: f.op, value: f.value.trim() }))
            : undefined
    }

    // ---- TopN 分组图下钻（LogStats bar-click → 字段筛选；维度映射在本层，子组件不感知父级 state） ----
    /** 是否存在下钻条件（「清除下钻」按钮可见性） */
    const hasDrilldown = computed(() => fieldFilters.value.some((f) => f.drilldown))

    /**
     * 点击 TopN 条形图项：映射到当前图维度的筛选字段，同字段 eq 行更新值、否则新增下钻行，
     * 随后按新筛选重查（doSearch 并行刷新明细 + 聚合，统计图同步）。
     */
    function onBarDrilldown(payload: { name: string }) {
        if (!filterableFields.value.length) {
            ElMessage.warning('字段字典未加载,暂不支持图表下钻')
            return
        }
        // 以「聚合 topn 是否实际生效」判定维度：聚合失败/无 topn 时图回退采样默认 TopN，
        // 此刻即使选了自定义维度也应映射默认字段,否则筛选与图上分组对不上
        const hasTopn = !!aggregate.value && aggregate.value.topn.length > 0
        const field = topnDrilldownField(hasTopn, aggrDimension.value, activeType.value)
        const next = applyDrilldown(fieldFilters.value, field, payload.name, FIELD_FILTER_MAX)
        if (!next) {
            ElMessage.warning(`字段筛选已达上限(${FIELD_FILTER_MAX}),请先删除一条再加下钻条件`)
            return
        }
        fieldFilters.value = next
        triggerSearch()
    }

    /**
     * 诊断卡下钻（Top 源/URI/状态码/动作 → 字段筛选）：判定→定位闭环 —— 判定为
     * 高风险后点一下攻击源即可在明细里看它的流量构成。字段映射由卡内给出
     * （client_ip/uri/status/action，都是诊断维度的统一字段 key），此处复用图表
     * 下钻同一套追加/覆盖逻辑。
     */
    function onDiagDrilldown(payload: { field: string; value: string }) {
        const known = filterableFields.value.some((f) => f.key === payload.field)
        if (!known) {
            ElMessage.warning(`字段 ${payload.field} 不在字段字典内,暂不支持下钻`)
            return
        }
        const next = applyDrilldown(fieldFilters.value, payload.field, payload.value, FIELD_FILTER_MAX)
        if (!next) {
            ElMessage.warning(`字段筛选已达上限(${FIELD_FILTER_MAX}),请先删除一条再加下钻条件`)
            return
        }
        fieldFilters.value = next
        triggerSearch()
    }

    /** 导出文件名时间戳（本地 yyyyMMdd-HHmm） */
    function datetimeStamp(): string {
        const d = new Date()
        const p = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
    }

    /** 明细导出：按当前字段字典列导出 allEntries，值口径与表格一致 */
    function exportDetailCsv() {
        if (!allEntries.value.length) return
        const columns = currentFields.value.map((f) => ({ key: f.key, label: f.label }))
        if (!columns.length) {
            ElMessage.warning('字段字典未加载,暂无法导出')
            return
        }
        const csv = csvSerialize(columns.map((c) => c.label), entryRows(allEntries.value, columns))
        downloadCsv(`日志明细-${activeType.value}-${datetimeStamp()}.csv`, csv)
        ElMessage.success(`已导出明细 ${allEntries.value.length} 条`)
    }

    /** 统计导出：趋势（时间，请求数）+ TopN（名称，计数）两段单文件，首列类型区分 */
    function exportStatsCsv() {
        const agg = aggregate.value
        if (!agg) {
            ElMessage.warning('暂无统计结果,先查询或查分组后再导出')
            return
        }
        const header = ['类型', '名称/时间', '数值']
        const rows: string[][] = []
        for (const b of agg.buckets ?? []) {
            rows.push(['趋势', formatLogTime(b.timestamp), String(b.count)])
        }
        for (const t of agg.topn ?? []) {
            rows.push(['TopN', t.name, String(t.count)])
        }
        downloadCsv(`日志统计-${activeType.value}-${datetimeStamp()}.csv`, csvSerialize(header, rows))
        ElMessage.success('已导出统计(趋势 + TopN)')
    }

    /** 清除下钻：仅移除带下钻标记的条件行（用户手动条件与 keyword 原样保留），并重查还原 */
    function clearDrilldown() {
        const next = stripDrilldown(fieldFilters.value)
        if (!next) return
        fieldFilters.value = next
        triggerSearch()
    }

    // ---- 自定义分组聚合（维度/指标；影响 TopN 图，趋势/总数不变） ----
    const aggrDimension = ref('')
    const aggrMetric = ref('count')
    const aggrLoading = ref(false)

    async function doAggregate() {
        if (aggrLoading.value || !timeRange.value) return
        aggrLoading.value = true
        try {
            const agg = await aggregateLogsApi({
                log_type: activeType.value,
                start_time: timeRange.value[0].getTime(),
                end_time: timeRange.value[1].getTime(),
                query: keyword.value || undefined,
                clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
                resources: selectedResources.value.length ? selectedResources.value : undefined,
                filters: buildFilters(),
                dimension: aggrDimension.value || undefined,
                metric: aggrMetric.value === 'count' ? undefined : aggrMetric.value,
            }).catch(() => null)
            aggregate.value = agg
            if (!agg) ElMessage.warning('分组聚合失败(可能不支持的维度/指标),TopN 已还原')
        } finally {
            aggrLoading.value = false
        }
    }

    /** 切类型时清理跨类型残留的筛选/分组条件（字段字典随类型变化） */
    function resetFilters() {
        fieldFilters.value = []
        aggrDimension.value = ''
        aggrMetric.value = 'count'
    }

    return {
        fieldFilters,
        filterableFields,
        aggregatableFields,
        aggregatableDictFields,
        aggregatableRawFields,
        nonAggregatableDictFields,
        addFilterRow,
        quickValuesByField,
        fieldLabel,
        applyQuickValue,
        buildFilters,
        hasDrilldown,
        onBarDrilldown,
        onDiagDrilldown,
        exportDetailCsv,
        exportStatsCsv,
        clearDrilldown,
        aggrDimension,
        aggrMetric,
        aggrLoading,
        doAggregate,
        resetFilters,
    }
}
