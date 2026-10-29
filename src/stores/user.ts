import { resolveLoginTarget } from '@/api/request/index'
import { removeEcmdbToken } from '@/utils/cookie'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mapEiamProfile } from './user-mapper'
import type { EiamTenant, UserInfo } from './user-mapper'
import { eiamAxios } from '@/api/request/eiam'

export type { UserInfo } from './user-mapper'

/**
 * eiam 统一鉴权下的用户状态管理
 */
export const useUserStore = defineStore(
    'user',
    () => {
        const userInfo = ref<UserInfo | null>(null)
        const isLoggedIn = ref(false)
        const permissions = ref<string[]>([])
        const tenants = ref<EiamTenant[]>([])
        const currentTenantId = ref<number>(0)
        const isAdmin = ref(false)
        const mustSelectTenant = ref(false)

        const setUserInfo = (info: UserInfo | null) => {
            userInfo.value = info
            isLoggedIn.value = !!info
        }

        const resetState = () => {
            setUserInfo(null)
            permissions.value = []
            tenants.value = []
            currentTenantId.value = 0
            isAdmin.value = false
            mustSelectTenant.value = false
        }

        /**
         * 在途 profile 请求（单飞）。
         *
         * 【为什么需要】实测（2026-10-30，真实环境逐页统计）：**每个页面**加载都会把
         * `GET /api/iam/user/profile` 请求 **2 次** —— 触发点是 `main.ts` 启动时的
         * `initUserState()` 与路由守卫里的 `fetchUserInfo()`，二者在同一次导航内并发执行。
         * 并发时复用同一在途请求即可，行为与结果完全一致（两处都拿同一个 boolean）。
         * 请求结束后清空，保证后续仍能真实重取（如租户变更后 reload、登出后重登）。
         */
        let inflightFetch: Promise<boolean> | null = null

        /**
         * 从 eiam 获取当前登录用户信息。
         * eiam 的 profile 同时返回权限码与租户上下文，故一次请求即可，
         * 无需再单独调权限菜单接口。
         */
        const doFetchUserInfo = async (): Promise<boolean> => {
            try {
                const res = await eiamAxios.get('/api/iam/user/profile')
                const body = res.data
                // eiam 使用 ginx 信封：{code, msg, data}，成功时 code === 0
                if (body?.code !== 0) {
                    // 三条失败路径都只向调用方返回 false，而调用方（路由守卫）会据此
                    // 跳登录页。本 store 无自动化测试覆盖（node 环境无法导入），
                    // 控制台是唯一的可观测手段，故三处必须各自留痕、可区分。
                    console.warn('[user] eiam profile 返回非成功信封', {
                        code: body?.code,
                        msg: body?.msg,
                    })
                    return false
                }

                const mapped = mapEiamProfile(body.data)
                if (!mapped) {
                    console.warn('[user] eiam profile 载荷无法解析，已按未登录处理')
                    return false
                }

                setUserInfo(mapped.userInfo)
                permissions.value = mapped.permissions
                tenants.value = mapped.tenants
                currentTenantId.value = mapped.currentTenantId
                isAdmin.value = mapped.isAdmin
                mustSelectTenant.value = mapped.mustSelectTenant
                return true
            } catch (err) {
                // 网络失败 / 超时 / 非 2xx 都落到这里，与上面两条业务失败区分开
                console.warn('[user] 请求 eiam profile 失败', err)
                return false
            }
        }

        /**
         * 对外入口：并发调用共享同一在途请求（单飞），避免启动与路由守卫重复拉取。
         * 不做结果缓存 —— 请求结束后再次调用仍会真实发起（租户变更/重登场景需要）。
         */
        const fetchUserInfo = (): Promise<boolean> => {
            if (!inflightFetch) {
                inflightFetch = doFetchUserInfo().finally(() => {
                    inflightFetch = null
                })
            }
            return inflightFetch
        }

        /**
         * 登出：通知 eiam 销毁会话，再清理本地状态与 cookie。
         * 这是唯一应当主动清除共享凭证的路径。
         */
        const logout = async () => {
            try {
                await eiamAxios.post('/api/iam/user/logout')
            } catch {
                // 即使登出接口失败也清理本地状态
            }
            resetState()
            removeEcmdbToken()
            // RC#2：登出后回控制台登录页（/console/login），不再指向 ecmdb-web /login；
            // 目标经 resolveLoginTarget 统一取值（VITE_LOGIN_TARGET，默认 /console/login）。
            window.location.href = resolveLoginTarget()
        }

        const initUserState = async () => {
            await fetchUserInfo()
        }

        const hasPermission = (permission: string): boolean => {
            return permissions.value.includes(permission)
        }

        return {
            userInfo,
            isLoggedIn,
            permissions,
            tenants,
            currentTenantId,
            isAdmin,
            mustSelectTenant,
            setUserInfo,
            fetchUserInfo,
            logout,
            initUserState,
            hasPermission,
        }
    },
    {
        persist: {
            // key 从 'cam-user' 提升为 v2：本任务把 store 的 ref 从 3 个增至 7 个，
            // 旧 blob 带 isLoggedIn:true 复原后会让路由守卫跳过 profile 拉取（见下方说明）
            key: 'cam-user-v2',
            storage: localStorage,
            // 只持久化 userInfo（仅为冷启动时即时渲染用户名）。
            // 授权派生字段 permissions / isAdmin / tenants / currentTenantId /
            // mustSelectTenant 一律不落盘：它们必须每次从 eiam 取，
            // 否则用户可编辑 localStorage 伪造 isAdmin，且撤权无法生效。
            pick: ['userInfo'],
        },
    }
)
