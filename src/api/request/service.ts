import HttpRequest from './index'

/**
 * API服务前缀配置
 */
export const API_SERVICE = {
    CAM: import.meta.env.VITE_API_BASE_URL || '/api'
}

/**
 * HTTP客户端实例
 */
const instance = new HttpRequest({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 30000,
    withCredentials: false,
    headers: {
        'Content-Type': 'application/json'
    }
})

export default instance
