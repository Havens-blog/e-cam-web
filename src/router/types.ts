import type { RouteMeta as VueRouteMeta } from 'vue-router'

/**
 * 扩展路由元信息类型
 */
declare module 'vue-router' {
    interface RouteMeta {
        /** 页面标题 */
        title?: string
        /** 图标名称 */
        icon?: string
        /** 是否在菜单中隐藏 */
        hideInMenu?: boolean
        /** 是否需要认证 */
        requiresAuth?: boolean
        /** 权限标识 */
        permissions?: string[]
    }
}

export { }

