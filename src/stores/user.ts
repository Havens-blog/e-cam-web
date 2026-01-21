import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 用户信息接口
 */
export interface UserInfo {
    id: string
    username: string
    email?: string
    avatar?: string
    roles?: string[]
    permissions?: string[]
}

/**
 * 用户状态管理
 */
export const useUserStore = defineStore(
    'user',
    () => {
        // 状态
        const token = ref<string>('')
        const userInfo = ref<UserInfo | null>(null)
        const isLoggedIn = ref(false)

        /**
         * 设置 Token
         */
        const setToken = (newToken: string) => {
            token.value = newToken
            isLoggedIn.value = !!newToken
            if (newToken) {
                localStorage.setItem('token', newToken)
            } else {
                localStorage.removeItem('token')
            }
        }

        /**
         * 设置用户信息
         */
        const setUserInfo = (info: UserInfo | null) => {
            userInfo.value = info
        }

        /**
         * 登录
         */
        const login = (newToken: string, info: UserInfo) => {
            setToken(newToken)
            setUserInfo(info)
        }

        /**
         * 登出
         */
        const logout = () => {
            setToken('')
            setUserInfo(null)
            isLoggedIn.value = false
        }

        /**
         * 初始化用户状态
         */
        const initUserState = () => {
            const savedToken = localStorage.getItem('token')
            if (savedToken) {
                setToken(savedToken)
            }
        }

        /**
         * 检查权限
         */
        const hasPermission = (permission: string): boolean => {
            if (!userInfo.value?.permissions) {
                return false
            }
            return userInfo.value.permissions.includes(permission)
        }

        /**
         * 检查角色
         */
        const hasRole = (role: string): boolean => {
            if (!userInfo.value?.roles) {
                return false
            }
            return userInfo.value.roles.includes(role)
        }

        return {
            // 状态
            token,
            userInfo,
            isLoggedIn,
            // 方法
            setToken,
            setUserInfo,
            login,
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
