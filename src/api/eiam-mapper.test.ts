import type { AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { diffSets, eiam, mapEiamRole, mapEiamUser, parseEiamStatus } from './eiam-mapper'

/** 构造一个已 resolved 的 axios 响应，避免引入 axios 运行时（AxiosResponse 仅作类型） */
function env<T>(code: number, data: T, msg = ''): Promise<AxiosResponse<{ code: number; msg: string; data: T }>> {
    return Promise.resolve(
        { data: { code, msg, data } } as unknown as AxiosResponse<{ code: number; msg: string; data: T }>,
    )
}

describe('eiam envelope unwrap', () => {
    it('code===0 时返回 data', async () => {
        await expect(eiam(env(0, { id: 7 }))).resolves.toEqual({ id: 7 })
    })

    it('非 0 code 抛错且带上 msg', async () => {
        await expect(eiam(env(50001, null, '权限不足'))).rejects.toThrow('权限不足')
    })

    it('非 0 code 缺 msg 时回退为通用信息', async () => {
        await expect(eiam(env(9, null))).rejects.toThrow('eiam 请求失败 (code 9)')
    })
})

describe('parseEiamStatus', () => {
    it('active / disable 原样透传', () => {
        expect(parseEiamStatus('active')).toBe('active')
        expect(parseEiamStatus('disable')).toBe('disable')
    })

    it('"disabled" 是常见笔误，必须归一为 unknown 而非误判启用', () => {
        expect(parseEiamStatus('disabled')).toBe('unknown')
    })

    it('非法值归一为 unknown', () => {
        expect(parseEiamStatus(undefined)).toBe('unknown')
        expect(parseEiamStatus(1)).toBe('unknown')
    })
})

describe('mapEiamUser', () => {
    const raw = {
        id: 42,
        username: 'zhangsan',
        email: 'zhangsan@example.com',
        nickname: '张三',
        job_title: '运维工程师',
        phone: '13800000000',
        avatar: '',
        status: 'active',
        last_login_at: 1700000000,
    }

    it('snake_case → camelCase 映射', () => {
        expect(mapEiamUser(raw)).toEqual({
            id: 42,
            username: 'zhangsan',
            nickname: '张三',
            email: 'zhangsan@example.com',
            phone: '13800000000',
            jobTitle: '运维工程师',
            status: 'active',
            avatar: '',
            lastLoginAt: 1700000000,
            isMember: undefined,
        })
    })

    it('系统租户列表携带 is_member 时保留', () => {
        expect(mapEiamUser({ ...raw, is_member: true })?.isMember).toBe(true)
        expect(mapEiamUser({ ...raw, is_member: false })?.isMember).toBe(false)
    })

    it('缺 id 返回 null', () => {
        expect(mapEiamUser({ username: 'noid' })).toBeNull()
    })

    it('缺可选字段降级为安全默认值', () => {
        const u = mapEiamUser({ id: 1, username: 'a', status: 'disable' })
        expect(u).toMatchObject({
            nickname: '',
            email: '',
            phone: '',
            jobTitle: '',
            status: 'disable',
            lastLoginAt: 0,
        })
    })

    it('非对象输入返回 null', () => {
        expect(mapEiamUser(null)).toBeNull()
        expect(mapEiamUser('x')).toBeNull()
        expect(mapEiamUser({})).toBeNull()
    })
})

describe('mapEiamRole', () => {
    it('映射 id/code/name/desc', () => {
        expect(mapEiamRole({ id: 3, code: 'admin', name: '管理员', desc: '全部权限' })).toEqual({
            id: 3,
            code: 'admin',
            name: '管理员',
            desc: '全部权限',
        })
    })

    it('desc 字段名不是 description', () => {
        // 若误用 description，desc 将为空串
        const r = mapEiamRole({ id: 1, code: 'x', name: 'X', description: '不应被采用' })
        expect(r?.desc).toBe('')
    })

    it('既无 id 又无 code 返回 null', () => {
        expect(mapEiamRole({ name: '空壳' })).toBeNull()
    })
})

describe('diffSets', () => {
    it('新增与移除同时计算', () => {
        expect(diffSets(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] })
    })

    it('完全相同则两侧皆空', () => {
        expect(diffSets([1, 2], [2, 1])).toEqual({ added: [], removed: [] })
    })

    it('空原集合 → 全部为新增', () => {
        expect(diffSets([], ['x', 'y'])).toEqual({ added: ['x', 'y'], removed: [] })
    })

    it('空目标集合 → 全部为移除', () => {
        expect(diffSets(['x'], [])).toEqual({ added: [], removed: ['x'] })
    })
})
