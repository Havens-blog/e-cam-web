/**
 * 证书详情与引用关系页纯展示逻辑（任务 6.3，UF-2）。
 *
 * 无 Vue / DOM 运行时依赖（扫描会话存储带能力探测注入），可被 node 环境单测
 * 直接导入（同 src/views/cert/ledger/format.ts 约定）。
 *
 * 依据：docs/features/ssl-cert-management/ui/ui-design.md「Component: 证书详情与引用关系页」
 * （Layout/States/Interactions/Data Binding）+ 全局模式（变更单状态徽章色映射 /
 * 长文本规则 / 无障碍规范），prd/prd-ui-functions.md UF-2，
 * design/tech-design.md（引用状态语义、覆盖率分母、SCAN_IN_PROGRESS）。
 *
 * Hard Rules：盲区声明横幅不可关闭不可被筛选隐藏（组件层静态渲染）；
 * 同域名多证书并存按指纹严格区分（反向结果按 API 指纹分组逐卡渲染，不合并）。
 */

import type { CertReferenceGroup, ChangeStatus, CoverageMeta } from '@/api/cert'

// ==================== 云 / 产品标签（分组标题与筛选器） ====================

const CLOUD_LABELS: Record<string, string> = {
    aliyun: '阿里云',
    tencent: '腾讯云',
    huawei: '华为云',
    aws: 'AWS',
    azure: 'Azure',
    k8s: 'K8s',
}

const PRODUCT_LABELS: Record<string, string> = {
    cdn: 'CDN',
    dcdn: 'DCDN',
    waf: 'WAF',
    alb: 'ALB',
    clb: 'CLB',
    nlb: 'NLB',
    ingress: 'Ingress',
    gateway: 'Gateway',
    httproute: 'HTTPRoute',
    albconfig: 'ALBConfig',
}

/** 云展示名（未知云回退原文） */
export function cloudLabel(cloud: string): string {
    return CLOUD_LABELS[cloud] ?? cloud
}

/** 产品展示名（未知产品回退原文） */
export function productLabel(product: string): string {
    return PRODUCT_LABELS[product] ?? product
}

/** K8s 引用分组判定（集群筛选仅对该类分组生效） */
export function isK8sCloud(cloud: string): boolean {
    return cloud === 'k8s' || cloud === 'kubernetes'
}

/** 分组标题：云 · 产品（K8s 组附集群 ID） */
export function groupLabel(g: CertReferenceGroup): string {
    const base = `${cloudLabel(g.cloud)} · ${productLabel(g.product)}`
    return g.clusterId ? `${base} · ${g.clusterId}` : base
}

// ==================== 相对时间 / 扫描新鲜度（扫描元数据行） ====================

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000
const MS_PER_DAY = 86_400_000

/** 最近扫描相对时间：刚刚 / N 分钟前 / Nh 前 / N 天前；null=尚未扫描（blind_spot 依据） */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
    if (!iso) return '尚未扫描'
    const t = Date.parse(iso)
    if (Number.isNaN(t)) return '尚未扫描'
    const diff = now.getTime() - t
    if (diff < MS_PER_MINUTE) return '刚刚'
    if (diff < MS_PER_HOUR) return `${Math.floor(diff / MS_PER_MINUTE)} 分钟前`
    if (diff < MS_PER_DAY) return `${Math.floor(diff / MS_PER_HOUR)}h 前`
    return `${Math.floor(diff / MS_PER_DAY)} 天前`
}

/**
 * 扫描新鲜度默认阈值（小时）：客户端侧 Warning 判定。
 * 服务端 thresholds.scanFreshnessHours 默认 24（tech-design 全局配置页）；
 * 详情页无权限读取 settings（仅主管/审计），故���用同口径本地常量。
 */
export const SCAN_FRESHNESS_DEFAULT_HOURS = 24

/** 扫描超期判定：从未扫描或超过阈值 → true（元数据行变 Warning） */
export function scanStale(
    lastScanAt: string | null | undefined,
    now: Date = new Date(),
    thresholdHours: number = SCAN_FRESHNESS_DEFAULT_HOURS,
): boolean {
    if (!lastScanAt) return true
    const t = Date.parse(lastScanAt)
    if (Number.isNaN(t)) return true
    return now.getTime() - t > thresholdHours * MS_PER_HOUR
}

// ==================== 覆盖率汇总（各云覆盖率 chips） ====================

export interface CloudCoverageChip {
    /** 后端云标识（原始值） */
    cloud: string
    /** 展示名 */
    label: string
    /** 展示文案：百分比 / 分母不可用 / N 集群 */
    text: string
    /** false=存在 total=-1 项（盲区声明，不显示 0%） */
    denominatorAvailable: boolean
    /** asset 盘点滞后（covered>total，以 covered 为准） */
    lagging: boolean
}

interface CloudAgg {
    covered: number
    total: number
    unavailable: boolean
    lagging: boolean
}

/**
 * 覆盖率按云聚合：百分比 = Σcovered/Σtotal（仅可用分母项）；
 * total=-1 项 → 「分母不可用」（不显示 0%，tech-design 失效处理���；
 * K8s 云展示「N 集群」（N=引用分组去重集群数，非覆盖率）；
 * lagging → 百分比封顶 100% + 「asset 盘点滞后」标记。
 */
export function coverageSummary(coverage: readonly CoverageMeta[], k8sClusterCount = 0): CloudCoverageChip[] {
    const byCloud = new Map<string, CloudAgg>()
    for (const c of coverage) {
        const key = c.cloud || 'unknown'
        const agg: CloudAgg = byCloud.get(key) ?? { covered: 0, total: 0, unavailable: false, lagging: false }
        if (!c.denominatorAvailable || c.total < 0) {
            agg.unavailable = true
        } else {
            agg.covered += c.covered
            agg.total += c.total
        }
        if (c.lagging) agg.lagging = true
        byCloud.set(key, agg)
    }
    const chips: CloudCoverageChip[] = []
    for (const [cloud, agg] of byCloud) {
        let text: string
        if (isK8sCloud(cloud) && k8sClusterCount > 0) {
            text = `${k8sClusterCount} 集群`
        } else if (agg.total <= 0) {
            text = agg.unavailable ? '分母不可用' : '—'
        } else {
            const pct = Math.min(100, Math.round((agg.covered / agg.total) * 100))
            text = `${pct}%`
            if (agg.lagging) text += '（asset 盘点滞后）'
            if (agg.unavailable) text += ' · 部分分母不可用'
        }
        chips.push({
            cloud,
            label: cloudLabel(cloud),
            text,
            denominatorAvailable: !agg.unavailable,
            lagging: agg.lagging,
        })
    }
    return chips
}

// ==================== 引用状态文案（三态区分） ====================

/** 未发现引用（≠ 无引用）：已扫描无匹配，附最近扫描时间（区别于空态） */
export function noRefsNotice(lastScanAt: string | null | undefined, now: Date = new Date()): string {
    return `未发现引用（≠ 无引用）· 最近扫描 ${relativeTime(lastScanAt, now)}`
}

/** 盲区声明：优先服务端 reason（referenceStatus=blind_spot 的 reason 字段） */
export function blindSpotNotice(reason?: string): string {
    const trimmed = reason?.trim()
    return trimmed
        ? `引用视图存在盲区：${trimmed}`
        : '引用视图存在盲区：部分云/产品未纳入扫描范围或无成功快照'
}

// ==================== 复合资源 ID（LB 类产品 "{实例ID}/{监听ID}" 拆分展示） ====================

/** 复合资源 ID 拆分结果（实例 ID / 监听 ID） */
export interface ScopedResourceId {
    instanceId: string
    listenerId: string
}

/**
 * 拆分复合资源 ID（腾讯 CLB/华为 ELB/阿里 ALB/NLB 的 "{实例ID}/{监听ID}" 形态）。
 * 恰含一个 "/" 才拆：多斜杠（AWS 监听 ARN）与无斜杠（CDN 域名/K8s 实例名）原样返回 null。
 */
export function splitScopedResourceId(resourceId: string): ScopedResourceId | null {
    const idx = resourceId.indexOf('/')
    if (idx <= 0 || idx === resourceId.length - 1) return null
    if (resourceId.indexOf('/', idx + 1) >= 0) return null
    return { instanceId: resourceId.slice(0, idx), listenerId: resourceId.slice(idx + 1) }
}

/**
 * 资源 ID 展示行：复合形态拆两行（实例 ID / 「监听 {ID}」），其余单行原文。
 * 供表格单元格与抽屉列表渲染（第二行以弱化样式呈现）。
 */
export function resourceIdLines(resourceId: string): string[] {
    const scoped = splitScopedResourceId(resourceId)
    return scoped ? [scoped.instanceId, `监听 ${scoped.listenerId}`] : [resourceId]
}

// ==================== 正向筛选（级联 + 资源名搜索，客户端过滤 refs[]） ====================

export interface ForwardFilters {
    cloud: string
    product: string
    cluster: string
    keyword: string
}

export const EMPTY_FORWARD_FILTERS: ForwardFilters = { cloud: '', product: '', cluster: '', keyword: '' }

export interface ForwardFilterOptions {
    clouds: string[]
    products: string[]
    clusters: string[]
}

/** K8s 引用分组去重集群数（覆盖率「N 集群」与集群筛选选项的数据源） */
export function k8sClusterCount(groups: readonly CertReferenceGroup[]): number {
    const ids = new Set<string>()
    for (const g of groups) {
        if (isK8sCloud(g.cloud) && g.clusterId) ids.add(g.clusterId)
    }
    return ids.size
}

/**
 * 级联筛选选项：云=全量去重；产���=当前云作用域内去重（未选云=全部）；
 * 集群=K8s 分组的 clusterId 去重（非 K8s 作用域为空——集群筛选不适用）。
 */
export function forwardFilterOptions(groups: readonly CertReferenceGroup[], cloud: string): ForwardFilterOptions {
    const scoped = cloud ? groups.filter((g) => g.cloud === cloud) : groups
    const products = [...new Set(scoped.map((g) => g.product))]
    const clusters = [
        ...new Set(scoped.filter((g) => isK8sCloud(g.cloud) && g.clusterId).map((g) => g.clusterId!)),
    ]
    return { clouds: [...new Set(groups.map((g) => g.cloud))], products, clusters }
}

/**
 * 正向引用过滤：组级 云/产品/集群（集群仅匹配 K8s 分组的 clusterId）+
 * 行级资源名搜索（resourceId 子串，大小写不敏感）；整组无命中行则丢弃；
 * 返回新结构，不修改入参（immutable）。
 */
export function filterForwardGroups(
    groups: readonly CertReferenceGroup[],
    filters: ForwardFilters,
): CertReferenceGroup[] {
    const kw = filters.keyword.trim().toLowerCase()
    return groups
        .filter(
            (g) =>
                (!filters.cloud || g.cloud === filters.cloud) &&
                (!filters.product || g.product === filters.product) &&
                (!filters.cluster || (isK8sCloud(g.cloud) && g.clusterId === filters.cluster)),
        )
        .map((g) => (kw ? { ...g, references: g.references.filter((r) => r.resourceId.toLowerCase().includes(kw)) } : g))
        .filter((g) => g.references.length > 0)
}

// ==================== 关联变更历史（按当前证书过滤 + 倒序） ====================

/** 变更单最小形状（ChangeOrder 列表行满足；测试桩共用） */
export interface ChangeOrderLike {
    id?: string
    oldFingerprint: string
    newCertId: string
    createdAt: string
}

export interface ChangeStatusMeta {
    label: string
    tone: 'accent' | 'secondary' | 'success' | 'warning' | 'error' | 'verifying'
    /** 非色觉通道图标字符（执行中用 CSS spinner，icon 为空） */
    icon: string
    /** true=渲染 spinner 动画（执���中） */
    spinner?: boolean
}

const CHANGE_STATUS_META: Record<string, ChangeStatusMeta> = {
    draft: { label: '草稿', tone: 'secondary', icon: '—' },
    pending_confirm: { label: '待确认', tone: 'secondary', icon: '—' },
    executing: { label: '执行中', tone: 'accent', icon: '', spinner: true },
    verifying: { label: '验证中', tone: 'verifying', icon: '◐' },
    completed: { label: '已完成', tone: 'success', icon: '✓' },
    partial_completed: { label: '部分完成', tone: 'warning', icon: '⚠' },
    rolled_back: { label: '已回滚', tone: 'secondary', icon: '⟲' },
    rollback_failed: { label: '回滚失败', tone: 'error', icon: '⚠' },
    cancelled: { label: '已取消', tone: 'secondary', icon: '—' },
}

/** 变更单状态徽章（ui-design 全局模式色映射 + 图标非色觉通道）；未知状态回退 secondary */
export function changeStatusMeta(status: ChangeStatus | string): ChangeStatusMeta {
    return CHANGE_STATUS_META[status] ?? { label: status, tone: 'secondary', icon: '—' }
}

/**
 * 关联变更历史过滤：旧证书指纹或新证书 ID 命中当前证书即关联
 * （当前证书既可能是被更换的旧证书，也可能是换入的新证书），结果按 createdAt 倒序。
 */
export function filterChangeOrders<T extends ChangeOrderLike>(
    orders: readonly T[],
    cert: { id: string; fingerprint: string },
): T[] {
    return orders
        .filter((o) => o.oldFingerprint === cert.fingerprint || o.newCertId === cert.id)
        .slice()
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

// ==================== 有效期进度（剩余天数着状态色） ====================

/** 有效期已消耗百分比（0~100 钳制）；非法日期/空区间 → 0（不渲染误导进度） */
export function validityConsumedPercent(notBefore: string, notAfter: string, now: Date = new Date()): number {
    const start = Date.parse(notBefore)
    const end = Date.parse(notAfter)
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
    const pct = ((now.getTime() - start) / (end - start)) * 100
    return Math.min(100, Math.max(0, Math.round(pct)))
}

// ==================== 反向查询状态（三态区分） ====================

export type ReverseState = 'initial' | 'loading' | 'results' | 'no-match'

/**
 * 反向查询视图状态：未执行查询（无查询词）=initial（输入引导）；
 * 查询完成无匹配=no-match（「未查询到引用该域名/资源的证书」，区别于初始态）；
 * itemCount=null 表示尚未取得结果。
 */
export function resolveReverseState(query: string, loading: boolean, itemCount: number | null): ReverseState {
    if (loading) return 'loading'
    const q = query.trim()
    if (!q) return 'initial'
    if (itemCount === null) return 'initial'
    return itemCount > 0 ? 'results' : 'no-match'
}

// ==================== 扫描会话（防重 + 重入/刷新恢复轮询） ====================

/** 进行中扫描会话（sessionStorage 按 certId 隔离；刷新存活、关标签即弃） */
export interface ScanSession {
    certId: string
    snapshotId?: string
    /** 进行中快照 startedAt（ms，来自 409 meta 或触发时刻） */
    startedAt: number
}

/** 409 SCAN_IN_PROGRESS 解析结果 */
export interface ScanInProgressInfo {
    snapshotId?: string
    startedAt: number
}

export const SCAN_SESSION_KEY_PREFIX = 'cert.scan.'

/** 轮询间隔（ms）：刷新引用视图直至 lastScanAt >= startedAt */
export const SCAN_POLL_INTERVAL_MS = 5_000

/** 会话最大时长（ms）：超时放弃恢复（后端 scan-timeout 任务会失败该快照并释放防重锁） */
export const SCAN_SESSION_MAX_AGE_MS = 30 * 60_000

function scanSessionKey(certId: string): string {
    return `${SCAN_SESSION_KEY_PREFIX}${certId}`
}

function safeSessionStorage(): Storage | null {
    try {
        return typeof globalThis !== 'undefined' ? (globalThis.sessionStorage ?? null) : null
    } catch {
        return null
    }
}

/** 读取进行中扫描会话：损坏/过期/证书不匹配 → null 并清理残留键 */
export function loadScanSession(
    certId: string,
    storage: Storage | null | undefined = safeSessionStorage(),
    now: Date = new Date(),
): ScanSession | null {
    const key = scanSessionKey(certId)
    let raw: string | null = null
    try {
        raw = storage?.getItem(key) ?? null
    } catch {
        return null
    }
    if (!raw) return null
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        tryRemove(storage, key)
        return null
    }
    const s = parsed as Partial<ScanSession> | null
    if (
        !s ||
        typeof s !== 'object' ||
        s.certId !== certId ||
        typeof s.startedAt !== 'number' ||
        now.getTime() - s.startedAt > SCAN_SESSION_MAX_AGE_MS
    ) {
        tryRemove(storage, key)
        return null
    }
    return { certId: s.certId, snapshotId: typeof s.snapshotId === 'string' ? s.snapshotId : undefined, startedAt: s.startedAt }
}

/** 保存进行中扫描会话；storage 不可用静默忽略（仅影响刷新恢复，不影响当次轮询） */
export function saveScanSession(session: ScanSession, storage: Storage | null | undefined = safeSessionStorage()): void {
    try {
        storage?.setItem(scanSessionKey(session.certId), JSON.stringify(session))
    } catch {
        /* 隐私模式等场景放弃持久化 */
    }
}

/** 清除扫描会话（扫描完成/失败/放弃时） */
export function clearScanSession(certId: string, storage: Storage | null | undefined = safeSessionStorage()): void {
    tryRemove(storage, scanSessionKey(certId))
}

function tryRemove(storage: Storage | null | undefined, key: string): void {
    try {
        storage?.removeItem(key)
    } catch {
        /* 忽略 */
    }
}

/**
 * 解析服务端 409 SCAN_IN_PROGRESS：命中 → 进行中信息（meta.startedAt 为
 * 进行中快照开始时间）；meta 缺失/非法时以当前时间兜底（保守进入轮询）。
 * 非该错误码（含普通 Error/null）→ null。鸭子类型判定，避免 node 单测引入 axios 链。
 */
export function parseScanConflict(err: unknown, now: Date = new Date()): ScanInProgressInfo | null {
    if (!err || typeof err !== 'object') return null
    const e = err as { code?: unknown; meta?: unknown }
    if (e.code !== 'SCAN_IN_PROGRESS') return null
    let snapshotId: string | undefined
    let startedAt = now.getTime()
    const meta = e.meta
    if (meta && typeof meta === 'object') {
        const m = meta as { snapshotId?: unknown; startedAt?: unknown }
        if (typeof m.snapshotId === 'string' && m.snapshotId) snapshotId = m.snapshotId
        if (typeof m.startedAt === 'string') {
            const t = Date.parse(m.startedAt)
            if (!Number.isNaN(t)) startedAt = t
        }
    }
    return { snapshotId, startedAt }
}

/**
 * 轮询完成判定：references.lastScanAt（最新成功快照 startedAt，服务端口径）
 * >= 会话 startedAt → 该轮扫描已���功落库，可退出「扫描中」态并刷新元数据。
 */
export function isScanComplete(lastScanAt: string | null | undefined, startedAt: number): boolean {
    if (!lastScanAt) return false
    const t = Date.parse(lastScanAt)
    if (Number.isNaN(t)) return false
    return t >= startedAt
}
