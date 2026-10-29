import { appUrlForPath, redirectToLogin } from '@/api/request/index'
import { useUserStore } from '@/stores/user'
import { getEcmdbToken } from '@/utils/cookie'
import {
    CERT_VIEWER_BLOCKED_MESSAGE,
    CERT_VIEWER_FALLBACK_PATH,
    hasCertManageAccess,
} from '@/utils/cert-permission'
import type { RouteLocationNormalized } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
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
export async function authGuard(to: RouteLocationNormalized) {
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
        // 传目标页而不是当前页：push 尚未生效时 window.location.href 还是旧地址
        redirectToLogin(appUrlForPath(to.fullPath))
        // 用返回值而非 next()：vue-router 依据守卫形参个数（Function.length）决定走返回值还是 next，
    // 若把 next 加回形参（length>=3）却又不调用，会退回 "Invalid navigation guard" 的旧坑。
    // async 守卫若不调用 next 也不返回，vue-router 会报
        // "Invalid navigation guard"（DEV 下 console.error）。返回 false 表示中止本次导航。
        return false
    }

    // 有 token 但还没获取用户信息，尝试获取
    if (!userStore.isLoggedIn) {
        const success = await userStore.fetchUserInfo()
        if (!success) {
            redirectToLogin(appUrlForPath(to.fullPath))
            return false
        }
    }

    // 证书域只读角色拦截（任务 6.1）：只读查看者仅可访问 /certs/dashboard 与
    // /certs/:id；台账/变更管理（含子路由）/配置直接访问时提示并回退到期看板。
    // 前端拦截仅为体验层——接口由 EIAM 在后端同步拦截（Hard Rule：双侧拦截）。
    if (to.meta.certManageOnly && !hasCertManageAccess({
        isAdmin: userStore.isAdmin,
        permissions: userStore.permissions,
    })) {
        ElMessage.warning(CERT_VIEWER_BLOCKED_MESSAGE)
        return CERT_VIEWER_FALLBACK_PATH
    }

    return true
}

router.beforeEach(authGuard)

/**
 * 全局后置钩子
 * 在路由跳转后执行
 */
router.afterEach((_to: RouteLocationNormalized) => {
    // 可以在这里添加页面访问统计等逻辑
})

/**
 * 全局错误处理
 */
router.onError((error) => {
    console.error('[Router] Navigation error:', error)
})

export default router
