import axios, { type AxiosInstance } from 'axios'
import { getEcmdbToken } from '@/utils/cookie'
import { redirectToLogin } from './index'

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
            redirectToLogin()
        }
        return Promise.reject(error)
    }
)
