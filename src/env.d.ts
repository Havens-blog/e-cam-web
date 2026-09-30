/// <reference types="vite/client" />

/**
 * 声明 .vue 文件模块
 */
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

/**
 * 环境变量类型定义
 */
interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
    readonly VITE_APP_TITLE: string
    readonly VITE_USE_MOCK: string
    readonly VITE_PORT: string
    /** 登录目标（401/登出/「重新登录」跳转的登录页），默认 /console/login（RC#2） */
    readonly VITE_LOGIN_TARGET: string
    /** ecmdb-web 站点基址（「个人设置」跳转用，过渡期指向 ecmdb-web 根，RC#2） */
    readonly VITE_ECMDB_WEB_BASE: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
