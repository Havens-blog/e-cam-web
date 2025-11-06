import { ElMessage } from 'element-plus'

export interface ErrorInfo {
    type: 'network' | 'auth' | 'server' | 'timeout' | 'cors' | 'notfound' | 'unknown'
    message: string
    details?: string
    suggestion?: string
    canRetry: boolean
}

export function analyzeError(error: any): ErrorInfo {
    if (!error.response && error.message === 'Network Error') {
        return {
            type: 'network',
            message: '网络连接失败',
            details: '无法连接到服务器',
            suggestion: '请检查您的网络连接是否正常',
            canRetry: true
        }
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
            type: 'timeout',
            message: '请求超时',
            details: '服务器响应时间过长',
            suggestion: '请稍后重试或检查网络速度',
            canRetry: true
        }
    }

    if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
        return {
            type: 'cors',
            message: '跨域请求被阻止',
            details: 'CORS 策略阻止了请求',
            suggestion: '请联系管理员检查服务器 CORS 配置',
            canRetry: false
        }
    }

    if (error.response) {
        const status = error.response.status
        const data = error.response.data

        switch (status) {
            case 401:
                return {
                    type: 'auth',
                    message: '认证失败',
                    details: data?.message || '您的登录已过期',
                    suggestion: '请重新登录',
                    canRetry: false
                }
            case 403:
                return {
                    type: 'auth',
                    message: '权限不足',
                    details: data?.message || '您没有权限访问此资源',
                    suggestion: '请联系管理员获取权限',
                    canRetry: false
                }
            case 404:
                return {
                    type: 'notfound',
                    message: 'API 端点不存在',
                    details: `请求的资源未找到: ${error.config?.url}`,
                    suggestion: '请检查 API 配置或联系技术支持',
                    canRetry: false
                }
            case 500:
            case 502:
            case 503:
            case 504:
                return {
                    type: 'server',
                    message: '服务器错误',
                    details: data?.message || `服务器返回 ${status} 错误`,
                    suggestion: '请稍后重试或联系系统管理员',
                    canRetry: true
                }
            default:
                return {
                    type: 'unknown',
                    message: '请求失败',
                    details: data?.message || error.message || `HTTP ${status}`,
                    suggestion: '请重试或联系技术支持',
                    canRetry: true
                }
        }
    }

    return {
        type: 'unknown',
        message: '未知错误',
        details: error.message || '发生了意外错误',
        suggestion: '请刷新页面重试',
        canRetry: true
    }
}

export function showErrorMessage(errorInfo: ErrorInfo) {
    const message = `${errorInfo.message}${errorInfo.details ? ': ' + errorInfo.details : ''}`
    ElMessage.error({
        message,
        duration: 5000,
        showClose: true
    })
}

export function handleApiError(error: any, customMessage?: string): ErrorInfo {
    const errorInfo = analyzeError(error)

    if (customMessage) {
        errorInfo.message = customMessage
    }

    showErrorMessage(errorInfo)
    return errorInfo
}
