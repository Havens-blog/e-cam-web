import { redirectToLogin } from '@/api/request/index'
import { useUserStore } from '@/stores/user'
import { getEcmdbToken } from '@/utils/cookie'
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import routes from './routes'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL), // 使用 vite.config.ts 中的 base 配置
    routes,
    scrollBehavior(to, _from, savedPosition) {
        // 如果有保存的位置(浏览器前进/后退),则恢复到该位置
        if (savedPosition) {
            return savedPosition
        }
        // 如果有锚点,则滚动到锚点位置
        if (to.hash) {
            return {
                el: to.hash,
                behavior: 'smooth',
            }
        }
        // 否则滚动到页面顶部
        return { top: 0 }
    },
})

/**
 * 全局前置守卫
 * 在路由跳转前执行
 */
router.beforeEach(
    async (
        to: RouteLocationNormalized,
        _from: RouteLocationNormalized,
        next: NavigationGuardNext
    ) => {
        // 设置页面标题
        if (to.meta.title) {
            document.title = `${to.meta.title} - CAM 多云资产管理`
        } else {
            document.title = 'CAM 多云资产管理'
        }

        const userStore = useUserStore()

        // 检查 cookie 中是否有 ecmdb session token
        const hasToken = !!getEcmdbToken()

        if (!hasToken) {
            redirectToLogin()
            return
        }

        // 有 token 但还没获取用户信息，尝试获取
        if (!userStore.isLoggedIn) {
            const success = await userStore.fetchUserInfo()
            if (!success) {
                redirectToLogin()
                return
            }
            await userStore.fetchPermissions()
        }

        next()
    }
)

/**
 * 全局后置钩子
 * 在路由跳转后执行
 */
router.afterEach((to: RouteLocationNormalized) => {
    // 可以在这里添加页面访问统计等逻辑
    console.log(`[Router] Navigated to: ${to.path}`)
})

/**
 * 全局错误处理
 */
router.onError((error) => {
    console.error('[Router] Navigation error:', error)
})

export default router
