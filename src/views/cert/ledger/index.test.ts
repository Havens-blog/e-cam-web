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
import LedgerIndex from './index.vue'

vi.mock('@/api/cert', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/cert')>()
    return {
        ...actual,
        listCertsApi: vi.fn(),
        getCertStatsApi: vi.fn(),
    }
})

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
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
