import axios, { type AxiosInstance } from 'axios'
import { getEcmdbToken } from '@/utils/cookie'
import { markErrorNotified } from './index'
import { normalizeRequestError, redirectToLogin } from './index'

/**
 * eiam 统一身份服务专用 axios 实例。
 * 经 nginx: /api/iam/* -> eiam :9000 /api/*
 *
 * withCredentials: cookie 会话；请求拦截从 cookie 注入 Bearer；
 * 响应拦截 401 跳登录（redirectToLogin 不清共享 cookie，见 ./index.ts 注释）。
 */
export const eiamAxios: AxiosInstance = axios.create({
    timeout: 15000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
})

eiamAxios.interceptors.request.use((config) => {
    const token = getEcmdbToken()
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

eiamAxios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // 与主实例一致：只有真正弹过「登录状态已失效」才标记为已提示
            const notified = redirectToLogin()
            if (notified) markErrorNotified(error)
        }
        // 失败归一同主实例（Option A）：eiam 侧消费方（如 switchTenant）此前拿到的是
        // axios 泛化文案（"Request failed with status code 4xx"），归一后为服务端原因。
        return Promise.reject(normalizeRequestError(error))
    }
)
