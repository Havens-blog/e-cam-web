// @vitest-environment happy-dom
/**
 * CDN 缓存分析卡组件回归(AC 对应):
 * - 手动触发调用 /logs/cache-analyze(请求体 = 当前查询上下文 + log_type:cdn);
 * - 展示:健康档位徽标/双命中率总览(全请求/可缓存两档)/域名排行 Top(双口径
 *   + 已覆盖源标注)/未命中 URI TOP(归属域名,空 → 归属未知)/状态码分布
 *   (4xx/5xx 占比,口径名"状态码分布")/结构化优化项(可复制,低可信默认折叠);
 * - 前窗对比:↑↓ + "对比基期:前一 N 分钟" + "基于 X/Y 源"(含缺失源);降级不白屏;
 * - 预估拦截(窗口 >6h)→ 错误态出现"确认并继续分析",确认后带 confirm:true 重发;
 * - AI 解读区仅 summary 非空渲染;加载态/失败态可重试;空闲态不发请求。
 */
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElTag } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheAnalyzeApi } from '@/api/logs'
import type { LogCacheAnalyzeContext, LogCacheAnalyzeResponse } from '@/api/types/logs'
import CacheAnalyzeCard from './CacheAnalyzeCard.vue'

vi.mock('@/api/logs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/logs')>()
    return {
        ...actual,
        cacheAnalyzeApi: vi.fn(),
    }
})

const cacheApi = vi.mocked(cacheAnalyzeApi)

const context: LogCacheAnalyzeContext = {
    start_time: 1758000000000,
    end_time: 1758003600000,
    query: '',
    clouds: ['aliyun'],
    resources: ['d1'],
    filters: [{ field: 'host', op: 'eq', value: 'a.com' }],
}

function cacheResp(overrides: Partial<LogCacheAnalyzeResponse> = {}): LogCacheAnalyzeResponse {
    return {
        log_type: 'cdn',
        window_sec: 3600,
        total: 100000,
        total_bytes: 5 * 1024 * 1024 * 1024,
        result: {
            grade: 'poor',
            request_hit_rate: {
                all: { rate: 0.723, numerator: 72300, denominator: 100000, available: true },
                cacheable: { rate: 0.65, numerator: 60000, denominator: 92300, available: true },
            },
            byte_hit_rate: {
                all: { rate: 0.81, numerator: 4.2 * 1024 ** 3, denominator: 5.2 * 1024 ** 3, available: true },
                cacheable: { rate: 0.75, numerator: 3.6 * 1024 ** 3, denominator: 4.8 * 1024 ** 3, available: true },
            },
            domain_ranking: [
                { host: 'a.com', requests: 50000, hit_rate: 0.8, cacheable_hit_rate: 0.75, miss_traffic_ratio: 0.4, byte_hit_rate: 0.85, byte_hit_available: true, grade: 'fair' },
                { host: 'b.com', requests: 30000, hit_rate: 0.5, cacheable_hit_rate: 0.45, miss_traffic_ratio: 0.5, byte_hit_rate: 0.42, byte_hit_available: true, grade: 'poor' },
            ],
            miss_uri_top: [
                { uri: '/api/list', host: 'a.com', miss_count: 12000, miss_share: 0.35, variants: 3, sample_query: 'page=1&size=20' },
                { uri: '/static/img/x.png', host: '', miss_count: 8000, miss_share: 0.2, variants: 1 },
            ],
            status: { total: 100000, client_error_count: 4000, server_error_count: 2000, client_error_ratio: 0.04, server_error_ratio: 0.02 },
            gap: { byte_gap_ratio: 0.087, large_file_gap: true, small_file_reverse: false },
            recommendations: [
                { domain: 'a.com', uri_prefix: '/api/', action: 'add_cache_rule', miss_traffic_ratio: 0.35, confidence: 'high', low_confidence: false, evidence: 'URI /api/list 未命中 12,000 次,占全局未命中 35.0%' },
                { action: 'ignore_query_string', miss_traffic_ratio: 0.2, confidence: 'low', low_confidence: true, evidence: '查询串变体归并 3 个' },
            ],
            prev_trend: { available: true, prev_request_hit_rate: 0.78, delta: -0.057, direction: 'down', alert: true },
            notes: ['partial 按全命中计入,字节命中率上偏', '可缓存档为聚合层近似(口径偏保守,避免高估命中)'],
        },
        prev: { total: 90000, cache_hit_dist: [] },
        prev_sources: [
            { cloud: 'aliyun', account_id: 'a1', account_name: '阿里A', total: 90000, error: '', duration_ms: 80 },
            { cloud: 'aws', account_id: 'a2', account_name: 'AWS B', total: 0, error: 'prev boom', duration_ms: 3 },
        ],
        sources: [{ cloud: 'aliyun', account_id: 'a1', account_name: '阿里A', total: 100000, error: '', duration_ms: 90 }],
        aggregate_frames: 2,
        summary: '',
        cached: false,
        cache_stale: false,
        ...overrides,
    }
}

async function mountCard(ctx: LogCacheAnalyzeContext | null = context): Promise<VueWrapper> {
    const w = mount(CacheAnalyzeCard, {
        props: { context: ctx },
        // 全局插件在本环境不解析 el-tag(渲染为未知原生元素,徽标 class 丢失),
        // 显式注册真实 ElTag 保证徽标色断言有效;其余 el-* 走全局插件
        global: { plugins: [ElementPlus], components: { ElTag } },
    })
    await flushPromises()
    return w
}

/** 触发按钮:定位在触发行内(折叠头「缓存分析」同样含"分析"字样,不能泛匹配) */
const triggerBtn = (w: VueWrapper) => w.find('.cache-actions button')

/** 展开 + 触发 + 等结果(多数展示用例的前置动作) */
async function runOnce(w: VueWrapper) {
    await w.find('.cache-toggle').trigger('click')
    await triggerBtn(w)!.trigger('click')
    await flushPromises()
}

beforeEach(() => {
    vi.clearAllMocks()
    cacheApi.mockResolvedValue(cacheResp())
})

describe('CacheAnalyzeCard(触发与请求)', () => {
    it('空闲态:折叠卡展示入口与提示,不发起任何请求', async () => {
        const w = await mountCard()
        expect(w.find('.cache-toggle').exists()).toBe(true)
        expect(w.find('.cache-toggle').attributes('aria-expanded')).toBe('false')
        expect(triggerBtn(w)).toBeTruthy()
        expect(cacheApi).not.toHaveBeenCalled()
        w.unmount()
    })

    it('点击触发:请求体 = 当前查询上下文 + log_type:cdn(无 dimension/metric),完成后渲染结果', async () => {
        const w = await mountCard()
        await runOnce(w)

        expect(cacheApi).toHaveBeenCalledTimes(1)
        expect(cacheApi.mock.calls[0]![0]).toEqual({ log_type: 'cdn', ...context })
        expect(w.find('.cache-progress').exists()).toBe(false)
        expect(w.find('.cache-result').exists()).toBe(true)
        w.unmount()
    })

    it('加载中:按钮 loading + 文字进度态(含已耗时),不白屏', async () => {
        let resolve!: (v: LogCacheAnalyzeResponse) => void
        cacheApi.mockImplementationOnce(
            () =>
                new Promise<LogCacheAnalyzeResponse>((r) => {
                    resolve = r
                }),
        )
        const w = await mountCard()
        await w.find('.cache-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')

        expect(w.find('.cache-progress').exists()).toBe(true)
        expect(w.find('.cache-progress').text()).toContain('正在分析')
        expect(w.find('.cache-progress').text()).toContain('已耗时')

        resolve(cacheResp())
        await flushPromises()
        expect(w.find('.cache-progress').exists()).toBe(false)
        w.unmount()
    })

    it('分析失败:错误态 + 重试按钮,重试成功后渲染结果', async () => {
        cacheApi.mockRejectedValueOnce(new Error('cache-analyze only supports cdn log type'))
        const w = await mountCard()
        await runOnce(w)

        const errBox = w.find('.cache-error')
        expect(errBox.exists()).toBe(true)
        expect(errBox.text()).toContain('分析失败')
        expect(errBox.text()).toContain('cache-analyze only supports cdn log type')

        const retry = errBox.findAll('button').find((b) => b.text() === '重试')
        expect(retry).toBeTruthy()
        await retry!.trigger('click')
        await flushPromises()
        expect(cacheApi).toHaveBeenCalledTimes(2)
        expect(w.find('.cache-result').exists()).toBe(true)
        w.unmount()
    })

    it('预估扫描量拦截:错误态出现"确认并继续分析",确认后带 confirm:true 重发', async () => {
        cacheApi.mockRejectedValueOnce(
            new Error('estimated scan volume is high: window 7h0m0s × 2 frames × 5 dimension groups, blocked by default; confirm with confirm=true to proceed'),
        )
        const w = await mountCard()
        await runOnce(w)

        const confirmBtn = w.findAll('button').find((b) => b.text().includes('确认并继续分析'))
        expect(confirmBtn).toBeTruthy()
        expect(w.find('.cache-error').text()).toContain('estimated scan volume is high')

        await confirmBtn!.trigger('click')
        await flushPromises()
        expect(cacheApi).toHaveBeenCalledTimes(2)
        expect(cacheApi.mock.calls[1]![0]).toEqual({ log_type: 'cdn', ...context, confirm: true })
        expect(w.find('.cache-result').exists()).toBe(true)
        w.unmount()
    })

    it('时间窗未就绪(context 为 null):触发按钮禁用', async () => {
        const w = await mountCard(null)
        const btn = triggerBtn(w)!
        expect(btn.attributes('disabled')).toBeDefined()
        w.unmount()
    })
})

describe('CacheAnalyzeCard(双命中率总览/域名排行/URI/状态码)', () => {
    it('健康档位徽标:poor → 差 + danger 色', async () => {
        const w = await mountCard()
        await runOnce(w)
        expect(w.find('.cache-summary').text()).toContain('差')
        expect(w.find('.grade-tag .el-tag').classes()).toContain('el-tag--danger')
        w.unmount()
    })

    it('双命中率总览:全请求/可缓存两档四格,含分式与 partial 上偏标注', async () => {
        const w = await mountCard()
        await runOnce(w)

        const cells = w.findAll('.rate-cell')
        expect(cells.length).toBe(4)
        expect(cells[0]!.text()).toContain('72.3%')
        expect(cells[0]!.text()).toContain('72,300 / 100,000')
        expect(cells[1]!.text()).toContain('65.0%')
        expect(cells[2]!.text()).toContain('81.0%')
        expect(cells[3]!.text()).toContain('75.0%')
        // 口径标注(partial 上偏/可缓存近似)逐条渲染
        const notes = w.findAll('.rate-notes li')
        expect(notes.length).toBe(2)
        expect(notes[0]!.text()).toContain('字节命中率上偏')
        w.unmount()
    })

    it('域名命中率排行:双口径分列 + 档位角标,标注"已覆盖源命中率"', async () => {
        const w = await mountCard()
        await runOnce(w)

        expect(w.find('.cache-domains').text()).toContain('已覆盖源命中率')
        const rows = w.findAll('.domain-row')
        expect(rows.length).toBe(2)
        expect(rows[0]!.text()).toContain('a.com')
        expect(rows[0]!.text()).toContain('50,000')
        expect(rows[0]!.text()).toContain('80.0%')
        expect(rows[0]!.text()).toContain('75.0%')
        expect(rows[0]!.text()).toContain('40.0%')
        // 点击域名行下钻 host 筛选
        await rows[0]!.trigger('click')
        expect(w.emitted('drilldown')).toEqual([[{ field: 'host', value: 'a.com' }]])
        w.unmount()
    })

    it('未命中 URI TOP:归一路径 + 归属域名 + 变体归并;Host 空 → 归属未知;点击下钻 url', async () => {
        const w = await mountCard()
        await runOnce(w)

        const rows = w.findAll('.uri-row')
        expect(rows.length).toBe(2)
        expect(rows[0]!.text()).toContain('/api/list')
        expect(rows[0]!.text()).toContain('a.com')
        expect(rows[0]!.text()).toContain('12,000')
        expect(rows[0]!.text()).toContain('35.0%')
        expect(rows[0]!.text()).toContain('3 个查询串变体已归并')
        expect(rows[1]!.text()).toContain('归属未知')

        await rows[0]!.trigger('click')
        expect(w.emitted('drilldown')).toEqual([[{ field: 'url', value: '/api/list' }]])
        w.unmount()
    })

    it('状态码分布:口径名"状态码分布",展示 4xx/5xx 计数与占比(不称命中率)', async () => {
        const w = await mountCard()
        await runOnce(w)

        const status = w.find('.cache-status')
        expect(status.find('.section-title').text()).toBe('状态码分布')
        expect(status.text()).toContain('4xx')
        expect(status.text()).toContain('4,000')
        expect(status.text()).toContain('4.0%')
        expect(status.text()).toContain('5xx')
        expect(status.text()).toContain('2,000')
        expect(status.text()).toContain('2.0%')
        expect(status.text()).not.toContain('状态码命中率')
        w.unmount()
    })
})

describe('CacheAnalyzeCard(优化项:可复制/低可信折叠/统一标注)', () => {
    it('高/中可信项直接展示,低可信默认折叠在"更多建议"下,展开后可见', async () => {
        const w = await mountCard()
        await runOnce(w)

        const visible = w.findAll('.cache-optimizations .opt-list')[0]!
        expect(visible.findAll('li').length).toBe(1)
        expect(visible.text()).toContain('a.com')
        expect(visible.text()).toContain('/api/')
        expect(visible.text()).toContain('加缓存规则')
        expect(visible.text()).toContain('35.0%')
        expect(visible.text()).toContain('高可信')
        // 统一标注在优化项区块(不随单项重复)
        expect(w.find('.cache-optimizations').text()).toContain('建议,执行前请验证')

        // 低可信默认折叠
        expect(w.findAll('.opt-more .opt-list').length).toBe(0)
        const toggle = w.find('.opt-more-toggle')
        expect(toggle.text()).toContain('更多建议')
        await toggle.trigger('click')
        const more = w.find('.opt-more .opt-list')
        expect(more.exists()).toBe(true)
        expect(more.text()).toContain('忽略查询串')
        expect(more.text()).toContain('低可信')
        w.unmount()
    })

    it('复制按钮:优化项纯文本清单写入剪贴板', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        // happy-dom 的 navigator.clipboard 仅有 getter,须以 defineProperty 覆盖
        Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
        const w = await mountCard()
        await runOnce(w)

        await w.find('.opt-copy').trigger('click')
        await flushPromises()
        const text = writeText.mock.calls[0]![0] as string
        expect(text).toContain('建议,执行前请验证')
        expect(text).toContain('加缓存规则')
        w.unmount()
    })
})

describe('CacheAnalyzeCard(前窗对比与降级不白屏)', () => {
    it('趋势可用:↑↓ 标注 + 对比基期 + 基于 X/Y 源(缺失源列出)+ 下降告警', async () => {
        const w = await mountCard()
        await runOnce(w)

        const trend = w.find('.cache-trend')
        expect(trend.text()).toContain('对比基期:前一 60 分钟')
        expect(trend.text()).toContain('基于 1/2 源')
        expect(trend.text()).toContain('↓ 下降')
        expect(trend.text()).toContain('78.0%')
        expect(trend.text()).toContain('AWS·AWS B')
        expect(w.find('.trend-alert').exists()).toBe(true)
        w.unmount()
    })

    it('前窗不可用(prev 缺省 + prev_error):提示原因,结果照常渲染不白屏', async () => {
        cacheApi.mockResolvedValue(
            cacheResp({
                prev: undefined,
                prev_error: 'prev aggregate failed: rate exceeded',
                result: {
                    ...cacheResp().result,
                    prev_trend: { available: false, prev_request_hit_rate: 0, delta: 0, direction: 'flat', alert: false },
                },
            }),
        )
        const w = await mountCard()
        await runOnce(w)

        expect(w.find('.cache-result').exists()).toBe(true)
        const trend = w.find('.cache-trend')
        expect(trend.text()).toContain('前窗')
        expect(trend.text()).toContain('无数据')
        expect(trend.text()).toContain('prev aggregate failed: rate exceeded')
        w.unmount()
    })

    it('前窗确实无数据(prev.total=0):不误报不可用', async () => {
        cacheApi.mockResolvedValue(
            cacheResp({
                prev: { total: 0 },
                result: {
                    ...cacheResp().result,
                    prev_trend: { available: false, prev_request_hit_rate: 0, delta: 0, direction: 'flat', alert: false },
                },
            }),
        )
        const w = await mountCard()
        await runOnce(w)

        expect(w.find('.cache-result').exists()).toBe(true)
        expect(w.find('.cache-trend').text()).not.toContain('不可用')
        w.unmount()
    })

    it('dimension_notes 与 per-source 状态:缺失标注 + 失败源标记', async () => {
        cacheApi.mockResolvedValue(
            cacheResp({
                dimension_notes: 'URI 未命中(url×nonhit)部分源缺失:some store',
                sources: [
                    { cloud: 'aliyun', account_id: 'a1', account_name: '阿里A', total: 100000, error: '', duration_ms: 90 },
                    { cloud: 'aws', account_id: 'a2', account_name: 'AWS B', total: 0, error: 'not supported', duration_ms: 3 },
                ],
            }),
        )
        const w = await mountCard()
        await runOnce(w)

        expect(w.find('.cache-alert-notes').text()).toContain('URI 未命中(url×nonhit)部分源缺失')
        const src = w.find('.cache-sources')
        expect(src.text()).toContain('阿里云·阿里A')
        expect(src.text()).toContain('AWS·AWS B')
        expect(src.text()).toContain('失败')
        w.unmount()
    })
})

describe('CacheAnalyzeCard(AI 解读区与缓存标注)', () => {
    it('summary 为空串:AI 解读区不渲染(前端不引入模型调用)', async () => {
        const w = await mountCard()
        await runOnce(w)
        expect(w.find('.cache-summary-text').exists()).toBe(false)
        w.unmount()
    })

    it('summary 非空:AI 解读区渲染后端生成内容', async () => {
        cacheApi.mockResolvedValue(cacheResp({ summary: '后端生成的缓存健康解读' }))
        const w = await mountCard()
        await runOnce(w)
        expect(w.find('.cache-summary-text').exists()).toBe(true)
        expect(w.find('.cache-summary-text').text()).toBe('后端生成的缓存健康解读')
        w.unmount()
    })

    it('cached 标注', async () => {
        cacheApi.mockResolvedValue(cacheResp({ cached: true }))
        const w = await mountCard()
        await runOnce(w)
        expect(w.find('.cached-tag').exists()).toBe(true)
        w.unmount()
    })
})
