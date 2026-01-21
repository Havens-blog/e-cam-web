import type { CloudAccount } from '@/api/types/account'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 云账号状态管理
 */
export const useAccountStore = defineStore(
    'account',
    () => {
        // 状态
        const accounts = ref<CloudAccount[]>([])
        const currentAccount = ref<CloudAccount | null>(null)
        const loading = ref(false)

        // 计算属性
        const accountCount = computed(() => accounts.value.length)

        const activeAccounts = computed(() =>
            accounts.value.filter(account => account.status === 'active')
        )

        const disabledAccounts = computed(() =>
            accounts.value.filter(account => account.status === 'disabled')
        )

        const errorAccounts = computed(() =>
            accounts.value.filter(account => account.status === 'error')
        )

        /**
         * 按云厂商分组的账号
         */
        const accountsByProvider = computed(() => {
            const grouped: Record<string, CloudAccount[]> = {}
            accounts.value.forEach(account => {
                if (!grouped[account.provider]) {
                    grouped[account.provider] = []
                }
                grouped[account.provider]!.push(account)
            })
            return grouped
        })

        /**
         * 设置账号列表
         */
        const setAccounts = (newAccounts: CloudAccount[]) => {
            accounts.value = newAccounts
        }

        /**
         * 添加账号
         */
        const addAccount = (account: CloudAccount) => {
            accounts.value.push(account)
        }

        /**
         * 更新账号
         */
        const updateAccount = (id: number, updates: Partial<CloudAccount>) => {
            const index = accounts.value.findIndex(account => account.id === id)
            if (index !== -1 && accounts.value[index]) {
                accounts.value[index] = { ...accounts.value[index]!, ...updates } as CloudAccount
            }
        }

        /**
         * 删除账号
         */
        const removeAccount = (id: number) => {
            const index = accounts.value.findIndex(account => account.id === id)
            if (index !== -1) {
                accounts.value.splice(index, 1)
            }
        }

        /**
         * 设置当前账号
         */
        const setCurrentAccount = (account: CloudAccount | null) => {
            currentAccount.value = account
        }

        /**
         * 根据 ID 获取账号
         */
        const getAccountById = (id: number): CloudAccount | undefined => {
            return accounts.value.find(account => account.id === id)
        }

        /**
         * 根据云厂商获取账号
         */
        const getAccountsByProvider = (provider: string): CloudAccount[] => {
            return accounts.value.filter(account => account.provider === provider)
        }

        /**
         * 清空账号列表
         */
        const clearAccounts = () => {
            accounts.value = []
            currentAccount.value = null
        }

        /**
         * 设置加载状态
         */
        const setLoading = (value: boolean) => {
            loading.value = value
        }

        return {
            // 状态
            accounts,
            currentAccount,
            loading,
            // 计算属性
            accountCount,
            activeAccounts,
            disabledAccounts,
            errorAccounts,
            accountsByProvider,
            // 方法
            setAccounts,
            addAccount,
            updateAccount,
            removeAccount,
            setCurrentAccount,
            getAccountById,
            getAccountsByProvider,
            clearAccounts,
            setLoading,
        }
    },
    {
        persist: {
            key: 'cam-accounts',
            storage: sessionStorage,
        },
    }
)
