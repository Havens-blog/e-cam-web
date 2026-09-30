/**
 * 字段展示文案单源（fieldLabels）— 计费类型域 + 全局资产状态域 + 网络域(eip/eni/lb/vpc)
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
    // WAF 域(各厂商原生状态:阿里/腾讯/火山 suspended、腾讯 EO paused/deleted、华为 bypass)
    suspended: '已暂停', Suspended: '已暂停',
    paused: '已暂停', Paused: '已暂停',
    bypass: '已旁路', Bypass: '已旁路',
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

// ==================== 网络域产品状态/枚举（eip/eni/lb/vpc） ====================

/**
 * EIP 状态 → 展示文案。
 *
 * 产品语义保留：EIP 不与通用运行态同词——InUse/Attached(华为绑定态,实测 39 条)→已绑定、
 * Available→未绑定、Bindable→可绑定。中文键(已绑定/未绑定)为回显态原样收口。
 */
export const EIP_STATUS_LABELS: Record<string, string> = {
    InUse: '已绑定', inuse: '已绑定', '已绑定': '已绑定', Attached: '已绑定',
    Available: '未绑定', available: '未绑定', '未绑定': '未绑定',
    Bindable: '可绑定',
}

/**
 * EIP 实例类型 → 展示文案。
 *
 * 取列表页(index.vue)词表为 canonical（含 ClbInstance/AlbInstance/Nat/EVPN 等
 * 实测补齐键），详情抽屉对齐同一份。
 */
export const EIP_INSTANCE_TYPE_LABELS: Record<string, string> = {
    EcsInstance: 'ECS实例',
    SlbInstance: '负载均衡',
    ClbInstance: '负载均衡',
    AlbInstance: '负载均衡',
    NatGateway: 'NAT网关',
    Nat: 'NAT网关',
    HaVip: '高可用VIP',
    NetworkInterface: '弹性网卡',
    EVPN: 'EVPN网关',
}

/**
 * ENI 状态 → 展示文案。
 *
 * 2026-09-24 全量 5814 条实测值域仅 in_use(4799)/available(1014)/deleting(1) 三值，
 * 其余键为历史映射保留（防御其他厂商接入后出现新变体裸显英文）。
 */
export const ENI_STATUS_LABELS: Record<string, string> = {
    in_use: '使用中', InUse: '使用中', inuse: '使用中',
    available: '可用', Available: '可用',
    attaching: '绑定中', Attaching: '绑定中',
    detaching: '解绑中', Detaching: '解绑中',
    creating: '创建中', Creating: '创建中',
    deleting: '删除中', Deleting: '删除中',
    error: '异常', Error: '异常',
    ACTIVE: '使用中', DOWN: '可用',
    BINDBOUND: '使用中', BINDUNBOUND: '可用',
    PENDING: '创建中',
}

/**
 * ENI 网卡类型 → 展示文案。
 *
 * 2026-09-24 全量实测值域 11 个（厂商分区：huawei=Secondary、
 * aliyun=Primary/Secondary/Bond/Trunk/Member、volcano=primary/secondary/branch/nlb/vpclink/transit_router），
 * 未知值由 labelOfLenient 原样透出。
 */
export const ENI_TYPE_LABELS: Record<string, string> = {
    Primary: '主网卡', primary: '主网卡',
    Secondary: '辅助网卡', secondary: '辅助网卡',
    Bond: 'Bond网卡', Trunk: 'Trunk网卡', Member: '成员网卡',
    branch: '分支网卡', nlb: 'NLB网卡', vpclink: 'VPC Link', transit_router: '中转路由',
}

/**
 * LB 状态 → 展示文案。
 *
 * 实测值域仅 4 个大小写变体：Active(144)/active(156)/ACTIVE(14)/inactive(6)
 * （2026-09-24 全量 320 条探查，后端 status 过滤精确区分大小写），无异常态；
 * 其余键为原页防御性映射原样保留。
 */
export const LB_STATUS_LABELS: Record<string, string> = {
    Active: '运行中', active: '运行中', ACTIVE: '运行中',
    running: '运行中', Running: '运行中',
    inactive: '已停止', Inactive: '已停止', INACTIVE: '已停止',
    stopped: '已停止', Stopped: '已停止',
    available: '可用', Available: '可用',
    creating: '创建中', Creating: '创建中',
    configuring: '配置中', Configuring: '配置中',
    pending: '等待中', Pending: '等待中',
    locked: '已锁定', Locked: '已锁定',
    error: '异常', Error: '异常',
}

/** LB 类型 → 展示文案。实测值域 clb(155)/alb(127)/nlb(21)/slb(17)。 */
export const LB_TYPE_LABELS: Record<string, string> = { slb: 'SLB', alb: 'ALB', nlb: 'NLB', clb: 'CLB' }

/**
 * VPC 状态 → 展示文案。
 *
 * OK(华为/火山系成功态) 实测 22 条，缺此键会裸显英文（2026-09-24 全量 96 条探查）。
 * 中文键(正常/创建中)为回显态原样收口。
 */
export const VPC_STATUS_LABELS: Record<string, string> = {
    Available: '正常', available: '正常', OK: '正常', ok: '正常', '正常': '正常',
    Pending: '创建中', pending: '创建中', '创建中': '创建中',
    error: '异常', Error: '异常',
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
