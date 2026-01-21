/**
 * 云平台适配工具函数
 * 提供多云平台的统一适配接口
 */

import type { CloudProvider } from '@/api/types/iam'

export interface CloudUserType {
    value: string
    label: string
    description: string
}

// 云平台用户类型映射
const PLATFORM_USER_TYPES: Record<CloudProvider, CloudUserType[]> = {
    aliyun: [
        { value: 'ram_user', label: 'RAM 用户', description: '阿里云 RAM 子用户' },
        { value: 'ram_role', label: 'RAM 角色', description: '阿里云 RAM 角色' },
        { value: 'federated_user', label: '联邦用户', description: '通过身份联邦登录的用户' }
    ],
    aws: [
        { value: 'iam_user', label: 'IAM 用户', description: 'AWS IAM 用户' },
        { value: 'iam_role', label: 'IAM 角色', description: 'AWS IAM 角色' },
        { value: 'federated_user', label: '联邦用户', description: '通过身份联邦登录的用户' },
        { value: 'root_user', label: '根用户', description: 'AWS 根账户用户' }
    ],
    azure: [
        { value: 'user', label: 'Azure AD 用户', description: 'Azure Active Directory 用户' },
        { value: 'service_principal', label: '服务主体', description: 'Azure 服务主体' },
        { value: 'managed_identity', label: '托管标识', description: 'Azure 托管标识' },
        { value: 'guest_user', label: '来宾用户', description: 'Azure AD 来宾用户' }
    ],
    tencent: [
        { value: 'sub_user', label: '子用户', description: '腾讯云 CAM 子用户' },
        { value: 'role', label: '角色', description: '腾讯云 CAM 角色' },
        { value: 'federated_user', label: '联邦用户', description: '通过身份联邦登录的用户' }
    ],
    huawei: [
        { value: 'iam_user', label: 'IAM 用户', description: '华为云 IAM 用户' },
        { value: 'agency', label: '委托', description: '华为云委托' },
        { value: 'federated_user', label: '联邦用户', description: '通过身份联邦登录的用户' }
    ]
}

// 云平台权限策略类型
const PLATFORM_POLICY_TYPES: Record<CloudProvider, Array<{ value: string; label: string; description: string }>> = {
    aliyun: [
        { value: 'system', label: '系统策略', description: '阿里云预定义的系统策略' },
        { value: 'custom', label: '自定义策略', description: '用户自定义的权限策略' }
    ],
    aws: [
        { value: 'aws_managed', label: 'AWS 托管策略', description: 'AWS 预定义的托管策略' },
        { value: 'customer_managed', label: '客户托管策略', description: '用户创建的托管策略' },
        { value: 'inline', label: '内联策略', description: '直接附加到用户或角色的策略' }
    ],
    azure: [
        { value: 'built_in', label: '内置角色', description: 'Azure 预定义的内置角色' },
        { value: 'custom', label: '自定义角色', description: '用户自定义的角色定义' }
    ],
    tencent: [
        { value: 'preset', label: '预设策略', description: '腾讯云预设的权限策略' },
        { value: 'custom', label: '自定义策略', description: '用户自定义的权限策略' }
    ],
    huawei: [
        { value: 'system', label: '系统策略', description: '华为云预定义的系统策略' },
        { value: 'custom', label: '自定义策略', description: '用户自定义的权限策略' }
    ]
}

// 云平台特定的权限范围
const PLATFORM_PERMISSION_SCOPES: Record<CloudProvider, Array<{ value: string; label: string; description: string }>> = {
    aliyun: [
        { value: 'account', label: '账号级别', description: '整个阿里云账号范围' },
        { value: 'resource_group', label: '资源组', description: '特定资源组范围' },
        { value: 'resource', label: '资源级别', description: '特定资源实例' }
    ],
    aws: [
        { value: 'account', label: '账户级别', description: '整个 AWS 账户范围' },
        { value: 'organization', label: '组织级别', description: 'AWS Organizations 范围' },
        { value: 'resource', label: '资源级别', description: '特定资源实例' }
    ],
    azure: [
        { value: 'management_group', label: '管理组', description: 'Azure 管理组范围' },
        { value: 'subscription', label: '订阅', description: 'Azure 订阅范围' },
        { value: 'resource_group', label: '资源组', description: 'Azure 资源组范围' },
        { value: 'resource', label: '资源', description: '特定资源实例' }
    ],
    tencent: [
        { value: 'account', label: '账号级别', description: '整个腾讯云账号范围' },
        { value: 'project', label: '项目', description: '特定项目范围' },
        { value: 'resource', label: '资源级别', description: '特定资源实例' }
    ],
    huawei: [
        { value: 'account', label: '账号级别', description: '整个华为云账号范围' },
        { value: 'project', label: '项目', description: '特定项目范围' },
        { value: 'resource', label: '资源级别', description: '特定资源实例' }
    ]
}

/**
 * 根据云平台获取支持的用户类型
 * @param provider 云平台标识
 * @returns 用户类型列表
 */
export function getUserTypesByProvider(provider: CloudProvider): CloudUserType[] {
    return PLATFORM_USER_TYPES[provider] || []
}

/**
 * 根据云平台获取权限策略类型
 * @param provider 云平台标识
 * @returns 策略类型列表
 */
export function getPolicyTypesByProvider(provider: CloudProvider): Array<{ value: string; label: string; description: string }> {
    return PLATFORM_POLICY_TYPES[provider] || []
}

/**
 * 根据云平台获取权限范围选项
 * @param provider 云平台标识
 * @returns 权限范围列表
 */
export function getPermissionScopesByProvider(provider: CloudProvider): Array<{ value: string; label: string; description: string }> {
    return PLATFORM_PERMISSION_SCOPES[provider] || []
}

/**
 * 获取用户类型的显示标签
 * @param provider 云平台标识
 * @param userType 用户类型值
 * @returns 显示标签
 */
export function getUserTypeLabel(provider: CloudProvider, userType: string): string {
    const types = getUserTypesByProvider(provider)
    const type = types.find(t => t.value === userType)
    return type?.label || userType
}

/**
 * 获取策略类型的显示标签
 * @param provider 云平台标识
 * @param policyType 策略类型值
 * @returns 显示标签
 */
export function getPolicyTypeLabel(provider: CloudProvider, policyType: string): string {
    const types = getPolicyTypesByProvider(provider)
    const type = types.find(t => t.value === policyType)
    return type?.label || policyType
}

/**
 * 获取权限范围的显示标签
 * @param provider 云平台标识
 * @param scope 权限范围值
 * @returns 显示标签
 */
export function getPermissionScopeLabel(provider: CloudProvider, scope: string): string {
    const scopes = getPermissionScopesByProvider(provider)
    const scopeItem = scopes.find(s => s.value === scope)
    return scopeItem?.label || scope
}

/**
 * 检查云平台是否支持特定功能
 * @param provider 云平台标识
 * @param feature 功能名称
 * @returns 是否支持
 */
export function isPlatformFeatureSupported(provider: CloudProvider, feature: string): boolean {
    const featureSupport: Record<CloudProvider, string[]> = {
        aliyun: ['ram_user', 'ram_role', 'resource_group', 'custom_policy'],
        aws: ['iam_user', 'iam_role', 'organization', 'managed_policy', 'inline_policy'],
        azure: ['user', 'service_principal', 'managed_identity', 'rbac', 'custom_role'],
        tencent: ['sub_user', 'role', 'project', 'custom_policy'],
        huawei: ['iam_user', 'agency', 'project', 'custom_policy']
    }

    return featureSupport[provider]?.includes(feature) || false
}

/**
 * 获取云平台的默认权限策略模板
 * @param provider 云平台标识
 * @returns 默认策略模板
 */
export function getDefaultPolicyTemplate(provider: CloudProvider): Record<string, any> {
    const templates: Record<CloudProvider, Record<string, any>> = {
        aliyun: {
            Version: '1',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['*'],
                    Resource: ['*']
                }
            ]
        },
        aws: {
            Version: '2012-10-17',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: '*',
                    Resource: '*'
                }
            ]
        },
        azure: {
            properties: {
                roleName: 'Custom Role',
                description: 'Custom role description',
                assignableScopes: ['/subscriptions/{subscription-id}'],
                permissions: [
                    {
                        actions: ['*'],
                        notActions: [],
                        dataActions: [],
                        notDataActions: []
                    }
                ]
            }
        },
        tencent: {
            version: '2.0',
            statement: [
                {
                    effect: 'allow',
                    action: ['*'],
                    resource: ['*']
                }
            ]
        },
        huawei: {
            Version: '1.1',
            Statement: [
                {
                    Effect: 'Allow',
                    Action: ['*'],
                    Resource: ['*']
                }
            ]
        }
    }

    return templates[provider] || {}
}

/**
 * 验证权限策略格式是否符合云平台要求
 * @param provider 云平台标识
 * @param policy 权限策略对象
 * @returns 验证结果
 */
export function validatePolicyFormat(provider: CloudProvider, policy: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!policy || typeof policy !== 'object') {
        errors.push('策略必须是有效的 JSON 对象')
        return { valid: false, errors }
    }

    switch (provider) {
        case 'aliyun':
            if (!policy.Version) errors.push('缺少 Version 字段')
            if (!policy.Statement || !Array.isArray(policy.Statement)) {
                errors.push('缺少 Statement 字段或格式不正确')
            }
            break

        case 'aws':
            if (!policy.Version) errors.push('缺少 Version 字段')
            if (!policy.Statement || !Array.isArray(policy.Statement)) {
                errors.push('缺少 Statement 字段或格式不正确')
            }
            break

        case 'azure':
            if (!policy.properties) errors.push('缺少 properties 字段')
            if (!policy.properties?.permissions || !Array.isArray(policy.properties.permissions)) {
                errors.push('缺少 permissions 字段或格式不正确')
            }
            break

        case 'tencent':
            if (!policy.version) errors.push('缺少 version 字段')
            if (!policy.statement || !Array.isArray(policy.statement)) {
                errors.push('缺少 statement 字段或格式不正确')
            }
            break

        case 'huawei':
            if (!policy.Version) errors.push('缺少 Version 字段')
            if (!policy.Statement || !Array.isArray(policy.Statement)) {
                errors.push('缺少 Statement 字段或格式不正确')
            }
            break
    }

    return { valid: errors.length === 0, errors }
}
