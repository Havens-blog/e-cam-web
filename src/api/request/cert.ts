import { getEcmdbToken } from '@/utils/cookie'
import axios, { type AxiosInstance } from 'axios'
import { redirectToLogin } from './index'

/**
 * 证书域（e-cam-service internal/cert，/api/v1/certs）专用 axios 实例。
 *
 * ��端统一信封为 {success, data, error, meta}（api-handbook API Overview），
 * 与主实例（./service.ts）消费的 {code, data, message} 信封不同：主实例的
 * 全局响应拦截器对无 code 字段的载荷按格式错误拒绝，cert 响应会被误伤，
 * 故仿照 eiamAxios（./eiam.ts，ginx 信封）独立成实例，信封解包逻辑收敛在
 * src/api/cert.ts 的 unwrapCertEnvelope。
 *
 * baseURL 与主实例同源（VITE_API_BASE_URL || '/api/v1'），dev 经 vite proxy
 * 指向本地 e-cam-service；认证同为 ecmdb cookie → Bearer。
 * 不预设 Content-Type：导入类端点走 multipart（由 axios 按 FormData 自动
 * 生成带 boundary 的头），JSON 端点由默认 transformRequest 设置。
 */
export const certAxios: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    withCredentials: false,
})

certAxios.interceptors.request.use((config) => {
    const token = getEcmdbToken()
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

certAxios.interceptors.response.use(
    (response) => response,
    (error) => {
        // 401 未认证与会话过期：与主实例一致跳转 ecmdb 登录页（不清共享 cookie）
        if (error.response?.status === 401) {
            redirectToLogin()
        }
        return Promise.reject(error)
    }
)
