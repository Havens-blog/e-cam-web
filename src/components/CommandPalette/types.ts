/**
 * CommandPalette 类型定义（ui-unify-phase2-components 任务 6）。
 *
 * 面板条目统一为 PaletteItem：页面（路由跳转）/ 动作（回调执行）/
 * 资产（搜索结果直达详情）/ 最近访问（pinia 持久化记录）四类，
 * 键盘导航状态机只面向扁平化后的 PaletteItem 列表工作。
 */

/** 面板条目分组；展示与导航顺序由 PALETTE_GROUP_ORDER 固定 */
export type PaletteGroup = 'recent' | 'pages' | 'actions' | 'assets'

/** 分组固定顺序：最近访问 → 页面 → 动作 → 资产 */
export const PALETTE_GROUP_ORDER: readonly PaletteGroup[] = ['recent', 'pages', 'actions', 'assets'] as const

/** 分组展示标签（结果列表的组标题文案） */
export const PALETTE_GROUP_LABELS: Readonly<Record<PaletteGroup, string>> = {
    recent: '最近访问',
    pages: '页面',
    actions: '动作',
    assets: '资产'
} as const

/**
 * 面板单个可执行条目。
 *
 * 键盘导航与渲染只消费该结构；`run` 承载副作用（路由跳转 / 动作回调），
 * `path` 非空表示这是一次"跳转"，组件会将其写入最近访问记录。
 */
export interface PaletteItem {
    /** 稳定唯一标识（渲染 key 与高亮定位用） */
    id: string
    /** 所属分组（决定展示区块与排序） */
    group: PaletteGroup
    /** 主标题（过滤的主要匹配字段） */
    title: string
    /** 副标题（如路由路径、资产 ID 等；参与过滤但不参与排序） */
    subtitle?: string
    /**
     * 关联的路由路径；非空时执行后会被记入最近访问。
     * 页面条目为跳转目标路径，资产条目为 `/assets/:id` 详情路径，动作条目不设置。
     */
    path?: string
    /**
     * 是否参与本地关键词过滤。
     * 页面/动作/最近访问为 true（按 title/subtitle 包含匹配）；
     * 资产结果为 false（服务端已按关键词过滤，本地不再二次过滤）。
     */
    filterable: boolean
    /** 执行回调（路由跳转或动作逻辑），由组件在 Enter / 点击时调用 */
    run: () => void
}

/**
 * 可注册的命令动作（动作注册/执行 API 的载荷）。
 * 内置动作（如"切换主题"）与外部注册动作同构，合并后统一进动作组。
 */
export interface CommandAction {
    /** 动作唯一标识（与内置动作去重） */
    id: string
    /** 动作展示名（面板过滤匹配字段） */
    title: string
    /** 执行回调 */
    run: () => void
}

/** 路由配置派生的页面入口（sources.flattenRouteEntries 的产物） */
export interface PalettePageEntry {
    /** 跳转路径（vue-router path，如 /compute/ecs） */
    path: string
    /** 页面标题（来自 route meta.title） */
    title: string
}

/** 资产搜索防抖等待（与 MainLayout 旧搜索的 300ms 契约一致） */
export const ASSET_SEARCH_DEBOUNCE_MS = 300

/** 资产搜索返回条数上限（与 MainLayout 旧搜索契约一致） */
export const ASSET_SEARCH_LIMIT = 10

/** 最近访问最大保留条数（超出按"频次/时间"排序淘汰末位） */
export const MAX_RECENT_VISITS = 8
