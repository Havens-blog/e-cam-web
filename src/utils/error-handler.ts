import { ElMessage, ElNotification } from 'element-plus'

/**
 * 错误类型
 */
export const ErrorType = {
    NETWORK: 'network',
    AUTH: 'auth',
    BUSINESS: 'business',
    VALIDATION: 'validation',
    UNKNOWN: 'unknown',
} as const

export type ErrorType = typeof ErrorType[keyof typeof ErrorType]

/**
 * 错误信息接口
 */
export interface ErrorInfo {
    type: ErrorType
    code?: string | number
    message: string
    details?: string
    suggestion?: string
    canRetry?: boolean
}

/**
 * HTTP 状态码错误映射
 */
const HTTP_ERROR_MAP: Record<number, Partial<ErrorInfo>> = {
    400: {
        type: ErrorType.VALIDATION,
        message: '请求参数错误',
        suggestion: '请检查输入的数据是否正确',
    },
    401: {
        type: ErrorType.AUTH,
        message: '未授权访问',
        suggestion: '请重新登录',
    },
    403: {
        type: ErrorType.AUTH,
        message: '权限不足',
        suggestion: '请联系管理员获取权限',
    },
    404: {
        type: ErrorType.BUSINESS,
        message: '资源不存在',
        suggestion: '请确认资源是否存在或已被删除',
    },
    408: {
        type: ErrorType.NETWORK,
        message: '请求超时',
        suggestion: '请检查网络连接后重试',
        canRetry: true,
    },
    429: {
        type: ErrorType.BUSINESS,
        message: '请求过于频繁',
        suggestion: '请稍后再试',
        canRetry: true,
    },
    500: {
        type: ErrorType.BUSINESS,
        message: '服务器内部错误',
        suggestion: '请稍后重试或联系技术支持',
        canRetry: true,
    },
    502: {
        type: ErrorType.NETWORK,
        message: '网关错误',
        suggestion: '服务暂时不可用，请稍后重试',
        canRetry: true,
    },
    503: {
        type: ErrorType.NETWORK,
        message: '服务不可用',
        suggestion: '服务正在维护，请稍后重试',
        canRetry: true,
    },
    504: {
        type: ErrorType.NETWORK,
        message: '网关超时',
        suggestion: '请求处理时间过长，请稍后重试',
        canRetry: true,
    },
}

/**
 * 业务错误码映射
 */
const BUSINESS_ERROR_MAP: Record<string, Partial<ErrorInfo>> = {
    'ACCOUNT_NOT_FOUND': {
        type: ErrorType.BUSINESS,
        message: '云账号不存在',
        suggestion: '请确认云账号是否已被删除',
    },
    'ACCOUNT_DISABLED': {
        type: ErrorType.BUSINESS,
        message: '云账号已禁用',
        suggestion: '请启用云账号后重试',
    },
    'INVALID_CREDENTIALS': {
        type: ErrorType.AUTH,
        message: '凭证无效',
        suggestion: '请检查 Access Key 和 Secret Key 是否正确',
    },
    'INSUFFICIENT_PERMISSIONS': {
        type: ErrorType.AUTH,
        message: '权限不足',
        suggestion: '请确认云账号具有足够的权限',
    },
    'RESOURCE_LIMIT_EXCEEDED': {
        type: ErrorType.BUSINESS,
        message: '资源限制超出',
        suggestion: '请检查云账号的资源配额',
    },
    'TASK_ALREADY_RUNNING': {
        type: ErrorType.BUSINESS,
        message: '任务正在运行',
        suggestion: '请等待当前任务完成后再试',
    },
}

/**
 * 解析错误信息
 */
export function parseError(error: any): ErrorInfo {
    // 网络错误
    if (!error.response) {
        return {
            type: ErrorType.NETWORK,
            message: '网络连接失败',
            details: error.message || '无法连接到服务器',
            suggestion: '请检查网络连接后重试',
            canRetry: true,
        }
    }

    const { status, data } = error.response

    // HTTP 状态码错误
    const httpError = HTTP_ERROR_MAP[status]
    if (httpError) {
        return {
            code: status,
            details: data?.message || data?.error || error.message,
            ...httpError,
        } as ErrorInfo
    }

    // 业务错误码
    if (data?.code && BUSINESS_ERROR_MAP[data.code]) {
        const businessError = BUSINESS_ERROR_MAP[data.code]
        return {
            code: data.code,
            message: data.message || businessError?.message || '业务处理失败',
            details: data.details,
            ...businessError,
        } as ErrorInfo
    }

    // 默认错误
    return {
        type: ErrorType.UNKNOWN,
        code: status || 'UNKNOWN',
        message: data?.message || error.message || '未知错误',
        details: data?.details || data?.error,
        suggestion: '请稍后重试或联系技术支持',
    }
}

/**
 * 英文传输层错误文案（axios / fetch 的原生英文），需要翻成中文再展示。
 *
 * 背景（iter103 在 DataTable 内首次实现，iter129 提取为共享）：
 * 直接把 `error.message` 显示给用户时，网络不可达会显示 axios 原文「Network Error」、
 * HTTP 失败会显示「Request failed with status code 500」—— 在中文化产品里属明确缺陷。
 * 但既有契约是「显示错误自身的 message」（有单测断言 `new Error('网络超时')` 原样展示），
 * 所以**只翻译这些已知的英文传输层文案**，其余 message 一律保持原样。
 */
export const TRANSPORT_ERROR_EN =
    /^(Network Error|Failed to fetch|Load failed|Request failed with status code \d+|timeout of \d+ms exceeded)$/

/**
 * 解析可直接展示的错误文案：英文传输层错误走 parseError 翻成中文，其余保留原 message。
 *
 * @param error 捕获到的错误
 * @param fallback 既不是 Error 也没有 message 时的兜底文案
 */
export function resolveErrorMessage(error: unknown, fallback?: string): string {
    const raw = error instanceof Error ? error.message : ''
    if (raw && TRANSPORT_ERROR_EN.test(raw.trim())) {
        // parseError 对「无 response」的错误统一给出「网络连接失败」+ 检查网络的建议
        return parseError(error).message || raw
    }
    return raw || fallback || ''
}

/**
 * 处理 API 错误
 */
export function handleApiError(error: any, defaultMessage?: string): ErrorInfo {
    const errorInfo = parseError(error)

    // 使用默认消息覆盖
    if (defaultMessage) {
        errorInfo.message = defaultMessage
    }

    // 显示错误提示
    showErrorMessage(errorInfo)

    return errorInfo
}

/**
 * 显示错误消息
 */
export function showErrorMessage(errorInfo: ErrorInfo) {
    const { type, message, suggestion } = errorInfo

    // 根据错误类型选择提示方式
    switch (type) {
        case ErrorType.AUTH:
            ElNotification({
                title: '认证错误',
                message: suggestion ? `${message}\n${suggestion}` : message,
                type: 'warning',
                duration: 5000,
            })
            break
        case ErrorType.NETWORK:
            ElMessage({
                message: suggestion ? `${message}，${suggestion}` : message,
                type: 'error',
                duration: 4000,
                showClose: true,
            })
            break
        case ErrorType.VALIDATION:
            ElMessage({
                message: message,
                type: 'warning',
                duration: 3000,
            })
            break
        default:
            ElMessage({
                message: message,
                type: 'error',
                duration: 4000,
                showClose: true,
            })
    }
}

/**
 * 显示成功消息
 */
export function showSuccessMessage(message: string) {
    ElMessage({
        message,
        type: 'success',
        duration: 3000,
    })
}

/**
 * 显示警告消息
 */
export function showWarningMessage(message: string) {
    ElMessage({
        message,
        type: 'warning',
        duration: 3000,
    })
}

/**
 * 显示信息消息
 */
export function showInfoMessage(message: string) {
    ElMessage({
        message,
        type: 'info',
        duration: 3000,
    })
}
