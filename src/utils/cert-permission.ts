/**
 * 证书管理功能域的角色可见性判定（任务 6.1 脚手架）。
 *
 * 纯函数模块：无 axios / DOM / pinia 运行时依赖，可被单测直接导入
 * （同 src/stores/user-mapper.ts 约定）。
 *
 * 角色口径（PRD EIAM 三角色，后端 internal/cert/web/authz.go）：
 * - 运维工程师 ops_engineer：台账/引用/变更读写
 * - 运维主管 ops_supervisor / 审计 auditor：审计 + 配置
 * - 只读查看者 viewer：仅到期看板（/certs/dashboard）与证书详情（/certs/:id）只读
 *
 * 前端信号：eiam profile 的授权码数组（GetAuthorizedCodes）+ is_admin。
 * 授权码由 7.2「EIAM 权限资源同步」落库，本常量是其唯一对齐点——
 * 7.2 定稿资源码后只需改这一处。平台既有授权码为 `<domain>:<...>` 风格
 * （如 cam:asset:view），cert 域沿用 `cert:manage`。
 * 未持有授权码的非管理员按只读查看者处理（deny-by-default，与后端
 * RequireRoles 的未设置即拒绝一致）。
 */

/** 证书管理（非只读）授权码：控制台账/变更管理/配置的菜单可见性与路由拦截 */
export const CERT_MANAGE_PERMISSION = 'cert:manage'

/**
 * 全局配置授权码（任务 6.5）：变更管理页「配置」入口仅运维主管/审计可见
 * （ui-design 变更管理列表页头 [配置 Secondary(仅主管)]；/certs/settings 本身
 * 由 EIAM 按主管/审计角色同步拦截）。7.2 EIAM 权限资源同步定稿前的对齐点。
 */
export const CERT_SETTINGS_PERMISSION = 'cert:settings'

/** 只读角色命中拦截路由时的提示文案（ui-design 全局模式「只读角色路由拦截」） */
export const CERT_VIEWER_BLOCKED_MESSAGE = '无权限访问，仅到期看板可见'

/** 拦截后的回退目标：只读查看者默认页与唯一菜单入口 */
export const CERT_VIEWER_FALLBACK_PATH = '/certs/dashboard'

/** 角色判定入参：用户 store 的最小只读投影 */
export interface CertPermissionContext {
    isAdmin: boolean
    permissions: readonly string[]
}

/**
 * 当前用户是否具备证书管理权限（运维工程师/主管/审计/平台管理员）。
 * false = 只读查看者：仅 /certs/dashboard 与 /certs/:id 可达。
 */
export function hasCertManageAccess(ctx: CertPermissionContext): boolean {
    return ctx.isAdmin || ctx.permissions.includes(CERT_MANAGE_PERMISSION)
}

/**
 * 当前用户是否可进入全局配置（运维主管/审计/平台管理员）。
 * 变更管理页「配置」按钮的可见性判定；接口侧由 EIAM 同步拦截兜底。
 */
export function hasCertSettingsAccess(ctx: CertPermissionContext): boolean {
    return ctx.isAdmin || ctx.permissions.includes(CERT_SETTINGS_PERMISSION)
}
