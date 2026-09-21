/**
 * CommandPalette 数据源（ui-unify-phase2-components 任务 6）。
 *
 * 路由菜单条目直接从 `@/router/routes` 配置派生（单一事实来源，
 * 新增模块路由自动进入面板），不复制 MainLayout 的菜单配置。
 */
import type { RouteRecordRaw } from 'vue-router'
import type { PalettePageEntry } from './types'

/**
 * 判断路由记录是否可作为面板页面条目。
 *
 * 收敛规则：
 * - 必须声明 `meta.title`（面板展示名）
 * - 必须是承载页面的记录（有 component）；redirect 中转记录跳过
 * - `meta.hideInMenu: true` 的辅助页（详情/实例等）跳过
 * - 兜底 404（pathMatch 通配）跳过
 */
function isPaletteEntry(route: RouteRecordRaw): boolean {
    const meta = route.meta as { title?: string; hideInMenu?: boolean } | undefined
    if (!meta?.title) return false
    if (meta.hideInMenu) return false
    if (!('component' in route) || !route.component) return false
    if (typeof route.path === 'string' && route.path.includes(':pathMatch')) return false
    return true
}

/**
 * 递归展开路由配置为扁平页面条目（深度优先，保持配置声明顺序）。
 *
 * @param routes 路由记录数组（来自 `@/router/routes` 的默认导出）
 * @returns 面板页面条目列表（path + meta.title）
 */
export function flattenRouteEntries(routes: readonly RouteRecordRaw[]): PalettePageEntry[] {
    const entries: PalettePageEntry[] = []
    for (const route of routes) {
        const meta = route.meta as { title?: string } | undefined
        if (isPaletteEntry(route) && meta?.title) {
            entries.push({ path: route.path, title: meta.title })
        }
        if (route.children?.length) {
            entries.push(...flattenRouteEntries(route.children))
        }
    }
    return entries
}
