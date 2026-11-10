// @vitest-environment happy-dom
/**
 * ClusterCredentialCard 单测（iter334 / T13）
 *
 * 为什么用组件单测而不是浏览器验证：
 *   `/cam/certs/settings` 在 admin 会话下实测 `hasCredCard: false` —— 页面停在非渲染分支，
 *   只发 `GET /api/v1/certs/settings`、**从不调用** `k8s-credentials`，注入 GET 也打不中。
 *   该组件此前**没有任何单测**，浏览器路径又不可达，因此改为组件级验证：
 *   mock 掉 API 后直接断言 `ElMessage.success` 的入参，不依赖页面状态。
 *
 * 覆盖点：
 *   ① 列表加载后渲染行与「删除」按钮（可访问名含集群名）
 *   ② 删除成功 → 调用 deleteK8sCredentialApi(name) 且 toast 文案为「删除成功」
 *      （T13 文案统一：三站 21 处纯泛型都用「删除成功」，本组件原为「已删除」）
 *   ③ 删除失败 → 走 showApiError，不弹 success
 */
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
    listCloudAccountsApi: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/cert', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@/api/cert')
    return {
        ...actual,
        listK8sCredentialsApi: vi.fn(),
        deleteK8sCredentialApi: vi.fn(),
        addK8sCredentialApi: vi.fn(),
        fetchK8sCredentialsApi: vi.fn(),
        listAliyunK8sClustersApi: vi.fn(),
        listCertsApi: vi.fn().mockResolvedValue([]),
        triggerCertScanApi: vi.fn(),
    }
})
vi.mock('@/api/request', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@/api/request')
    return { ...actual, showApiError: vi.fn() }
})

import {
    deleteK8sCredentialApi,
    listK8sCredentialsApi,
} from '@/api/cert'
import { showApiError } from '@/api/request'
import ClusterCredentialCard from '../ClusterCredentialCard.vue'

const mockList = vi.mocked(listK8sCredentialsApi)
const mockDelete = vi.mocked(deleteK8sCredentialApi)
const mockShowError = vi.mocked(showApiError)

const ROW = {
    clusterName: 'prod-cluster',
    region: 'cn-hangzhou',
    status: 'registered',
    registeredAt: '2026-11-01T00:00:00Z',
} as never

async function mountCard() {
    const wrapper = mount(ClusterCredentialCard, {
        global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    return wrapper
}

describe('ClusterCredentialCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockList.mockResolvedValue([ROW])
        mockDelete.mockResolvedValue({ deleted: true } as never)
    })
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('加载后渲染凭证行，删除按钮的可访问名包含集群名', async () => {
        const wrapper = await mountCard()
        expect(mockList).toHaveBeenCalled()

        const rows = wrapper.findAll('.cred-table tbody tr')
        expect(rows.length).toBe(1)
        expect(rows[0]!.text()).toContain('prod-cluster')

        // 行内「删除」按钮：可见文案是「删除」，但 aria-label 带集群名（读屏能分辨行）
        const delBtn = wrapper
            .findAll('button')
            .find((b) => (b.attributes('aria-label') || '').includes('prod-cluster'))
        expect(delBtn, '应存在 aria-label 含集群名的删除按钮').toBeTruthy()
        expect(delBtn!.text()).toContain('删除')
    })

    it('无数据时显示空态「尚未登记集群凭证」', async () => {
        mockList.mockResolvedValue([] as never)
        const wrapper = await mountCard()
        expect(wrapper.text()).toContain('尚未登记集群凭证')
    })

    it('删除成功 → 调用 API(clusterName) 且 toast 文案为「删除成功」（T13 统一口径）', async () => {
        const successSpy = vi
            .spyOn(ElMessage, 'success')
            .mockImplementation((() => ({ close: () => {} })) as never)

        const wrapper = await mountCard()

        // 直接调用组件内部的 onDelete（通过 popconfirm 的 confirm 事件更贴近真实路径，
        // 但 happy-dom 下 el-popconfirm 的弹出/确认链条不稳定，这里用 emit 触发同一入口）
        // 组件未 expose onDelete，改为通过 popconfirm 的 confirm 事件触发
        const popconfirm = wrapper.findComponent({ name: 'ElPopconfirm' })
        expect(popconfirm.exists(), '应渲染 el-popconfirm').toBe(true)
        popconfirm.vm.$emit('confirm', new MouseEvent('click'))
        await flushPromises()

        expect(mockDelete).toHaveBeenCalledWith('prod-cluster')
        expect(successSpy).toHaveBeenCalled()
        // 核心断言：文案与全站 21 处主流一致
        expect(successSpy.mock.calls[0]![0]).toBe('删除成功')
    })

    it('删除失败 → 走 showApiError（带「删除失败」兜底文案），不弹 success', async () => {
        const successSpy = vi
            .spyOn(ElMessage, 'success')
            .mockImplementation((() => ({ close: () => {} })) as never)
        mockDelete.mockRejectedValue(new Error('boom') as never)

        const wrapper = await mountCard()
        const popconfirm = wrapper.findComponent({ name: 'ElPopconfirm' })
        popconfirm.vm.$emit('confirm', new MouseEvent('click'))
        await flushPromises()

        expect(mockShowError).toHaveBeenCalled()
        expect(mockShowError.mock.calls[0]![1]).toBe('删除失败')
        expect(successSpy).not.toHaveBeenCalled()
    })
})
