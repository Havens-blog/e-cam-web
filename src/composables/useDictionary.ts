/**
 * 数据字典 composable
 * 封装字典数据的获取、缓存和格式转换
 */
import { batchGetDictByCodesApi, getDictByCodeApi } from '@/api/dictionary'
import type { DictItem } from '@/api/types/dictionary'
import { computed, ref, type Ref } from 'vue'

// Module-level cache shared across all component instances
const dictCache = new Map<string, DictItem[]>()
// Promise dedup: prevent concurrent requests for the same code
const pendingRequests = new Map<string, Promise<void>>()

export function useDictionary() {
    const loading = ref(false)

    async function loadDict(code: string): Promise<void> {
        // Already cached
        if (dictCache.has(code)) return

        // Dedup: if a request for this code is already in flight, wait for it
        if (pendingRequests.has(code)) {
            return pendingRequests.get(code)!
        }

        const promise = (async () => {
            loading.value = true
            try {
                const res = await getDictByCodeApi(code)
                const data = (res as any).data || res
                const items: DictItem[] = Array.isArray(data) ? data : (data.items || data || [])
                dictCache.set(code, items)
            } catch (e) {
                console.error(`[useDictionary] Failed to load dict "${code}":`, e)
                dictCache.set(code, [])
            } finally {
                pendingRequests.delete(code)
                loading.value = false
            }
        })()

        pendingRequests.set(code, promise)
        return promise
    }

    async function loadDicts(codes: string[]): Promise<void> {
        const uncached = codes.filter(c => !dictCache.has(c))
        if (uncached.length === 0) return

        loading.value = true
        try {
            const res = await batchGetDictByCodesApi(uncached)
            const data = (res as any).data || res
            for (const code of uncached) {
                const items = data[code]
                dictCache.set(code, Array.isArray(items) ? items : [])
            }
        } catch (e) {
            console.error('[useDictionary] Failed to batch load dicts:', e)
            for (const code of uncached) {
                if (!dictCache.has(code)) dictCache.set(code, [])
            }
        } finally {
            loading.value = false
        }
    }

    async function refreshDict(code: string): Promise<void> {
        dictCache.delete(code)
        pendingRequests.delete(code)
        return loadDict(code)
    }

    function getDictItems(code: string): Ref<DictItem[]> {
        return computed(() => dictCache.get(code) || [])
    }

    function getDictLabel(code: string, value: string): string {
        const items = dictCache.get(code) || []
        const item = items.find(i => i.value === value)
        return item?.label || value
    }

    function getDictOptions(code: string): Ref<{ value: string; label: string }[]> {
        return computed(() => {
            const items = dictCache.get(code) || []
            return items.map(i => ({ value: i.value, label: i.label }))
        })
    }

    function getDictExtra(code: string, value: string): Record<string, any> | undefined {
        const items = dictCache.get(code) || []
        const item = items.find(i => i.value === value)
        return item?.extra
    }

    return {
        loading,
        loadDict,
        loadDicts,
        refreshDict,
        getDictItems,
        getDictLabel,
        getDictOptions,
        getDictExtra,
    }
}
