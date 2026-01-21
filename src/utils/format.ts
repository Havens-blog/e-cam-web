/**
 * 格式化工具函数
 */

/**
 * 格式化日期时间
 */
export function formatDateTime(dateTime: string | Date): string {
    if (!dateTime) return '-'

    const date = typeof dateTime === 'string' ? new Date(dateTime) : dateTime

    if (isNaN(date.getTime())) return '-'

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date): string {
    if (!date) return '-'

    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (isNaN(dateObj.getTime())) return '-'

    const year = dateObj.getFullYear()
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化数字
 */
export function formatNumber(num: number, precision = 2): string {
    if (isNaN(num)) return '-'

    return num.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
    })
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, precision = 1): string {
    if (isNaN(value)) return '-'

    return (value * 100).toFixed(precision) + '%'
}
