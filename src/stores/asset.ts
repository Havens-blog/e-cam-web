import type { Asset } from '@/api/types/asset'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 资产筛选条件
 */
export interface AssetFilters {
    provider?: string
    assetType?: string
    region?: string
    status?: string
    keyword?: string
}

/**
 * 资产状态管理
 */
export const useAssetStore = defineStore(
    'asset',
    () => {
        // 状态
        const assets = ref<Asset[]>([])
        const currentAsset = ref<Asset | null>(null)
        const filters = ref<AssetFilters>({})
        const loading = ref(false)
        const total = ref(0)
        const currentPage = ref(1)
        const pageSize = ref(20)

        // 计算属性
        const assetCount = computed(() => assets.value.length)

        /**
         * 按状态分组的资产
         */
        const assetsByStatus = computed(() => {
            const grouped: Record<string, Asset[]> = {}
            assets.value.forEach(asset => {
                if (!grouped[asset.status]) {
                    grouped[asset.status] = []
                }
                grouped[asset.status]!.push(asset)
            })
            return grouped
        })

        /**
         * 按云厂商分组的资产
         */
        const assetsByProvider = computed(() => {
            const grouped: Record<string, Asset[]> = {}
            assets.value.forEach(asset => {
                if (!grouped[asset.provider]) {
                    grouped[asset.provider] = []
                }
                grouped[asset.provider]!.push(asset)
            })
            return grouped
        })

        /**
         * 按资产类型分组的资产
         */
        const assetsByType = computed(() => {
            const grouped: Record<string, Asset[]> = {}
            assets.value.forEach(asset => {
                if (!grouped[asset.asset_type]) {
                    grouped[asset.asset_type] = []
                }
                grouped[asset.asset_type]!.push(asset)
            })
            return grouped
        })

        /**
         * 按区域分组的资产
         */
        const assetsByRegion = computed(() => {
            const grouped: Record<string, Asset[]> = {}
            assets.value.forEach(asset => {
                if (!grouped[asset.region]) {
                    grouped[asset.region] = []
                }
                grouped[asset.region]!.push(asset)
            })
            return grouped
        })

        /**
         * 筛选后的资产列表
         */
        const filteredAssets = computed(() => {
            let result = [...assets.value]

            if (filters.value.provider) {
                result = result.filter(asset => asset.provider === filters.value.provider)
            }

            if (filters.value.assetType) {
                result = result.filter(asset => asset.asset_type === filters.value.assetType)
            }

            if (filters.value.region) {
                result = result.filter(asset => asset.region === filters.value.region)
            }

            if (filters.value.status) {
                result = result.filter(asset => asset.status === filters.value.status)
            }

            if (filters.value.keyword) {
                const keyword = filters.value.keyword.toLowerCase()
                result = result.filter(
                    asset =>
                        asset.asset_id.toLowerCase().includes(keyword) ||
                        asset.asset_name?.toLowerCase().includes(keyword)
                )
            }

            return result
        })

        /**
         * 设置资产列表
         */
        const setAssets = (newAssets: Asset[]) => {
            assets.value = newAssets
        }

        /**
         * 添加资产
         */
        const addAsset = (asset: Asset) => {
            assets.value.push(asset)
        }

        /**
         * 更新资产
         */
        const updateAsset = (id: number, updates: Partial<Asset>) => {
            const index = assets.value.findIndex(asset => asset.id === id)
            if (index !== -1 && assets.value[index]) {
                assets.value[index] = { ...assets.value[index]!, ...updates } as Asset
            }
        }

        /**
         * 删除资产
         */
        const removeAsset = (id: number) => {
            const index = assets.value.findIndex(asset => asset.id === id)
            if (index !== -1) {
                assets.value.splice(index, 1)
            }
        }

        /**
         * 设置当前资产
         */
        const setCurrentAsset = (asset: Asset | null) => {
            currentAsset.value = asset
        }

        /**
         * 根据 ID 获取资产
         */
        const getAssetById = (id: number): Asset | undefined => {
            return assets.value.find(asset => asset.id === id)
        }

        /**
         * 设置筛选条件
         */
        const setFilters = (newFilters: AssetFilters) => {
            filters.value = { ...filters.value, ...newFilters }
        }

        /**
         * 清空筛选条件
         */
        const clearFilters = () => {
            filters.value = {}
        }

        /**
         * 清空资产列表
         */
        const clearAssets = () => {
            assets.value = []
            currentAsset.value = null
        }

        /**
         * 设置加载状态
         */
        const setLoading = (value: boolean) => {
            loading.value = value
        }

        /**
         * 设置总数
         */
        const setTotal = (value: number) => {
            total.value = value
        }

        /**
         * 设置当前页
         */
        const setCurrentPage = (page: number) => {
            currentPage.value = page
        }

        /**
         * 设置每页大小
         */
        const setPageSize = (size: number) => {
            pageSize.value = size
        }

        return {
            // 状态
            assets,
            currentAsset,
            filters,
            loading,
            total,
            currentPage,
            pageSize,
            // 计算属性
            assetCount,
            assetsByStatus,
            assetsByProvider,
            assetsByType,
            assetsByRegion,
            filteredAssets,
            // 方法
            setAssets,
            addAsset,
            updateAsset,
            removeAsset,
            setCurrentAsset,
            getAssetById,
            setFilters,
            clearFilters,
            clearAssets,
            setLoading,
            setTotal,
            setCurrentPage,
            setPageSize,
        }
    },
    {
        persist: {
            key: 'cam-assets',
            storage: sessionStorage,
        },
    }
)
