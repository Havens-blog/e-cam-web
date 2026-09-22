// @vitest-environment happy-dom
/**
 * resource/tag 标签管理页筛选回归单测（fix-bug）：
 * 复现并守卫「TagFilters v-model 对 const reactive 常量重新赋值」的运行时 bug——
 * 标签页搜索/筛选一旦触发 update:modelValue 即抛 TypeError，导致 filters 不更新、
 * 搜索失效。修复前本用例应失败，修复（v-model → :model-value + Object.assign）后通过。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import {
    getTagStatsApi,
    listPoliciesApi,
    listRulesApi,
    listTagsApi,
} from '@/api/tag'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import TagPage from '../index.vue'
import TagFilters from '../components/TagFilters.vue'

vi.mock('@/api/tag', () => ({
    getTagStatsApi: vi.fn(),
    listPoliciesApi: vi.fn(),
    listRulesApi: vi.fn(),
    listTagsApi: vi.fn(),
}))

// ==================== happy-dom 环境桩 ====================

/** el-table 的 key-render-helper 依赖 MutationObserver（happy-dom 跨 realm 崩溃） */
class NoopMutationObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): MutationRecord[] {
        return []
    }
}

/** el-select/谐振组件宽度观测（happy-dom 无实现） */
class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

/** 本文件所有挂载实例（afterEach 统一卸载） */
const wrappers: VueWrapper[] = []

async function mountPage(): Promise<{ wrapper: VueWrapper }> {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    const wrapper = mount(TagPage, {
        attachTo: document.body,
        global: {
            plugins: [router, ElementPlus],
            stubs: {
                teleport: true,
                // 与待测契约无关的重型子组件全部打桩，聚焦 TagFilters 的 v-model 链路
                TagBatchDialog: true,
                TagBindDialog: true,
                TagPolicyPanel: true,
                TagResourceDrawer: true,
                TagRulePanel2: true,
                StatCard: true,
            },
        },
    })
    wrappers.push(wrapper)
    // 页面 onMounted 触发 loadTags/loadStats/loadPolicyCount/loadRuleCount 四路异步
    await flushPromises()
    return { wrapper }
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vi.mocked(getTagStatsApi).mockResolvedValue({
        data: { total_keys: 1, total_values: 2, tagged_resources: 3, total_resources: 4, coverage_percent: 75 },
    } as never)
    vi.mocked(listPoliciesApi).mockResolvedValue({ data: { total: 0 } } as never)
    vi.mocked(listRulesApi).mockResolvedValue({ data: { total: 0 } } as never)
    vi.mocked(listTagsApi).mockResolvedValue({ data: { items: [], total: 0 } } as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.documentElement.classList.remove('dark', 'light')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('resource/tag 标签页筛选 v-model 契约', () => {
    it('bug: 子组件 update:modelValue 更新 filters 后，搜索应携带新筛选条件', async () => {
        const { wrapper } = await mountPage()
        // 清掉 onMounted 的初始 loadTags，只观察本轮触发
        vi.mocked(listTagsApi).mockClear()

        const filters = wrapper.findComponent(TagFilters)
        // 复刻子组件 handleChange/handleSearchInput 的两次 emit 顺序：
        // 先 update:modelValue（驱动父级 v-model 处理器），再 search
        filters.vm.$emit('update:modelValue', { keyword: 'prod', provider: 'aws', resource_type: 'ecs' })
        filters.vm.$emit('search')
        await flushPromises()

        expect(listTagsApi).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'prod', value: 'prod', provider: 'aws', resource_type: 'ecs' }),
        )
    })
})