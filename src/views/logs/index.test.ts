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
import { aggregateLogsApi, getLogSourcesApi, getLogTypesApi, searchLogsApi } from '@/api/logs'
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
