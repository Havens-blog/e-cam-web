import { getEcmdbToken } from '@/utils/cookie'
import axios, { type AxiosInstance } from 'axios'
import { redirectToLogin } from './index'

/**
 * 运维 Agent（D:/Haven/opsagent，/api/v1/opsagent）专用 axios 实例。
 *
 * 后端信封为 {code, message, data}，但成功 code 存在两态：多数端点经 web.OK
 * 写 code=0（数字），chat/correct 端点手写 code="0"（字符串）。主实例
 * （./service.ts）的全局响应拦截器按 code===0/200（数字）判成功，会误伤字符串
 * "0"；故仿照 certAxios（./cert.ts）独立成实例，信封解包逻辑收敛在
 * src/api/opsagent.ts 的 unwrapOpsagent。
 *
 * baseURL 与主实例同源（VITE_API_BASE_URL || '/api/v1'），dev 经 vite proxy
 * 指向 opsagent 服务；认证同为 ecmdb cookie → Bearer。401 跳登录（不清共享
 * cookie，同主实例语义）。
 */
export const opsagentAxios: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    withCredentials: false,
})

opsagentAxios.interceptors.request.use((config) => {
    const token = getEcmdbToken()
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

opsagentAxios.interceptors.response.use(
    (response) => response,
    (error) => {
        // 401 未认证与会话过期：与主实例一致跳转登录页（不清共享 cookie）
        if (error.response?.status === 401) {
            redirectToLogin()
        }
        return Promise.reject(error)
    }
)