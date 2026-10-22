/**
 * 图标映射配置
 *
 * 云厂商图标已下沉到平台共享包 @haven/ui（**单一来源**）：本文件只做 re-export，
 * 保持既有 `@/utils/icon-mapping` 导入路径不变，故 60+ 处调用点零改动。
 * 应用级的映射（导航菜单 MODULE_ICONS / 资产类型 ASSET_TYPE_ICONS）留在本仓。
 */

// 平台级：云厂商图标（唯一实现在 @haven/ui/provider）
export { PROVIDER_ICONS, getProviderIcon } from '@haven/ui/provider'

/**
 * 功能模块图标映射
 * 为导航菜单提供图标
 */
export const MODULE_ICONS: Record<string, string> = {
    // 主要功能模块
    dashboard: 'monitor-dashboard', // 多云概览
    accounts: 'ops-oneterm-asset-management', // 云账号管理
    assets: 'caise-public_cloud', // 资产管理
    cost: 'monitor-healing', // 成本分析
    tasks: 'quick_commands', // 任务管理

    // IAM 管理模块
    iam: 'ops-oneterm-authorization', // IAM 管理（主菜单）
    'iam-users': 'ops-oneterm-authorization', // 用户管理
    'iam-groups': 'ops-oneterm-access_period', // 用户组管理
    'iam-templates': 'file', // 策略模板管理
    'iam-audit': 'ops-oneterm-file_log', // 审计日志
    'iam-sync': 'oneterm-batch_execution', // 同步任务

    // 通用图标
    detail: 'file', // 详情页
    edit: 'auto', // 编辑
    create: 'auto', // 创建
    settings: 'terminal_settings', // 设置
}

/**
 * 资产类型图标映射
 */
export const ASSET_TYPE_ICONS: Record<string, string> = {
    ecs: 'caise-virtualization', // 云服务器
    rds: 'a-mongoDB1', // 数据库
    oss: 'folder1', // 对象存储
    vpc: 'caise-public_cloud', // 虚拟私有云
    slb: 'monitor-healing', // 负载均衡
    eip: 'caise-public_cloud', // 弹性公网IP
    disk: 'folder1', // 云盘
}

/**
 * 获取模块图标
 */
export function getModuleIcon(module: string): string {
    if (!module) return 'file'
    return MODULE_ICONS[module.toLowerCase()] || 'file'
}

/**
 * 获取资产类型图标
 */
export function getAssetTypeIcon(assetType: string): string {
    if (!assetType) return 'file'
    return ASSET_TYPE_ICONS[assetType.toLowerCase()] || 'file'
}
