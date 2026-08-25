// @vitest-environment happy-dom
/**
 * DiscoveryImportModal 组件用例（cert-cloud-discovery-import 任务 6 + 任务 8）。
 * 覆盖 AC：分组展示/灰选/不可选组提示/默认全选未登记（AC2）、
 * 快照超 7 天提示与 notAfter 占位（AC3）、NO_SNAPSHOT 引导流程（任务 8）：
 * 先执行扫描引导文案+触发按钮、触发即转 snapshot-status 轮询（不依赖触发
 * 请求同步返回终态）、running→done 自动进预览、failed 展示 partialFailures
 * 明细+重试入口、分组折叠（实现注记：分组折叠承载大清单）。
 * ElDialog 以渲染函数 stub 替身（规避 overlay 过渡/传送门不确定性），
 * 其余 Element Plus 组件用真实实现，交互断言落在原生 input 上。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CertRequestError } from '@/api/cert'
import {
    getDiscoveryImportApi,
    getDiscoveryPreviewApi,
    getDiscoverySnapshotStatusApi,
    listCertsApi,
    startDiscoveryImportApi,
    triggerCertScanApi,
} from '@/api/cert'
import type { DiscoveryImportItem, DiscoveryImportSession } from '@/api/cert'
import DiscoveryImportModal from './DiscoveryImportModal.vue'

vi.mock('@/api/cert', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/cert')>()
    return {
        ...actual,
        getDiscoveryPreviewApi: vi.fn(),
        getDiscoverySnapshotStatusApi: vi.fn(),
        listCertsApi: vi.fn(),
        triggerCertScanApi: vi.fn(),
        startDiscoveryImportApi: vi.fn(),
        getDiscoveryImportApi: vi.fn(),
    }
})

const previewApi = vi.mocked(getDiscoveryPreviewApi)
const statusApi = vi.mocked(getDiscoverySnapshotStatusApi)
const listApi = vi.mocked(listCertsApi)
const triggerApi = vi.mocked(triggerCertScanApi)
const startImportApi = vi.mocked(startDiscoveryImportApi)
const importApi = vi.mocked(getDiscoveryImportApi)

/** ElDialog 替身：modelValue=true 时渲染三个 slot（header/default/footer） */
const DialogStub = defineComponent({
    name: 'ElDialog',
    props: { modelValue: { type: Boolean, default: false } },
    setup(props, { slots }) {
        return () =>
            props.modelValue
                ? h('div', { class: 'dialog-stub' }, [slots.header?.(), slots.default?.(), slots.footer?.()])
                : null
    },
})

/** 未登记 notAfter 占位（与后端 DiscoveryNotAfterPending 一致） */
const PENDING = '—（导入后补全）'

function entry(p: {
    cloud: string
    cloudCertId: string
    accountKey?: string
    refCount?: number
    inLedger?: boolean
    notAfter?: string
    parseable?: boolean
    parseReason?: 'deferred_parse' | 'unsupported_cloud' | 'iam_hosted'
}) {
    return {
        cloud: p.cloud,
        accountKey: p.accountKey ?? 'acc-1',
        cloudCertId: p.cloudCertId,
        refCount: p.refCount ?? 1,
        inLedger: p.inLedger ?? false,
        notAfter: p.notAfter ?? PENDING,
        parseable: p.parseable ?? true,
        ...(p.parseReason ? { parseReason: p.parseReason } : {}),
    }
}

/** 主夹具：四云五条目（未登记可选/已在台账灰选/华为云整组不可选/腾讯 deferred_parse/AWS IAM-hosted 组） */
function makePreview(snapshotStartedAt = '2099-01-01T00:00:00Z') {
    return {
        snapshotId: 'snap-1',
        snapshotStartedAt,
        count: 5,
        items: [
            entry({ cloud: 'aliyun', cloudCertId: 'cert-new-1', accountKey: 'acc-a', refCount: 2 }),
            entry({
                cloud: 'aliyun',
                cloudCertId: 'cert-in-ledger',
                accountKey: 'acc-a',
                inLedger: true,
                notAfter: '2027-01-01T00:00:00Z',
            }),
            entry({ cloud: 'tencent', cloudCertId: 'tx-defer', accountKey: 'acc-t', parseReason: 'deferred_parse' }),
            entry({ cloud: 'aws', cloudCertId: 'cert-iam-1', accountKey: 'acc-w', parseable: false, parseReason: 'iam_hosted' }),
            entry({ cloud: 'huawei', cloudCertId: 'hw-1', accountKey: 'acc-h', refCount: 3, parseable: false, parseReason: 'unsupported_cloud' }),
        ],
    }
}

async function openWith(payload: ReturnType<typeof makePreview>) {
    previewApi.mockResolvedValueOnce(payload as never)
    const wrapper = mount(DiscoveryImportModal, { global: { stubs: { ElDialog: DialogStub } } })
    ;(wrapper.vm as unknown as { open: () => void }).open()
    await flushPromises()
    return wrapper
}

function rows(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll('[data-testid="discovery-row"]')
}

/** 分组断言辅助：安全取第 i 组（noUncheckedIndexedAccess 下索引访问守卫） */
function groupAt(wrapper: ReturnType<typeof mount>, i: number) {
    const g = wrapper.findAll('[data-testid="discovery-group"]')[i]
    if (!g) throw new Error(`group ${i} not found`)
    return g
}

function rowBy(wrapper: ReturnType<typeof mount>, certId: string) {
    const r = rows(wrapper).find((x) => x.text().includes(certId))
    if (!r) throw new Error(`row ${certId} not found`)
    return r
}

function checkOf(rowEl: { find: (sel: string) => { element: Element } }) {
    return rowEl.find('input[type="checkbox"]').element as HTMLInputElement
}

/** 空态快照状态（hasSnapshot=false → idle 引导首查缺省返回值） */
function noSnapshotStatus() {
    return { hasSnapshot: false, partialFailures: [] }
}

/** 台账首条证书（触发端点挂载证书解析用，pageSize=1 轻量查询形态） */
function oneCertList() {
    return { items: [{ id: 'cert-mount-1' }], total: 1, page: 1, pageSize: 1 }
}

afterEach(() => {
    previewApi.mockReset()
    statusApi.mockReset()
    listApi.mockReset()
    triggerApi.mockReset()
    startImportApi.mockReset()
    importApi.mockReset()
    vi.useRealTimers()
})

// ==================== AC2：分组列表、灰选、不可选组、默认全选 ====================

describe('DiscoveryImportModal（预览装配与默认勾选，AC2）', () => {
    it('open() 调用 preview API 并按云分组渲染（已知云顺序）', async () => {
        const wrapper = await openWith(makePreview())
        expect(previewApi).toHaveBeenCalledTimes(1)
        expect(previewApi).toHaveBeenCalledWith()
        const groups = wrapper.findAll('[data-testid="discovery-group"]')
        expect(groups.map((g) => g.find('.ds-group-title').text())).toEqual(['阿里云', '腾讯云', 'AWS', '华为云'])
        expect(rows(wrapper)).toHaveLength(5)
    })

    it('默认勾选全部未登记可选项（2/5），footer 计数同步', async () => {
        const wrapper = await openWith(makePreview())
        expect(checkOf(rowBy(wrapper, 'cert-new-1')).checked).toBe(true)
        expect(checkOf(rowBy(wrapper, 'tx-defer')).checked).toBe(true)
        expect(checkOf(rowBy(wrapper, 'cert-in-ledger')).checked).toBe(false)
        expect(checkOf(rowBy(wrapper, 'cert-iam-1')).checked).toBe(false)
        expect(checkOf(rowBy(wrapper, 'hw-1')).checked).toBe(false)
        expect(wrapper.text()).toContain('导入所选（2 张）')
        expect(wrapper.text()).toContain('待登记 2')
        expect(wrapper.text()).toContain('已在台账 1')
        expect(wrapper.text()).toContain('暂不支持 2')
    })

    it('已在台账条目灰选不可勾（disabled），带「已在台账」标记', async () => {
        const wrapper = await openWith(makePreview())
        const row = rowBy(wrapper, 'cert-in-ledger')
        expect(checkOf(row).disabled).toBe(true)
        expect(row.text()).toContain('已在台账')
    })

    it('华为云/AWS IAM-hosted 不可选组：整组无组级复选框、行复选框禁用、组提示可见', async () => {
        const wrapper = await openWith(makePreview())
        const aws = groupAt(wrapper, 2)
        const huawei = groupAt(wrapper, 3)
        // 组级复选框仅可选组渲染
        expect(aws.find('[data-testid="discovery-group-check"]').exists()).toBe(false)
        expect(huawei.find('[data-testid="discovery-group-check"]').exists()).toBe(false)
        expect(aws.find('[data-testid="discovery-unsupported-hint"]').text()).toContain('IAM-hosted')
        expect(huawei.find('[data-testid="discovery-unsupported-hint"]').text()).toContain('暂不支持自动解析')
        expect(checkOf(rowBy(wrapper, 'cert-iam-1')).disabled).toBe(true)
        expect(checkOf(rowBy(wrapper, 'hw-1')).disabled).toBe(true)
    })

    it('deferred_parse 条目保持可选并带「导入时解析」标记', async () => {
        const wrapper = await openWith(makePreview())
        const row = rowBy(wrapper, 'tx-defer')
        expect(checkOf(row).disabled).toBe(false)
        expect(row.find('[data-testid="discovery-reason-tag"]').text()).toBe('导入时解析')
    })

    it('行勾选切换与组头复选框批量切换（不可选条目不受影响）', async () => {
        const wrapper = await openWith(makePreview())
        // 行级取消勾选：cert-new-1 → 计数 2→1
        const newRow = rowBy(wrapper, 'cert-new-1')
        await newRow.find('input[type="checkbox"]').setValue(false)
        expect(wrapper.text()).toContain('导入所选（1 张）')
        // 组头（阿里云）当前半选 → 点击全选组内待登记项（仅 cert-new-1，已在台账不可选）
        const aliyun = groupAt(wrapper, 0)
        const groupCheck = aliyun.find('[data-testid="discovery-group-check"] input[type="checkbox"]')
        await groupCheck.setValue(true)
        expect(checkOf(rowBy(wrapper, 'cert-new-1')).checked).toBe(true)
        expect(checkOf(rowBy(wrapper, 'cert-in-ledger')).checked).toBe(false)
        expect(wrapper.text()).toContain('导入所选（2 张）')
        // 再点组头 → 清空本组
        await groupCheck.setValue(false)
        expect(checkOf(rowBy(wrapper, 'cert-new-1')).checked).toBe(false)
        expect(wrapper.text()).toContain('导入所选（1 张）')
    })

    it('分组折叠：组头点击切换行区显隐（大清单分组折叠承载）', async () => {
        const wrapper = await openWith(makePreview())
        const aliyun = groupAt(wrapper, 0)
        const rowsEl = aliyun.find('.ds-rows')
        expect((rowsEl.element as HTMLElement).style.display).not.toBe('none')
        await aliyun.find('.ds-group-head').trigger('click')
        expect((rowsEl.element as HTMLElement).style.display).toBe('none')
        await aliyun.find('.ds-group-head').trigger('click')
        expect((rowsEl.element as HTMLElement).style.display).not.toBe('none')
    })
})

// ==================== AC3：快照超 7 天提示 + notAfter 占位 ====================

describe('DiscoveryImportModal（快照时效与 notAfter 展示，AC3）', () => {
    it('快照超 7 天 → 顶部显著提示建议重扫（含快照时间）', async () => {
        const wrapper = await openWith(makePreview('2020-01-01T00:00:00Z'))
        const alertEl = wrapper.find('[data-testid="discovery-stale-alert"]')
        expect(alertEl.exists()).toBe(true)
        expect(alertEl.text()).toContain('超过 7 天')
        expect(alertEl.text()).toContain('2020-01-01')
        expect(alertEl.text()).toContain('重新执行引用扫描')
    })

    it('新鲜快照无过期提示，展示快照时间', async () => {
        const wrapper = await openWith(makePreview('2026-08-24T00:00:00Z'))
        expect(wrapper.find('[data-testid="discovery-stale-alert"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('快照时间：2026-08-24 00:00 UTC')
    })

    it('notAfter 未登记条目显示「—（导入后补全）」占位，台账条目显示日期', async () => {
        const wrapper = await openWith(makePreview())
        expect(rowBy(wrapper, 'cert-new-1').text()).toContain('—（导入后补全）')
        expect(rowBy(wrapper, 'cert-in-ledger').text()).toContain('2027-01-01')
        expect(rowBy(wrapper, 'cert-in-ledger').text()).not.toContain('—（导入后补全）')
    })
})

// ==================== 任务 8：NO_SNAPSHOT 引导流程（AC1-AC4） ====================

describe('DiscoveryImportModal（NO_SNAPSHOT 引导分支，任务 8）', () => {
    /** 打开 Modal 并落入引导分支（预览 409 + 首查快照状态返回指定形态） */
    async function openNoSnapshot(statusPayload: object) {
        previewApi.mockRejectedValueOnce(new CertRequestError('NO_SNAPSHOT', 'no done snapshot') as never)
        statusApi.mockResolvedValueOnce(statusPayload as never)
        const wrapper = mount(DiscoveryImportModal, { global: { stubs: { ElDialog: DialogStub } } })
        ;(wrapper.vm as unknown as { open: () => void }).open()
        await flushPromises()
        return wrapper
    }

    it('NO_SNAPSHOT → 「先执行扫描」引导（说明文案 + 可用触发按钮），不展示错误堆栈', async () => {
        const wrapper = await openNoSnapshot(noSnapshotStatus())
        const branch = wrapper.find('[data-testid="discovery-no-snapshot"]')
        expect(branch.exists()).toBe(true)
        expect(branch.text()).toContain('暂无可用的扫描快照')
        expect(branch.text()).toContain('先执行扫描')
        // 进入分支即首查一次快照状态（区分从未扫描/进行中/失败）
        expect(statusApi).toHaveBeenCalledTimes(1)
        // 触发按钮可用（任务 6 占位禁用态由任务 8 接管为真实引导）
        const trigger = wrapper.find('[data-testid="discovery-trigger-scan"]')
        expect(trigger.exists()).toBe(true)
        expect(trigger.attributes('disabled')).toBeUndefined()
        // 非错误态（无错误堆栈/错误分支）
        expect(wrapper.find('[data-testid="discovery-error"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="discovery-scan-running"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="discovery-scan-failed"]').exists()).toBe(false)
    })

    it('重新检查入口：重取预览成功后进入列表', async () => {
        const wrapper = await openNoSnapshot(noSnapshotStatus())
        previewApi.mockResolvedValueOnce(makePreview() as never)
        await wrapper.find('[data-testid="discovery-reload"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="discovery-group"]').exists()).toBe(true)
    })

    it('进入分支时快照已在 running → 直接进入进行中态并挂轮询（无需触发）', async () => {
        vi.useFakeTimers()
        const wrapper = await openNoSnapshot({
            hasSnapshot: true,
            snapshotId: 'snap-r1',
            status: 'running',
            startedAt: '2026-08-25T02:00:00Z',
            partialFailures: [],
        })
        const running = wrapper.find('[data-testid="discovery-scan-running"]')
        expect(running.exists()).toBe(true)
        expect(running.text()).toContain('扫描进行中')
        expect(running.text()).toContain('2026-08-25 02:00 UTC')
        expect(running.text()).toContain('自动进入预览')
        // 触发按钮不展示（已在进行中，防重复触发）
        expect(wrapper.find('[data-testid="discovery-trigger-scan"]').exists()).toBe(false)
        // 轮询已挂载：推进一个周期即再次查询状态
        statusApi.mockResolvedValue({ hasSnapshot: true, status: 'running', partialFailures: [] } as never)
        await vi.advanceTimersByTimeAsync(2000)
        expect(statusApi).toHaveBeenCalledTimes(2)
    })

    it('进入分支时上次扫描 failed → 展示 failReason + partialFailures 明细 + 重试入口', async () => {
        const wrapper = await openNoSnapshot({
            hasSnapshot: true,
            snapshotId: 'snap-f1',
            status: 'failed',
            startedAt: '2026-08-25T01:00:00Z',
            failReason: '全部扫描通道失败',
            partialFailures: [
                { cloud: 'aliyun', product: 'slb', account: 'acc-a', reason: '凭证失效' },
                { cloud: 'tencent', product: 'cdn', reason: '权限不足' },
            ],
        })
        const failed = wrapper.find('[data-testid="discovery-scan-failed"]')
        expect(failed.exists()).toBe(true)
        expect(failed.text()).toContain('扫描未完成')
        expect(failed.find('[data-testid="discovery-scan-failreason"]').text()).toContain('全部扫描通道失败')
        const items = failed.findAll('[data-testid="discovery-scan-failures"] li')
        expect(items).toHaveLength(2)
        expect(items[0]?.text()).toBe('阿里云 · slb · acc-a：凭证失效')
        expect(items[1]?.text()).toBe('腾讯云 · cdn：权限不足')
        expect(failed.find('[data-testid="discovery-retry-scan"]').exists()).toBe(true)
    })

    it('failed 重试 → 走触发路径（解析挂载证书 + fire-and-forget 触发 + 转轮询）', async () => {
        vi.useFakeTimers()
        const wrapper = await openNoSnapshot({
            hasSnapshot: true,
            status: 'failed',
            failReason: 'x',
            partialFailures: [{ product: 'k8s', reason: '集群不可达' }],
        })
        listApi.mockResolvedValueOnce(oneCertList() as never)
        triggerApi.mockImplementation(() => new Promise(() => {}) as never)
        statusApi.mockResolvedValue({ hasSnapshot: true, status: 'running', partialFailures: [] } as never)
        await wrapper.find('[data-testid="discovery-retry-scan"]').trigger('click')
        await flushPromises()
        expect(listApi).toHaveBeenCalledWith({ page: 1, pageSize: 1 })
        expect(triggerApi).toHaveBeenCalledWith('cert-mount-1')
        expect(wrapper.find('[data-testid="discovery-scan-running"]').exists()).toBe(true)
    })

    it('其他错误 → 内联错误态展示 message（不误入引导分支）', async () => {
        previewApi.mockRejectedValueOnce(new Error('服务暂不可用') as never)
        const wrapper = mount(DiscoveryImportModal, { global: { stubs: { ElDialog: DialogStub } } })
        ;(wrapper.vm as unknown as { open: () => void }).open()
        await flushPromises()
        const err = wrapper.find('[data-testid="discovery-error"]')
        expect(err.exists()).toBe(true)
        expect(err.text()).toContain('服务暂不可用')
        expect(wrapper.find('[data-testid="discovery-no-snapshot"]').exists()).toBe(false)
    })
})

describe('DiscoveryImportModal（触发扫描与状态轮询收敛，任务 8）', () => {
    /** 打开至 idle 引导并触发扫描（fire-and-forget：触发请求永不返回也不阻塞） */
    async function openAndTrigger() {
        vi.useFakeTimers()
        previewApi.mockRejectedValueOnce(new CertRequestError('NO_SNAPSHOT', 'no done snapshot') as never)
        statusApi.mockResolvedValueOnce(noSnapshotStatus() as never)
        const wrapper = mount(DiscoveryImportModal, { global: { stubs: { ElDialog: DialogStub } } })
        ;(wrapper.vm as unknown as { open: () => void }).open()
        await flushPromises()
        listApi.mockResolvedValueOnce(oneCertList() as never)
        // 同步至终态语义：触发请求挂起（永不 resolve）也不得阻塞引导转轮询
        triggerApi.mockImplementation(() => new Promise(() => {}) as never)
        await wrapper.find('[data-testid="discovery-trigger-scan"]').trigger('click')
        await flushPromises()
        return wrapper
    }

    it('触发即转 running 轮询视图：不等待触发请求响应体（挂起 Promise 不阻塞）', async () => {
        const wrapper = await openAndTrigger()
        expect(triggerApi).toHaveBeenCalledTimes(1)
        expect(triggerApi).toHaveBeenCalledWith('cert-mount-1')
        expect(listApi).toHaveBeenCalledWith({ page: 1, pageSize: 1 })
        // 预览未再次拉取（终态由轮询收敛，非触发请求）
        expect(previewApi).toHaveBeenCalledTimes(1)
        const running = wrapper.find('[data-testid="discovery-scan-running"]')
        expect(running.exists()).toBe(true)
        expect(running.text()).toContain('扫描进行中')
    })

    it('running → done 收敛：轮询到 done 停轮询并自动拉取预览进入列表', async () => {
        const wrapper = await openAndTrigger()
        statusApi.mockResolvedValueOnce({ hasSnapshot: true, status: 'running', partialFailures: [] } as never)
        await vi.advanceTimersByTimeAsync(2000)
        expect(wrapper.find('[data-testid="discovery-scan-running"]').exists()).toBe(true)
        // done → 自动进预览（无需手动刷新）
        statusApi.mockResolvedValueOnce({ hasSnapshot: true, status: 'done', partialFailures: [] } as never)
        previewApi.mockResolvedValueOnce(makePreview() as never)
        await vi.advanceTimersByTimeAsync(2000)
        await flushPromises()
        expect(previewApi).toHaveBeenCalledTimes(2)
        expect(wrapper.find('[data-testid="discovery-group"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="discovery-no-snapshot"]').exists()).toBe(false)
        // 终态后停止轮询
        const calls = statusApi.mock.calls.length
        await vi.advanceTimersByTimeAsync(6000)
        expect(statusApi.mock.calls.length).toBe(calls)
    })

    it('running → failed 收敛：展示 partialFailures 明细 + 重试入口，并停止轮询', async () => {
        const wrapper = await openAndTrigger()
        statusApi.mockResolvedValueOnce({
            hasSnapshot: true,
            status: 'failed',
            failReason: '多数通道失败',
            partialFailures: [{ cloud: 'aws', product: 'acm', account: 'acc-w', reason: '限流' }],
        } as never)
        await vi.advanceTimersByTimeAsync(2000)
        await flushPromises()
        const failed = wrapper.find('[data-testid="discovery-scan-failed"]')
        expect(failed.exists()).toBe(true)
        expect(failed.text()).toContain('多数通道失败')
        expect(failed.findAll('[data-testid="discovery-scan-failures"] li')).toHaveLength(1)
        expect(failed.find('[data-testid="discovery-retry-scan"]').exists()).toBe(true)
        const calls = statusApi.mock.calls.length
        await vi.advanceTimersByTimeAsync(6000)
        expect(statusApi.mock.calls.length).toBe(calls)
    })

    it('空台账无法挂载既有触发端点：不调触发 API，内联提示定时扫描（非错误堆栈）', async () => {
        vi.useFakeTimers()
        previewApi.mockRejectedValueOnce(new CertRequestError('NO_SNAPSHOT', 'no done snapshot') as never)
        statusApi.mockResolvedValueOnce(noSnapshotStatus() as never)
        const wrapper = mount(DiscoveryImportModal, { global: { stubs: { ElDialog: DialogStub } } })
        ;(wrapper.vm as unknown as { open: () => void }).open()
        await flushPromises()
        listApi.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 1 } as never)
        await wrapper.find('[data-testid="discovery-trigger-scan"]').trigger('click')
        await flushPromises()
        expect(triggerApi).not.toHaveBeenCalled()
        const notice = wrapper.find('[data-testid="discovery-scan-notice"]')
        expect(notice.exists()).toBe(true)
        expect(notice.text()).toContain('每日 02:00')
        // 保持 idle 引导态（未进入 running/failed，无错误堆栈）
        expect(wrapper.find('[data-testid="discovery-trigger-scan"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="discovery-scan-running"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="discovery-error"]').exists()).toBe(false)
    })

    it('组件卸载停止轮询（不泄漏定时器）', async () => {
        const wrapper = await openAndTrigger()
        statusApi.mockResolvedValue({ hasSnapshot: true, status: 'running', partialFailures: [] } as never)
        wrapper.unmount()
        await vi.advanceTimersByTimeAsync(6000)
        const calls = statusApi.mock.calls.length
        await vi.advanceTimersByTimeAsync(6000)
        expect(statusApi.mock.calls.length).toBe(calls)
    })
})

// ==================== 任务 7：确认导入与进度轮询收敛 ====================

describe('DiscoveryImportModal（确认导入与进度轮询收敛，任务 7）', () => {
    /** 发现导入会话条目（三元组 + 结果） */
    function importItem(p: {
        cloud: string
        cloudCertId: string
        accountKey?: string
        result: DiscoveryImportItem['result']
        mappedCertId?: string
        errorReason?: string
    }): DiscoveryImportItem {
        return {
            cloud: p.cloud,
            accountKey: p.accountKey ?? 'acc-1',
            cloudCertId: p.cloudCertId,
            result: p.result,
            ...(p.mappedCertId ? { mappedCertId: p.mappedCertId } : {}),
            ...(p.errorReason ? { errorReason: p.errorReason } : {}),
        }
    }

    /** 会话夹具（POST 202 初始快照 / 轮询响应同构） */
    function makeSession(p: {
        status: DiscoveryImportSession['status']
        items: DiscoveryImportItem[]
        succeeded: number
        failed: number
        sessionId?: string
        finishedAt?: string
    }): DiscoveryImportSession {
        return {
            sessionId: p.sessionId ?? 'ds-1',
            status: p.status,
            items: p.items,
            progress: { total: p.items.length, succeeded: p.succeeded, failed: p.failed },
            createdAt: '2026-08-25T10:00:00Z',
            ...(p.finishedAt ? { finishedAt: p.finishedAt } : {}),
        }
    }

    /** 默认勾选两条（cert-new-1 + tx-defer）的 202 初始快照（全 pending） */
    function initialSession(): DiscoveryImportSession {
        return makeSession({
            status: 'running',
            items: [
                importItem({ cloud: 'aliyun', cloudCertId: 'cert-new-1', accountKey: 'acc-a', result: 'pending' }),
                importItem({ cloud: 'tencent', cloudCertId: 'tx-defer', accountKey: 'acc-t', result: 'pending' }),
            ],
            succeeded: 0,
            failed: 0,
        })
    }

    /** 打开预览（默认勾选 2 条）并点击确认导入（POST 已 mock） */
    async function openAndConfirm(postResponse: DiscoveryImportSession = initialSession()) {
        vi.useFakeTimers()
        const wrapper = await openWith(makePreview())
        startImportApi.mockResolvedValueOnce(postResponse as never)
        await wrapper.find('[data-testid="discovery-import-submit"]').trigger('click')
        await flushPromises()
        return wrapper
    }

    it('确认导入：以勾选三元组 POST 创建会话，切换进度视图并按批量导入同族间隔（2s）轮询', async () => {
        const wrapper = await openAndConfirm()
        // POST 载荷 = 默认勾选的两条（预览序，已在台账/不可选组不含）
        expect(startImportApi).toHaveBeenCalledTimes(1)
        expect(startImportApi).toHaveBeenCalledWith([
            { cloud: 'aliyun', accountKey: 'acc-a', cloudCertId: 'cert-new-1' },
            { cloud: 'tencent', accountKey: 'acc-t', cloudCertId: 'tx-defer' },
        ])
        // 切换进度视图（预览清单不再渲染）
        const progress = wrapper.find('[data-testid="discovery-import-progress"]')
        expect(progress.exists()).toBe(true)
        expect(wrapper.find('[data-testid="discovery-group"]').exists()).toBe(false)
        // 进度计数展示（running 初始 0/2）
        expect(progress.find('[data-testid="discovery-import-progress-text"]').text()).toContain('0/2')
        // 轮询未即时触发；推一个周期（2000ms）即 GET 会话进度
        expect(importApi).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(2000)
        expect(importApi).toHaveBeenCalledTimes(1)
        expect(importApi).toHaveBeenCalledWith('ds-1')
    })

    it('running → completed 收敛：逐条结果与计数可见，终态停止轮询并触发完成事件（台账刷新）', async () => {
        const wrapper = await openAndConfirm()
        // 第一轮：部分完成（1 成功 1 待处理）
        importApi.mockResolvedValueOnce(
            makeSession({
                status: 'running',
                items: [
                    importItem({ cloud: 'aliyun', cloudCertId: 'cert-new-1', accountKey: 'acc-a', result: 'success', mappedCertId: 'cert-ledger-1' }),
                    importItem({ cloud: 'tencent', cloudCertId: 'tx-defer', accountKey: 'acc-t', result: 'pending' }),
                ],
                succeeded: 1,
                failed: 0,
            }) as never,
        )
        await vi.advanceTimersByTimeAsync(2000)
        expect(wrapper.find('[data-testid="discovery-import-progress-text"]').text()).toContain('成功 1')
        // 第二轮：completed 全部登记
        importApi.mockResolvedValueOnce(
            makeSession({
                status: 'completed',
                items: [
                    importItem({ cloud: 'aliyun', cloudCertId: 'cert-new-1', accountKey: 'acc-a', result: 'success', mappedCertId: 'cert-ledger-1' }),
                    importItem({ cloud: 'tencent', cloudCertId: 'tx-defer', accountKey: 'acc-t', result: 'success', mappedCertId: 'cert-ledger-2' }),
                ],
                succeeded: 2,
                failed: 0,
                finishedAt: '2026-08-25T10:01:00Z',
            }) as never,
        )
        await vi.advanceTimersByTimeAsync(2000)
        await flushPromises()
        // 终态摘要与逐条结果（成功徽章 + 台账证书 ID）
        const summary = wrapper.find('[data-testid="discovery-import-summary"]')
        expect(summary.text()).toContain('全部完成')
        expect(summary.text()).toContain('成功 2 / 失败 0')
        const items = wrapper.findAll('[data-testid="discovery-import-item"]')
        expect(items).toHaveLength(2)
        expect(items[0]?.text()).toContain('已登记')
        expect(items[0]?.text()).toContain('cert-ledger-1')
        // footer 出现「完成」入口
        expect(wrapper.text()).toContain('完成')
        // 终态停止轮询
        const calls = importApi.mock.calls.length
        await vi.advanceTimersByTimeAsync(6000)
        expect(importApi.mock.calls.length).toBe(calls)
        // 完成事件已触发（父级刷新台账列表）
        expect(wrapper.emitted('completed')).toHaveLength(1)
    })

    it('running → partial_failed 收敛：逐条失败原因（errorReason）可见，停止轮询并触发完成事件', async () => {
        const wrapper = await openAndConfirm()
        importApi.mockResolvedValueOnce(
            makeSession({
                status: 'partial_failed',
                items: [
                    importItem({ cloud: 'aliyun', cloudCertId: 'cert-new-1', accountKey: 'acc-a', result: 'success', mappedCertId: 'cert-ledger-1' }),
                    importItem({ cloud: 'tencent', cloudCertId: 'tx-defer', accountKey: 'acc-t', result: 'failed', errorReason: '云侧已不存在' }),
                ],
                succeeded: 1,
                failed: 1,
                finishedAt: '2026-08-25T10:01:00Z',
            }) as never,
        )
        await vi.advanceTimersByTimeAsync(2000)
        await flushPromises()
        // 终态摘要：部分失败 + 计数
        const summary = wrapper.find('[data-testid="discovery-import-summary"]')
        expect(summary.text()).toContain('部分失败')
        expect(summary.text()).toContain('成功 1 / 失败 1')
        // 逐条失败原因可见（errorReason 就地展示于失败行）
        const errors = wrapper.findAll('[data-testid="discovery-import-item-error"]')
        expect(errors).toHaveLength(1)
        expect(errors[0]?.text()).toBe('云侧已不存在')
        const items = wrapper.findAll('[data-testid="discovery-import-item"]')
        expect(items[1]?.text()).toContain('失败')
        // 终态停止轮询 + 完成事件（成功条目登记仍需列表刷新可见）
        const calls = importApi.mock.calls.length
        await vi.advanceTimersByTimeAsync(6000)
        expect(importApi.mock.calls.length).toBe(calls)
        expect(wrapper.emitted('completed')).toHaveLength(1)
    })

    it('空选择禁用提交按钮（不发起 POST）', async () => {
        const wrapper = await openWith(makePreview())
        // 取消仅有的两条勾选 → 导入所选（0 张）禁用
        await rowBy(wrapper, 'cert-new-1').find('input[type="checkbox"]').setValue(false)
        await rowBy(wrapper, 'tx-defer').find('input[type="checkbox"]').setValue(false)
        const submit = wrapper.find('[data-testid="discovery-import-submit"]')
        expect(submit.attributes('disabled')).toBeDefined()
        expect(wrapper.text()).toContain('导入所选（0 张）')
        await submit.trigger('click')
        await flushPromises()
        expect(startImportApi).not.toHaveBeenCalled()
        // 仍停留在预览视图
        expect(wrapper.find('[data-testid="discovery-group"]').exists()).toBe(true)
    })

    it('POST 失败：留在预览视图并 Toast 错误（会话未创建，可重试）', async () => {
        const wrapper = await openWith(makePreview())
        startImportApi.mockRejectedValueOnce(new Error('导入会话创建失败') as never)
        await wrapper.find('[data-testid="discovery-import-submit"]').trigger('click')
        await flushPromises()
        expect(startImportApi).toHaveBeenCalledTimes(1)
        // 未切换进度视图（预览仍在），无轮询
        expect(wrapper.find('[data-testid="discovery-group"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="discovery-import-progress"]').exists()).toBe(false)
        expect(importApi).not.toHaveBeenCalled()
    })

    it('组件卸载停止导入轮询（不泄漏定时器）', async () => {
        const wrapper = await openAndConfirm()
        importApi.mockResolvedValue(initialSession() as never)
        wrapper.unmount()
        await vi.advanceTimersByTimeAsync(6000)
        const calls = importApi.mock.calls.length
        await vi.advanceTimersByTimeAsync(6000)
        expect(importApi.mock.calls.length).toBe(calls)
    })
})
