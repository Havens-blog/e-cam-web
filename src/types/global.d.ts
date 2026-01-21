import type { ErrorInfo } from '@/utils/error-handler'
import type { ErrorLogger } from '@/utils/error-logger'

/**
 * 全局属性类型声明
 */
declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        $config: typeof import('@/config').default
        $handleError: (error: any, defaultMessage?: string) => ErrorInfo
        $logger: ErrorLogger
    }
}

export { }

