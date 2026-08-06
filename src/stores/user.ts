import { redirectToLogin } from '@/api/request/index'
import { getEcmdbToken, removeEcmdbToken } from '@/utils/cookie'
import axios from 'axios'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mapEiamProfile } from './user-mapper'
import type { EiamTenant, UserInfo } from './user-mapper'

export type { UserInfo } from './user-mapper'

/**
 * eiam 统一身份服务专用 axios 实例。
 * 经 nginx: /api/iam/* -> eiam :9000 /api/*
 */
const eiamAxios = axios.create({
    timeout: 15000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

// 请求拦截：注入 session token（从 cookie 读取）
eiamAxios.interceptors.request.use((config) => {
    const token = getEcmdbToken()
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// 响应拦截：401 跳转登录
eiamAxios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            redirectToLogin()
        }
        return Promise.reject(error)
    }
)

/**
 * eiam 统一鉴权下的用户状态管理
 */
export const useUserStore = defineStore(
    'user',
    () => {
        const userInfo = ref<UserInfo | null>(null)
        const isLoggedIn = ref(false)
        const permissions = ref<string[]>([])
        const tenants = ref<EiamTenant[]>([])
        const currentTenantId = ref<number>(0)
        const isAdmin = ref(false)
        const mustSelectTenant = ref(false)

        const setUserInfo = (info: UserInfo | null) => {
            userInfo.value = info
            isLoggedIn.value = !!info
        }

        const resetState = () => {
            setUserInfo(null)
            permissions.value = []
            tenants.value = []
            currentTenantId.value = 0
            isAdmin.value = false
            mustSelectTenant.value = false
        }

        /**
         * 从 eiam 获取当前登录用户信息。
         * eiam 的 profile 同时返回权限码与租户上下文，故一次请求即可，
         * 无需再单独调权限菜单接口。
         */
        const fetchUserInfo = async (): Promise<boolean> => {
            try {
                const res = await eiamAxios.get('/api/iam/user/profile')
                const body = res.data
                // eiam 使用 ginx 信封：{code, msg, data}，成功时 code === 0
                if (body?.code !== 0) return false

                const mapped = mapEiamProfile(body.data)
                if (!mapped) return false

                setUserInfo(mapped.userInfo)
                permissions.value = mapped.permissions
                tenants.value = mapped.tenants
                currentTenantId.value = mapped.currentTenantId
                isAdmin.value = mapped.isAdmin
                mustSelectTenant.value = mapped.mustSelectTenant
                return true
            } catch {
                return false
            }
        }

        /**
         * 登出：通知 eiam 销毁会话，再清理本地状态与 cookie。
         * 这是唯一应当主动清除共享凭证的路径。
         */
        const logout = async () => {
            try {
                await eiamAxios.post('/api/iam/user/logout')
            } catch {
                // 即使登出接口失败也清理本地状态
            }
            resetState()
            removeEcmdbToken()
            const loginUrl = import.meta.env.VITE_ECMDB_LOGIN_URL || '/login'
            window.location.href = loginUrl
        }

        const initUserState = async () => {
            await fetchUserInfo()
        }

        const hasPermission = (permission: string): boolean => {
            return permissions.value.includes(permission)
        }

        return {
            userInfo,
            isLoggedIn,
            permissions,
            tenants,
            currentTenantId,
            isAdmin,
            mustSelectTenant,
            setUserInfo,
            fetchUserInfo,
            logout,
            initUserState,
            hasPermission,
        }
    },
    {
        persist: {
            key: 'cam-user',
            storage: localStorage,
        },
    }
)
