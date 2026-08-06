/**
 * eiam profile 响应 → 前端 UserInfo 的映射层。
 *
 * 独立于 store 存在，原因有两点：
 * 1. eiam 侧字段为 snake_case、前端为 camelCase，转换逻辑值得单独收敛与测试。
 * 2. user.ts 在 import 期即访问 localStorage（pinia persist），而测试环境
 *    environment: 'node' 下该全局不存在，故 store 本身无法被测试导入。
 *
 * 本文件不得引入任何 DOM / axios / pinia 依赖，否则将失去可测性。
 */

/** 前端使用的用户信息（camelCase） */
export interface UserInfo {
    id: number
    username: string
    displayName?: string
    email?: string
    title?: string
}

/** eiam 租户（对应 eiam/internal/web/user/vo.go 的 Tenant） */
export interface EiamTenant {
    id: number
    name: string
    code: string
    domain: string
}

/** 映射结果：用户信息 + 权限 + 租户上下文 */
export interface MappedProfile {
    userInfo: UserInfo
    permissions: string[]
    tenants: EiamTenant[]
    /** 0 表示尚未选择租户（临时凭证） */
    currentTenantId: number
    isAdmin: boolean
    mustSelectTenant: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asString(v: unknown): string | undefined {
    return typeof v === 'string' && v !== '' ? v : undefined
}

function asNumber(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function mapTenants(v: unknown): EiamTenant[] {
    if (!Array.isArray(v)) return []
    return v.filter(isRecord).map((t) => ({
        id: asNumber(t.id),
        name: asString(t.name) ?? '',
        code: asString(t.code) ?? '',
        domain: asString(t.domain) ?? '',
    }))
}

/**
 * 把 eiam `GET /api/user/profile` 的 data 部分映射为前端结构。
 * 输入非法（缺 user 或缺 user.id）时返回 null，由调用方决定降级行为。
 */
export function mapEiamProfile(rawData: unknown): MappedProfile | null {
    if (!isRecord(rawData)) return null

    const user = rawData.user
    if (!isRecord(user)) return null
    if (typeof user.id !== 'number') return null

    const username = asString(user.username) ?? ''

    return {
        userInfo: {
            id: user.id,
            username,
            // nickname 缺失或为空串时回退 username，避免界面出现空白用户名
            displayName: asString(user.nickname) ?? username,
            email: asString(user.email),
            title: asString(user.job_title),
        },
        // eiam 的 permissions 来自 permSvc.GetAuthorizedCodes()，是权限码字符串数组；
        // 过滤非字符串元素，保证 hasPermission 的 includes 语义不被污染
        permissions: Array.isArray(rawData.permissions)
            ? rawData.permissions.filter((p): p is string => typeof p === 'string')
            : [],
        tenants: mapTenants(rawData.tenants),
        currentTenantId: asNumber(rawData.current_tenant_id),
        isAdmin: rawData.is_admin === true,
        mustSelectTenant: rawData.must_select_tenant === true,
    }
}
