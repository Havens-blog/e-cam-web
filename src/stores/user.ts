import { redirectToLogin } from '@/api/request/index'
import { getEcmdbToken, removeEcmdbToken } from '@/utils/cookie'
import axios from 'axios'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 用户信息接口（与 ecmdb 用户模型对齐）
 */
export interface UserInfo {
    id: number
    username: string
    displayName?: string
    email?: string
    title?: string
    departmentId?: number
    roleCodes?: string[]
    createType?: number
}

/**
 * ecmdb 专用 axios 实例
 */
const ecmdbAxios = axios.create({
    timeout: 15000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

// 请求拦截：注入 ecmdb session token（从 cookie 读取）
ecmdbAxios.interceptors.request.use((config) => {
    const token = getEcmdbToken()
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// 响应拦截：401 跳转登录
ecmdbAxios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            redirectToLogin()
        }
        return Promise.reject(error)
    }
)

/**
 * ecmdb 统一鉴权下的用户状态管理
 */
export const useUserStore = defineStore(
    'user',
    () => {
        const userInfo = ref<UserInfo | null>(null)
        const isLoggedIn = ref(false)
        const permissions = ref<string[]>([])

        const setUserInfo = (info: UserInfo | null) => {
            userInfo.value = info
            isLoggedIn.value = !!info
        }

        /**
         * 从 ecmdb 获取当前登录用户信息
         */
        const fetchUserInfo = async (): Promise<boolean> => {
            try {
                const res = await ecmdbAxios.post('/api/cmdb/user/info')
                const data = res.data
                if (data.code === 0 && data.data) {
                    setUserInfo(data.data as UserInfo)
                    return true
                }
                return false
            } catch {
                return false
            }
        }

        /**
         * 获取用户权限菜单（从 ecmdb 的权限系统）
         */
        const fetchPermissions = async () => {
            try {
                const res = await ecmdbAxios.post('/api/cmdb/permission/get_user_menu')
                const data = res.data
                if (data.code === 0 && data.data) {
                    permissions.value = data.data.menus || []
                }
            } catch {
                permissions.value = []
            }
        }

        /**
         * 登出
         */
        const logout = async () => {
            try {
                await ecmdbAxios.post('/api/cmdb/user/logout')
            } catch {
                // 即使登出接口失败也清理本地状态
            }
            setUserInfo(null)
            permissions.value = []
            removeEcmdbToken()
            const loginUrl = import.meta.env.VITE_ECMDB_LOGIN_URL || '/login'
            window.location.href = loginUrl
        }

        const initUserState = async () => {
            const success = await fetchUserInfo()
            if (success) {
                await fetchPermissions()
            }
        }

        const hasPermission = (permission: string): boolean => {
            return permissions.value.includes(permission)
        }

        const hasRole = (role: string): boolean => {
            return userInfo.value?.roleCodes?.includes(role) ?? false
        }

        return {
            userInfo,
            isLoggedIn,
            permissions,
            setUserInfo,
            fetchUserInfo,
            fetchPermissions,
            logout,
            initUserState,
            hasPermission,
            hasRole,
        }
    },
    {
        persist: {
            key: 'cam-user',
            storage: localStorage,
        },
    }
)
