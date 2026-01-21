/**
 * 错误日志记录器
 */
interface LogLevel {
    ERROR: 'error'
    WARN: 'warn'
    INFO: 'info'
    DEBUG: 'debug'
}

const LOG_LEVELS: LogLevel = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
}

interface LogEntry {
    level: string
    message: string
    timestamp: string
    context?: string
    data?: any
    stack?: string
}

class ErrorLogger {
    private isDev = import.meta.env.DEV
    private logs: LogEntry[] = []
    private maxLogs = 1000

    /**
     * 记录错误日志
     */
    error(message: string, error?: any, context?: string) {
        this.log(LOG_LEVELS.ERROR, message, error, context)
    }

    /**
     * 记录警告日志
     */
    warn(message: string, data?: any, context?: string) {
        this.log(LOG_LEVELS.WARN, message, data, context)
    }

    /**
     * 记录信息日志
     */
    info(message: string, data?: any, context?: string) {
        this.log(LOG_LEVELS.INFO, message, data, context)
    }

    /**
     * 记录调试日志
     */
    debug(message: string, data?: any, context?: string) {
        if (this.isDev) {
            this.log(LOG_LEVELS.DEBUG, message, data, context)
        }
    }

    /**
     * 通用日志记录方法
     */
    private log(level: string, message: string, data?: any, context?: string) {
        const logEntry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
            data: this.serializeData(data),
        }

        // 如果是错误对象，添加堆栈信息
        if (data instanceof Error) {
            logEntry.stack = data.stack
        }

        // 添加到内存日志
        this.addToMemoryLog(logEntry)

        // 控制台输出
        this.consoleLog(logEntry)

        // 生产环境发送到服务器
        if (!this.isDev) {
            this.sendToServer(logEntry)
        }
    }

    /**
     * 序列化数据
     */
    private serializeData(data: any): any {
        if (!data) return undefined

        try {
            // 处理循环引用
            return JSON.parse(JSON.stringify(data, this.getCircularReplacer()))
        } catch (error) {
            return { error: 'Failed to serialize data', original: String(data) }
        }
    }

    /**
     * 处理循环引用的替换器
     */
    private getCircularReplacer() {
        const seen = new WeakSet()
        return (_key: string, value: any) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]'
                }
                seen.add(value)
            }
            return value
        }
    }

    /**
     * 添加到内存日志
     */
    private addToMemoryLog(logEntry: LogEntry) {
        this.logs.push(logEntry)

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs)
        }
    }

    /**
     * 控制台输出
     */
    private consoleLog(logEntry: LogEntry) {
        const { level, message, context, data, stack } = logEntry
        const prefix = context ? `[${context}]` : ''
        const fullMessage = `${prefix} ${message}`

        switch (level) {
            case LOG_LEVELS.ERROR:
                console.error(fullMessage, data)
                if (stack) console.error(stack)
                break
            case LOG_LEVELS.WARN:
                console.warn(fullMessage, data)
                break
            case LOG_LEVELS.INFO:
                console.info(fullMessage, data)
                break
            case LOG_LEVELS.DEBUG:
                console.debug(fullMessage, data)
                break
            default:
                console.log(fullMessage, data)
        }
    }

    /**
     * 发送到服务器
     */
    private async sendToServer(_logEntry: LogEntry) {
        try {
            // 这里可以实现发送到日志服务器的逻辑
            // 例如发送到 ELK、Sentry 等日志收集系统
            // 示例：发送到自定义日志接口
            // await fetch('/api/logs', {
            //   method: 'POST',
            //   headers: {
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify(logEntry),
            // })
        } catch (error) {
            // 发送失败时只在控制台记录，避免无限循环
            console.error('Failed to send log to server:', error)
        }
    }

    /**
     * 获取内存中的日志
     */
    getLogs(level?: string): LogEntry[] {
        if (level) {
            return this.logs.filter(log => log.level === level)
        }
        return [...this.logs]
    }

    /**
     * 清空内存日志
     */
    clearLogs() {
        this.logs = []
    }

    /**
     * 导出日志
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2)
    }
}

// 创建全局实例
export const logger = new ErrorLogger()

// 便捷方法
export const logError = (message: string, error?: any, context?: string) => {
    logger.error(message, error, context)
}

export const logWarn = (message: string, data?: any, context?: string) => {
    logger.warn(message, data, context)
}

export const logInfo = (message: string, data?: any, context?: string) => {
    logger.info(message, data, context)
}

export const logDebug = (message: string, data?: any, context?: string) => {
    logger.debug(message, data, context)
}

// API 配置日志
export const logApiConfig = () => {
    logInfo('API Configuration', {
        baseURL: import.meta.env.VITE_API_BASE_URL,
        environment: import.meta.env.MODE,
        isDev: import.meta.env.DEV,
    }, 'API')
}
