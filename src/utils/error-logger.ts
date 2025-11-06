export interface ErrorLog {
    timestamp: string
    type: string
    message: string
    url?: string
    method?: string
    params?: any
    headers?: any
    status?: number
    statusText?: string
    responseData?: any
    userContext?: any
    stackTrace?: string
}

export function logError(error: any, context?: string) {
    const isDev = import.meta.env.DEV

    const errorLog: ErrorLog = {
        timestamp: new Date().toISOString(),
        type: error.name || 'Error',
        message: error.message || '未知错误'
    }

    if (error.config) {
        errorLog.url = error.config.url
        errorLog.method = error.config.method?.toUpperCase()
        errorLog.params = error.config.params
        errorLog.headers = error.config.headers
    }

    if (error.response) {
        errorLog.status = error.response.status
        errorLog.statusText = error.response.statusText
        errorLog.responseData = error.response.data
    }

    if (error.stack) {
        errorLog.stackTrace = error.stack
    }

    if (context) {
        errorLog.userContext = context
    }

    if (isDev) {
        console.group(`🔴 API Error ${context ? `[${context}]` : ''}`)
        console.error('Error Log:', errorLog)
        console.error('Original Error:', error)
        console.groupEnd()
    } else {
        console.error('API Error:', errorLog.message, errorLog)
    }

    return errorLog
}

export function logApiConfig() {
    const isDev = import.meta.env.DEV

    if (isDev) {
        console.group('📡 API Configuration')
        console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL)
        console.groupEnd()
    }
}
