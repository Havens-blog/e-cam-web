import type { EiamTenant } from '@/stores/user-mapper'

/**
 * eiam 用户状态。
 * active = 启用，disable = 禁用。注意：不是 "disabled" ——
 * eiam/internal/domain/user.go ParseStatus 对未知串返回 StatusUnknown(0)，
 * 写错会静默降级为未知，启用/禁用操作将无效。
 */
export type EiamUserStatus = 'active' | 'disable' | 'unknown'

/** eiam 角色（对应 eiam/internal/web/role/vo.go Role，取前端所需字段子集） */
export interface EiamRole {
    /** 角色 id */
    id: number
    /** 角色代码，如 admin；角色分配以 code 为准 */
    code: string
    name: string
    /** 角色描述（注意 eiam 字段是 desc，不是 description） */
    desc: string
}

/** 前端使用的平台用户（camelCase） */
export interface EiamUser {
    id: number
    username: string
    nickname: string
    email: string
    phone: string
    jobTitle: string
    status: EiamUserStatus
    avatar: string
    lastLoginAt: number
    /** 是否已入驻当前查看租户（仅系统租户下列表返回携带） */
    isMember?: boolean
}

// ---------- 请求 / 响应类型 ----------

export interface ListEiamUsersParams {
    keyword?: string
    offset: number
    limit: number
}

export interface ListEiamUsersResult {
    total: number
    users: EiamUser[]
}

export interface CreateEiamUserRequest {
    username: string
    password: string
    confirm_password: string
    nickname?: string
    email?: string
    phone?: string
    job_title?: string
    /** 不传时 eiam 默认 active */
    status?: EiamUserStatus
}

export interface UpdateEiamUserRequest {
    id: number
    nickname?: string
    email?: string
    phone?: string
    job_title?: string
    /** 启用/禁用 lever */
    status?: EiamUserStatus
}

/** 复用既有租户类型，避免重复定义 */
export type { EiamTenant }
