/**
 * CommandPalette 键盘导航状态机（ui-unify-phase2-components 任务 6）。
 *
 * 收敛面板全部交互状态：开关（⌘K/Ctrl+K 唤起、Esc 关闭）、query 过滤、
 * 分组排序（最近访问 → 页面 → 动作 → 资产）、↑↓ 循环移动、Enter 执行。
 * 状态机不接触 DOM——键盘事件处理函数由组件绑定，也便于在 composable
 * 层独立单测（提案 Key Risks 缓解：导航状态机收敛在 composable 内单测）。
 */
import { computed, ref, watch, type ComputedRef, type MaybeRefOrGetter, type Ref, toValue } from 'vue'
import {
    PALETTE_GROUP_ORDER,
    type PaletteGroup,
    type PaletteItem
} from './types'

/** useCommandPalette 可选项 */
export interface UseCommandPaletteOptions {
    /**
     * 候选条目全集（页面/动作/最近访问/资产结果的并集），由组件组装；
     * 支持 ref / getter / 普通数组，内部响应式跟随。
     */
    items: MaybeRefOrGetter<PaletteItem[]>
    /** 选中回调（Enter 执行高亮条目时回调） */
    onSelect?: (item: PaletteItem) => void
}

/** useCommandPalette 对外暴露的状态与操作 */
export interface UseCommandPaletteReturn {
    /** 面板是否打开 */
    isOpen: Ref<boolean>
    /** 搜索关键词（双向绑定到面板输入框） */
    query: Ref<string>
    /** 当前高亮条目在 filteredItems 中的下标 */
    activeIndex: Ref<number>
    /** 过滤 + 分组排序后的扁平条目列表（键盘导航的命中域） */
    filteredItems: ComputedRef<PaletteItem[]>
    /** 按组聚合后的结果区块（模板分组渲染用，只含有条目的组） */
    groupedItems: ComputedRef<{ group: PaletteGroup; items: PaletteItem[] }[]>
    /** 当前高亮条目（空列表时为 undefined） */
    activeItem: ComputedRef<PaletteItem | undefined>
    /** 打开面板（重置 query 与高亮） */
    open: () => void
    /** 关闭面板 */
    close: () => void
    /** 切换开关（⌘K 入口） */
    toggle: () => void
    /** 全局快捷键处理：⌘K / Ctrl+K 唤起切换（绑定在 document 上） */
    handleGlobalKeydown: (event: KeyboardEvent) => void
    /** 面板内键盘处理：Esc 关闭、↑↓ 移动、Enter 执行（绑定在输入框上） */
    handlePaletteKeydown: (event: KeyboardEvent) => void
    /** 直接设置高亮下标（鼠标悬停同步高亮用） */
    setActiveIndex: (index: number) => void
    /** 执行当前高亮条目 */
    selectActive: () => void
}

/**
 * 关键词匹配：title / subtitle 大小写不敏感的包含匹配。
 */
function matchesQuery(item: PaletteItem, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
        item.title.toLowerCase().includes(q) ||
        (item.subtitle ?? '').toLowerCase().includes(q)
    )
}

/**
 * 创建命令面板键盘导航状态机。
 *
 * @param options 候选条目来源与选中回调
 * @returns 状态与操作集合（见 {@link UseCommandPaletteReturn}）
 */
export function useCommandPalette(options: UseCommandPaletteOptions): UseCommandPaletteReturn {
    const isOpen = ref(false)
    const query = ref('')
    const activeIndex = ref(0)

    /**
     * 过滤 + 分组排序后的扁平条目：
     * - 空 query：展示 recent/pages/actions 三组（资产结果仅在主动搜索时出现）
     * - 非 query：filterable 条目按关键词包含匹配，filterable=false（服务端已过滤）直通
     * - 组内保持候选顺序，组间按 PALETTE_GROUP_ORDER 固定排序
     */
    const filteredItems = computed<PaletteItem[]>(() => {
        const all = toValue(options.items)
        const q = query.value.trim().toLowerCase()
        const matched = q
            ? all.filter((item) => (item.filterable ? matchesQuery(item, q) : true))
            : all.filter((item) => item.group !== 'assets')
        return PALETTE_GROUP_ORDER.flatMap((group) => matched.filter((item) => item.group === group))
    })

    /** 按组聚合（只输出有内容的组），模板分组渲染直接消费 */
    const groupedItems = computed<{ group: PaletteGroup; items: PaletteItem[] }[]>(() => {
        const groups: { group: PaletteGroup; items: PaletteItem[] }[] = []
        for (const group of PALETTE_GROUP_ORDER) {
            const items = filteredItems.value.filter((item) => item.group === group)
            if (items.length > 0) groups.push({ group, items })
        }
        return groups
    })

    /** 当前高亮条目；越界或空列表时为 undefined */
    const activeItem = computed<PaletteItem | undefined>(() => filteredItems.value[activeIndex.value])

    // 候选列表缩短（如过滤后变空）时收敛高亮，避免悬空下标
    watch(filteredItems, (list) => {
        if (activeIndex.value >= list.length) {
            activeIndex.value = Math.max(0, list.length - 1)
        }
    })

    /** 打开面板：重置 query 与高亮，保证每次唤起都是干净上下文 */
    function open(): void {
        query.value = ''
        activeIndex.value = 0
        isOpen.value = true
    }

    /** 关闭面板 */
    function close(): void {
        isOpen.value = false
    }

    /** 切换开关状态 */
    function toggle(): void {
        if (isOpen.value) {
            close()
        } else {
            open()
        }
    }

    /**
     * 全局快捷键处理：⌘K（macOS）/ Ctrl+K（Windows）切换面板。
     * Alt 组合与无修饰键的 k 不触发；命中时 preventDefault 阻止浏览器默认行为。
     */
    function handleGlobalKeydown(event: KeyboardEvent): void {
        if (event.altKey) return
        if (!(event.metaKey || event.ctrlKey)) return
        if (event.key.toLowerCase() !== 'k') return
        event.preventDefault()
        toggle()
    }

    /** 高亮下移（循环：末项回到首项） */
    function moveNext(): void {
        const length = filteredItems.value.length
        if (length === 0) return
        activeIndex.value = (activeIndex.value + 1) % length
    }

    /** 高亮上移（循环：首项回到末项） */
    function movePrev(): void {
        const length = filteredItems.value.length
        if (length === 0) return
        activeIndex.value = (activeIndex.value - 1 + length) % length
    }

    /** 设置高亮下标（鼠标悬停同步） */
    function setActiveIndex(index: number): void {
        activeIndex.value = index
    }

    /** 执行当前高亮条目（空列表为安全 no-op） */
    function selectActive(): void {
        const item = filteredItems.value[activeIndex.value]
        if (item) options.onSelect?.(item)
    }

    /**
     * 面板内键盘处理：Esc 关闭、↑↓ 循环移动、Enter 执行；
     * 其余按键不拦截（输入交给 v-model）。
     */
    function handlePaletteKeydown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'Escape':
                event.preventDefault()
                close()
                break
            case 'ArrowDown':
                event.preventDefault()
                moveNext()
                break
            case 'ArrowUp':
                event.preventDefault()
                movePrev()
                break
            case 'Enter':
                event.preventDefault()
                selectActive()
                break
            default:
                break
        }
    }

    return {
        isOpen,
        query,
        activeIndex,
        filteredItems,
        groupedItems,
        activeItem,
        open,
        close,
        toggle,
        handleGlobalKeydown,
        handlePaletteKeydown,
        setActiveIndex,
        selectActive
    }
}
