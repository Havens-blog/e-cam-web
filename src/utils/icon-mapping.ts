/**
 * 图标映射配置
 * 使用 cmdb-ui 的 iconfont 图标库
 */

/**
 * 云平台图标映射
 * 使用彩色 SVG 图标以更好地识别不同云平台
 */
export const PROVIDER_ICONS: Record<string, string> = {
    aliyun: 'Alibaba_Cloud', // 阿里云 - 彩色
    aws: 'AWS', // AWS - 彩色
    azure: 'Azure', // Azure - 彩色
    tencent: 'Tencent_Cloud', // 腾讯云 - 彩色
    huawei: 'Huawei_Cloud', // 华为云 - 彩色
    google: 'Google_Cloud_Platform', // 谷歌云 - 彩色
    ucloud: 'UCloud', // UCloud - 彩色
    jdcloud: 'JDCloud', // 京东云 - 彩色
    ecloud: 'ECloud', // 天翼云 - 彩色
    bytecloud: 'Bytecloud', // 火山引擎 - 彩色
    nutanix: 'Nutanix', // Nutanix - 彩色
    openstack: 'OpenStack', // OpenStack - 彩色
    zstack: 'ZStack', // ZStack - 彩色
    ctyun: 'Ctyun', // 天翼云 - 彩色
}

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
 * 获取云平台图标
 */
export function getProviderIcon(provider: string): string {
    if (!provider) return 'caise-public_cloud'
    return PROVIDER_ICONS[provider.toLowerCase()] || 'caise-public_cloud'
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
