// @vitest-environment happy-dom
/**
 * 变更历史页 total=-1 降级分支单测（e-cam-web#292）：
 * 后端对 field_name 筛选的 Count 超时降级返回 total=-1（列表仍有效，#382 契约），
 * 此前 -1 直接进 el-pagination 渲染成「共 -1 条」且页码损坏 —— 现降级态
 * 隐藏数字总数与页码、保留按需翻页 + 提示文案；正常 total 走标准分页。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LiveStatus from '@/components/LiveStatus.vue'
import ElementPlus from 'element-plus'
import { getChangeSummaryApi, listAssetChangesApi } from '@/api/audit'
import type { AssetChange } from '@/api/audit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChangesPage from '../index.vue'

vi.mock('@/api/audit', () => ({
    getChangeSummaryApi: vi.fn(),
    listAssetChangesApi: vi.fn(),
}))

const rows: AssetChange[] = [
    {
        id: 1, asset_id: 'i-1', asset_name: 'web-1', model_uid: 'cloud_vm',
        field_name: 'spec', old_value: '"4c"', new_value: '"8c"', change_source: 'sync_task',
        change_task_id: 't-1', account_id: 1, provider: 'qcloud', region: 'ap-gz', ctime: 1700000000000,
    },
    {
        id: 2, asset_id: 'i-1', asset_name: 'web-1', model_uid: 'cloud_vm',
        field_name: 'note', old_value: 'a', new_value: 'b', change_source: 'manual',
        change_task_id: '', account_id: 1, provider: 'qcloud', region: 'ap-gz', ctime: 1700000001000,
    },
]

class NoopMutationObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
        return []
    }
}

class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

const wrappers: VueWrapper[] = []

async function mountWithAsset(assetId: string): Promise<VueWrapper> {
    const wrapper = mount(ChangesPage, {
        attachTo: document.body,
        global: {
            plugins: [ElementPlus],
            stubs: { teleport: true },
            // iter363：本页在 iter361（PR #352）接入 <LiveStatus>，测试未注册会打
            // Failed to resolve 警告。警告会淹没真实问题（iter354 的 unhandled error 就藏在里面）。
            components: { LiveStatus },
        },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await nextTick()
    // 资产输入框回填 + 回车触发查询
    const input = wrapper.find('.action-bar input')
    await input.setValue(assetId)
    await input.trigger('keyup.enter')
    await flushPromises()
    await nextTick()
    return wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vi.mocked(getChangeSummaryApi).mockResolvedValue({
        data: { total: 0, by_resource_type: {}, by_field: {}, by_provider: {} },
    } as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('变更历史页 total=-1 降级分支', () => {
    it('total=-1：渲染降级提示，不出现「共 -1 条」', async () => {
        vi.mocked(listAssetChangesApi).mockResolvedValue({ data: { items: rows, total: -1 } } as never)
        const wrapper = await mountWithAsset('i-1')
        expect(wrapper.text()).toContain('总数统计超时')
        expect(wrapper.text()).not.toContain('-1 条')
        // 列表仍正常渲染（降级契约：列表有效）
        expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    })

    it('total 正常：标准分页含总数', async () => {
        vi.mocked(listAssetChangesApi).mockResolvedValue({ data: { items: rows, total: 42 } } as never)
        const wrapper = await mountWithAsset('i-1')
        expect(wrapper.text()).toContain('42')
        expect(wrapper.text()).not.toContain('总数统计超时')
        expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    })

    it('统一事件双写：列表查询参数含资产ID与分页', async () => {
        vi.mocked(listAssetChangesApi).mockResolvedValue({ data: { items: rows, total: 42 } } as never)
        await mountWithAsset('i-1')
        expect(vi.mocked(listAssetChangesApi)).toHaveBeenCalledWith('i-1', { offset: 0, limit: 20 })
    })
})
