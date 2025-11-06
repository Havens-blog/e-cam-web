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
                return config
            },
            (error) => {
                return Promise.reject(error)
            }
        )

        // 全局响应拦截
        this.instance.interceptors.response.use(
            (response) => {
                const apiData = response.data

                // 二进制数据直接返回
                const responseType = response.request?.responseType
                if (responseType === 'blob' || responseType === 'arraybuffer') {
                    return apiData
                }

                const code = apiData.code

                // 如果没有code字段，说明不是标准格式
                if (code === undefined) {
                    ElMessage.error('接口响应格式错误')
                    return Promise.reject(new Error('接口响应格式错误'))
                }

                // code为0或200都视为成功
                if (code === 0 || code === 200) {
                    return response
                }

                // 其他code视为业务错误
                ElMessage.error(apiData.message || apiData.msg || 'Error')
                return Promise.reject(new Error(apiData.message || 'Error'))
            },
            (error) => {
                // 处理网络错误
                if (!error.response) {
                    ElMessage.error('网络连接失败，请检查网络设置')
                    return Promise.reject(error)
                }

                const status = error.response?.status
                const message = error.response?.data?.message || error.response?.data?.msg

                if (message) {
                    ElMessage.error(message)
                } else {
                    switch (status) {
                        case 400:
                            ElMessage.error('请求错误')
                            break
                        case 401:
                            ElMessage.error('未授权，请登录')
                            // 可以在这里处理登录跳转
                            break
                        case 403:
                            ElMessage.error('拒绝访问')
                            break
                        case 404:
                            ElMessage.error('请求地址不存在')
                            break
                        case 408:
                            ElMessage.error('请求超时')
                            break
                        case 500:
                            ElMessage.error('服务器内部错误')
                            break
                        case 502:
                            ElMessage.error('网关错误')
                            break
                        case 503:
                            ElMessage.error('服务不可用')
                            break
                        case 504:
                            ElMessage.error('网关超时')
                            break
                        default:
                            ElMessage.error('请求失败')
                            break
                    }
                }

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
}

export default HttpRequest
