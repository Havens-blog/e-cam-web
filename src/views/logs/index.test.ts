// @vitest-environment happy-dom
/**
 * 日志查询页状态回归(任务 2:查询进行中状态 + 失败可重试):
 * - 查询期间显示文字进度态(N 个源 / 已耗时,带 aria-label),非纯骨架;
 * - 整页失败给可读中文原因 + 可点重试(不再是裸错误串);
 * - 部分源失败保持 per-source 标签,整页不进入失败态;
 * - 翻页(加载更早)期间同样有文字进度。
 */
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aggregateLogsApi, diagnoseLogsApi, getLogSourcesApi, getLogTypesApi, searchLogsApi } from '@/api/logs'
import type { LogSearchResponse, LogSource, LogTypeMeta } from '@/api/types/logs'
import LogsIndex from './index.vue'

vi.mock('@/api/logs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/logs')>()
    return {
        ...actual,
        getLogTypesApi: vi.fn(),
        getLogSourcesApi: vi.fn(),
        searchLogsApi: vi.fn(),
        aggregateLogsApi: vi.fn(),
        diagnoseLogsApi: vi.fn(),
    }
})

const typesApi = vi.mocked(getLogTypesApi)
const sourcesApi = vi.mocked(getLogSourcesApi)
const searchApi = vi.mocked(searchLogsApi)
const aggregateApi = vi.mocked(aggregateLogsApi)

const typeMetas: LogTypeMeta[] = [
    {
        type: 'cdn',
        label: 'CDN',
        max_window_days: 7,
        fields: [
            { key: 'timestamp', label: '时间', fixed: true },
            { key: 'host', label: '域名', fixed: true },
            { key: 'status', label: '状态码', fixed: false },
        ],
    },
]

function src(resourceId: string, enabled: boolean): LogSource {
    return {
        cloud: 'aliyun',
        account_id: 'acc-1',
        account_name: '阿里A',
        region: 'cn-hangzhou',
        log_type: 'cdn',
        resource_id: resourceId,
        name: `域名 ${resourceId}`,
        enabled,
        note: '',
    }
}

const sources: LogSource[] = [src('d1', true), src('d2', true), src('d3', false)]

const entry = {
    meta: {
        cloud: 'aliyun',
        account_id: 'acc-1',
        account_name: '阿里A',
        region: 'cn-hangzhou',
        resource_id: 'd1',
        source: 'sls/project/logstore',
    },
    timestamp: Date.now(),
    client_ip: '1.2.3.4',
    method: 'GET',
    url: '/a',
    host: 'a.com',
    status: 200,
    bytes_sent: 10,
    cache_hit: 'hit',
    latency_ms: 5,
    referer: '',
    user_agent: 'ua',
    edge_node: '',
    request_id: 'r1',
    raw: {},
}

function searchResp(overrides: Partial<LogSearchResponse> = {}): LogSearchResponse {
    return {
        log_type: 'cdn',
        total: 1,
        truncated: false,
        entries: [entry as never],
        sources: [
            { cloud: 'aliyun', account_id: 'acc-1', account_name: '阿里A', count: 1, error: '', duration_ms: 12 },
        ],
        ...overrides,
    }
}

async function mountPage(): Promise<VueWrapper> {
    const w = mount(LogsIndex, {
        global: {
            plugins: [ElementPlus],
            // el-table 的 key-render-helper 在 happy-dom 下 MutationObserver 崩溃(#destroyed),
            // 本页状态断言不涉及表格行渲染,直接 stub 掉
            stubs: { LogStats: true, LogDetailDrawer: true, ElTooltip: true, ElTable: true },
        },
    })
    await flushPromises()
    return w
}

const findSearchBtn = (w: VueWrapper) => w.findAll('button').find((b) => b.text().includes('查询'))

beforeEach(() => {
    vi.clearAllMocks()
    // URL 纯净:页面 URL 状态同步(share-hydrate)会把前序用例的 query 写进
    // history,污染后续挂载(误判分享链接 → 自动查询/时间窗被覆盖)
    window.history.replaceState(null, '', window.location.pathname)
    typesApi.mockResolvedValue(typeMetas)
    sourcesApi.mockResolvedValue(sources)
    aggregateApi.mockResolvedValue({ log_type: 'cdn', total: 0, buckets: [], topn: [], sources: [] })
})

describe('LogsIndex(查询进行中状态 + 失败可重试)', () => {
    it('查询进行中显示文字进度态与 aria-label,完成后消失', async () => {
        let resolve!: (v: LogSearchResponse) => void
        searchApi.mockImplementationOnce(
            () =>
                new Promise<LogSearchResponse>((r) => {
                    resolve = r
                }),
        )
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        const progress = w.find('.search-progress')
        expect(progress.exists()).toBe(true)
        expect(progress.text()).toContain('正在查询')
        // 默认阿里云收敛后 2 个已投递源(禁投递的 d3 不计入)
        expect(progress.text()).toContain('2 个云账号')
        expect(progress.text()).toContain('已耗时')
        expect(progress.attributes('aria-label')).toContain('查询进行中')

        resolve(searchResp())
        await flushPromises()
        expect(w.find('.search-progress').exists()).toBe(false)
        w.unmount()
    })

    it('整页失败显示可读原因与重试按钮,重试复用 doSearch', async () => {
        searchApi.mockRejectedValueOnce(new Error('timeout of 20000ms exceeded'))
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        const errState = w.find('.error-state')
        expect(errState.exists()).toBe(true)
        expect(w.find('.state-desc').text()).toContain('超时')
        // 不再是裸错误串:映射后的可读文案不含原始英文报错
        expect(w.find('.state-desc').text()).not.toContain('timeout of 20000ms exceeded')

        const retry = w.findAll('button').find((b) => b.text().includes('重试'))
        expect(retry).toBeTruthy()
        searchApi.mockResolvedValueOnce(searchResp())
        await retry!.trigger('click')
        await flushPromises()

        expect(searchApi).toHaveBeenCalledTimes(2)
        expect(w.find('.error-state').exists()).toBe(false)
        w.unmount()
    })

    it('部分源失败保持 per-source 标签,整页不进入失败态', async () => {
        searchApi.mockResolvedValueOnce(
            searchResp({
                sources: [
                    { cloud: 'aliyun', account_id: 'acc-1', account_name: '阿里A', count: 1, error: '', duration_ms: 12 },
                    { cloud: 'aws', account_id: 'acc-2', account_name: 'AWS B', count: 0, error: 'rate exceeded', duration_ms: 3 },
                ],
            }),
        )
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        expect(w.find('.error-state').exists()).toBe(false)
        expect(w.find('.sources-strip').exists()).toBe(true)
        expect(w.find('.sources-strip').text()).toContain('失败')
        expect(w.find('.sources-strip').text()).toContain('AWS B')
        expect(w.find('.detail-toggle').exists()).toBe(true)
        w.unmount()
    })

    it('翻页加载更早期间显示文字进度', async () => {
        searchApi.mockResolvedValueOnce(searchResp())
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        const toggle = w.find('.detail-toggle')
        await toggle.trigger('click')
        let resolvePage!: (v: LogSearchResponse) => void
        searchApi.mockImplementationOnce(
            () =>
                new Promise<LogSearchResponse>((r) => {
                    resolvePage = r
                }),
        )
        const earlier = w.findAll('button').find((b) => b.text().includes('加载更早'))
        expect(earlier).toBeTruthy()
        await earlier!.trigger('click')
        await flushPromises()

        const pagerProgress = w.find('.pager-progress')
        expect(pagerProgress.exists()).toBe(true)
        expect(pagerProgress.isVisible()).toBe(true)
        expect(pagerProgress.text()).toContain('已耗时')

        resolvePage(searchResp({ entries: [entry as never] }))
        await flushPromises()
        expect(w.find('.pager-progress').exists()).toBe(false)
        w.unmount()
    })

    it('查询成功路径无回归:统计视图 + 明细渲染', async () => {
        searchApi.mockResolvedValueOnce(searchResp())
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        expect(w.find('.error-state').exists()).toBe(false)
        expect(w.find('.search-progress').exists()).toBe(false)
        expect(w.find('.detail-toggle').text()).toContain('明细数据(1 条)')
        w.unmount()
    })
})

describe('LogsIndex(明细按云·账号折叠分组,组头含条数/耗时)', () => {
    // 时间用相对值:翻页 canLoadEarlier 要求最旧一条晚于窗口起点(默认 6h)
    const NOW = Date.now()
    const aliEntry = { ...entry, timestamp: NOW - 1000 } as never
    const awsEntry = {
        ...entry,
        meta: { ...entry.meta, cloud: 'aws', account_id: 'acc-2', account_name: 'AWS B' },
        timestamp: NOW - 2000,
    } as never

    const okAli = { cloud: 'aliyun', account_id: 'acc-1', account_name: '阿里A', count: 1, error: '', duration_ms: 12 }
    const okAws = { cloud: 'aws', account_id: 'acc-2', account_name: 'AWS B', count: 1, error: '', duration_ms: 7 }

    function groupedResp(): LogSearchResponse {
        return searchResp({
            entries: [aliEntry, awsEntry],
            sources: [okAli, okAws],
        })
    }

    /** 查询成功并展开明细区(分组 UI 在明细体内) */
    async function mountWithGroups(): Promise<VueWrapper> {
        searchApi.mockResolvedValueOnce(groupedResp())
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()
        await w.find('.detail-toggle').trigger('click')
        return w
    }

    it('明细按 云·账号 分组,组头含账号展示名/条数/耗时,组序按云固定序', async () => {
        const w = await mountWithGroups()
        const headers = w.findAll('.group-header')
        expect(headers.length).toBe(2)
        expect(headers[0]!.text()).toContain('阿里云·阿里A')
        expect(headers[0]!.text()).toContain('1 条')
        expect(headers[0]!.text()).toContain('12ms')
        expect(headers[1]!.text()).toContain('AWS·AWS B')
        // 云固定排序(cloudOrder):阿里云组在 AWS 组前
        expect(headers.findIndex((h) => h.text().includes('阿里云'))).toBeLessThan(
            headers.findIndex((h) => h.text().includes('AWS')),
        )
        w.unmount()
    })

    it('组头点击可折叠/展开;全部折叠/全部展开按钮生效(默认全展开)', async () => {
        const w = await mountWithGroups()
        // 默认全展开:每组都有表
        expect(w.findAll('el-table-stub').length).toBe(2)
        expect(w.findAll('.group-header')[0]!.attributes('aria-expanded')).toBe('true')

        // 单组折叠:该组表消失,另一组不受影响
        await w.findAll('.group-header')[0]!.trigger('click')
        expect(w.findAll('.group-header')[0]!.attributes('aria-expanded')).toBe('false')
        expect(w.findAll('el-table-stub').length).toBe(1)

        // 全部折叠
        const collapseAll = () => w.findAll('button').find((b) => b.text().includes('全部折叠'))
        await collapseAll()!.trigger('click')
        expect(w.findAll('el-table-stub').length).toBe(0)
        expect(w.findAll('.group-header').every((h) => h.attributes('aria-expanded') === 'false')).toBe(true)

        // 全部展开
        const expandAll = () => w.findAll('button').find((b) => b.text().includes('全部展开'))
        expect(expandAll()).toBeTruthy()
        await expandAll()!.trigger('click')
        expect(w.findAll('el-table-stub').length).toBe(2)
        w.unmount()
    })

    it('单源失败不整组报错:失败源在组头标注,错误可查;成功组不受影响', async () => {
        searchApi.mockResolvedValueOnce(
            searchResp({
                entries: [aliEntry, awsEntry],
                sources: [
                    okAli,
                    { cloud: 'aws', account_id: 'acc-2', account_name: 'AWS B', count: 0, error: 'rate exceeded', duration_ms: 3 },
                ],
            }),
        )
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()
        await w.find('.detail-toggle').trigger('click')

        expect(w.find('.error-state').exists()).toBe(false)
        const headers = w.findAll('.group-header')
        const awsHeader = headers.find((h) => h.text().includes('AWS B'))!
        expect(awsHeader).toBeTruthy()
        expect(awsHeader.text()).toContain('失败')
        // 错误原因可通过组头 title(hover)查看
        expect(awsHeader.attributes('title')).toContain('rate exceeded')
        const aliHeader = headers.find((h) => h.text().includes('阿里A'))!
        expect(aliHeader.text()).not.toContain('失败')
        w.unmount()
    })

    it('翻页追加后组内条数自动更新(allEntries 累积 → 分组派生),翻页条不受影响', async () => {
        const w = await mountWithGroups()
        expect(w.findAll('.group-header')[0]!.text()).toContain('1 条')

        searchApi.mockResolvedValueOnce(searchResp({ entries: [aliEntry] }))
        const earlier = w.findAll('button').find((b) => b.text().includes('加载更早'))!
        await earlier.trigger('click')
        await flushPromises()

        // 同账号再 +1 条 → 组头条数自动 2;翻页条照常显示
        expect(w.findAll('.group-header')[0]!.text()).toContain('2 条')
        expect(w.find('.pager-info').text()).toContain('已加载 3 条')
        w.unmount()
    })

    it('明细区外层滚动:组表不再自带 max-height(占位交给 detail-body,表头吸顶由 CSS sticky 承担)', async () => {
        // 用透传 attrs 的 ElTable 桩捕获 max-height:若有人把每表 max-height 加回来,
        // 外层滚动 + sticky 吸顶设计(改 max-height 为占位+外层滚动)即被破坏
        searchApi.mockResolvedValueOnce(groupedResp())
        const w = mount(LogsIndex, {
            global: {
                plugins: [ElementPlus],
                stubs: {
                    LogStats: true,
                    LogDetailDrawer: true,
                    ElTooltip: true,
                    ElTable: { name: 'ElTable', template: '<div class="etable-stub" v-bind="$attrs" />' },
                },
            },
        })
        await flushPromises()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()
        await w.find('.detail-toggle').trigger('click')

        const tables = w.findAll('.etable-stub')
        expect(tables.length).toBe(2)
        expect(tables.every((t) => t.attributes('max-height') === undefined)).toBe(true)
        // 表格位于明细滚动容器内(吸顶的滚动上下文)
        expect(w.find('.detail-body .etable-stub').exists()).toBe(true)
        w.unmount()
    })
})

describe('LogsIndex(TopN 下钻:图点击 → 字段筛选重查,可清除)', () => {
    /** LogStats 桩:一个点击即发出 bar-click 的按钮(默认维度 cdn 域名 Top → host) */
    const LogStatsDrillStub = {
        name: 'LogStats',
        template: `<button class="stats-drill" @click="$emit('bar-click', { name: 'a.com' })" />`,
    }

    async function mountWithDrill(): Promise<VueWrapper> {
        searchApi.mockResolvedValue(searchResp())
        const w = mount(LogsIndex, {
            global: {
                plugins: [ElementPlus],
                stubs: { LogStats: LogStatsDrillStub, LogDetailDrawer: true, ElTooltip: true, ElTable: true },
            },
        })
        await flushPromises()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()
        return w
    }

    const clearDrillBtn = (w: VueWrapper) => w.findAll('button').find((b) => b.text().includes('清除下钻'))

    it('点击 TopN 图项 → 新增字段筛选行(host eq)并自动重查,明细/统计同步带上新筛选', async () => {
        const w = await mountWithDrill()
        expect(w.findAll('.field-filter-row').length).toBe(0)

        await w.find('.stats-drill').trigger('click')
        await flushPromises()

        expect(searchApi).toHaveBeenCalledTimes(2)
        expect(aggregateApi).toHaveBeenCalledTimes(2)
        expect(searchApi.mock.calls.at(-1)![0].filters).toEqual([{ field: 'host', op: 'eq', value: 'a.com' }])
        expect(w.findAll('.field-filter-row').length).toBe(1)
        w.unmount()
    })

    it('已存在同字段 eq 条件 → 更新值不重复加行(仍只有一行)', async () => {
        const w = await mountWithDrill()
        await w.find('.stats-drill').trigger('click')
        await flushPromises()
        await w.find('.stats-drill').trigger('click')
        await flushPromises()

        expect(searchApi).toHaveBeenCalledTimes(3)
        expect(w.findAll('.field-filter-row').length).toBe(1)
        w.unmount()
    })

    it('「清除下钻」仅移除下钻行,用户手动条件保留并重查还原', async () => {
        const w = await mountWithDrill()
        await w.find('.stats-drill').trigger('click')
        await flushPromises()
        expect(clearDrillBtn(w)).toBeTruthy()

        // 用户手动加一行并填值(与下钻行不同字段)
        const addBtn = w.findAll('button').find((b) => b.text().includes('添加字段筛选'))
        await addBtn!.trigger('click')
        await (w.findAll('.ff-value input')[1]!).setValue('custom')

        await clearDrillBtn(w)!.trigger('click')
        await flushPromises()

        expect(w.findAll('.field-filter-row').length).toBe(1)
        expect(searchApi.mock.calls.at(-1)![0].filters).toEqual([{ field: 'host', op: 'eq', value: 'custom' }])
        expect(clearDrillBtn(w)).toBeUndefined()
        w.unmount()
    })
})

describe('LogsIndex(字段筛选快捷值:样本回填 chips,零额外请求)', () => {
    const addFilterBtn = (w: VueWrapper) => w.findAll('button').find((b) => b.text().includes('添加字段筛选'))
    const valueInput = (w: VueWrapper) => w.find('.ff-value input').element as HTMLInputElement

    it('未加载数据时不显示快捷值区(整洁降级)', async () => {
        const w = await mountPage()
        await addFilterBtn(w)!.trigger('click')
        expect(w.find('.quick-values').exists()).toBe(false)
        w.unmount()
    })

    it('查询后展示所选字段快捷值 chips;点击填入 value 并重查;再次点击取消(toggle)', async () => {
        // 每次重查返回同样本,保证 chip 在 toggle 期间不因样本变化消失
        searchApi.mockResolvedValue(searchResp())
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        await addFilterBtn(w)!.trigger('click')
        const chips = w.findAll('.qv-chip')
        expect(chips.length).toBe(1)
        expect(chips[0]!.text()).toBe('a.com')

        // 点击 chip → 填入该行 value 并直接重查(复用 doSearch,零额外接口)
        await chips[0]!.trigger('click')
        await flushPromises()
        expect(searchApi).toHaveBeenCalledTimes(2)
        expect(valueInput(w).value).toBe('a.com')

        // 再次点击 → toggle 取消(清空 value,该行退出筛选组合)并重查
        await w.find('.qv-chip').trigger('click')
        await flushPromises()
        expect(searchApi).toHaveBeenCalledTimes(3)
        expect(valueInput(w).value).toBe('')
        w.unmount()
    })

    it('样本变化后快捷值自动重算,不残留旧值;用户已填 value 不被覆盖', async () => {
        searchApi.mockResolvedValueOnce(searchResp())
        const w = await mountPage()
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()

        await addFilterBtn(w)!.trigger('click')
        expect(w.findAll('.qv-chip').map((c) => c.text())).toEqual(['a.com'])

        // 下一次查询样本 host 全为 b.com:chips 重算,不残留 a.com
        searchApi.mockResolvedValueOnce(
            searchResp({ entries: [{ ...entry, host: 'b.com' } as never] }),
        )
        await findSearchBtn(w)!.trigger('click')
        await flushPromises()
        expect(searchApi).toHaveBeenCalledTimes(2)
        expect(w.findAll('.qv-chip').map((c) => c.text())).toEqual(['b.com'])
        w.unmount()
    })
})

describe('LogsIndex(WAF Tab 流量诊断入口,任务 3)', () => {
    const diagnoseApi = vi.mocked(diagnoseLogsApi)

    const wafMeta: LogTypeMeta = {
        type: 'waf',
        label: 'WAF',
        max_window_days: 7,
        fields: [
            { key: 'timestamp', label: '时间', fixed: true },
            { key: 'client_ip', label: '客户端 IP', fixed: false },
        ],
    }

    /** 挂载 CDN+WAF 双类型页面(诊断入口仅 WAF Tab 展示) */
    async function mountDualType(): Promise<VueWrapper> {
        typesApi.mockResolvedValue([...typeMetas, wafMeta])
        return mountPage()
    }

    const tabItem = (w: VueWrapper, label: string) =>
        w.findAll('.el-tabs__item').find((t) => t.text().includes(label))

    it('仅 WAF Tab 展示「流量诊断」折叠卡,切 Tab 随类型显隐', async () => {
        const w = await mountDualType()
        // 默认 CDN Tab:无诊断卡
        expect(w.find('.diagnose-card').exists()).toBe(false)
        // 切到 WAF:诊断卡出现(折叠态)
        await tabItem(w, 'WAF')!.trigger('click')
        await flushPromises()
        const card = w.find('.diagnose-card')
        expect(card.exists()).toBe(true)
        expect(card.find('.diagnose-toggle').attributes('aria-expanded')).toBe('false')
        // 切回 CDN:入口消失
        await tabItem(w, 'CDN')!.trigger('click')
        await flushPromises()
        expect(w.find('.diagnose-card').exists()).toBe(false)
        w.unmount()
    })

    it('诊断独立于既有查询:页内触发诊断不触碰 search/aggregate,统计/明细行为不变', async () => {
        diagnoseApi.mockResolvedValue({
            log_type: 'waf',
            window_sec: 3600,
            total: 0,
            buckets: [],
            top_ips: [],
            top_uas: [],
            status_codes: [],
            actions: [],
            result: {
                risk_score: 0,
                risk_level: 'none',
                attack_type: 'normal',
                measures: ['m1', 'm2', 'm3'],
                top_sources: [],
                degraded: false,
                surge_multiplier: 0,
            },
            sources: [],
            aggregate_frames: 2,
            summary: '',
            cached: false,
            cache_stale: false,
        })
        const w = await mountDualType()
        await tabItem(w, 'WAF')!.trigger('click')
        await flushPromises()

        // 未查询过:整页仍是无结果态,诊断卡已可用
        expect(w.find('.diagnose-card').exists()).toBe(true)
        await w.find('.diagnose-actions button').trigger('click')
        await flushPromises()

        expect(diagnoseApi).toHaveBeenCalledTimes(1)
        expect(diagnoseApi.mock.calls[0]![0].log_type).toBe('waf')
        expect(diagnoseApi.mock.calls[0]![0].start_time).toBeTypeOf('number')
        // 纯新增区块:既有明细/聚合查询零调用
        expect(searchApi).not.toHaveBeenCalled()
        expect(aggregateApi).not.toHaveBeenCalled()
        expect(w.find('.error-state').exists()).toBe(false)
        w.unmount()
    })
})
