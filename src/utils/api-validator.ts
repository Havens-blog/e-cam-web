/**
 * 验证 API 配置
 */
export function validateApiConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查必需的环境变量
    if (!import.meta.env.VITE_API_BASE_URL) {
        errors.push('VITE_API_BASE_URL 未配置')
    }

    // 验证 URL 格式
    const baseApi = import.meta.env.VITE_API_BASE_URL
    if (baseApi && !baseApi.startsWith('/') && !baseApi.startsWith('http')) {
        errors.push('VITE_API_BASE_URL 格式不正确，应以 / 或 http 开头')
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * 获取完整的 API URL
 */
export function getFullApiUrl(endpoint: string): string {
    const baseApi = import.meta.env.VITE_API_BASE_URL || '/api'
    return `${baseApi}${endpoint}`
}

/**
 * 在应用启动时验证配置
 */
export function initApiValidation() {
    const { valid, errors } = validateApiConfig()

    if (!valid) {
        console.error('❌ API 配置验证失败:')
        errors.forEach((error) => console.error(`  - ${error}`))
    } else if (import.meta.env.DEV) {
        console.log('✅ API 配置验证通过')
    }

    return valid
}
