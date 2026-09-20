// @vitest-environment happy-dom
/**
 * WAF 流量诊断卡组件回归(任务 3:触发/展示/降级):
 * - 手动触发调用 /logs/diagnose(请求体 = 当前查询上下文 + log_type:waf);
 * - 结果展示:风险等级徽标/风险分/疑似攻击类型/Top 攻击源(请求数+占比)/
 *   趋势对比(突增倍数)/来源分布(按云账号)/措施清单(可复制);
 * - 降级不白屏:前窗缺失(prev 缺省或 total=0)、prev_error、degraded、
 *   dimension_notes 均有对应提示;
 * - 加载态/失败态可重试;空闲态不发请求。
 */
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElTag } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { diagnoseLogsApi } from '@/api/logs'
import type { LogDiagnoseContext, LogDiagnoseResponse } from '@/api/types/logs'
import LogDiagnoseCard from './LogDiagnoseCard.vue'

vi.mock('@/api/logs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/logs')>()
    return {
        ...actual,
        diagnoseLogsApi: vi.fn(),
    }
})

const diagnoseApi = vi.mocked(diagnoseLogsApi)

const context: LogDiagnoseContext = {
    start_time: 1758000000000,
    end_time: 1758003600000,
    query: 'status:404',
    clouds: ['aliyun'],
    resources: ['d1'],
    filters: [{ field: 'host', op: 'eq', value: 'a.com' }],
}

function diagResp(overrides: Partial<LogDiagnoseResponse> = {}): LogDiagnoseResponse {
    return {
        log_type: 'waf',
        window_sec: 3600,
        total: 8000,
        buckets: [],
        top_ips: [],
        top_uas: [],
        status_codes: [],
        actions: [],
        prev: { total: 1000, top_ip_count: 100 },
        result: {
            risk_score: 78,
            risk_level: 'high',
            attack_type: 'cc_flood',
            measures: [
                '判定疑似 CC 刷量(风险分 78/100,高风险),建议按以下措施处置',
                '封禁 Top 攻击源 IP:1.2.3.4(5000 次)、5.6.7.8(1000 次),加入 WAF 黑名单',
                '开启 CC 防护/频次限流:建议单 IP 限频 ≤60000 次/分钟(当前最高单 IP 500.0 次/秒)',
                '关注最高请求源 IP 1.2.3.4(窗口内 5000 次,占比 62.5%),如持续增长建议配置限频',
            ],
            top_sources: [
                { ip: '1.2.3.4', count: 5000, share: 0.625 },
                { ip: '5.6.7.8', count: 1000, share: 0.125 },
            ],
            degraded: false,
            surge_multiplier: 8,
        },
        sources: [
            { cloud: 'aliyun', account_id: 'a1', account_name: '阿里A', total: 8000, error: '', duration_ms: 100 },
        ],
        aggregate_frames: 2,
        summary: '',
        cached: false,
        cache_stale: false,
        ...overrides,
    }
}

async function mountCard(ctx: LogDiagnoseContext | null = context): Promise<VueWrapper> {
    const w = mount(LogDiagnoseCard, {
        props: { context: ctx },
        // 全局插件在本环境不解析 el-tag(渲染为未知原生元素,徽标 class 丢失),
        // 显式注册真实 ElTag 保证徽标色断言有效;其余 el-* 走全局插件
        global: { plugins: [ElementPlus], components: { ElTag } },
    })
    await flushPromises()
    return w
}

/** 触发按钮:定位在触发行内(折叠头「流量诊断」同样含"诊断"字样,不能泛匹配) */
const triggerBtn = (w: VueWrapper) => w.find('.diagnose-actions button')

beforeEach(() => {
    vi.clearAllMocks()
    diagnoseApi.mockResolvedValue(diagResp())
})

describe('LogDiagnoseCard(触发与请求)', () => {
    it('空闲态:折叠卡展示入口与提示,不发起任何请求', async () => {
        const w = await mountCard()
        expect(w.find('.diagnose-toggle').exists()).toBe(true)
        expect(w.find('.diagnose-toggle').attributes('aria-expanded')).toBe('false')
        expect(triggerBtn(w)).toBeTruthy()
        expect(diagnoseApi).not.toHaveBeenCalled()
        w.unmount()
    })

    it('点击触发:请求体 = 当前查询上下文 + log_type:waf(无 dimension/metric),完成后渲染结果', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click') // 展开面板
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        expect(diagnoseApi).toHaveBeenCalledTimes(1)
        expect(diagnoseApi.mock.calls[0]![0]).toEqual({ log_type: 'waf', ...context })
        expect(w.find('.diagnose-progress').exists()).toBe(false)
        expect(w.find('.diagnose-result').exists()).toBe(true)
        w.unmount()
    })

    it('加载中:按钮 loading + 文字进度态(含已耗时),不白屏', async () => {
        let resolve!: (v: LogDiagnoseResponse) => void
        diagnoseApi.mockImplementationOnce(
            () =>
                new Promise<LogDiagnoseResponse>((r) => {
                    resolve = r
                }),
        )
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')

        expect(w.find('.diagnose-progress').exists()).toBe(true)
        expect(w.find('.diagnose-progress').text()).toContain('正在诊断')
        expect(w.find('.diagnose-progress').text()).toContain('已耗时')

        resolve(diagResp())
        await flushPromises()
        expect(w.find('.diagnose-progress').exists()).toBe(false)
        w.unmount()
    })

    it('诊断失败:错误态 + 重试按钮,重试成功后渲染结果', async () => {
        diagnoseApi.mockRejectedValueOnce(new Error('diagnose only supports waf log type'))
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const errBox = w.find('.diagnose-error')
        expect(errBox.exists()).toBe(true)
        expect(errBox.text()).toContain('诊断失败')
        expect(errBox.text()).toContain('diagnose only supports waf log type')

        const retry = w.findAll('button').find((b) => b.text().includes('重试'))
        expect(retry).toBeTruthy()
        await retry!.trigger('click')
        await flushPromises()
        expect(diagnoseApi).toHaveBeenCalledTimes(2)
        expect(w.find('.diagnose-result').exists()).toBe(true)
        w.unmount()
    })

    it('时间窗未就绪(context 为 null):触发按钮禁用', async () => {
        const w = await mountCard(null)
        const btn = triggerBtn(w)!
        expect(btn.attributes('disabled')).toBeDefined()
        w.unmount()
    })
})

describe('LogDiagnoseCard(结果展示)', () => {
    it('风险等级徽标/风险分/疑似攻击类型/窗口概览', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const summary = w.find('.diagnose-summary')
        expect(summary.text()).toContain('高风险')
        expect(summary.text()).toContain('风险分 78/100')
        expect(summary.text()).toContain('CC 刷量')
        // 徽标色:测试环境 transition 存根把透传 class 落在壳上,真实 el-tag 在内层
        expect(w.find('.risk-tag .el-tag').classes()).toContain('el-tag--danger')
        // 窗口概览:大数千分位
        expect(w.find('.diagnose-summary').text()).toContain('8,000')
        w.unmount()
    })

    it('Top 攻击源:请求数 + 占比逐行展示', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const rows = w.findAll('.source-row')
        expect(rows.length).toBe(2)
        expect(rows[0]!.text()).toContain('1.2.3.4')
        expect(rows[0]!.text()).toContain('5,000 次')
        expect(rows[0]!.text()).toContain('62.5%')
        expect(rows[1]!.text()).toContain('5.6.7.8')
        w.unmount()
    })

    it('趋势对比:当前窗/前窗请求数与突增倍数', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const trend = w.find('.diagnose-trend')
        expect(trend.text()).toContain('8,000 次')
        expect(trend.text()).toContain('1,000 次')
        expect(trend.text()).toContain('8.0 倍')
        w.unmount()
    })

    it('来源分布:按云账号逐源展示,失败源标注', async () => {
        diagnoseApi.mockResolvedValue(
            diagResp({
                sources: [
                    { cloud: 'aliyun', account_id: 'a1', account_name: '阿里A', total: 8000, error: '', duration_ms: 100 },
                    { cloud: 'aws', account_id: 'a2', account_name: 'AWS B', total: 0, error: 'not supported', duration_ms: 3 },
                ],
            }),
        )
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const geo = w.find('.diagnose-geo')
        expect(geo.exists()).toBe(true)
        expect(geo.text()).toContain('阿里云·阿里A')
        expect(geo.text()).toContain('8,000 次')
        expect(geo.text()).toContain('AWS·AWS B')
        expect(geo.text()).toContain('失败')
        w.unmount()
    })

    it('措施清单 ≥3 条可复制:复制按钮写入剪贴板(换行拼接)', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined)
        // happy-dom 的 navigator.clipboard 仅有 getter,须以 defineProperty 覆盖
        Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true })
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const items = w.findAll('.diagnose-measures li')
        expect(items.length).toBeGreaterThanOrEqual(3)
        const copy = w.find('.measures-copy')
        expect(copy.exists()).toBe(true)
        await copy.trigger('click')
        await flushPromises()
        expect(writeText).toHaveBeenCalledWith(diagResp().result.measures.join('\n'))
        w.unmount()
    })

    it('后端 summary 占位为空串时不渲染 AI 解读区(不引入模型调用)', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()
        expect(w.find('.diagnose-summary-text').exists()).toBe(false)
        w.unmount()
    })
})

describe('LogDiagnoseCard(降级不白屏)', () => {
    it('前窗不可用:prev 缺省 + prev_error → 前窗无数据提示,突增为占位,结果照常渲染', async () => {
        diagnoseApi.mockResolvedValue(
            diagResp({
                prev: undefined,
                prev_error: 'prev aggregate failed: rate exceeded',
                result: {
                    risk_score: 40,
                    risk_level: 'medium',
                    attack_type: 'normal',
                    measures: ['m1', 'm2', 'm3'],
                    top_sources: [],
                    degraded: true,
                    degraded_reason: '前窗无数据,突增判据缺失,已降级为当前窗绝对量判定',
                    surge_multiplier: 0,
                },
            }),
        )
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        // 不白屏:结果区完整渲染
        expect(w.find('.diagnose-result').exists()).toBe(true)
        const trend = w.find('.diagnose-trend')
        expect(trend.text()).toContain('前窗')
        expect(trend.text()).toContain('无数据')
        expect(trend.text()).toContain('prev aggregate failed: rate exceeded')
        expect(trend.text()).toContain('—')
        // 降级标注
        expect(w.find('.diagnose-alert-degraded').exists()).toBe(true)
        expect(w.find('.diagnose-alert-degraded').text()).toContain('前窗无数据,突增判据缺失')
        w.unmount()
    })

    it('前窗确实无数据(prev.total=0)不误报为不可用,仅突增占位', async () => {
        diagnoseApi.mockResolvedValue(
            diagResp({
                prev: { total: 0, top_ip_count: 0 },
                result: {
                    risk_score: 10,
                    risk_level: 'none',
                    attack_type: 'normal',
                    measures: ['m1', 'm2', 'm3'],
                    top_sources: [],
                    degraded: true,
                    degraded_reason: '前窗无数据,突增判据缺失,已降级为当前窗绝对量判定',
                    surge_multiplier: 0,
                },
            }),
        )
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        expect(w.find('.diagnose-result').exists()).toBe(true)
        const trend = w.find('.diagnose-trend')
        expect(trend.text()).toContain('0 次')
        expect(trend.text()).not.toContain('不可用')
        expect(trend.text()).toContain('—')
        expect(w.find('.trend-note').exists()).toBe(false)
        w.unmount()
    })

    it('dimension_notes 非主维度缺失说明有对应提示', async () => {
        diagnoseApi.mockResolvedValue(diagResp({ dimension_notes: 'user_agent TopN 部分源缺失:some store' }))
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        expect(w.find('.diagnose-alert-notes').exists()).toBe(true)
        expect(w.find('.diagnose-alert-notes').text()).toContain('user_agent TopN 部分源缺失')
        w.unmount()
    })

    it('缓存命中标注(cached)', async () => {
        diagnoseApi.mockResolvedValue(diagResp({ cached: true }))
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()
        expect(w.find('.cached-tag').exists()).toBe(true)
        w.unmount()
    })
})

describe('LogDiagnoseCard(下钻:判定→定位闭环)', () => {
    /** 带全部分布的响应:IP/URI/状态码/动作均可下钻 */
    const fullResp: LogDiagnoseResponse = diagResp({
        total: 5000,
        top_uris: [{ name: '/login', count: 600 }],
        status_codes: [{ name: '404', count: 200 }],
        actions: [{ name: 'block', count: 300 }],
    })

    it('点击 Top 攻击源 IP → emit drilldown(client_ip, ip)', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const ipRow = w.findAll('.source-row')[0]!
        expect(ipRow.classes()).toContain('drillable')
        await ipRow.trigger('click')
        expect(w.emitted('drilldown')).toEqual([[{ field: 'client_ip', value: '1.2.3.4' }]])
        w.unmount()
    })

    it('点击 URI 行 → emit drilldown(uri, path)', async () => {
        diagnoseApi.mockResolvedValue(fullResp)
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        const uriRow = w.findAll('.diagnose-uris .source-row')[0]!
        await uriRow.trigger('click')
        expect(w.emitted('drilldown')).toEqual([[{ field: 'uri', value: '/login' }]])
        w.unmount()
    })

    it('点击状态码/动作标签 → emit drilldown(status | action, 值)', async () => {
        diagnoseApi.mockResolvedValue(fullResp)
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()

        await w.findAll('.diagnose-buckets .bucket-tag')[0]!.trigger('click')
        await w.findAll('.diagnose-buckets .bucket-tag')[1]!.trigger('click')
        expect(w.emitted('drilldown')).toEqual([
            [{ field: 'status', value: '404' }],
            [{ field: 'action', value: 'block' }],
        ])
        w.unmount()
    })

    it('空态:无 URI/状态码/动作数据时不渲染下钻对象(不崩)', async () => {
        const w = await mountCard()
        await w.find('.diagnose-toggle').trigger('click')
        await triggerBtn(w)!.trigger('click')
        await flushPromises()
        expect(w.find('.diagnose-uris .section-empty').exists()).toBe(true)
        expect(w.findAll('.diagnose-buckets .bucket-tag').length).toBe(0)
        expect(w.emitted('drilldown')).toBeUndefined()
        w.unmount()
    })
})
