import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 主题类型
 */
export type Theme = 'light' | 'dark' | 'auto'

/**
 * 语言类型
 */
export type Language = 'zh-CN' | 'en-US'

/**
 * 租户信息
 */
export interface TenantInfo {
    id: string
    name: string
    displayName?: string
}

/**
 * 应用配置状态管理
 */
export const useAppStore = defineStore(
    'app',
    () => {
        // 状态
        const theme = ref<Theme>('dark')
        const language = ref<Language>('zh-CN')
        const sidebarCollapsed = ref(false)
        const loading = ref(false)
        const pageTitle = ref('CAM 多云资产管理')

        // 租户状态
        const currentTenantId = ref<string>('default')
        const currentTenant = ref<TenantInfo | null>(null)

        /**
         * 获取系统主题偏好
         */
        const getSystemTheme = (): 'light' | 'dark' => {
            if (typeof window !== 'undefined' && window.matchMedia) {
                return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
            }
            return 'dark'
        }

        /**
         * 应用主题到 DOM
         */
        const applyTheme = (themeValue: 'light' | 'dark') => {
            const root = document.documentElement
            console.log('Apply theme:', themeValue)
            if (themeValue === 'light') {
                root.classList.add('light')
                root.classList.remove('dark')
            } else {
                root.classList.add('dark')
                root.classList.remove('light')
            }
        }

        /**
         * 设置主题
         */
        const setTheme = (newTheme: Theme) => {
            theme.value = newTheme

            if (newTheme === 'auto') {
                applyTheme(getSystemTheme())
            } else {
                applyTheme(newTheme)
            }
        }

        /**
         * 切换主题 (在 light 和 dark 之间切换)
         */
        const toggleTheme = () => {
            const currentTheme = theme.value === 'auto' ? getSystemTheme() : theme.value
            const newTheme = currentTheme === 'light' ? 'dark' : 'light'
            console.log('Toggle theme:', currentTheme, '->', newTheme)
            setTheme(newTheme)
        }

        /**
         * 获取当前实际应用的主题
         */
        const getActiveTheme = (): 'light' | 'dark' => {
            if (theme.value === 'auto') {
                return getSystemTheme()
            }
            return theme.value
        }

        /**
         * 设置语言
         */
        const setLanguage = (newLanguage: Language) => {
            language.value = newLanguage
            // 这里可以集成 i18n
        }

        /**
         * 设置侧边栏折叠状态
         */
        const setSidebarCollapsed = (collapsed: boolean) => {
            sidebarCollapsed.value = collapsed
        }

        /**
         * 切换侧边栏折叠状态
         */
        const toggleSidebar = () => {
            sidebarCollapsed.value = !sidebarCollapsed.value
        }

        /**
         * 设置全局加载状态
         */
        const setLoading = (value: boolean) => {
            loading.value = value
        }

        /**
         * 设置页面标题
         */
        const setPageTitle = (title: string) => {
            pageTitle.value = title
            document.title = `${title} - CAM 多云资产管理`
        }

        /**
         * 初始化应用状态
         */
        const initAppState = () => {
            // 应用保存的主题
            setTheme(theme.value)

            // 同步租户ID到localStorage（供请求拦截器使用）
            if (currentTenantId.value) {
                localStorage.setItem('tenantId', currentTenantId.value)
            }

            // 监听系统主题变化 (仅当设置为 auto 时)
            if (typeof window !== 'undefined' && window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                    if (theme.value === 'auto') {
                        applyTheme(e.matches ? 'dark' : 'light')
                    }
                })
            }
        }

        /**
         * 设置当前租户
         */
        const setCurrentTenant = (tenant: TenantInfo | null) => {
            currentTenant.value = tenant
            currentTenantId.value = tenant?.id || 'default'
            // 同步到 localStorage 供请求拦截器使用
            localStorage.setItem('tenantId', currentTenantId.value)
        }

        /**
         * 设置当前租户ID
         */
        const setCurrentTenantId = (tenantId: string) => {
            currentTenantId.value = tenantId
            localStorage.setItem('tenantId', tenantId)
        }

        return {
            // 状态
            theme,
            language,
            sidebarCollapsed,
            loading,
            pageTitle,
            currentTenantId,
            currentTenant,
            // 方法
            setTheme,
            toggleTheme,
            getActiveTheme,
            setLanguage,
            setSidebarCollapsed,
            toggleSidebar,
            setLoading,
            setPageTitle,
            initAppState,
            setCurrentTenant,
            setCurrentTenantId,
        }
    },
    {
        persist: {
            key: 'cam-app',
            storage: localStorage,
        },
    }
)
