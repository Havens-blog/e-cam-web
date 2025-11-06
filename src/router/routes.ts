import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由配置
 * 使用懒加载优化首屏加载性能
 */
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/dashboard',
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: {
            title: '多云概览',
            icon: 'Dashboard',
        },
    },
    {
        path: '/accounts',
        name: 'Accounts',
        component: () => import('@/views/accounts/index.vue'),
        meta: {
            title: '云账号管理',
            icon: 'User',
        },
    },
    {
        path: '/accounts/create',
        name: 'AccountCreate',
        component: () => import('@/views/accounts/form.vue'),
        meta: {
            title: '添加云账号',
            icon: 'Plus',
            hideInMenu: true,
        },
    },
    {
        path: '/accounts/:id/edit',
        name: 'AccountEdit',
        component: () => import('@/views/accounts/form.vue'),
        meta: {
            title: '编辑云账号',
            icon: 'Edit',
            hideInMenu: true,
        },
    },
    {
        path: '/assets',
        name: 'Assets',
        component: () => import('@/views/assets/index.vue'),
        meta: {
            title: '资产管理',
            icon: 'Box',
        },
    },
    {
        path: '/assets/:id',
        name: 'AssetDetail',
        component: () => import('@/views/assets/detail.vue'),
        meta: {
            title: '资产详情',
            icon: 'Document',
            hideInMenu: true,
        },
    },
    {
        path: '/cost',
        name: 'Cost',
        component: () => import('@/views/cost/index.vue'),
        meta: {
            title: '成本分析',
            icon: 'TrendCharts',
        },
    },
    {
        path: '/tasks',
        name: 'Tasks',
        component: () => import('@/views/tasks/index.vue'),
        meta: {
            title: '任务管理',
            icon: 'List',
        },
    },
    {
        path: '/tasks/:id',
        name: 'TaskDetail',
        component: () => import('@/views/tasks/detail.vue'),
        meta: {
            title: '任务详情',
            icon: 'Document',
            hideInMenu: true,
        },
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/error/404.vue'),
        meta: {
            title: '页面不存在',
            hideInMenu: true,
        },
    },
]

export default routes
