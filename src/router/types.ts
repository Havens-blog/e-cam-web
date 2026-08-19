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
        /**
         * 证书管理域只读拦截（任务 6.1）：true = 只读查看者不可直接访问，
         * 由全局前置守卫拦截提示并回退 /certs/dashboard。
         * 前端拦截仅为体验层，接口由 EIAM 同步拦截（后端 RequireRoles）。
         */
        certManageOnly?: boolean
    }
}

export { }

