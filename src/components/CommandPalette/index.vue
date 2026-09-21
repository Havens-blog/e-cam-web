<template>
  <Teleport to="body">
    <Transition name="command-palette">
      <div v-if="isOpen" class="command-palette__overlay" @mousedown.self="close">
        <div class="command-palette__backdrop" />
        <div class="command-palette" role="dialog" aria-modal="true" aria-label="全局命令面板">
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="command-palette__input"
            placeholder="搜索页面、动作或资产…"
            @keydown="handlePaletteKeydown"
          />
          <div class="command-palette__results">
            <template v-if="groupedItems.length > 0">
              <section
                v-for="group in groupedItems"
                :key="group.group"
                class="command-palette__group"
              >
                <div class="command-palette__group-label">
                  {{ PALETTE_GROUP_LABELS[group.group] }}
                </div>
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="command-palette__item"
                  :class="{ 'is-active': activeItem?.id === item.id }"
                  @mouseenter="setActive(item)"
                  @click="handleSelect(item)"
                >
                  <span class="command-palette__item-title">{{ item.title }}</span>
                  <span v-if="item.subtitle" class="command-palette__item-subtitle">
                    {{ item.subtitle }}
                  </span>
                </button>
              </section>
            </template>
            <div v-else class="command-palette__empty">未找到匹配的页面、动作或资产</div>
            <div v-if="assetLoading" class="command-palette__loading">资产搜索中…</div>
          </div>
          <footer class="command-palette__hints">
            <span>↑↓ 选择</span>
            <span>Enter 执行</span>
            <span>Esc 关闭</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { searchAssetsApi } from '@/api/asset'
import type { SearchResultItem } from '@/api/types/asset'
import { useAppStore } from '@/stores/app'
import { useRecentVisitsStore } from '@/stores/recentVisits'
import routes from '@/router/routes'
import {
  ASSET_SEARCH_DEBOUNCE_MS,
  ASSET_SEARCH_LIMIT,
  PALETTE_GROUP_LABELS,
  type CommandAction,
  type PaletteItem
} from './types'
import { flattenRouteEntries } from './sources'
import { useCommandPalette } from './useCommandPalette'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

/**
 * CommandPalette ⌘K 全局命令面板（ui-unify-phase2-components 任务 6）。
 *
 * 能力：路由菜单关键词过滤跳转（数据源直接派生自 `@/router/routes` 配置）、
 * 动作注册/执行（内置「切换主题」，外部可经 `actions` prop 或 `registerActions`
 * 注册）、最近访问（pinia 持久化，频次/时间排序）、资产快捷搜索（复用
 * searchAssetsApi 与 300ms 防抖契约，结果直达 `/assets/:id` 详情）。
 * 完整键盘导航（⌘K/Ctrl+K 唤起、Esc 关闭、↑↓ 循环移动、Enter 执行），
 * 状态机见 {@link useCommandPalette}；焦点管理为开时捕获输入框、关时归还。
 *
 * 本组件不含全局挂载逻辑：由接入方（MainLayout，Phase 3 任务 7）放置实例；
 * 支持两种开关模式——不传 `visible` 时组件内部自持状态（挂载即具备 ⌘K 唤起），
 * 传入 `visible` 时转为受控模式（v-model:visible，组件 emit 变更）。
 */

interface Props {
  /**
   * 受控开关（v-model:visible）。缺省时组件内部自持开关状态；
   * 传入后组件不再自行变更状态，而是 emit `update:visible` 交由父组件驱动。
   */
  visible?: boolean
  /** 外部注册动作，与内置动作合并进「动作」组（id 重复时先到先得） */
  actions?: CommandAction[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 开关状态变更（仅受控模式携带 visible prop 时发出） */
  'update:visible': [value: boolean]
}>()

const router = useRouter()
const appStore = useAppStore()
const recentStore = useRecentVisitsStore()

// ==================== 动作注册/执行 API ====================

/** 内置动作（至少「切换主题」，走既有 appStore.toggleTheme） */
const builtinActions: CommandAction[] = [
  { id: 'builtin:toggle-theme', title: '切换主题', run: () => appStore.toggleTheme() }
]

/** registerActions 注册的运行时动作 */
const registeredActions = ref<CommandAction[]>([])

/**
 * 注册自定义动作（运行时 API，与 `actions` prop 等效）。
 *
 * @param actions 动作列表（id 重复时先到先得）
 * @returns 反注册函数：调用后移除本批动作
 */
function registerActions(actions: CommandAction[]): () => void {
  registeredActions.value.push(...actions)
  const added = [...actions]
  return () => {
    registeredActions.value = registeredActions.value.filter((action) => !added.includes(action))
  }
}

/** 动作条目：内置 → prop → registerActions 依序合并去重（id 先到先得） */
const actionItems = computed<PaletteItem[]>(() => {
  const merged: CommandAction[] = []
  const seen = new Set<string>()
  for (const action of [...builtinActions, ...(props.actions ?? []), ...registeredActions.value]) {
    if (seen.has(action.id)) continue
    seen.add(action.id)
    merged.push(action)
  }
  return merged.map((action) => ({
    id: `action:${action.id}`,
    group: 'actions',
    title: action.title,
    filterable: true,
    run: action.run
  }))
})

// ==================== 页面条目（数据源：router 配置） ====================

/** 路由配置派生的页面条目（flattenRouteEntries 保持配置声明顺序） */
const pageItems = computed<PaletteItem[]>(() =>
  flattenRouteEntries(routes).map((entry) => ({
    id: `page:${entry.path}`,
    group: 'pages',
    title: entry.title,
    subtitle: entry.path,
    path: entry.path,
    filterable: true,
    run: () => {
      void router.push(entry.path)
    }
  }))
)

// ==================== 最近访问条目 ====================

/** 最近访问条目（store 已按频次/时间排序；同为跳转，执行后继续累计频次） */
const recentItems = computed<PaletteItem[]>(() =>
  recentStore.sortedEntries.map((entry) => ({
    id: `recent:${entry.path}`,
    group: 'recent',
    title: entry.title,
    subtitle: entry.path,
    path: entry.path,
    filterable: true,
    run: () => {
      void router.push(entry.path)
    }
  }))
)

// ==================== 资产快捷搜索（复用 searchAssetsApi 契约） ====================

/** 资产类型展示名（未知类型回退原始值） */
const ASSET_TYPE_LABELS: Record<string, string> = {
  ecs: 'ECS',
  rds: 'RDS',
  redis: 'Redis',
  mongodb: 'MongoDB',
  vpc: 'VPC',
  eip: 'EIP'
}

/** 资产搜索结果（防抖请求回填；清空输入即时清空） */
const assetResults = ref<SearchResultItem[]>([])
/** 资产搜索进行中（结果区尾部轻提示） */
const assetLoading = ref(false)
let searchTimer: number | null = null
/** 请求序号：防抖竞态下只采纳最后一次关键词的响应 */
let searchSeq = 0

onBeforeUnmount(() => {
  if (searchTimer !== null) clearTimeout(searchTimer)
})

/** 资产结果条目（服务端已过滤，本地 filterable=false 直通；直达 /assets/:id 详情） */
const assetItems = computed<PaletteItem[]>(() =>
  assetResults.value.map((item) => ({
    id: `asset:${item.id}`,
    group: 'assets',
    title: item.asset_name,
    subtitle: `${ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type} · ${item.asset_id} · ${item.provider}`,
    path: `/assets/${item.id}`,
    filterable: false,
    run: () => {
      void router.push(`/assets/${item.id}`)
    }
  }))
)

// ==================== 状态机装配 ====================

/**
 * 选中统一入口：执行条目副作用，跳转类条目（path 非空）写入最近访问，
 * 然后关闭面板（动作执行同样收起，保持 Linear 交互习惯）。
 */
function handleSelect(item: PaletteItem): void {
  item.run()
  if (item.path) recentStore.record(item.path, item.title)
  close()
}

/** 候选全集（组间顺序由状态机的 PALETTE_GROUP_ORDER 决定，此处只负责并集） */
const allItems = computed<PaletteItem[]>(() => [
  ...recentItems.value,
  ...pageItems.value,
  ...actionItems.value,
  ...assetItems.value
])

const {
  isOpen,
  query,
  groupedItems,
  filteredItems,
  activeItem,
  open,
  close,
  toggle,
  handleGlobalKeydown,
  handlePaletteKeydown,
  setActiveIndex
} = useCommandPalette({ items: allItems, onSelect: handleSelect })

// ==================== 资产搜索防抖（依赖状态机 query） ====================

watch(
  () => query.value,
  (raw) => {
    if (searchTimer !== null) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    const keyword = raw.trim()
    if (!keyword) {
      searchSeq++
      assetResults.value = []
      assetLoading.value = false
      return
    }
    const seq = ++searchSeq
    searchTimer = window.setTimeout(async () => {
      assetLoading.value = true
      try {
        // 契约与 MainLayout 旧搜索一致：{keyword, limit:10} → res.data.items
        const res = await searchAssetsApi({ keyword, limit: ASSET_SEARCH_LIMIT })
        if (seq !== searchSeq) return
        assetResults.value = res.data?.items ?? []
      } catch {
        // 搜索失败静默降级为无结果，不打断面板键盘流
        if (seq !== searchSeq) return
        assetResults.value = []
      } finally {
        if (seq === searchSeq) assetLoading.value = false
      }
    }, ASSET_SEARCH_DEBOUNCE_MS)
  }
)

/** 鼠标悬停同步高亮（键盘导航可选鼠标介入） */
function setActive(item: PaletteItem): void {
  const index = filteredItems.value.indexOf(item)
  if (index >= 0) setActiveIndex(index)
}

// ==================== 开关受控模式同步 ====================

// visible prop → 状态机（受控模式单向驱动；undefined 表示非受控）
watch(
  () => props.visible,
  (visible) => {
    if (visible === undefined) return
    if (visible && !isOpen.value) open()
    if (!visible && isOpen.value) close()
  },
  { immediate: true }
)

// 状态机 → update:visible（仅受控模式；父组件回流 prop 后两条 watch 自然收敛）
watch(isOpen, (value) => {
  if (props.visible !== undefined && value !== props.visible) {
    emit('update:visible', value)
  }
})

// ==================== 全局快捷键与焦点管理 ====================

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

const inputRef = ref<HTMLInputElement | null>(null)
/** 打开前捕获的焦点元素，关闭时归还 */
let lastActiveElement: HTMLElement | null = null

watch(isOpen, async (value) => {
  if (value) {
    lastActiveElement = document.activeElement as HTMLElement | null
    await nextTick()
    inputRef.value?.focus()
  } else {
    await nextTick()
    if (lastActiveElement && document.contains(lastActiveElement)) {
      lastActiveElement.focus()
    }
    lastActiveElement = null
  }
})

// 高亮条目滚动跟随（键盘长列表导航时保持可见）
watch(
  () => [activeItem.value?.id, isOpen.value] as const,
  async () => {
    await nextTick()
    const el = document.querySelector('.command-palette__item.is-active')
    el?.scrollIntoView?.({ block: 'nearest' })
  }
)

// Enter 执行入口由 handlePaletteKeydown 内部消费（selectActive/toggle 未在模板使用）

defineExpose({
  /** 打开面板（供接入方程序化唤起） */
  open,
  /** 关闭面板 */
  close,
  /** 切换开关 */
  toggle,
  /** 动作注册 API（返回反注册函数） */
  registerActions
})
</script>

<style lang="scss" scoped>
.command-palette__overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.command-palette__backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-base);
  opacity: 0.8;
}

.command-palette {
  position: relative;
  width: 560px;
  max-width: calc(100vw - 32px);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-overlay);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.command-palette__input {
  flex-shrink: 0;
  height: 48px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  outline: none;

  &::placeholder {
    color: var(--text-placeholder);
  }
}

.command-palette__results {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }
}

.command-palette__group-label {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.command-palette__item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  width: 100%;
  padding: 8px 16px;
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 150ms ease;

  &:hover,
  &.is-active {
    background: var(--bg-hover);
  }

  .command-palette__item-title {
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  &.is-active .command-palette__item-title,
  &:hover .command-palette__item-title {
    color: var(--text-primary);
  }

  .command-palette__item-subtitle {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-family: var(--font-mono);
    color: var(--text-tertiary);
    text-align: right;
  }
}

.command-palette__empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

.command-palette__loading {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.command-palette__hints {
  flex-shrink: 0;
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--border-subtle);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}

// 开合动画：淡入 + 轻微上浮
.command-palette-enter-active,
.command-palette-leave-active {
  transition: opacity 150ms ease;

  .command-palette {
    transition: transform 150ms ease;
  }
}

.command-palette-enter-from,
.command-palette-leave-to {
  opacity: 0;

  .command-palette {
    transform: translateY(-8px);
  }
}
</style>
