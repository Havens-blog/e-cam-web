// @vitest-environment happy-dom
/**
 * alert/events 告警事件等价重写单测（ui-unify-phase3-pilot-pages 任务 4）：
 * 旧页用户路径盘点全保留（页头总数徽章 / 三筛选下拉 / 刷新 / expand 详情行 /
 * 七列结构 / 状态徽章语义色 / 分页 / 30s 轮询），PageContainer + DataTable
 * 组件化骨架（fetch 模式三态由组件内置承载），规格增强（密度切换），
 * scoped 样式 <100 行，以及「零新增硬编码颜色字面量」Hard Rule 守卫
 * （页面色字面量 ⊆ 旧页基线）。
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElPagination, ElTable } from 'element-plus'
import { listEventsApi } from '@/api/alert'
import type { AlertEvent } from '@/api/alert'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import EventsPage from '../index.vue'

vi.mock('@/api/alert', () => ({
    listEventsApi: vi.fn(),
}))

// ==================== mock 数据（形状对齐 AlertEvent / 列表响应） ====================

const eventRows: AlertEvent[] = [
    {
        id: 1,
        rule_id: 11,
        type: 'resource_change',
        severity: 'critical',
        title: '实例停止事件',
        content: { instance_id: 'i-aaa111', action: 'stop' },
        source: 'monitor-core',
        status: 'sent',
        retry_count: 0,
        create_time: '2026-09-20T10:00:00Z',
        sent_at: '2026-09-20T10:00:05Z',
    },
    {
        id: 2,
        rule_id: 12,
        type: 'sync_failure',
        severity: 'warning',
        title: '账号同步失败',
        content: { provider: 'aws', reason: 'timeout' },
        source: 'sync-worker',
        status: 'failed',
        retry_count: 3,
        create_time: '2026-09-19T08:30:00Z',
        sent_at: '',
    },
    {
        id: 3,
        rule_id: 13,
        type: 'expiration',
        severity: 'info',
        title: '证书即将过期',
        content: { domain: 'example.com' },
        source: 'certd',
        status: 'pending',
        retry_count: 0,
        create_time: '',
        sent_at: '',
    },
    {
        id: 4,
        rule_id: 14,
        type: 'security_group',
        severity: 'critical',
        title: '安全组规则变更',
        content: { group_id: 'sg-1' },
        source: 'sg-audit',
        status: 'silenced',
        retry_count: 1,
        create_time: '2026-09-18T21:10:00Z',
        sent_at: '',
    },
]

const eventsPayload = { data: { items: eventRows, total: 42 } }

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

/** el-select 内部自建宽度观测（happy-dom 无实现） */
class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

/** 本文件所有挂载实例（afterEach 统一卸载） */
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
    // el-table 列注册是异步的：flush 后再断言
    await flushPromises()
    await nextTick()
    return wrapper
}

const buttonWithText = (wrapper: VueWrapper, text: string) =>
    wrapper.findAll('button').find((button) => button.text().includes(text))

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('MutationObserver', NoopMutationObserver)
    vi.stubGlobal('ResizeObserver', NoopResizeObserver)
    vi.mocked(listEventsApi).mockResolvedValue(eventsPayload as never)
})

afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.documentElement.classList.remove('dark', 'light')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

// ==================== AC1：旧页用户路径盘点全保留 ====================

describe('AC1 页面骨架与页头（旧页路径 1）', () => {
    it('PageContainer 骨架 + 页头标题 + 总数徽章', async () => {
        const wrapper = await mountPage()
        expect(wrapper.find('.page-container').exists()).toBe(true)
        expect(wrapper.find('.page-container__header').exists()).toBe(true)
        expect(wrapper.find('.page-container__filters').exists()).toBe(true)
        expect(wrapper.find('.page-container__body').exists()).toBe(true)
        expect(wrapper.find('.page-container__footer').exists()).toBe(true)
        expect(wrapper.find('.page-title').text()).toBe('告警事件')
        expect(wrapper.find('.stat-label').text()).toBe('总数')
        expect(wrapper.find('.stat-num').text()).toBe('42')
    })
})

describe('AC1 查询条件与刷新（旧页路径 2-3）', () => {
    it('三个筛选下拉：placeholder/clearable/size 与旧页一致，选项清单等价（源码盘点）', async () => {
        const wrapper = await mountPage()
        const selects = wrapper.findAllComponents({ name: 'ElSelect' })
        expect(selects).toHaveLength(3)
        const placeholders = selects.map((select) => select.find('.el-select__placeholder').text())
        expect(placeholders).toEqual(['全部类型', '全部级别', '全部状态'])
        expect(selects.every((select) => select.props('clearable'))).toBe(true)
        expect(selects.every((select) => select.props('size') === 'small')).toBe(true)

        // 下拉面板为懒渲染（未展开时选项不在组件树中），选项清单以源码盘点断言；
        // 选项取值的功能等价由筛选 change 参数断言覆盖
        const raw = (await import('../index.vue?raw')).default
        const typeBlock = raw.match(/placeholder="全部类型"[\s\S]*?<\/el-select>/)![0]!
        expect(typeBlock).toContain('资源变更')
        expect(typeBlock).toContain('resource_change')
        expect(typeBlock).toContain('同步失败')
        expect(typeBlock).toContain('sync_failure')
        expect(typeBlock).toContain('资源过期')
        expect(typeBlock).toContain('expiration')
        expect(typeBlock).toContain('安全组变更')
        expect(typeBlock).toContain('security_group')

        const severityBlock = raw.match(/placeholder="全部级别"[\s\S]*?<\/el-select>/)![0]!
        expect(severityBlock).toContain('信息')
        expect(severityBlock).toContain('info')
        expect(severityBlock).toContain('警告')
        expect(severityBlock).toContain('warning')
        expect(severityBlock).toContain('严重')
        expect(severityBlock).toContain('critical')

        const statusBlock = raw.match(/placeholder="全部状态"[\s\S]*?<\/el-select>/)![0]!
        expect(statusBlock).toContain('待发送')
        expect(statusBlock).toContain('pending')
        expect(statusBlock).toContain('已发送')
        expect(statusBlock).toContain('sent')
        expect(statusBlock).toContain('发送失败')
        expect(statusBlock).toContain('failed')
        expect(statusBlock).toContain('已静默')
        expect(statusBlock).toContain('silenced')
    })

    it('刷新按钮（circle + title）点击重拉当前页', async () => {
        const wrapper = await mountPage()
        vi.mocked(listEventsApi).mockClear()
        const refreshButton = wrapper.find('button[title="刷新"]')
        expect(refreshButton.exists()).toBe(true)
        await refreshButton.trigger('click')
        await flushPromises()
        expect(listEventsApi).toHaveBeenCalledTimes(1)
        expect(listEventsApi).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, limit: 20 }))
    })

    it('类型筛选 change 后以新参数重拉；等价旧页：翻页后变更筛选不回第 1 页', async () => {
        const wrapper = await mountPage()
        const typeSelect = wrapper.findAllComponents({ name: 'ElSelect' })[0]!
        typeSelect.vm.$emit('update:modelValue', 'resource_change')
        typeSelect.vm.$emit('change', 'resource_change')
        await flushPromises()
        expect(listEventsApi).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'resource_change', offset: 0, limit: 20 }),
        )

        // 旧页等价：@change=fetchData 只按当前 page 重拉，不重置页码
        const pagination = wrapper.findComponent(ElPagination)
        pagination.vm.$emit('update:current-page', 2)
        pagination.vm.$emit('current-change', 2)
        await flushPromises()
        vi.mocked(listEventsApi).mockClear()
        typeSelect.vm.$emit('update:modelValue', 'sync_failure')
        typeSelect.vm.$emit('change', 'sync_failure')
        await flushPromises()
        expect(listEventsApi).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: 'sync_failure', offset: 20, limit: 20 }),
        )
    })

    it('级别与状态筛选 change 后以对应参数重拉', async () => {
        const wrapper = await mountPage()
        const selects = wrapper.findAllComponents({ name: 'ElSelect' })
        selects[1]!.vm.$emit('update:modelValue', 'critical')
        selects[1]!.vm.$emit('change', 'critical')
        selects[2]!.vm.$emit('update:modelValue', 'failed')
        selects[2]!.vm.$emit('change', 'failed')
        await flushPromises()
        expect(listEventsApi).toHaveBeenLastCalledWith(
            expect.objectContaining({ severity: 'critical', status: 'failed', offset: 0, limit: 20 }),
        )
    })
})

describe('AC1 列结构与行渲染（旧页路径 4-5）', () => {
    it('七个列表头顺序等价，首列为展开列', async () => {
        const wrapper = await mountPage()
        const headerCells = wrapper.findAll('.el-table__header th .cell').map((node) => node.text())
        expect(headerCells).toEqual(['', '标题', '类型', '级别', '状态', '来源', '时间'])
    })

    it('行渲染等价：标题/类型映射/级别映射/状态映射/来源/时间格式（空时间回退 -）', async () => {
        const wrapper = await mountPage()
        const rows = wrapper.findAll('.el-table__body tbody tr')
        expect(rows).toHaveLength(4)
        expect(rows[0]!.text()).toContain('实例停止事件')
        expect(rows[0]!.text()).toContain('资源变更')
        expect(rows[0]!.text()).toContain('严重')
        expect(rows[0]!.text()).toContain('已发送')
        expect(rows[0]!.text()).toContain('monitor-core')
        expect(rows[0]!.text()).toContain(new Date('2026-09-20T10:00:00Z').toLocaleString('zh-CN'))
        expect(rows[1]!.text()).toContain('同步失败')
        expect(rows[1]!.text()).toContain('警告')
        expect(rows[1]!.text()).toContain('发送失败')
        expect(rows[2]!.text()).toContain('资源过期')
        expect(rows[2]!.text()).toContain('待发送')
        expect(rows[2]!.text()).toContain('certd')
        expect(rows[2]!.text()).toContain('-')
        expect(rows[3]!.text()).toContain('安全组变更')
        expect(rows[3]!.text()).toContain('已静默')
    })

    it('语义状态徽章：级别/状态 el-tag type 语义映射（danger/warning/success/info）', async () => {
        const wrapper = await mountPage()
        const rows = wrapper.findAll('.el-table__body tbody tr')
        // 行 1：severity critical → danger；status sent → success
        expect(rows[0]!.find('.el-tag--danger').exists()).toBe(true)
        expect(rows[0]!.find('.el-tag--success').exists()).toBe(true)
        // 行 2：severity warning → warning；status failed → danger
        expect(rows[1]!.find('.el-tag--warning').exists()).toBe(true)
        expect(rows[1]!.find('.el-tag--danger').exists()).toBe(true)
        // 行 3：severity info / status pending → info
        expect(rows[2]!.find('.el-tag--info').exists()).toBe(true)
        // 行 4：status silenced → warning
        expect(rows[3]!.find('.el-tag--warning').exists()).toBe(true)
    })

    it('展开行显示事件 JSON 详情（等价旧页 expand 列）', async () => {
        const wrapper = await mountPage()
        // 未展开时无展开单元格（hidden-columns 里的插槽种子不计，单测无样式表不隐藏）
        expect(wrapper.find('.el-table__expanded-cell .event-content').exists()).toBe(false)

        await wrapper.findAll('.el-table__expand-icon')[0]!.trigger('click')
        await flushPromises()
        await nextTick()
        const pre = wrapper.find('.el-table__expanded-cell .event-content')
        expect(pre.exists()).toBe(true)
        expect(pre.text()).toBe(JSON.stringify(eventRows[0]!.content, null, 2))
    })
})

describe('AC1 分页与轮询（旧页路径 6-7）', () => {
    it('分页等价：total/prev/pager/next 布局、page-size 20、翻页重拉 offset', async () => {
        const wrapper = await mountPage()
        const pagination = wrapper.findComponent(ElPagination)
        expect(pagination.props('pageSize')).toBe(20)
        expect(pagination.props('total')).toBe(42)
        expect(pagination.props('layout')).toBe('total, prev, pager, next')
        expect(wrapper.find('.el-pagination__total').text()).toContain('42')
        expect(wrapper.find('button.btn-prev').exists()).toBe(true)
        expect(wrapper.find('button.btn-next').exists()).toBe(true)

        pagination.vm.$emit('update:current-page', 2)
        pagination.vm.$emit('current-change', 2)
        await flushPromises()
        expect(listEventsApi).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20, limit: 20 }))
    })

    it('挂载后启动 30s 轮询，卸载时清除（等价旧页 pollTimer）', async () => {
        const setIntervalSpy = vi.spyOn(window, 'setInterval')
        const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
        const wrapper = await mountPage()
        expect(setIntervalSpy).toHaveBeenCalledTimes(1)
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)
        wrapper.unmount()
        const index = wrappers.indexOf(wrapper)
        if (index >= 0) wrappers.splice(index, 1)
        expect(clearIntervalSpy).toHaveBeenCalled()
    })
})

// ==================== AC1/实现说明：三态由 DataTable 内置承载 ====================

describe('DataTable 三态（组件内置承载，规格错误场景）', () => {
    it('拉取失败呈现错误态（错误信息 + 重试），恢复后重试成功渲染行', async () => {
        vi.mocked(listEventsApi).mockRejectedValueOnce(new Error('boom') as never)
        const wrapper = await mountPage()
        expect(wrapper.find('[role="alert"]').exists()).toBe(true)
        expect(wrapper.find('[role="alert"]').text()).toContain('boom')
        expect(wrapper.find('.state-block__retry').exists()).toBe(true)

        await wrapper.find('.state-block__retry').trigger('click')
        await flushPromises()
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        expect(wrapper.findAll('.el-table__body tbody tr')).toHaveLength(4)
    })

    it('空数据呈现空态文案「暂无数据」且不渲染表格行（规格：空态为验收点）', async () => {
        vi.mocked(listEventsApi).mockResolvedValue({ data: { items: [], total: 0 } } as never)
        const wrapper = await mountPage()
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        expect(wrapper.text()).toContain('暂无数据')
        expect(wrapper.findAll('.el-table__body tbody tr')).toHaveLength(0)
        expect(wrapper.find('.stat-num').text()).toBe('0')
    })

    it('首屏拉取中呈现骨架屏（等价旧页 v-loading 反馈）', async () => {
        vi.mocked(listEventsApi).mockImplementation(() => new Promise(() => {}) as never)
        const wrapper = await mountPage()
        expect(wrapper.find('.el-skeleton').exists()).toBe(true)
    })
})

// ==================== AC2：规格指定增强 ====================

describe('AC2 密度切换（规格增强）', () => {
    it('密度切换：默认 → 紧凑透传 el-table size=small', async () => {
        const wrapper = await mountPage()
        const table = wrapper.findComponent(ElTable)
        expect(table.props('size')).toBe('default')
        await buttonWithText(wrapper, '紧凑')!.trigger('click')
        expect(table.props('size')).toBe('small')
        await buttonWithText(wrapper, '默认')!.trigger('click')
        expect(table.props('size')).toBe('default')
    })
})

// ==================== AC3：scoped 样式与硬编码色守卫 ====================

describe('AC3 scoped 样式 <100 行 + 零新增硬编码色', () => {
    it('style 块行数 <100 且只消费令牌（布局微调）', async () => {
        const raw = (await import('../index.vue?raw')).default
        const match = raw.match(/<style[^>]*>([\s\S]*?)<\/style>/)
        expect(match).toBeTruthy()
        const styleBody = match![1]!
        expect(styleBody.split('\n').length).toBeLessThan(100)
        expect(styleBody).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
        expect(styleBody).not.toMatch(/rgba?\(/)
        expect(styleBody).toContain('var(--')
    })

    it('页面色字面量 ⊆ 旧页基线（零新增），且无旧蓝 #3b82f6 系', async () => {
        // 旧版 index.vue（HEAD 基线）全部颜色字面量盘点：仅 var() 兜底里的 #fff
        const OLD_PAGE_COLORS = new Set(['#fff'])
        const raw = (await import('../index.vue?raw')).default
        const colors = (raw.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []).map((color) =>
            color.replace(/\s+/g, '').toLowerCase(),
        )
        const unknown = colors.filter((color) => !OLD_PAGE_COLORS.has(color))
        expect(unknown).toEqual([])
        expect(colors.some((color) => color.includes('3b82f6'))).toBe(false)
    })
})
