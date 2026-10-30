/**
 * 日志导出权限判定(纯函数可单测)。
 * 口径(2026-10-30 确认):独立权限码 cam:logs:export;admin 与只读角色默认拥有;
 * 默认放行(向后兼容)——权限清单为空表示 eiam 尚未同步该权限码,不阻断导出。
 */
export const CAM_LOGS_EXPORT_PERMISSION = 'cam:logs:export'

export function canExportLogs(isAdmin: boolean, permissions: readonly string[]): boolean {
    if (isAdmin) return true
    if (permissions.includes(CAM_LOGS_EXPORT_PERMISSION)) return true
    // 默认放行:授权清单为空(未同步/未配置)时向后兼容,不静默藏掉导出入口
    return permissions.length === 0
}
