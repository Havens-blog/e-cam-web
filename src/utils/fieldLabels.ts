/**
 * 字段展示文案单源（fieldLabels）— 计费类型域 + 全局资产状态域 + 网络域(eip/eni/lb/vpc/vswitch/waf/ddos/dns) + 计算域(ecs/image/disk) + 数据库域(rds/redis/mongodb) + 中间件/存储域(es/kafka/nas) + 快照域(snapshot) + 服务树节点状态
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
    // WAF 域实测值（azure 系计费词,原 WAF 抽屉本地 map 并入）
    subscription: '包年包月', Subscription: '包年包月',
    payasyougo: '按量付费', PayAsYouGo: '按量付费',
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
    InUse: '已绑定', inuse: '已绑定', in_use: '已绑定', '已绑定': '已绑定', Attached: '已绑定',
    BIND: '已绑定', BIND_ENI: '已绑定',
    Available: '未绑定', available: '未绑定', UNBIND: '未绑定', '未绑定': '未绑定',
    Bindable: '可绑定',
    associating: '绑定中', Associating: '绑定中', Attaching: '绑定中',
    unassociating: '解绑中', Unassociating: '解绑中', Detaching: '解绑中',
    releasing: '释放中', Releasing: '释放中',
    pending: '创建中', error: '异常', frozen: '已冻结', Frozen: '已冻结',
    unknown: '未知',
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
    updating: '更新中',
    deleting: '删除中', Deleting: '删除中',
    pending: '等待中', Pending: '等待中',
    locked: '已锁定', Locked: '已锁定',
    error: '异常', Error: '异常',
    frozen: '已冻结',
    unknown: '未知',
}

/** LB 类型 → 展示文案。实测值域 clb(155)/alb(127)/nlb(21)/slb(17)。 */
export const LB_TYPE_LABELS: Record<string, string> = { slb: 'SLB', alb: 'ALB', nlb: 'NLB', clb: 'CLB', elb: 'ELB' }

/**
 * VPC 状态 → 展示文案。
 *
 * OK(华为/火山系成功态) 实测 22 条，缺此键会裸显英文（2026-09-24 全量 96 条探查）。
 * 中文键(正常/创建中)为回显态原样收口。
 */
export const VPC_STATUS_LABELS: Record<string, string> = {
    Available: '正常', available: '正常', OK: '正常', ok: '正常', '正常': '正常',
    Pending: '创建中', pending: '创建中', '创建中': '创建中',
    deleting: '删除中', Deleting: '删除中',
    error: '异常', Error: '异常',
    unknown: '未知',
}

// ==================== 网络域产品状态/枚举（vswitch/waf/dns） ====================

/**
 * VSwitch 状态 → 展示文案。
 *
 * 实测值域仅 Available(613)/available(130)/ACTIVE(117) 三个大小写变体（2026-09-24
 * 全量 860 条探查），全为成功族；Pending/creating/Deleting 保留防御键。
 * 列表页与详情抽屉共用此单源（键以列表页 canonical 为准）。
 */
export const VSWITCH_STATUS_LABELS: Record<string, string> = {
    Available: '可用', available: '可用', ACTIVE: '可用', active: '可用', '可用': '可用',
    Pending: '创建中', pending: '创建中', creating: '创建中',
    Deleting: '删除中', deleting: '删除中',
    DOWN: '异常', error: '异常',
    unknown: '未知',
}

/**
 * WAF 状态 → 展示文案（列表页 canonical：active→正常 / suspended→已暂停 / pending→待接入）。
 *
 * 实测值域仅 active(160)/suspended(252)/pending(13) 三值（2026-09-24 全量 425 条探查，
 * 全小写）。收敛前 index 本地词表(active→正常)与抽屉 ASSET_STATUS_LABELS(active→运行中)
 * 已漂移，本表为唯一 WAF 口径；WAF 域原生近义态(paused/bypass 等)仍由
 * ASSET_STATUS_LABELS 承载，可作回退链使用。
 */
export const WAF_STATUS_LABELS: Record<string, string> = { active: '正常', suspended: '已暂停', pending: '待接入' }

/**
 * WAF 版本(edition) → 展示文案。
 *
 * 键集以列表页为准：实测值域 EdgeOne(13)/sparta-waf(100)/空(312)，basic/pro 等键为
 * 历史兼容保留。收敛前 index(6 键)与抽屉(4 键)两份且键集不等，本表为唯一来源。
 */
export const WAF_EDITION_LABELS: Record<string, string> = {
    'sparta-waf': 'Sparta WAF',
    EdgeOne: 'EdgeOne',
    basic: '基础版',
    pro: '专业版',
    business: '商业版',
    enterprise: '企业版',
}

/** WAF 防护模式 → 展示文案。实测 block(99)/observe(11)/空(315)；仅展示，非有效后端筛参。 */
export const WAF_PROTECTION_MODE_LABELS: Record<string, string> = { block: '拦截', observe: '观察', off: '关闭' }

/**
 * DDoS 状态 → 展示文案（列表页 canonical；键值以腾讯云 DDoS 防护实例状态注释实证）。
 *
 * 腾讯取值域：idle/attacking/blocking/creating/deblocking/isolate（全小写厂商原生字符串，
 * 后端直透 SDK 值）；阿里/华为为各自厂商原值（可能为中文），本表不臆造、不代收其他
 * 厂商状态。未知值透出策略：调用方直查本表（DDoS 页 getStatusText / 详情抽屉），
 * 未命中时原样透出原始值，不回退全局 ASSET_STATUS_LABELS —— 避免厂商原生值被全局
 * 通用词（如 active→运行中）误译。
 */
export const DDOS_STATUS_LABELS: Record<string, string> = {
    idle: '正常',
    attacking: '攻击中',
    blocking: '封堵中',
    creating: '创建中',
    deblocking: '解封中',
    isolate: '隔离中',
}

/**
 * DNS 域名状态 → 展示文案。
 *
 * paused→暂停 为 DNS 域专属语义，不并入通用运行态（ASSET_STATUS_LABELS 的 paused→已暂停
 * 不适用于域名）。
 */
export const DNS_DOMAIN_STATUS_LABELS: Record<string, string> = { normal: '正常', paused: '暂停', locked: '锁定' }

/**
 * DNS 解析线路（运营商）→ 展示文案。
 *
 * RecordTable 状态列查表与 RecordFormDialog 线路下拉选项共用此单源。
 */
export const DNS_LINE_LABELS: Record<string, string> = { default: '默认', telecom: '电信', unicom: '联通', mobile: '移动' }

/** DNS 解析记录接入源 → 展示文案（RecordTable 关联资源列）。 */
export const DNS_RECORD_SOURCE_LABELS: Record<string, string> = { cdn: 'CDN', waf: 'WAF', slb: 'SLB', ecs: 'ECS', eip: 'EIP' }

// ==================== 计算域产品状态/枚举（ecs/image/disk） ====================

/**
 * ECS 状态 → 展示文案（列表页 canonical）。
 *
 * ECS 域专属措辞：stopped→已关机（不与全局 ASSET_STATUS_LABELS 的 stopped→已停止
 * 同词），列表页/详情抽屉/导出/统计卡筛选用同一份。键含大小写变体：
 * getStatusText 走 toUpperCase 查大写键，统计卡筛选/导出走原始键直查。
 */
export const ECS_STATUS_LABELS: Record<string, string> = {
    RUNNING: '运行中', Running: '运行中', running: '运行中',
    STOPPED: '已关机', Stopped: '已关机', stopped: '已关机',
    DELETED: '已删除', Deleted: '已删除', deleted: '已删除',
    PENDING: '创建中', Pending: '创建中', pending: '创建中',
}

/**
 * 镜像状态 → 展示文案（列表页 canonical）。
 *
 * 实测值域仅 Available(141)/available(506)/active(16)/NORMAL(6) 四个大小写变体，
 * 全部为成功族（2026-09-24 全量 669 条探查）；原页词表缺 active/NORMAL 键会裸显
 * 英文，按镜像域近义态防御性扩展。未知值由调用方回退全局 ASSET_STATUS_LABELS
 * 后透出原始值。
 */
export const IMAGE_STATUS_LABELS: Record<string, string> = {
    available: '可用', Available: '可用', active: '可用', Active: '可用', ACTIVE: '可用', NORMAL: '可用',
    creating: '创建中', Creating: '创建中', importing: '导入中', Importing: '导入中',
    waiting: '等待中', Waiting: '等待中',
    unavailable: '不可用', UnAvailable: '不可用', failed: '失败', Failed: '失败',
}

/** 镜像类型 → 展示文案（沿用原页口径：system 公共 / self 自定义 / others 共享 / marketplace 市场）。 */
export const IMAGE_TYPE_LABELS: Record<string, string> = {
    system: '公共', self: '自定义', others: '共享', marketplace: '市场',
}

/** 镜像操作系统类型 → 展示文案（platform/os_name 均缺失时的兜底）。 */
export const OS_TYPE_LABELS: Record<string, string> = { linux: 'Linux', windows: 'Windows' }

/**
 * 云盘状态 → 展示文案（列表页 canonical）。
 *
 * 值域随厂商大小写/连字符不一（In_use/in-use/attached/available），查表方须先
 * toLowerCase 归一。attached→已挂载 为盘域专属措辞；原 ecs 主机抽屉盘状态把
 * attached 写成「使用中」已按列表页口径对齐。
 */
export const DISK_STATUS_LABELS: Record<string, string> = {
    in_use: '使用中', 'in-use': '使用中', attached: '已挂载',
    available: '可用', creating: '创建中', attaching: '挂载中', detaching: '卸载中',
}

/** 云盘类型（category）→ 展示文案（阿里云盘家族：高效/SSD/ESSD/普通）。 */
export const DISK_CATEGORY_LABELS: Record<string, string> = {
    cloud_efficiency: '高效云盘', cloud_ssd: 'SSD云盘', cloud_essd: 'ESSD云盘', cloud: '普通云盘',
}

// ==================== 数据库域产品状态（rds/redis/mongodb） ====================

/**
 * RDS 状态 → 展示文案（列表页 canonical）。
 *
 * 键集取 index 词表全量（running/stopped/shutdown/creating/deleting），详情抽屉
 * 原缺 deleting 键，收敛后对齐同一份。查表方用 labelOfLenient：命中返回文案，
 * 未知原始值原样透出。shutdown→已停止 为数据库域原生停止态，与 stopped 同词。
 */
export const RDS_STATUS_LABELS: Record<string, string> = {
    running: '运行中', Running: '运行中', RUNNING: '运行中',
    stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
    shutdown: '已停止', Shutdown: '已停止',
    creating: '创建中', Creating: '创建中',
    deleting: '删除中', Deleting: '删除中',
}

/**
 * Redis 状态 → 展示文案（列表页 canonical）。
 *
 * normal→运行中 为 Redis 域健康态（阿里云 Redis 正常态），不与全局
 * ASSET_STATUS_LABELS 的 normal 冲突，本表为唯一 Redis 口径。
 */
export const REDIS_STATUS_LABELS: Record<string, string> = {
    running: '运行中', Running: '运行中', RUNNING: '运行中',
    normal: '运行中', Normal: '运行中', NORMAL: '运行中',
    stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
    shutdown: '已停止', Shutdown: '已停止',
    creating: '创建中', Creating: '创建中',
}

/**
 * MongoDB 状态 → 展示文案（列表页 canonical）。
 *
 * 键集与 RDS 同构（running/stopped/shutdown/creating/deleting）；收敛前抽屉只认
 * running/stopped，creating/deleting/shutdown 裸显英文，收敛后对齐。
 */
export const MONGODB_STATUS_LABELS: Record<string, string> = {
    running: '运行中', Running: '运行中', RUNNING: '运行中',
    stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
    shutdown: '已停止', Shutdown: '已停止',
    creating: '创建中', Creating: '创建中',
    deleting: '删除中', Deleting: '删除中',
}

// ==================== 快照域产品状态（snapshot） ====================

/**
 * 快照状态 → 展示文案（列表页 canonical）。
 *
 * 实测值域（2026-09-24 全量 3620 条）：顶层 status 的「成功族」为
 * accomplished(阿里云)/available(华为+火山)/NORMAL(腾讯)/completed(AWS)，
 * 不同类型同义而值不同，统一收敛为「正常」；progressing/failed 为历史映射保留。
 * 抽屉此前只认 accomplished/normal/progressing/failed，available/NORMAL/completed
 * 会裸显英文，本表补齐厂商成功态变体（大小写均收）。
 */
export const SNAPSHOT_STATUS_LABELS: Record<string, string> = {
    accomplished: '正常', Accomplished: '正常', ACCOMPLISHED: '正常',
    available: '正常', Available: '正常', AVAILABLE: '正常',
    NORMAL: '正常', normal: '正常', Normal: '正常',
    completed: '正常', Completed: '正常', COMPLETED: '正常',
    progressing: '创建中', Progressing: '创建中',
    failed: '失败', Failed: '失败', FAILED: '失败',
}

// ==================== 服务树节点状态（service-tree） ====================

/**
 * 服务树节点状态 → 展示文案。
 *
 * 服务树节点为业务维度健康态（active→活跃、inactive→未激活），与资产运行态
 * （ASSET_STATUS_LABELS 的 active→运行中）语义不同，不并入通用词表；
 * service-tree/index.vue 与 BindResourceDialog.vue 共用此单源以防漂移。
 */
export const SERVICE_NODE_STATUS_LABELS: Record<string, string> = {
    running: '运行中',
    active: '活跃',
    stopped: '已停止',
    inactive: '未激活',
    error: '错误',
    terminated: '已终止',
}

// ==================== 对象存储域枚举（oss） ====================

/**
 * OSS 存储类型 → 展示文案。
 *
 * 真实值域含厂商大小写差异（实测 aliyun=Standard、tencent/aws=STANDARD），
 * 统一以小写键归一展示；列表/详情/导出共用此单源（原列表 map、导出 map、抽屉
 * map 三份键集不等、导出缺 ColdArchive、抽屉对 STANDARD 裸显英文）。
 */
export const OSS_STORAGE_CLASS_LABELS: Record<string, string> = {
    standard: '标准存储',
    ia: '低频存储',
    archive: '归档存储',
    coldarchive: '冷归档存储',
}

/**
 * OSS ACL 权限 → 展示文案（列表导出与详情抽屉共用，防双份漂移）。
 */
export const OSS_ACL_LABELS: Record<string, string> = {
    private: '私有',
    'public-read': '公共读',
    'public-read-write': '公共读写',
}

// ==================== 中间件+存储域产品状态（es/kafka/nas） ====================

/**
 * Elasticsearch 状态 → 展示文案（列表页 canonical）。
 *
 * active→运行中 为 ES 域原生运行态（与 running 同义），不并入全局
 * ASSET_STATUS_LABELS，本表为唯一 ES 口径。键含大小写变体：列表页/抽屉
 * getStatusText 走 toLowerCase 查表，labelOfLenient 直查，变体键保证两口径等价。
 */
export const ES_STATUS_LABELS: Record<string, string> = {
    running: '运行中', Running: '运行中', RUNNING: '运行中',
    active: '运行中', Active: '运行中', ACTIVE: '运行中',
    stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
    creating: '创建中', Creating: '创建中',
}

/**
 * Kafka 状态 → 展示文案（列表页 canonical）。
 *
 * serving→运行中 为 Kafka 域原生运行态（阿里云 Serving），shutdown→已停止
 * 与域内 getStatusClass 停止态口径一致。键含大小写变体，理由同上。
 */
export const KAFKA_STATUS_LABELS: Record<string, string> = {
    running: '运行中', Running: '运行中', RUNNING: '运行中',
    serving: '运行中', Serving: '运行中', SERVING: '运行中',
    stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
    shutdown: '已停止', Shutdown: '已停止',
    creating: '创建中', Creating: '创建中',
}

/**
 * NAS 状态 → 展示文案（列表页 canonical）。
 *
 * pending/creating→创建中 为 NAS 域创建期两态；大写 Running/Stopped 为历史
 * 回显值（2026-09 实测 95 条全小写 running），保留防御键防裸显英文。
 */
export const NAS_STATUS_LABELS: Record<string, string> = { running: '运行中', Running: '运行中', RUNNING: '运行中',
    stopped: '已停止', Stopped: '已停止', STOPPED: '已停止',
    pending: '创建中', Pending: '创建中', PENDING: '创建中',
    creating: '创建中', Creating: '创建中',
}

/**
 * NAS 文件系统类型 → 展示文案（列表页与详情抽屉共用，防双份漂移）。
 */
export const NAS_FILE_SYSTEM_TYPE_LABELS: Record<string, string> = {
    standard: '通用型',
    extreme: '极速型',
    cpfs: 'CPFS',
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
