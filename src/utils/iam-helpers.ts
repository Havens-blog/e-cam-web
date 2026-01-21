/**
 * IAM 相关的工具函数
 */

import type { CloudProvider, CloudUser, PermissionGroup, SyncTask } from '@/api/types/iam'
import { getUserTypesByProvider } from './cloud-platform-adapter'

/**
 * 格式化用户类型显示
 * @param provider 云平台
 * @param userType 用户类型值
 * @returns 格式化后的显示文本
 */
export function formatUserType(provider: CloudProvider, userType: string): string {
    const types = getUserTypesByProvider(provider)
    const type = types.find(t => t.value === userType)
    return type?.label || userType
}

/**
 * 格式化用户状态
 * @param status 状态值
 * @returns 格式化后的显示文本
 */
export function formatUserStatus(status: string): string {
    const statusMap: Record<string, string> = {
        active: '正常',
        inactive: '禁用',
        locked: '锁定',
        pending: '待激活'
    }
    return statusMap[status] || status
}

/**
 * 格式化任务状态
 * @param status 状态值
 * @returns 格式化后的显示文本
 */
export function formatTaskStatus(status: string): string {
    const statusMap: Record<string, string> = {
        pending: '等待中',
        running: '执行中',
        success: '成功',
        failed: '失败',
        cancelled: '已取消'
    }
    return statusMap[status] || status
}

/**
 * 格式化权限范围
 * @param scope 权限范围值
 * @returns 格式化后的显示文本
 */
export function formatPermissionScope(scope: string): string {
    const scopeMap: Record<string, string> = {
        account: '账号级别',
        resource_group: '资源组',
        resource: '资源级别',
        organization: '组织级别',
        subscription: '订阅',
        project: '项目'
    }
    return scopeMap[scope] || scope
}

/**
 * 计算用户权限等级
 * @param user 用户对象
 * @returns 权限等级 (0-100)
 */
export function calculateUserPermissionLevel(user: CloudUser): number {
    // 简单的权限等级计算逻辑
    let level = 0

    // 基于用户类型
    if (user.user_type === 'root_user') {
        level += 100
    } else if (user.user_type === 'iam_user' || user.user_type === 'ram_user') {
        level += 50
    }

    // 基于权限组数量
    if (user.groups && user.groups.length > 0) {
        level += Math.min(user.groups.length * 10, 50)
    }

    return Math.min(level, 100)
}

/**
 * 检查用户是否有管理员权限
 * @param user 用户对象
 * @returns 是否有管理员权限
 */
export function isAdminUser(user: CloudUser): boolean {
    if (user.user_type === 'root_user') {
        return true
    }

    if (user.groups) {
        return user.groups.some(group =>
            group.name.toLowerCase().includes('admin') ||
            group.name.toLowerCase().includes('管理员')
        )
    }

    return false
}

/**
 * 格式化权限组成员数量
 * @param group 权限组对象
 * @returns 格式化后的成员数量文本
 */
export function formatGroupMemberCount(group: PermissionGroup): string {
    const count = group.member_count || 0
    if (count === 0) {
        return '无成员'
    } else if (count === 1) {
        return '1 个成员'
    } else {
        return `${count} 个成员`
    }
}

/**
 * 格式化权限组策略数量
 * @param group 权限组对象
 * @returns 格式化后的策略数量文本
 */
export function formatGroupPolicyCount(group: PermissionGroup): string {
    const count = group.policies?.length || 0
    if (count === 0) {
        return '无策略'
    } else if (count === 1) {
        return '1 个策略'
    } else {
        return `${count} 个策略`
    }
}

/**
 * 计算同步任务进度百分比
 * @param task 同步任务对象
 * @returns 进度百分比 (0-100)
 */
export function calculateSyncProgress(task: SyncTask): number {
    if (task.status === 'success') {
        return 100
    } else if (task.status === 'failed' || task.status === 'cancelled') {
        return 0
    } else if (task.status === 'running') {
        // 如果有进度信息,使用实际进度
        if (task.progress !== undefined) {
            return task.progress
        }
        // 否则返回一个估算值
        return 50
    }
    return 0
}

/**
 * 格式化同步任务持续时间
 * @param task 同步任务对象
 * @returns 格式化后的持续时间文本
 */
export function formatSyncDuration(task: SyncTask): string {
    if (!task.start_time) {
        return '-'
    }

    const startTime = new Date(task.start_time).getTime()
    const endTime = task.end_time ? new Date(task.end_time).getTime() : Date.now()
    const duration = endTime - startTime

    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
        return `${hours} 小时 ${minutes % 60} 分钟`
    } else if (minutes > 0) {
        return `${minutes} 分钟 ${seconds % 60} 秒`
    } else {
        return `${seconds} 秒`
    }
}

/**
 * 验证权限策略 JSON 格式
 * @param policyJson 策略 JSON 字符串
 * @returns 验证结果
 */
export function validatePolicyJson(policyJson: string): { valid: boolean; error?: string } {
    try {
        const policy = JSON.parse(policyJson)

        // 基本结构验证
        if (!policy || typeof policy !== 'object') {
            return { valid: false, error: '策略必须是有效的 JSON 对象' }
        }

        // 检查必需字段
        if (!policy.Statement && !policy.statement) {
            return { valid: false, error: '策略缺少 Statement 字段' }
        }

        return { valid: true }
    } catch (error) {
        return { valid: false, error: 'JSON 格式错误' }
    }
}

/**
 * 生成权限策略摘要
 * @param policy 权限策略对象
 * @returns 策略摘要文本
 */
export function generatePolicySummary(policy: any): string {
    try {
        const statements = policy.Statement || policy.statement || []
        const allowCount = statements.filter((s: any) =>
            (s.Effect || s.effect) === 'Allow' || (s.Effect || s.effect) === 'allow'
        ).length
        const denyCount = statements.filter((s: any) =>
            (s.Effect || s.effect) === 'Deny' || (s.Effect || s.effect) === 'deny'
        ).length

        return `${statements.length} 条规则 (${allowCount} 允许, ${denyCount} 拒绝)`
    } catch (error) {
        return '无法解析策略'
    }
}

/**
 * 比较两个权限策略是否相同
 * @param policy1 策略1
 * @param policy2 策略2
 * @returns 是否相同
 */
export function comparePolicies(policy1: any, policy2: any): boolean {
    try {
        return JSON.stringify(policy1) === JSON.stringify(policy2)
    } catch (error) {
        return false
    }
}

/**
 * 格式化最后登录时间
 * @param lastLoginTime 最后登录时间
 * @returns 格式化后的时间文本
 */
export function formatLastLoginTime(lastLoginTime?: string): string {
    if (!lastLoginTime) {
        return '从未登录'
    }

    const now = Date.now()
    const loginTime = new Date(lastLoginTime).getTime()
    const diff = now - loginTime

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
        return `${days} 天前`
    } else if (hours > 0) {
        return `${hours} 小时前`
    } else if (minutes > 0) {
        return `${minutes} 分钟前`
    } else {
        return '刚刚'
    }
}

/**
 * 生成随机密码
 * @param length 密码长度
 * @param includeSymbols 是否包含特殊字符
 * @returns 随机密码
 */
export function generateRandomPassword(length: number = 16, includeSymbols: boolean = true): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'

    let chars = lowercase + uppercase + numbers
    if (includeSymbols) {
        chars += symbols
    }

    let password = ''
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return password
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 强度等级 (weak, medium, strong)
 */
export function validatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    if (password.length < 8) {
        return 'weak'
    }

    let strength = 0

    // 检查长度
    if (password.length >= 12) strength++
    if (password.length >= 16) strength++

    // 检查字符类型
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++

    if (strength >= 5) {
        return 'strong'
    } else if (strength >= 3) {
        return 'medium'
    } else {
        return 'weak'
    }
}
