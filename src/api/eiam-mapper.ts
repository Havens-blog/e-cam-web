import type { AxiosResponse } from 'axios'
import type { EiamRole, EiamUser, EiamUserStatus } from './types/eiam'

/**
 * 本文件只放纯函数：无 axios / DOM / pinia 运行时依赖（AxiosResponse 仅作类型），
 * 以便像 src/stores/user-mapper.ts 一样被单独单测。
 */

/** eiam ginx 信封 */
export interface EiamEnvelope<T> {
    code: number
    msg: string
    data: T
}

/**
 * 解开 eiam 信封：code===0 返回 data；非 0 抛错。
 * 调用方（视图层）catch 后用 ElMessage.error 展示。
 */
export async function eiam<T>(
    p: Promise<AxiosResponse<EiamEnvelope<T>>>,
): Promise<T> {
    const res = await p
    if (res.data.code !== 0) {
        throw new Error(res.data.msg || `eiam 请求失败 (code ${res.data.code})`)
    }
    return res.data.data
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

/** 把 eiam 状态原值收敛为合法字面量；非法值归一为 'unknown' */
export function parseEiamStatus(v: unknown): EiamUserStatus {
    if (v === 'active') return 'active'
    if (v === 'disable') return 'disable'
    return 'unknown'
}

/**
 * 把 eiam user/list 或 user/detail 返回的单个用户（snake_case）映射为 EiamUser。
 * 缺 id（核心标识）时返回 null，由调用方降级（与 mapEiamProfile 一致）。
 */
export function mapEiamUser(raw: unknown): EiamUser | null {
    if (!isRecord(raw)) return null
    const id = asNumber(raw.id)
    if (id === 0) return null
    return {
        id,
        username: asString(raw.username) ?? '',
        nickname: asString(raw.nickname) ?? '',
        email: asString(raw.email) ?? '',
        phone: asString(raw.phone) ?? '',
        jobTitle: asString(raw.job_title) ?? '',
        status: parseEiamStatus(raw.status),
        avatar: asString(raw.avatar) ?? '',
        lastLoginAt: asNumber(raw.last_login_at),
        isMember: typeof raw.is_member === 'boolean' ? raw.is_member : undefined,
    }
}

/** 把 eiam RoleVO 映射为 EiamRole（防御性收敛） */
export function mapEiamRole(raw: unknown): EiamRole | null {
    if (!isRecord(raw)) return null
    const id = asNumber(raw.id)
    if (id === 0 && !asString(raw.code)) return null
    return {
        id,
        code: asString(raw.code) ?? '',
        name: asString(raw.name) ?? '',
        desc: asString(raw.desc) ?? '',
    }
}

/**
 * 集合差异：给定原集合 from 与目标集合 to，返回需新增 / 需移除的元素。
 * 用于编辑用户时 diff 角色 / 租户：新增项走 batch_assign，移除项走 batch_unassign。
 */
export function diffSets<T>(from: readonly T[], to: readonly T[]): { added: T[]; removed: T[] } {
    const fromSet = new Set(from)
    const toSet = new Set(to)
    return {
        added: to.filter((x) => !fromSet.has(x)),
        removed: from.filter((x) => !toSet.has(x)),
    }
}
