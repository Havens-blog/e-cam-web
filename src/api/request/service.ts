import HttpRequest from './index'

/**
 * API服务前缀配置
 * 注意: 这里只配置服务路径，不包含 baseURL
 * baseURL 会在 HttpRequest 实例中配置
 */
export const API_SERVICE = {
    CAM: '/cam'
}

// 开发环境输出配置信息
if (import.meta.env.DEV) {
    console.log('[API Config] baseURL:', import.meta.env.VITE_API_BASE_URL || '/api/v1')
    console.log('[API Config] API_SERVICE.CAM:', API_SERVICE.CAM)
    console.log('[API Config] Example full URL:', `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}${API_SERVICE.CAM}/cloud-accounts`)
}

/**
 * HTTP客户端实例
 */
const instance = new HttpRequest({
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    withCredentials: false,
    headers: {
        'Content-Type': 'application/json'
    }
})

export default instance
