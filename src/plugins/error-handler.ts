import { handleApiError, type ErrorInfo } from '@/utils/error-handler'
import { logError, logger } from '@/utils/error-logger'
import { ElMessage, ElNotification } from 'element-plus'
import type { App } from 'vue'

/**
 * 全局错误处理插件
 */
export default {
    install(app: App) {
        // Vue 错误处理
        app.config.errorHandler = (error: any, instance, info) => {
            logError('Vue Error', error, `Vue:${info}`)

            // 开发环境在控制台显示详细错误
            if (import.meta.env.DEV) {
                console.error('Vue Error:', error)
                console.error('Component:', instance)
                console.error('Info:', info)
            }

            // 生产环境显示用户友好的错误提示
            if (!import.meta.env.DEV) {
                ElMessage.error('页面出现异常，请刷新重试')
            }
        }

        // 全局警告处理
        app.config.warnHandler = (msg, _instance, trace) => {
            if (import.meta.env.DEV) {
                console.warn('Vue Warning:', msg)
                console.warn('Trace:', trace)
            }
        }

        // 未捕获的 Promise 错误
        window.addEventListener('unhandledrejection', (event) => {
            logError('Unhandled Promise Rejection', event.reason, 'Promise')

            // 阻止默认的控制台错误输出
            event.preventDefault()

            // 显示用户友好的错误提示
            ElMessage.error('操作失败，请重试')
        })

        // 全局 JavaScript 错误
        window.addEventListener('error', (event) => {
            // 忽略 ResizeObserver 错误（这是浏览器的良性警告）
            if (event.message.includes('ResizeObserver loop')) {
                event.preventDefault()
                return
            }

            logError('Global JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
            }, 'JavaScript')

            // 显示用户友好的错误提示
            ElMessage.error('页面出现异常，请刷新重试')
        })

        // 资源加载错误
        window.addEventListener('error', (event) => {
            const target = event.target
            if (target && target !== window && target instanceof HTMLElement) {
                logError('Resource Load Error', {
                    tagName: target.tagName,
                    src: (target as any).src || (target as any).href,
                    message: event.message,
                }, 'Resource')

                // 对于关键资源加载失败，显示提示
                if (target.tagName === 'SCRIPT' || target.tagName === 'LINK') {
                    ElNotification({
                        title: '资源加载失败',
                        message: '部分资源加载失败，页面可能无法正常工作',
                        type: 'warning',
                        duration: 5000,
                    })
                }
            }
        }, true)

        // 网络状态监听
        window.addEventListener('online', () => {
            ElMessage.success('网络连接已恢复')
            logger.info('Network status changed', { status: 'online' }, 'Network')
        })

        window.addEventListener('offline', () => {
            ElMessage.warning('网络连接已断开')
            logger.warn('Network status changed', { status: 'offline' }, 'Network')
        })

        // 提供全局错误处理方法
        app.config.globalProperties.$handleError = handleApiError
        app.config.globalProperties.$logger = logger
    },
}

/**
 * 错误边界组合式函数
 */
export function useErrorBoundary() {
    const handleError = (error: any, context?: string) => {
        logError('Component Error', error, context)
        return handleApiError(error)
    }

    const handleAsyncError = async (asyncFn: () => Promise<any>, context?: string) => {
        try {
            return await asyncFn()
        } catch (error) {
            return handleError(error, context)
        }
    }

    return {
        handleError,
        handleAsyncError,
    }
}

/**
 * API 错误重试装饰器
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    maxRetries = 3,
    delay = 1000
): T {
    return (async (...args: any[]) => {
        let lastError: any

        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn(...args)
            } catch (error: any) {
                lastError = error

                // 如果是最后一次重试或者不可重试的错误，直接抛出
                if (i === maxRetries || !isRetryableError(error)) {
                    throw error
                }

                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
                logger.warn(`API retry attempt ${i + 1}/${maxRetries}`, { error: error.message }, 'Retry')
            }
        }

        throw lastError
    }) as T
}

/**
 * 判断错误是否可重试
 */
function isRetryableError(error: any): boolean {
    // 网络错误可重试
    if (!error.response) {
        return true
    }

    const status = error.response.status

    // 5xx 服务器错误可重试
    if (status >= 500) {
        return true
    }

    // 408 请求超时可重试
    if (status === 408) {
        return true
    }

    // 429 请求过于频繁可重试
    if (status === 429) {
        return true
    }

    return false
}

/**
 * 错误统计
 */
class ErrorStats {
    private stats = new Map<string, number>()

    record(error: ErrorInfo) {
        const key = `${error.type}:${error.code || 'unknown'}`
        this.stats.set(key, (this.stats.get(key) || 0) + 1)
    }

    getStats() {
        return Object.fromEntries(this.stats)
    }

    clear() {
        this.stats.clear()
    }
}

export const errorStats = new ErrorStats()

// 扩展 handleApiError 以包含统计
const originalHandleApiError = handleApiError
export const handleApiErrorWithStats = (error: any, defaultMessage?: string): ErrorInfo => {
    const errorInfo = originalHandleApiError(error, defaultMessage)
    errorStats.record(errorInfo)
    return errorInfo
}
