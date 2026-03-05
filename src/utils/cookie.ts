/**
 * Cookie 工具函数
 * 用于读取 ecmdb-web 写入的 session token cookie
 */

const ECMDB_TOKEN_KEY = 'ecmdb-token-key'

/** 从 cookie 中获取 ecmdb session token */
export function getEcmdbToken(): string | undefined {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${ECMDB_TOKEN_KEY}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : undefined
}

/** 删除 ecmdb session token cookie */
export function removeEcmdbToken(): void {
    // 清除当前路径和根路径的 cookie
    document.cookie = `${ECMDB_TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    document.cookie = `${ECMDB_TOKEN_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/cam`
}
