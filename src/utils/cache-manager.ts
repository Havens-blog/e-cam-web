interface CacheItem<T> {
    data: T
    timestamp: number
    expiresIn: number
}

class CacheManager {
    private cache: Map<string, CacheItem<any>> = new Map()

    /**
     * 设置缓存
     */
    set<T>(key: string, data: T, expiresIn: number = 5 * 60 * 1000) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresIn
        })
    }

    /**
     * 获取缓存
     */
    get<T>(key: string): { data: T; isExpired: boolean } | null {
        const item = this.cache.get(key)

        if (!item) {
            return null
        }

        const isExpired = Date.now() - item.timestamp > item.expiresIn

        return {
            data: item.data as T,
            isExpired
        }
    }

    /**
     * 清除缓存
     */
    clear(key?: string) {
        if (key) {
            this.cache.delete(key)
        } else {
            this.cache.clear()
        }
    }

    /**
     * 获取缓存时间戳
     */
    getTimestamp(key: string): Date | null {
        const item = this.cache.get(key)
        return item ? new Date(item.timestamp) : null
    }
}

export const cacheManager = new CacheManager()
