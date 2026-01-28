import { handleApiError } from '@/utils/error-handler'
import { logError, logInfo, logWarn } from '@/utils/error-logger'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { RequestConfig, RequestInterceptors, ResponseData } from './types'

class HttpRequest {
    instance: AxiosInstance
    interceptors?: RequestInterceptors

    constructor(config: RequestConfig) {
        this.instance = axios.create(config)
        this.interceptors = config.interceptors

        // 实例级别的请求拦截
        this.instance.interceptors.request.use(
            this.interceptors?.requestInterceptor,
            this.interceptors?.requestInterceptorCatch
        )

        // 实例级别的响应拦截
        this.instance.interceptors.response.use(
            this.interceptors?.responseInterceptor,
            this.interceptors?.responseInterceptorCatch
        )

        // 全局请求拦截
        this.instance.interceptors.request.use(
            (config) => {
                // 添加认证 token
                const token = localStorage.getItem('token')
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`
                }

                // 添加租户 ID
                const tenantId = localStorage.getItem('tenantId') || 'default'
                if (config.headers) {
                    config.headers['X-Tenant-ID'] = tenantId
                }

                // 添加请求 ID 用于追踪
                const requestId = this.generateRequestId()
                if (config.headers) {
                    config.headers['X-Request-ID'] = requestId
                }

                // 记录请求日志
                logInfo(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
                    requestId,
                    params: config.params,
                    data: config.data,
                }, 'API')

                return config
            },
            (error) => {
                logError('Request interceptor error', error, 'API')
                return Promise.reject(error)
            }
        )

        // 全局响应拦截
        this.instance.interceptors.response.use(
            (response) => {
                const apiData = response.data
                const requestId = response.config.headers?.['X-Request-ID']

                // 记录响应日志
                logInfo(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
                    requestId,
                    status: response.status,
                    code: apiData.code,
                }, 'API')

                // 二进制数据直接返回
                const responseType = response.request?.responseType
                if (responseType === 'blob' || responseType === 'arraybuffer') {
                    return apiData
                }

                const code = apiData.code

                // 如果没有code字段，说明不是标准格式
                if (code === undefined) {
                    logWarn('Invalid API response format', { requestId, response: apiData }, 'API')
                    ElMessage.error('接口响应格式错误')
                    return Promise.reject(new Error('接口响应格式错误'))
                }

                // code为0或200都视为成功
                if (code === 0 || code === 200) {
                    return response
                }

                // 其他code视为业务错误
                logWarn('Business error', {
                    requestId,
                    code,
                    message: apiData.message || apiData.msg,
                }, 'API')

                ElMessage.error(apiData.message || apiData.msg || 'Error')
                return Promise.reject(new Error(apiData.message || 'Error'))
            },
            (error) => {
                const requestId = error.config?.headers?.['X-Request-ID']

                // 记录错误日志
                logError('API Error', {
                    requestId,
                    url: error.config?.url,
                    method: error.config?.method,
                    status: error.response?.status,
                    message: error.message,
                }, 'API')

                // 使用统一错误处理
                handleApiError(error)

                return Promise.reject(error)
            }
        )
    }

    request<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return new Promise((resolve, reject) => {
            // 单次请求拦截
            if (config.interceptorsToOnce?.requestInterceptor) {
                config = config.interceptorsToOnce.requestInterceptor(config)
            }

            this.instance
                .request(config)
                .then((res) => {
                    // 单次响应拦截
                    if (config.interceptorsToOnce?.responseInterceptor) {
                        res = config.interceptorsToOnce.responseInterceptor(res)
                    }
                    resolve(res.data)
                })
                .catch((error) => {
                    reject(error.response ? error.response.data : error)
                })
        })
    }

    get<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'get' })
    }

    post<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'post' })
    }

    put<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'put' })
    }

    delete<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'delete' })
    }

    patch<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'patch' })
    }

    /**
     * 生成请求 ID
     */
    private generateRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
}

export default HttpRequest
