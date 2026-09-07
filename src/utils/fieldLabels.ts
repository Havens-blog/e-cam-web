/**
 * 字段展示文案单源（fieldLabels）— 计费类型域 + 全局资产状态域
 *
 * 背景：字段文案一致性审计（docs/features/ecam-web-ui-audit/reports/field-consistency.md §2 域4/域3）
 * 发现计费类型 `charge_type` 在 eip/ecs/cmdb/rds/redis/mongodb/nas/template/provision
 * 的列表列、详情抽屉、导出共 11+ 处各自手写映射：键集不齐（有的只认 `PrePaid`/`PostPaid`，
 * 有的额外收 `prepaid`/`postpaid` 小写变体）、空值/未知值被吞成错误文案
 * （eip 列表把空值也显示成「按量付费」）、导出链路直接裸出 `PrePaid`。
 *
 * 本模块是计费类型与全局资产状态的唯一映射源：各位点统一 import，新增取值只改这里。
 * 渲染侧请配合下方 `labelOf` / `labelOfLenient` 使用。
 *
 * 同类单源：CDN 的业务类型/服务区域/状态已由 src/utils/cdn.ts 收口（后端 26c0758
 * 已归一化为统一枚举 + 历史原始值兼容），不要在本模块重复定义。
 */

// ==================== 计费类型（charge_type） ====================

/**
 * 计费类型 → 展示文案（含三种大小写变体）。
 *
 * 待接口核实: 是否存在第三态（如包月/PackageYear）以及实际下发的大小写
 * —— src/api/types/database.ts 的 PayType 只声明 `PrePaid`/`PostPaid`，
 * EIP 链路实际观测到 `Prepaid`，故三种写法都收，未知值由 labelOfLenient 原样透出。
 */
export const CHARGE_TYPE_LABELS: Record<string, string> = {
    PrePaid: '包年包月',
    prepaid: '包年包月',
    Prepaid: '包年包月',
    PostPaid: '按量付费',
    postpaid: '按量付费',
    Postpaid: '按量付费',
}

// ==================== 资产状态（status，全局资产视图） ====================

/**
 * 全局资产状态 → 展示文案。
 *
 * 全局资产列表/详情聚合各资产域（ecs/rds/redis/mongodb/vpc/eip…），状态词表比任一
 * 单模块都宽，这里收录各列表页 statusLabels / ASSET_STATUS(src/utils/constants.ts)
 * 的并集；同键跨模块语义不同时取更通用的措辞（available→可用、pending→创建中、
 * stopped→已停止、active→运行中），冲突明细见 field-consistency.md §2 域3。
 *
 * 待运行时复核: 真实取值域以运行时抓样为准；restarting/upgrading 来自
 * src/api/types/asset.ts 的 AssetStatus，尚无既有文案。未命中的状态由
 * @/components/AssetStatusBadge 回退显示原始值。
 */
export const ASSET_STATUS_LABELS: Record<string, string> = {
    // 运行态
    running: '运行中', Running: '运行中', RUNNING: '运行中',
    active: '运行中', Active: '运行中',
    serving: '运行中', normal: '运行中', accomplished: '正常',
    online: '正常', Online: '正常', Deployed: '正常', deployed: '正常',
    Started: '正常', started: '正常',
    in_use: '使用中', InUse: '使用中', inuse: '使用中', BINDBOUND: '使用中', ACTIVE: '使用中',
    available: '可用', Available: '可用', DOWN: '可用', BINDUNBOUND: '可用',
    Bindable: '可绑定',
    // 停止 / 停用
    stopped: '已停止', Stopped: '已停止', STOPPED: '已关机',
    inactive: '已停止', Inactive: '已停止',
    offline: '已停用', Offline: '已停用', disabled: '已停用',
    closed: '已停止', Closed: '已停止', shutdown: '已停止',
    terminated: '已销毁', deleted: '已删除', DELETED: '已删除',
    // 过渡态
    pending: '创建中', Pending: '创建中', PENDING: '创建中',
    creating: '创建中', Creating: '创建中', progressing: '创建中',
    starting: '启动中', stopping: '停止中',
    rebooting: '重启中', restarting: '重启中', upgrading: '升级中',
    configuring: '配置中', Configuring: '配置中',
    checking: '审核中', Checking: '审核中',
    attaching: '绑定中', Attaching: '绑定中',
    detaching: '解绑中', Detaching: '解绑中',
    deleting: '删除中', Deleting: '删除中',
    InProgress: '部署中', inprogress: '部署中', deploying: '部署中', Deploying: '部署中',
    Waiting: '等待中', waiting: '等待中',
    // 异常 / 其他
    error: '异常', Error: '异常',
    failed: '失败', Failed: '失败',
    check_failed: '审核失败', CheckFailed: '审核失败',
    locked: '已锁定', Locked: '已锁定',
    expired: '已过期', expiring: '即将到期',
    UnAvailable: '不可用', unavailable: '不可用',
    unknown: '未知',
}

// ==================== 查表助手 ====================

/**
 * 严格查表：命中返回文案，未命中返回 `fallback`（默认 `-`）。
 *
 * 适用于取值域已完全由后端类型/枚举支撑的字段 —— 宁可显示 `-` 或既定兜底，
 * 也不把未知原始值透出（如表单汇总、导出单元格）。
 */
export function labelOf(map: Record<string, string>, value: string | undefined | null, fallback = '-'): string {
    if (!value) return fallback
    return map[value] ?? fallback
}

/**
 * 宽松查表：命中返回文案，未命中但确有原始值时透出原始值，仅空值返回 `fallback`。
 *
 * 适用于取值域待接口核实的字段（charge_type 目前即是）—— 后端未来新增的合法
 * 取值依旧可读，而不是被兜底文案误导。
 */
export function labelOfLenient(map: Record<string, string>, value: string | undefined | null, fallback = '-'): string {
    if (!value) return fallback
    return map[value] ?? value
}
