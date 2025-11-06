import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

/**
 * 请求拦截器接口
 */
export interface RequestInterceptors {
    // 请求拦截
    requestInterceptor?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
    requestInterceptorCatch?: (error: any) => any
    // 响应拦截
    responseInterceptor?: (res: AxiosResponse) => AxiosResponse
    responseInterceptorCatch?: (error: any) => any
}

/**
 * 单次请求拦截器接口
 */
export interface RequestInterceptorsOnce {
    // 请求拦截
    requestInterceptor?: (config: AxiosRequestConfig) => AxiosRequestConfig
    // 响应拦截
    responseInterceptor?: (res: AxiosResponse) => AxiosResponse
}

/**
 * 请求配置接口
 */
export interface RequestConfig extends AxiosRequestConfig {
    interceptors?: RequestInterceptors
    interceptorsToOnce?: RequestInterceptorsOnce
}

/**
 * 响应数据格式
 */
export interface ResponseData<T = any> {
    code: number
    data: T
    message: string
}
