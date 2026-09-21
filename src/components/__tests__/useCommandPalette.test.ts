// @vitest-environment happy-dom
/**
 * CommandPalette 键盘导航状态机单测（ui-unify-phase2-components 任务 6）：
 * 导航状态机收敛在 useCommandPalette composable 内，本文件只测状态机本身——
 * 开关（⌘K/Ctrl+K 唤起、Esc 关闭）、↑↓ 循环移动、Enter 执行、query 过滤、
 * 分组排序（最近访问/页面/动作/资产）、以及候选列表变化时 activeIndex 收敛。
 */
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { PALETTE_GROUP_LABELS, type PaletteItem } from '../CommandPalette/types'
import { useCommandPalette } from '../CommandPalette/useCommandPalette'

/** 构造面板条目辅助：默认可过滤（API 结果用 filterable: false） */
function makeItem(overrides: Partial<PaletteItem> & Pick<PaletteItem, 'id' | 'group' | 'title'>): PaletteItem {
    return {
        filterable: true,
        run: vi.fn(),
        ...overrides
    } as PaletteItem
}

/** 快捷键事件构造辅助 */
function keyEvent(
    key: string,
    mods: { metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean } = {}
): KeyboardEvent {
    return new KeyboardEvent('keydown', { key, bubbles: true, ...mods })
}

describe('useCommandPalette 开关状态', () => {
    it('初始状态：关闭、query 为空、activeIndex 为 0', () => {
        const palette = useCommandPalette({ items: () => [] })
        expect(palette.isOpen.value).toBe(false)
        expect(palette.query.value).toBe('')
        expect(palette.activeIndex.value).toBe(0)
    })

    it('open/close/toggle 正确翻转 isOpen', () => {
        const palette = useCommandPalette({ items: () => [] })
        palette.open()
        expect(palette.isOpen.value).toBe(true)
        palette.close()
        expect(palette.isOpen.value).toBe(false)
        palette.toggle()
        expect(palette.isOpen.value).toBe(true)
        palette.toggle()
        expect(palette.isOpen.value).toBe(false)
    })

    it('open 重置 query 与 activeIndex（重新唤起不残留上次输入）', () => {
        const items = [makeItem({ id: 'p1', group: 'pages', title: '仪表盘' })]
        const palette = useCommandPalette({ items: () => items })
        palette.open()
        palette.query.value = '主机'
        palette.activeIndex.value = 5
        palette.close()
        palette.open()
        expect(palette.query.value).toBe('')
        expect(palette.activeIndex.value).toBe(0)
    })

    it('Ctrl+K / Meta+K 全局键切换开关并 preventDefault', () => {
        const palette = useCommandPalette({ items: () => [] })
        const ctrlK = keyEvent('k', { ctrlKey: true })
        const spy = vi.spyOn(ctrlK, 'preventDefault')
        palette.handleGlobalKeydown(ctrlK)
        expect(palette.isOpen.value).toBe(true)
        expect(spy).toHaveBeenCalled()

        const metaK = keyEvent('K', { metaKey: true })
        palette.handleGlobalKeydown(metaK)
        expect(palette.isOpen.value).toBe(false)
    })

    it('非 ⌘K 组合不触发：无修饰键的 k、Ctrl+其它键、Alt+K', () => {
        const palette = useCommandPalette({ items: () => [] })
        palette.handleGlobalKeydown(keyEvent('k'))
        palette.handleGlobalKeydown(keyEvent('Enter', { ctrlKey: true }))
        palette.handleGlobalKeydown(keyEvent('k', { altKey: true }))
        expect(palette.isOpen.value).toBe(false)
    })

    it('Esc 关闭打开中的面板', () => {
        const palette = useCommandPalette({ items: () => [] })
        palette.open()
        palette.handlePaletteKeydown(keyEvent('Escape'))
        expect(palette.isOpen.value).toBe(false)
    })

    it('关闭状态下 Esc 无副作用（保持关闭）', () => {
        const palette = useCommandPalette({ items: () => [] })
        palette.handlePaletteKeydown(keyEvent('Escape'))
        expect(palette.isOpen.value).toBe(false)
    })
})

describe('useCommandPalette 键盘导航', () => {
    const items = () => [
        makeItem({ id: 'a', group: 'pages', title: '仪表盘' }),
        makeItem({ id: 'b', group: 'pages', title: '资源拓扑' }),
        makeItem({ id: 'c', group: 'actions', title: '切换主题' })
    ]

    it('ArrowDown 顺序下移，到末尾循环回首项', () => {
        const palette = useCommandPalette({ items })
        palette.open()
        expect(palette.activeIndex.value).toBe(0)
        palette.handlePaletteKeydown(keyEvent('ArrowDown'))
        expect(palette.activeIndex.value).toBe(1)
        palette.handlePaletteKeydown(keyEvent('ArrowDown'))
        expect(palette.activeIndex.value).toBe(2)
        palette.handlePaletteKeydown(keyEvent('ArrowDown'))
        expect(palette.activeIndex.value).toBe(0)
    })

    it('ArrowUp 逆序上移，到首位循环回末项', () => {
        const palette = useCommandPalette({ items })
        palette.open()
        palette.handlePaletteKeydown(keyEvent('ArrowUp'))
        expect(palette.activeIndex.value).toBe(2)
        palette.handlePaletteKeydown(keyEvent('ArrowUp'))
        expect(palette.activeIndex.value).toBe(1)
    })

    it('Enter 执行当前高亮项并回调 onSelect', () => {
        const onSelect = vi.fn()
        const list = items()
        const palette = useCommandPalette({ items: () => list, onSelect })
        palette.open()
        palette.setActiveIndex(2)
        palette.handlePaletteKeydown(keyEvent('Enter'))
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith(list[2])
    })

    it('空候选列表时 Enter 不回调、↑↓ 不出错', () => {
        const onSelect = vi.fn()
        const palette = useCommandPalette({ items: () => [], onSelect })
        palette.open()
        palette.handlePaletteKeydown(keyEvent('ArrowDown'))
        palette.handlePaletteKeydown(keyEvent('ArrowUp'))
        palette.handlePaletteKeydown(keyEvent('Enter'))
        expect(onSelect).not.toHaveBeenCalled()
        expect(palette.activeIndex.value).toBe(0)
    })

    it('其余按键不改变状态（如字母输入交给 v-model）', () => {
        const palette = useCommandPalette({ items })
        palette.open()
        palette.handlePaletteKeydown(keyEvent('a'))
        expect(palette.activeIndex.value).toBe(0)
        expect(palette.isOpen.value).toBe(true)
    })
})

describe('useCommandPalette query 过滤与分组', () => {
    function fixtureItems(): PaletteItem[] {
        return [
            makeItem({ id: 'page-host', group: 'pages', title: '虚拟机', subtitle: '/compute/ecs' }),
            makeItem({ id: 'page-dash', group: 'pages', title: '仪表盘', subtitle: '/dashboard' }),
            makeItem({ id: 'act-theme', group: 'actions', title: '切换主题' }),
            makeItem({ id: 'recent-dash', group: 'recent', title: '仪表盘', subtitle: '/dashboard', path: '/dashboard' }),
            makeItem({ id: 'asset-1', group: 'assets', title: 'iZ8vb123', filterable: false })
        ]
    }

    it('空 query：展示 recent/pages/actions，排除 assets 组（资产只在有输入时出现）', () => {
        const palette = useCommandPalette({ items: fixtureItems })
        expect(palette.filteredItems.value.map((i) => i.id)).toEqual([
            'recent-dash',
            'page-host',
            'page-dash',
            'act-theme'
        ])
    })

    it('分组顺序固定：最近访问 → 页面 → 动作 → 资产（输入后）', () => {
        const palette = useCommandPalette({ items: fixtureItems })
        // 'd' 命中 recent（仪表盘 /dashboard）与 pages（仪表盘），资产直通
        palette.query.value = 'd'
        const groups = palette.filteredItems.value.map((i) => i.group)
        const order = [...new Set(groups)]
        expect(order).toEqual(['recent', 'pages', 'assets'])
    })

    it('按 title 关键词过滤（大小写不敏感）', () => {
        const palette = useCommandPalette({ items: fixtureItems })
        palette.query.value = '仪表'
        // 资产条目 filterable=false 直通（服务端已按关键词过滤）
        expect(palette.filteredItems.value.map((i) => i.id)).toEqual([
            'recent-dash',
            'page-dash',
            'asset-1'
        ])
    })

    it('按 path（subtitle）关键词过滤', () => {
        const palette = useCommandPalette({ items: fixtureItems })
        palette.query.value = '/compute'
        expect(palette.filteredItems.value.map((i) => i.id)).toEqual(['page-host', 'asset-1'])
    })

    it('filterable: false 的条目（API 已过滤的资产结果）不被 query 二次过滤', () => {
        const palette = useCommandPalette({ items: fixtureItems })
        palette.query.value = '完全不相关的词'
        expect(palette.filteredItems.value.map((i) => i.id)).toEqual(['asset-1'])
    })

    it('分组标签映射齐备且稳定', () => {
        expect(PALETTE_GROUP_LABELS.recent).toBe('最近访问')
        expect(PALETTE_GROUP_LABELS.pages).toBe('页面')
        expect(PALETTE_GROUP_LABELS.actions).toBe('动作')
        expect(PALETTE_GROUP_LABELS.assets).toBe('资产')
    })

    it('groupedItems 按组聚合且只含有条目的组', () => {
        const palette = useCommandPalette({ items: fixtureItems })
        const groups = palette.groupedItems.value
        expect(groups.map((g) => g.group)).toEqual(['recent', 'pages', 'actions'])
        const pages = groups.find((g) => g.group === 'pages')
        expect(pages?.items.map((i) => i.id)).toEqual(['page-host', 'page-dash'])
    })
})

describe('useCommandPalette 候选变化收敛', () => {
    it('过滤后列表缩短时 activeIndex 收敛到末项，不悬空', async () => {
        const items = ref<PaletteItem[]>([
            makeItem({ id: 'a', group: 'pages', title: 'A' }),
            makeItem({ id: 'b', group: 'pages', title: 'B' }),
            makeItem({ id: 'c', group: 'pages', title: 'C' })
        ])
        const palette = useCommandPalette({ items })
        palette.open()
        palette.setActiveIndex(2)
        items.value = items.value.slice(0, 1)
        await nextTick()
        expect(palette.filteredItems.value).toHaveLength(1)
        expect(palette.activeIndex.value).toBe(0)
    })

    it('items 响应式：ref 源变化后 filteredItems 跟随', async () => {
        const items = ref<PaletteItem[]>([makeItem({ id: 'a', group: 'pages', title: 'A' })])
        const palette = useCommandPalette({ items })
        expect(palette.filteredItems.value.map((i) => i.id)).toEqual(['a'])
        items.value = [makeItem({ id: 'b', group: 'actions', title: 'B' })]
        await nextTick()
        expect(palette.filteredItems.value.map((i) => i.id)).toEqual(['b'])
    })

    it('activeItem 返回当前高亮条目；列表为空时为 undefined', () => {
        const list = [makeItem({ id: 'a', group: 'pages', title: 'A' })]
        const palette = useCommandPalette({ items: () => list })
        palette.open()
        expect(palette.activeItem.value?.id).toBe('a')
        palette.query.value = '无匹配'
        expect(palette.activeItem.value).toBeUndefined()
    })
})
