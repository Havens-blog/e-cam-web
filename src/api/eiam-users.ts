import { eiamAxios } from './request/eiam'
import { eiam, mapEiamRole, mapEiamUser } from './eiam-mapper'
import type {
    CreateEiamUserRequest,
    EiamRole,
    EiamUser,
    ListEiamUsersParams,
    ListEiamUsersResult,
    UpdateEiamUserRequest,
} from './types/eiam'
import type { EiamTenant } from '@/stores/user-mapper'

// ---------------- 用户 ----------------

export async function listUsers(params: ListEiamUsersParams): Promise<ListEiamUsersResult> {
    const raw = await eiam<{ total: number; users: unknown[] }>(
        eiamAxios.post('/api/iam/user/list', {
            offset: params.offset,
            limit: params.limit,
            keyword: params.keyword ?? '',
        }),
    )
    return {
        total: raw.total,
        users: raw.users
            .map(mapEiamUser)
            .filter((u): u is EiamUser => u !== null),
    }
}

/** 创建用户，返回新用户 id（eiam 返回值即 int64 id） */
export function createUser(payload: CreateEiamUserRequest): Promise<number> {
    return eiam<number>(eiamAxios.post('/api/iam/user/create', payload))
}

/** 更新用户（status 为启用/禁用 lever） */
export function updateUser(payload: UpdateEiamUserRequest): Promise<void> {
    return eiam<null>(eiamAxios.post('/api/iam/user/update', payload)).then(() => undefined)
}

export function deleteUser(id: number): Promise<void> {
    return eiam<null>(eiamAxios.delete(`/api/iam/user/delete/${id}`)).then(() => undefined)
}

// ---------------- 角色 ----------------

export async function listRoles(params: {
    keyword?: string
    offset: number
    limit: number
}): Promise<{ total: number; roles: EiamRole[] }> {
    const raw = await eiam<{ total: number; roles: unknown[] }>(
        eiamAxios.post('/api/iam/role/list', {
            offset: params.offset,
            limit: params.limit,
            keyword: params.keyword ?? '',
        }),
    )
    return {
        total: raw.total,
        roles: raw.roles
            .map(mapEiamRole)
            .filter((r): r is EiamRole => r !== null),
    }
}

/** 用户已关联的角色（按 user_id 查询） */
export async function listRolesForUser(userId: number): Promise<EiamRole[]> {
    const raw = await eiam<{ total: number; roles: unknown[] }>(
        eiamAxios.post('/api/iam/role/list/attached/user', {
            user_id: userId,
            offset: 0,
            limit: 100,
        }),
    )
    return raw.roles
        .map(mapEiamRole)
        .filter((r): r is EiamRole => r !== null)
}

/** 角色分配以 username + role_code 为准 */
export function assignRoles(usernames: string[], roleCodes: string[]): Promise<void> {
    return eiam<null>(
        eiamAxios.post('/api/iam/role/batch_assign', { usernames, role_codes: roleCodes }),
    ).then(() => undefined)
}

export function unassignRoles(usernames: string[], roleCodes: string[]): Promise<void> {
    return eiam<null>(
        eiamAxios.post('/api/iam/role/batch_unassign', { usernames, role_codes: roleCodes }),
    ).then(() => undefined)
}

// ---------------- 租户 ----------------

export async function listTenants(params: {
    keyword?: string
    offset: number
    limit: number
}): Promise<{ total: number; tenants: EiamTenant[] }> {
    return eiam<{ total: number; tenants: EiamTenant[] }>(
        eiamAxios.post('/api/iam/tenant/list', {
            offset: params.offset,
            limit: params.limit,
            keyword: params.keyword ?? '',
        }),
    )
}

/** 用户已入驻的租户（按 user_id 查询） */
export async function listTenantsForUser(userId: number): Promise<EiamTenant[]> {
    const raw = await eiam<{ total: number; tenants: EiamTenant[] }>(
        eiamAxios.post('/api/iam/tenant/list/attached/user', {
            user_id: userId,
            offset: 0,
            limit: 100,
        }),
    )
    return raw.tenants
}

/** 租户分配以 user_id(int64) + tenant_id(int64) 为准；eiam 禁止 M:N，本特性恒为单用户 */
export function assignUserTenants(userIds: number[], tenantIds: number[]): Promise<void> {
    return eiam<null>(
        eiamAxios.post('/api/iam/tenant/batch_assign', { user_ids: userIds, tenant_ids: tenantIds }),
    ).then(() => undefined)
}

export function unassignUserTenants(userIds: number[], tenantIds: number[]): Promise<void> {
    return eiam<null>(
        eiamAxios.post('/api/iam/tenant/batch_unassign', { user_ids: userIds, tenant_ids: tenantIds }),
    ).then(() => undefined)
}
