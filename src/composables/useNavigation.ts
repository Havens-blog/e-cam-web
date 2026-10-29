import type { RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

/**
 * 导航相关的组合式函数
 */
export function useNavigation() {
    const router = useRouter()
    const route = useRoute()

    /**
     * 导航到指定路由
     */
    const navigateTo = (to: RouteLocationRaw) => {
        return router.push(to)
    }

    /**
     * 替换当前路由
     */
    const replaceTo = (to: RouteLocationRaw) => {
        return router.replace(to)
    }

    /**
     * 返回上一页
     */
    const goBack = () => {
        return router.back()
    }

    /**
     * 前进到下一页
     */
    const goForward = () => {
        return router.forward()
    }

    /**
     * 导航到首页
     */
    const goHome = () => {
        return router.push('/')
    }

    /**
     * 导航到多云概览
     */
    const goDashboard = () => {
        return router.push('/dashboard')
    }

    /**
     * 导航到云账号管理
     */
    const goAccounts = () => {
        return router.push('/accounts')
    }

    // 注：/accounts/create 与 /accounts/:id/edit 两条独立路由已随 ui-audit(A-H1/A-H2) 移除
    // （云账号新增/编辑统一由 accounts/index.vue 的对话框承载），故此处不再提供
    // goAccountCreate/goAccountEdit 助手 —— 保留会指向不存在的路由（点击即 404）。

    /**
     * 导航到资产管理
     */
    const goAssets = () => {
        return router.push('/assets')
    }

    /**
     * 导航到资产详情
     */
    const goAssetDetail = (id: string | number) => {
        return router.push(`/assets/${id}`)
    }

    /**
     * 导航到成本分析
     */
    const goCost = () => {
        return router.push('/cost')
    }

    /**
     * 导航到任务管理
     */
    const goTasks = () => {
        return router.push('/tasks')
    }

    /**
     * 导航到任务详情
     */
    const goTaskDetail = (id: string | number) => {
        return router.push(`/tasks/${id}`)
    }

    /**
     * 检查当前路由是否匹配
     */
    const isCurrentRoute = (name: string) => {
        return route.name === name
    }

    /**
     * 检查当前路由路径是否匹配
     */
    const isCurrentPath = (path: string) => {
        return route.path === path
    }

    return {
        router,
        route,
        navigateTo,
        replaceTo,
        goBack,
        goForward,
        goHome,
        goDashboard,
        goAccounts,
        goAssets,
        goAssetDetail,
        goCost,
        goTasks,
        goTaskDetail,
        isCurrentRoute,
        isCurrentPath,
    }
}
