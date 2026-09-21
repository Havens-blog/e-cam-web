// @vitest-environment happy-dom
/**
 * 台账页「从云端导入」双入口用例（cert-cloud-discovery-import 任务 6 AC1）：
 * 工具栏按钮与空态 CTA 均打开 DiscoveryImportModal（以 open() 暴露替身断言）。
 * 其余 Modal（导入/批量导入/补传私钥）stub 化避免无关装配噪声。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { ElButton } from 'element-plus'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCertStatsApi, listCertsApi } from '@/api/cert'
import type { CertListItem } from '@/api/cert'
import LedgerIndex from './index.vue'

vi.mock('@/api/cert', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/cert')>()
    return {
        ...actual,
        listCertsApi: vi.fn(),
        getCertStatsApi: vi.fn(),
    }
})

// useRoute query 可配置（看板跳转 /certs?daysLeft=expired 用例）
const routeQuery: Record<string, unknown> = {}
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
    // 页面 setup 现调用 useRoute()（cert 侧新增），mock 缺失会令全部挂载类用例失败
    useRoute: () => ({ query: routeQuery, params: {} }),
}))

const listApi = vi.mocked(listCertsApi)
const statsApi = vi.mocked(getCertStatsApi)

/** DiscoveryImportModal 替身：暴露 open() 间谍（父级经模板 ref 调用）；
 * 渲染 completed 触发按钮（DOM 桥接 emit，供完成刷新挂接断言） */
const openSpy = vi.fn()
const DiscoveryModalStub = defineComponent({
    name: 'DiscoveryImportModal',
    emits: ['completed'],
    setup(_, { expose, emit }) {
        expose({ open: openSpy })
        return () =>
            h('button', { 'data-testid': 'discovery-modal-complete', onClick: () => emit('completed') })
    },
})

const NullStub = defineComponent({
    name: 'NullStub',
    // 页面经模板 ref 调 open()/open(row)：替身暴露 no-op 保持调用链安全
    setup(_, { expose }) {
        expose({ open: () => {} })
        return () => null
    },
})

const ElDialogStub = defineComponent({
    name: 'ElDialog',
    props: { modelValue: { type: Boolean, default: false } },
    setup(props) {
        return () => (props.modelValue ? h('div') : null)
    },
})

/** 统计载荷（空台账形态；刷新断言复用） */
function emptyStats() {
    return {
        total: 0,
        complete: 0,
        fingerprintOnly: 0,
        missingRegistrations: 0,
        registrationRate: 0,
        replaceableRate: 0,
        fingerprintOnlyRate: 0,
        denominator: 0,
        denominatorSources: { scannedUniqueFingerprints: 0, manualOnlyFingerprints: 0 },
    }
}

async function mountEmptyLedger() {
    listApi.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 } as never)
    statsApi.mockResolvedValueOnce(emptyStats() as never)
    const wrapper = mount(LedgerIndex, {
        global: {
            // 页面模板依赖 unplugin 自动注册的 el-button/el-dialog（vitest 无该插件），
            // 测试内显式注册；el-dialog 直接注册为替身规避 overlay 过渡
            components: {
                ElButton,
                ElDialog: ElDialogStub,
            },
            stubs: {
                DiscoveryImportModal: DiscoveryModalStub,
                ImportCertModal: NullStub,
                BatchImportModal: NullStub,
                UploadKeyModal: NullStub,
            },
        },
    })
    await flushPromises()
    return wrapper
}

afterEach(() => {
    openSpy.mockClear()
    listApi.mockReset()
    statsApi.mockReset()
    for (const k of Object.keys(routeQuery)) delete routeQuery[k]
})

describe('台账页「从云端导入」双入口（AC1）', () => {
    it('工具栏按钮存在且点击打开 DiscoveryImportModal', async () => {
        const wrapper = await mountEmptyLedger()
        const btn = wrapper.findAll('button').find((b) => b.text() === '从云端导入')
        expect(btn).toBeDefined()
        expect(openSpy).not.toHaveBeenCalled()
        await btn!.trigger('click')
        expect(openSpy).toHaveBeenCalledTimes(1)
    })

    it('空态 CTA：从云端导入存量证书为主入口，批量上传为兜底，点击云端 CTA 打开 Modal', async () => {
        const wrapper = await mountEmptyLedger()
        // 空态可见（台账 0 条）
        expect(wrapper.find('.empty-state').exists()).toBe(true)
        expect(wrapper.text()).toContain('暂无证书')
        const cloudCta = wrapper.findAll('.empty-state button').find((b) => b.text() === '从云端导入存量证书')
        const batchCta = wrapper.findAll('.empty-state button').find((b) => b.text().includes('批量上传'))
        expect(cloudCta).toBeDefined()
        expect(batchCta).toBeDefined()
        await cloudCta!.trigger('click')
        expect(openSpy).toHaveBeenCalledTimes(1)
        // 批量上传 CTA 不打开云端导入 Modal（仍走 BatchImportModal 替身）
        await batchCta!.trigger('click')
        expect(openSpy).toHaveBeenCalledTimes(1)
    })
})

describe('云端导入完成刷新挂接（任务 7 AC3）', () => {
    it('导入完成事件触发台账列表与统计重取（新增登记项立即可见）', async () => {
        const wrapper = await mountEmptyLedger()
        const listCalls = listApi.mock.calls.length
        const statsCalls = statsApi.mock.calls.length
        // 刷新请求的持久返回值（refreshAll 不阻塞断言）
        listApi.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 } as never)
        statsApi.mockResolvedValue(emptyStats() as never)
        // Modal 到达终态（completed/partial_failed）→ emit completed（经替身触发按钮桥接）
        await wrapper.find('[data-testid="discovery-modal-complete"]').trigger('click')
        await flushPromises()
        expect(listApi.mock.calls.length).toBe(listCalls + 1)
        expect(statsApi.mock.calls.length).toBe(statsCalls + 1)
    })
})

// ==================== 台账默认隐藏无引用过期证书（ledger-hide-expired-orphans 任务 2） ====================

function certRow(id: string, commonName: string): CertListItem {
    return {
        id,
        fingerprint: `fp-${id}`,
        commonName,
        sans: [commonName],
        issuer: 'Test Issuer',
        notAfter: '2026-01-01T00:00:00Z',
        daysLeft: -5,
        hostingStatus: 'fingerprint_only',
        protectUntil: null,
        refCount: 0,
    }
}

/** 挂载台账页（隐藏切换用例）：首响应携带指定 total/hiddenCount。
 * ElTable 桩化：本组断言聚焦工具栏提示条/请求参数（表格行渲染不在范围） */
async function mountLedgerWith(list: {
    items: CertListItem[]
    total: number
    hiddenCount: number
}) {
    listApi.mockResolvedValueOnce({ ...list, page: 1, pageSize: 20 } as never)
    statsApi.mockResolvedValue(emptyStats() as never)
    const wrapper = mount(LedgerIndex, {
        global: {
            components: {
                ElButton,
                ElDialog: ElDialogStub,
            },
            stubs: {
                ElTable: true,
                DiscoveryImportModal: DiscoveryModalStub,
                ImportCertModal: NullStub,
                BatchImportModal: NullStub,
                UploadKeyModal: NullStub,
            },
        },
    })
    await flushPromises()
    return wrapper
}

describe('台账默认隐藏 + 行内提示切换（任务 2 AC1/AC2/AC3）', () => {
    it('默认视图消费服务端 hiddenCount：工具栏提示 canonical 文案，请求不含 includeExpiredNoRefs', async () => {
        const wrapper = await mountLedgerWith({
            items: [certRow('a', 'a.example.com')],
            total: 1,
            hiddenCount: 2,
        })

        const banner = wrapper.find('.hidden-toggle')
        expect(banner.exists()).toBe(true)
        expect(banner.text()).toBe('已隐藏 2 张无引用过期证书 · 查看全部')
        // AC1：默认视图 = 服务端过滤（includeExpiredNoRefs 缺省 false）
        const firstCall = listApi.mock.calls[0]?.[0] as Record<string, unknown> | undefined
        expect(firstCall && 'includeExpiredNoRefs' in firstCall).toBe(false)
    })

    it('点击「查看全部」→ includeExpiredNoRefs:true + 重置第 1 页；文案变展开态；再点恢复隐藏', async () => {
        const wrapper = await mountLedgerWith({
            items: [certRow('a', 'a.example.com')],
            total: 1,
            hiddenCount: 2,
        })

        // 展开后服务端 include=true 路径返回 hiddenCount=0，但提示仍显示展开态文案（可再次点击隐藏）
        listApi.mockResolvedValue({
            items: [certRow('a', 'a.example.com'), certRow('b', 'b.example.com'), certRow('c', 'c.example.com')],
            total: 3,
            hiddenCount: 0,
            page: 1,
            pageSize: 20,
        } as never)
        let banner = wrapper.find('.hidden-toggle')
        await banner.trigger('click')
        await flushPromises()

        let lastCall = listApi.mock.calls[listApi.mock.calls.length - 1]?.[0] as Record<string, unknown>
        expect(lastCall).toMatchObject({ page: 1, includeExpiredNoRefs: true })
        banner = wrapper.find('.hidden-toggle')
        expect(banner.exists()).toBe(true)
        expect(banner.text()).toBe('再次点击隐藏无引用过期证书')

        // 再点恢复隐藏：includeExpiredNoRefs 移除 + 文案复原（下一响应 hiddenCount=2）
        listApi.mockResolvedValue({
            items: [certRow('a', 'a.example.com')],
            total: 1,
            hiddenCount: 2,
            page: 1,
            pageSize: 20,
        } as never)
        await banner.trigger('click')
        await flushPromises()

        lastCall = listApi.mock.calls[listApi.mock.calls.length - 1]?.[0] as Record<string, unknown>
        expect(lastCall).toMatchObject({ page: 1 })
        expect('includeExpiredNoRefs' in lastCall).toBe(false)
        banner = wrapper.find('.hidden-toggle')
        expect(banner.text()).toBe('已隐藏 2 张无引用过期证书 · 查看全部')
    })

    it('AC4 daysLeft=expired 跳转：切换态挂起（不显示隐藏提示）', async () => {
        routeQuery.daysLeft = 'expired'
        // 后端豁免路径：恒返回全部过期 + hiddenCount=0
        const wrapper = await mountLedgerWith({
            items: [certRow('a', 'a.example.com'), certRow('b', 'b.example.com')],
            total: 2,
            hiddenCount: 0,
        })

        expect(wrapper.find('.hidden-toggle').exists()).toBe(false)
    })

    it('AC5 空态视图保留「已隐藏 N 张…」提示条与「查看全部」入口（提示不随表格主体消失）', async () => {
        const wrapper = await mountLedgerWith({ items: [], total: 0, hiddenCount: 1 })

        expect(wrapper.find('.empty-state').exists()).toBe(true)
        const banner = wrapper.find('.empty-hidden-toggle')
        expect(banner.exists()).toBe(true)
        expect(banner.text()).toBe('已隐藏 1 张无引用过期证书 · 查看全部')

        // 查看全部入口可用：展开请求带 includeExpiredNoRefs:true
        listApi.mockResolvedValue({
            items: [certRow('a', 'a.example.com')],
            total: 1,
            hiddenCount: 0,
            page: 1,
            pageSize: 20,
        } as never)
        await banner.trigger('click')
        await flushPromises()
        const lastCall = listApi.mock.calls[listApi.mock.calls.length - 1]?.[0] as Record<string, unknown>
        expect(lastCall).toMatchObject({ page: 1, includeExpiredNoRefs: true })
    })
})
