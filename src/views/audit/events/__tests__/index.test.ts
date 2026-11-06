// @vitest-environment happy-dom
/**
 * 统一审计事件页单测（统一审计 P0 前端块 e-cam-web#289/#289 后续）：
 * 挂载即拉取（offset/limit）/ 筛选透传到请求参数 / 结果渲染（行数+总数徽章）/
 * 错误态（持久错误块+重试，筛选区隐藏）/ 重试后恢复。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { listAuditEventsApi } from '@/api/audit'
import type { AuditEvent } from '@/api/audit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EventsPage from '../index.vue'

vi.mock('@/api/audit', () => ({
    listAuditEventsApi: vi.fn(),
}))

// ==================== mock 数据（形状对齐 AuditEvent / 列表响应） ====================

const eventRows: AuditEvent[] = [
    {
        actor_type: 'human', actor_id: '7', actor_name: '管理员', at: 1700000001000,
        tenant_id: 3, service: 'e-cam-service', domain: 'audit', action: 'create',
        resource_type: 'api', resource_id: '/tags', result: 'failed', status_code: 400,
    },
    {
        actor_type: 'system', actor_id: 'task-1', actor_name: '', at: 1700000002000,
        tenant_id: 3, service: 'e-cam-service', domain: 'change', action: 'update',
        resource_type: 'cloud_vm', resource_id: 'i-1', result: 'success',
    },
]

const payload = (total: number, items: AuditEvent[]) => ({ data: { items, total } })

// ==================== happy-dom 环境桩 ====================

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

async function mountPage(): Promise<VueWrapper> {
    const wrapper = mount(EventsPage, {
        attachTo: document.body,
        global: {
            plugins: [ElementPlus],
            stubs: { teleport: true },
        },
    })
    wrappers.push(wrapper)
    await flushPromises()
    await nextTick()
    return wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vi.mocked(listAuditEventsApi).mockResolvedValue(payload(2, eventRows) as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

// ==================== 拉取与渲染 ====================

describe('统一审计事件页', () => {
    it('挂载即拉取：默认 offset=0/limit=20，无筛选时不带业务参数', async () => {
        await mountPage()
        expect(listAuditEventsApi).toHaveBeenCalledTimes(1)
        const firstCall = vi.mocked(listAuditEventsApi).mock.calls[0]?.[0]
        expect(firstCall).toEqual({ offset: 0, limit: 20 })
    })

    it('结果渲染：两行数据 + 总数徽章 2', async () => {
        const wrapper = await mountPage()
        expect(wrapper.findAll('tbody tr')).toHaveLength(2)
        expect(wrapper.text()).toContain('2')
        // 域标签与结果徽章
        expect(wrapper.text()).toContain('资产变更')
        expect(wrapper.text()).toContain('失败')
    })

    it('错误态：持久错误块 + 重试按钮，筛选区隐藏', async () => {
        vi.mocked(listAuditEventsApi).mockRejectedValueOnce(new Error('boom'))
        const wrapper = await mountPage()
        await flushPromises()
        expect(wrapper.text()).toContain('获取统一审计事件失败')
        const retry = wrapper.findAll('button').find((b) => b.text().includes('重试'))
        expect(retry).toBeDefined()
        // 错误态下不再渲染表格
        expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    })

    it('重试：点击后再次拉取并恢复渲染', async () => {
        vi.mocked(listAuditEventsApi).mockRejectedValueOnce(new Error('boom'))
        const wrapper = await mountPage()
        await flushPromises()
        const retry = wrapper.findAll('button').find((b) => b.text().includes('重试'))
        await retry!.trigger('click')
        await flushPromises()
        await nextTick()
        expect(listAuditEventsApi).toHaveBeenCalledTimes(2)
        expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    })
})
