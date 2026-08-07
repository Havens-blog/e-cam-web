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
                if (body?.code !== 0) {
                    // 三条失败路径都只向调用方返回 false，而调用方（路由守卫）会据此
                    // 跳登录页。本 store 无自动化测试覆盖（node 环境无法导入），
                    // 控制台是唯一的可观测手段，故三处必须各自留痕、可区分。
                    console.warn('[user] eiam profile 返回非成功信封', {
                        code: body?.code,
                        msg: body?.msg,
                    })
                    return false
                }

                const mapped = mapEiamProfile(body.data)
                if (!mapped) {
                    console.warn('[user] eiam profile 载荷无法解析，已按未登录处理')
                    return false
                }

                setUserInfo(mapped.userInfo)
                permissions.value = mapped.permissions
                tenants.value = mapped.tenants
                currentTenantId.value = mapped.currentTenantId
                isAdmin.value = mapped.isAdmin
                mustSelectTenant.value = mapped.mustSelectTenant
                return true
            } catch (err) {
                // 网络失败 / 超时 / 非 2xx 都落到这里，与上面两条业务失败区分开
                console.warn('[user] 请求 eiam profile 失败', err)
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
            // key 从 'cam-user' 提升为 v2：本任务把 store 的 ref 从 3 个增至 7 个，
            // 旧 blob 带 isLoggedIn:true 复原后会让路由守卫跳过 profile 拉取（见下方说明）
            key: 'cam-user-v2',
            storage: localStorage,
            // 只持久化 userInfo（仅为冷启动时即时渲染用户名）。
            // 授权派生字段 permissions / isAdmin / tenants / currentTenantId /
            // mustSelectTenant 一律不落盘：它们必须每次从 eiam 取，
            // 否则用户可编辑 localStorage 伪造 isAdmin，且撤权无法生效。
            pick: ['userInfo'],
        },
    }
)
