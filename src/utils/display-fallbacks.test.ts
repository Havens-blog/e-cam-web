/**
 * 展示兜底用例（对应实测的字段不一致：cloud_account_name 缺失 / user_groups 命名 / regions 复数）。
 */
import { describe, expect, it } from 'vitest'
import type { PermissionGroup } from '@/api/types/iam'
import { getProviderLabel } from '@/utils/constants'
import { accountRegionLabel, userAccountLabel, userPermissionGroups } from './display-fallbacks'

describe('userAccountLabel（云账号展示名兜底）', () => {
    it('**回归**：接口不给 cloud_account_name 时退到云厂商中文名，而不是显示 "-"', () => {
        expect(userAccountLabel({ provider: 'aliyun' })).toBe(getProviderLabel('aliyun'))
        expect(userAccountLabel({ provider: 'aliyun' })).not.toBe('-')
    })

    it('有账号名时优先用账号名', () => {
        expect(userAccountLabel({ cloud_account_name: '集团-阿里云', provider: 'aliyun' })).toBe('集团-阿里云')
    })

    it('空串/空白视为缺失（避免渲染出空白单元格）', () => {
        expect(userAccountLabel({ cloud_account_name: '   ', provider: 'tencent' })).toBe(getProviderLabel('tencent'))
    })

    it('两者都没有时才是 "-"', () => {
        expect(userAccountLabel({})).toBe('-')
        expect(userAccountLabel(null)).toBe('-')
    })
})

describe('userPermissionGroups（权限组字段兼容）', () => {
    it('**回归**：读取接口实际返回的 user_groups', () => {
        expect(userPermissionGroups({ user_groups: [{ id: 1 } as PermissionGroup] })).toEqual([{ id: 1 }])
    })

    it('保留历史字段名兼容（组件旧写法）', () => {
        expect(userPermissionGroups({ permission_groups: [{ id: 2 } as PermissionGroup] })).toEqual([{ id: 2 }])
    })

    it('user_groups 优先于 permission_groups', () => {
        expect(userPermissionGroups({ user_groups: [{ id: 1 } as PermissionGroup], permission_groups: [{ id: 2 } as PermissionGroup] })).toEqual([{ id: 1 }])
    })

    it('缺失时返回空数组（组件按空态渲染）', () => {
        expect(userPermissionGroups({})).toEqual([])
        expect(userPermissionGroups(null)).toEqual([])
    })
})

describe('accountRegionLabel（区域展示）', () => {
    it('**回归**：接口只给 regions[] 时取首个，而不是显示 "-"', () => {
        expect(accountRegionLabel({ regions: ['cn-guangzhou'] })).toBe('cn-guangzhou')
    })

    it('单数 region 存在时优先（兼容旧数据）', () => {
        expect(accountRegionLabel({ region: 'cn-hangzhou', regions: ['cn-guangzhou'] })).toBe('cn-hangzhou')
    })

    it('跳过空白项', () => {
        expect(accountRegionLabel({ regions: ['', '  ', 'cn-beijing'] })).toBe('cn-beijing')
    })

    it('都没有时才是 "-"', () => {
        expect(accountRegionLabel({ regions: [] })).toBe('-')
        expect(accountRegionLabel(null)).toBe('-')
    })
})
