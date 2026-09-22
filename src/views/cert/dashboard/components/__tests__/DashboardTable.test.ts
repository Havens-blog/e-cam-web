// @vitest-environment happy-dom
/**
 * DashboardTable 组件用例（dashboard-cert-granularity 任务 2）：
 * - row-key=certId（同域两证不串行，Hard Rule：行 key 必须证书 ID）；
 * - 「查看全部」开关状态机（风险维度卡激活强制开启并禁用、清除恢复原态）；
 * - 开关态 localStorage 持久化（cert.dashboard.hiddenExpanded，刷新保留）；
 * - 云筛选选项由当前可见行派生（隐藏态不含孤儿所属云）；
 * - 空态「查看全部」入口保留（非静默吞行）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { ElButton, ElEmpty, ElOption, ElSelect, ElSwitch, ElTable, ElTableColumn, ElTooltip } from 'element-plus'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardItem } from '@/api/cert'
import { DASHBOARD_HIDDEN_EXPANDED_KEY } from '../../format'
import DashboardTable from '../DashboardTable.vue'

// el-table 的 key-render-helper 依赖 MutationObserver（happy-dom 跨 realm 崩溃，沿 assets 先例）
class NoopMutationObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
        return []
    }
}
vi.stubGlobal('MutationObserver', NoopMutationObserver)

function cert(over: Partial<DashboardItem>): DashboardItem {
    return {
        certId: 'cert-1',
        fingerprint: 'aa112233445566778899aabbccddeeff',
        commonName: 'a.example.com',
        sans: ['a.example.com'],
        issuer: "Let's Encrypt R3",
        daysLeft: 45,
        level: 'gt30',
        hostingType: 'complete',
        referenceStatus: 'has_refs',
        referencedClouds: [],
        probeStatus: '',
        lastProbeAt: null,
        onlineFingerprint: '',
        lastScanAt: null,
        hidden: false,
        ...over,
    }
}

const EMPTY_FILTER = { level: '' as const, clouds: [] as string[], hosting: '' as const, special: '' as const }

function mountTable(over: {
    rows?: DashboardItem[]
    items?: DashboardItem[]
    filter?: typeof EMPTY_FILTER
    hiddenCount?: number
}) {
    return mount(DashboardTable, {
        props: {
            rows: over.rows ?? [],
            items: over.items ?? over.rows ?? [],
            filter: over.filter ?? EMPTY_FILTER,
            disabled: false,
            hiddenCount: over.hiddenCount ?? 0,
            lastInspectionAt: null,
            wildcardSkippedCount: 0,
        },
        global: {
            components: { ElTable, ElTableColumn, ElSelect, ElOption, ElSwitch, ElTooltip, ElEmpty, ElButton },
        },
    })
}

afterEach(() => {
    window.localStorage.clear()
})

describe('DashboardTable（row-key=certId，同域两证不串行）', () => {
    it('同域两证各成一行且数据不串行（域名粒度时代旧行为：仅最新证独占一行）', async () => {
        const oldCert = cert({ certId: 'cert-old', commonName: 'app.example.com', sans: ['app.example.com'], daysLeft: -9, level: 'expired', issuer: 'Old CA' })
        const newCert = cert({ certId: 'cert-new', commonName: 'app.example.com', sans: ['app.example.com'], daysLeft: 60, issuer: 'New CA' })
        const wrapper = mountTable({ rows: [oldCert, newCert] })
        await flushPromises()
        await nextTick()
        const trs = wrapper.findAll('.el-table__row')
        expect(trs).toHaveLength(2)
        // 两行数据各自成立（不互相掩盖/串行）：CN 相同、签发者与到期分属两行
        const text = wrapper.text()
        expect(text).toContain('Old CA')
        expect(text).toContain('New CA')
    })
})

describe('DashboardTable（云筛选选项由当前可见行派生）', () => {
    it('隐藏态：hidden 行（孤儿）所属云不入选项；可见行云保留', () => {
        const orphan = cert({ certId: 'orphan', commonName: 'orphan.example.com', daysLeft: -9, level: 'expired', referenceStatus: 'no_refs_scanned', referencedClouds: ['huawei'], hidden: true })
        const v1 = cert({ certId: 'v1', referencedClouds: ['aliyun'] })
        const v2 = cert({ certId: 'v2', referencedClouds: ['tencent'] })
        const wrapper = mountTable({ rows: [orphan, v1, v2], items: [orphan, v1, v2] })
        const vm = wrapper.vm as unknown as { cloudOptions: string[] }
        expect(vm.cloudOptions).toEqual(['aliyun', 'tencent'])
    })

    it('全可见态：选项为全部行云去重排序', () => {
        const a = cert({ certId: 'a', referencedClouds: ['tencent'] })
        const b = cert({ certId: 'b', referencedClouds: ['aliyun'] })
        const wrapper = mountTable({ rows: [a, b], items: [a, b] })
        expect((wrapper.vm as unknown as { cloudOptions: string[] }).cloudOptions).toEqual(['aliyun', 'tencent'])
    })
})

describe('DashboardTable（「查看全部」开关状态机 + localStorage 持久化）', () => {
    it('默认态：开关关、可用；挂载即上抛 show-all-change=false（豁免接线初始值）', () => {
        const wrapper = mountTable({ rows: [cert({})], hiddenCount: 2 })
        const sw = wrapper.findComponent(ElSwitch)
        expect(sw.props('modelValue')).toBe(false)
        expect(sw.props('disabled')).toBe(false)
        expect(wrapper.emitted('show-all-change')).toEqual([[false]])
        // 横幅可见且计数驱动（非静默吞行）
        expect(wrapper.find('.hidden-banner').text()).toContain('已隐藏 2 张')
    })

    it('hiddenCount=0 且未展开 → 无横幅（无「已隐藏 0 张」噪音）', () => {
        const wrapper = mountTable({ rows: [cert({})], hiddenCount: 0 })
        expect(wrapper.find('.hidden-banner').exists()).toBe(false)
    })

    it('分级卡激活（filter.level）：强制开启 + 禁用 + 上抛 true（includeHidden 重拉接线）', async () => {
        const wrapper = mountTable({ rows: [cert({})], hiddenCount: 2 })
        wrapper.emitted('show-all-change')
        await wrapper.setProps({ filter: { ...EMPTY_FILTER, level: 'expired' } })
        const sw = wrapper.findComponent(ElSwitch)
        expect(sw.props('modelValue')).toBe(true)
        expect(sw.props('disabled')).toBe(true)
        expect(wrapper.emitted('show-all-change')).toEqual([[false], [true]])
    })

    it('特殊卡激活（special=diff）同样强制豁免；清除筛选恢复原开关态（false）', async () => {
        const wrapper = mountTable({ rows: [cert({})], hiddenCount: 2 })
        await wrapper.setProps({ filter: { ...EMPTY_FILTER, special: 'diff' } })
        expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(true)
        await wrapper.setProps({ filter: { ...EMPTY_FILTER } })
        expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(false)
        expect(wrapper.findComponent(ElSwitch).props('disabled')).toBe(false)
        expect(wrapper.emitted('show-all-change')).toEqual([[false], [true], [false]])
    })

    it('用户开关 → 上抛变化并持久化 localStorage（刷新保留）', async () => {
        const wrapper = mountTable({ rows: [cert({})], hiddenCount: 2 })
        wrapper.emitted('show-all-change')
        await wrapper.findComponent(ElSwitch).find('.el-switch__core').trigger('click')
        await flushPromises()
        expect(window.localStorage.getItem(DASHBOARD_HIDDEN_EXPANDED_KEY)).toBe('1')
        expect(wrapper.emitted('show-all-change')).toEqual([[false], [true]])

        // 再关：清除持久化（回默认隐藏）
        await wrapper.findComponent(ElSwitch).find('.el-switch__core').trigger('click')
        await flushPromises()
        expect(window.localStorage.getItem(DASHBOARD_HIDDEN_EXPANDED_KEY)).toBeNull()
        expect(wrapper.emitted('show-all-change')).toEqual([[false], [true], [false]])
    })

    it('预置持久化态=开 → 挂载即开启（对账工作流刷新不丢）', () => {
        window.localStorage.setItem(DASHBOARD_HIDDEN_EXPANDED_KEY, '1')
        const wrapper = mountTable({ rows: [cert({})], hiddenCount: 0 })
        expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(true)
        expect(wrapper.emitted('show-all-change')).toEqual([[true]])
    })
})

describe('DashboardTable（空态「查看全部」入口保留，非静默吞行）', () => {
    it('全部隐藏时空态提示 + CTA；点击即展开（上抛 true + 持久化）', async () => {
        const wrapper = mountTable({ rows: [], hiddenCount: 3 })
        expect(wrapper.find('.el-empty').exists()).toBe(true)
        const cta = wrapper.find('.show-all-cta')
        expect(cta.text()).toContain('查看全部证书')
        expect(cta.text()).toContain('3')
        await cta.trigger('click')
        await flushPromises()
        expect(wrapper.emitted('show-all-change')).toEqual([[false], [true]])
        expect(window.localStorage.getItem(DASHBOARD_HIDDEN_EXPANDED_KEY)).toBe('1')
    })

    it('无隐藏时空态无 CTA（不误导）', () => {
        const wrapper = mountTable({ rows: [], hiddenCount: 0 })
        expect(wrapper.find('.show-all-cta').exists()).toBe(false)
    })
})
