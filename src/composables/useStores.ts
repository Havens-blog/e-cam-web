import { useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'
import { useAssetStore } from '@/stores/asset'
import { useUserStore } from '@/stores/user'

/**
 * 统一访问所有 stores 的组合式函数
 */
export function useStores() {
    const userStore = useUserStore()
    const accountStore = useAccountStore()
    const assetStore = useAssetStore()
    const appStore = useAppStore()

    return {
        userStore,
        accountStore,
        assetStore,
        appStore,
    }
}

/**
 * 便捷方法：获取用户 store
 */
export function useUser() {
    return useUserStore()
}

/**
 * 便捷方法：获取账号 store
 */
export function useAccount() {
    return useAccountStore()
}

/**
 * 便捷方法：获取资产 store
 */
export function useAsset() {
    return useAssetStore()
}

/**
 * 便捷方法：获取应用 store
 */
export function useApp() {
    return useAppStore()
}
