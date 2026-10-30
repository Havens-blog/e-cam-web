/**
 * IAM 用户 / 云账号的展示兜底（纯函数，便于单测）。
 *
 * 【为什么需要】实测（2026-10-30，真实后端）接口字段与前端预期不一致：
 * - `GET /iam/users` 只返回 `cloud_account_id` / `provider`，**没有 `cloud_account_name`** ⇒
 *   详情与抽屉里"云账号"直接渲染成 `-`（列表页早已用 provider 做过兜底，详情页漏了）；
 * - 同一个接口把权限组放在 **`user_groups`**，而详情组件读的是 `permission_groups` ⇒
 *   权限组区块永远为空（当前数据该字段也是空的，属"数据来了也显示不出来"的隐患）。
 * - `GET /cloud-accounts` 返回 **`regions: string[]`**，没有单数 `region` ⇒ 账号卡片"区域"显示 `-`。
 *
 * 这里只做**展示层兜底**（不猜业务规则）：取不到的字段退到接口确实返回的等价信息。
 */
import { getProviderLabel } from '@/utils/constants'
import type { PermissionGroup } from '@/api/types/iam'

/** 用户所属云账号展示名：优先账号名，缺失时退到云厂商中文名（接口必返回 provider）。 */
export function userAccountLabel(user: { cloud_account_name?: string; provider?: string } | null | undefined): string {
    const name = (user?.cloud_account_name || '').trim()
    if (name) return name
    const provider = (user?.provider || '').trim()
    if (provider) return getProviderLabel(provider)
    return '-'
}

/** 兼容读取权限组：接口字段名是 `user_groups`，历史组件读 `permission_groups`。 */
export function userPermissionGroups(
    user: { user_groups?: PermissionGroup[]; permission_groups?: PermissionGroup[] } | null | undefined,
): PermissionGroup[] {
    if (Array.isArray(user?.user_groups)) return user.user_groups
    if (Array.isArray(user?.permission_groups)) return user.permission_groups
    return []
}

/** 云账号区域展示：接口给的是 `regions[]`，取首个；都没有则 '-'。 */
export function accountRegionLabel(account: { region?: string; regions?: string[] } | null | undefined): string {
    const single = (account?.region || '').trim()
    if (single) return single
    const first = account?.regions?.filter((r) => (r || '').trim())[0]
    return first ? first.trim() : '-'
}
