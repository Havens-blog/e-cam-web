// @vitest-environment happy-dom
/**
 * 探测结果页挂载回归：初始加载 → 点刷新二次加载不崩（全屏白屏回归）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { getCertProbesApi, triggerCertProbeScanApi } from '@/api/cert'
import ProbesIndex from './index.vue'

vi.mock('@/api/cert', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/cert')>()
    return {
        ...actual,
        getCertProbesApi: vi.fn(),
        triggerCertProbeScanApi: vi.fn(),
    }
})

const probesApi = vi.mocked(getCertProbesApi)

const payload = [
    { domain: 'www.easyeda.com', status: 'consistent', probeAt: '2026-09-02T08:00:00Z', linkedResource: 'cdn', recordType: 'CNAME', recordValue: 'x.edgesuite.net', tlsVersion: 'TLS 1.3', onlineNotAfter: '2027-01-01T00:00:00Z' },
    { domain: 'easyeda.com', status: 'diff', probeAt: '2026-09-02T08:00:00Z', linkedResource: 'external', recordType: 'A', recordValue: '1.2.3.4', tlsVersion: 'TLS 1.2' },
    { domain: '*.jlcerp.com', status: 'wildcard_skipped', probeAt: '2026-09-02T08:00:00Z' },
    { domain: 'jlcerp.com', status: 'unreachable', probeAt: '2026-09-02T08:00:00Z' },
]

const ElTooltipStub = defineComponent({
    name: 'ElTooltip',
    setup(_, { slots }) {
        return () => h('span', slots.default?.())
    },
})

function mountPage() {
    return mount(ProbesIndex, {
        global: {
            plugins: [ElementPlus],
            components: { ElTooltip: ElTooltipStub },
        },
    })
}

describe('ProbesIndex（挂载与刷新回归）', () => {
    it('初始加载渲染根域分组', async () => {
        probesApi.mockResolvedValue(payload as never)
        const w = mountPage()
        await flushPromises()
        expect(w.find('.group-root').exists()).toBe(true)
        expect(w.text()).toContain('easyeda.com')
    })

    it('点刷新二次加载不崩（白屏回归）', async () => {
        probesApi.mockResolvedValue(payload as never)
        const w = mountPage()
        await flushPromises()
        const refreshBtn = w.findAll('button').find((b) => b.text().includes('刷新'))
        expect(refreshBtn).toBeTruthy()
        await refreshBtn!.trigger('click')
        await flushPromises()
        await flushPromises()
        expect(w.find('.group-root').exists()).toBe(true)
        expect(w.text()).toContain('jlcerp.com')
    })

    it('组头「探测此域」触发定向 API', async () => {
        probesApi.mockResolvedValue(payload as never)
        const triggerApi = vi.mocked(triggerCertProbeScanApi)
        triggerApi.mockRejectedValue(new (await import('@/api/cert')).CertRequestError('SCAN_IN_PROGRESS', 'running') as never)
        const w = mountPage()
        await flushPromises()
        const probeBtn = w.findAll('button').find((b) => b.text().includes('探测此域'))
        expect(probeBtn).toBeTruthy()
        await probeBtn!.trigger('click')
        await flushPromises()
        expect(triggerApi).toHaveBeenCalledWith('easyeda.com')
    })
})

describe('ProbesIndex（搜索交互回归）', () => {
    it('搜索无匹配保留工具栏与空态（页面消失回归）', async () => {
        probesApi.mockResolvedValue(payload as never)
        vi.useFakeTimers()
        try {
            const w = mountPage()
            await flushPromises()
            const input = w.find('.toolbar-search input')
            await input.setValue('zzz-no-match')
            await flushPromises()
            // 防抖窗口内表格仍在（未过滤）
            expect(w.find('.data-table').exists()).toBe(true)
            vi.advanceTimersByTime(300)
            await flushPromises()
            // 工具栏与搜索框必须保留——用户能调整/清空筛选
            expect(w.find('.toolbar-search').exists()).toBe(true)
            // 空态提示可见
            expect(w.text()).toContain('当前筛选无匹配')
        } finally {
            vi.useRealTimers()
        }
    })

    it('输入防抖：停顿后过滤才生效', async () => {
        probesApi.mockResolvedValue(payload as never)
        vi.useFakeTimers()
        try {
            const w = mountPage()
            await flushPromises()
            const input = w.find('.toolbar-search input')
            await input.setValue('easyeda')
            await flushPromises()
            // 防抖窗口内：全部组仍显示（keyword 未应用）
            expect(w.text()).toContain('jlcerp.com')
            vi.advanceTimersByTime(300)
            await flushPromises()
            // 防抖后：过滤生效，只剩命中组
            expect(w.text()).not.toContain('jlcerp.com')
            expect(w.text()).toContain('easyeda.com')
        } finally {
            vi.useRealTimers()
        }
    })
})

describe('ProbesIndex（渲染量防御回归）', () => {
    // 2622 行全量渲染是整机卡死根因：默认必须折叠，展开单组有上限，筛选态有总上限。
    const bigPayload = Array.from({ length: 250 }, (_, i) => ({
        domain: `svc-${String(i).padStart(3, '0')}.jlcerp.com`,
        status: 'consistent',
        probeAt: '2026-09-02T08:00:00Z',
    })) as never

    it('默认折叠：首屏不渲染子行（仅组头）', async () => {
        probesApi.mockResolvedValue(payload as never)
        const w = mountPage()
        await flushPromises()
        expect(w.findAll('.group-row').length).toBe(2)
        expect(w.findAll('.sub-row').length).toBe(0)
    })

    it('展开组头按需渲染子行', async () => {
        probesApi.mockResolvedValue(payload as never)
        const w = mountPage()
        await flushPromises()
        await w.find('.group-row').trigger('click')
        await flushPromises()
        expect(w.findAll('.sub-row').length).toBe(2)
    })

    it('单组渲染上限：超限截断并提示', async () => {
        probesApi.mockResolvedValue(bigPayload)
        const w = mountPage()
        await flushPromises()
        await w.find('.group-row').trigger('click')
        await flushPromises()
        expect(w.findAll('.sub-row').length).toBeLessThanOrEqual(200)
        expect(w.text()).toContain('已展示前')
    })

    it('筛选态总渲染上限：短关键词全量命中时预算截断', async () => {
        // 700 行 > FILTER_RENDER_TOTAL(600)：筛选激活全展开时预算截断出提示
        const hugePayload = Array.from({ length: 700 }, (_, i) => ({
            domain: `svc-${String(i).padStart(3, '0')}.jlcerp.com`,
            status: 'consistent',
            probeAt: '2026-09-02T08:00:00Z',
        })) as never
        probesApi.mockResolvedValue(hugePayload)
        vi.useFakeTimers()
        try {
            const w = mountPage()
            await flushPromises()
            const input = w.find('.toolbar-search input')
            await input.setValue('jlcerp')
            vi.advanceTimersByTime(300)
            await flushPromises()
            expect(w.findAll('.sub-row').length).toBeLessThanOrEqual(600)
            expect(w.text()).toContain('已展示前')
        } finally {
            vi.useRealTimers()
        }
    })
})
