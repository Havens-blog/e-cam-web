// @vitest-environment happy-dom
/**
 * DiscoveryImportModal 组件用例（cert-cloud-discovery-import 任务 6）。
 * 覆盖 AC：分组展示/灰选/不可选组提示/默认全选未登记（AC2）、
 * 快照超 7 天提示与 notAfter 占位（AC3）、NO_SNAPSHOT 引导占位触发点（AC4）、
 * 分组折叠（实现注记：分组折叠承载大清单）。
 * ElDialog 以渲染函数 stub 替身（规避 overlay 过渡/传送门不确定性），
 * 其余 Element Plus 组件用真实实现，交互断言落在原生 input 上。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CertRequestError } from '@/api/cert'
import { getDiscoveryPreviewApi } from '@/api/cert'
import DiscoveryImportModal from './DiscoveryImportModal.vue'

vi.mock('@/api/cert', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/cert')>()
    return { ...actual, getDiscoveryPreviewApi: vi.fn() }
})

const previewApi = vi.mocked(getDiscoveryPreviewApi)

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

afterEach(() => {
    previewApi.mockReset()
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

// ==================== AC4：NO_SNAPSHOT 引导占位触发点 ====================

describe('DiscoveryImportModal（NO_SNAPSHOT 分支，AC4）', () => {
    it('预览 409 NO_SNAPSHOT → 引导占位视图 + 禁用的触发按钮（任务 8 触发点），非错误态', async () => {
        previewApi.mockRejectedValueOnce(new CertRequestError('NO_SNAPSHOT', 'no done snapshot') as never)
        const wrapper = mount(DiscoveryImportModal, { global: { stubs: { ElDialog: DialogStub } } })
        ;(wrapper.vm as unknown as { open: () => void }).open()
        await flushPromises()
        const branch = wrapper.find('[data-testid="discovery-no-snapshot"]')
        expect(branch.exists()).toBe(true)
        expect(branch.text()).toContain('暂无可用的扫描快照')
        expect(branch.text()).toContain('引用扫描')
        const trigger = wrapper.find('[data-testid="discovery-trigger-scan-placeholder"]')
        expect(trigger.exists()).toBe(true)
        expect(trigger.attributes('disabled')).toBeDefined()
        expect(wrapper.find('[data-testid="discovery-error"]').exists()).toBe(false)
        // 占位分支提供重新检查入口（重试预览）
        previewApi.mockResolvedValueOnce(makePreview() as never)
        await wrapper.find('[data-testid="discovery-reload"]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-testid="discovery-group"]').exists()).toBe(true)
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
