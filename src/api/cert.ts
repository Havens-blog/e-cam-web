/**
 * 证书管理 API（e-cam-service internal/cert，任务 6.1 脚手架）
 *
 * 端点契约：docs/features/ssl-cert-management/design/api-handbook.md（权威源）。
 * 传输：certAxios（./request/cert.ts，ecmdb token + 401 跳登录）。
 * 信封：所有响应为 {success, data, error, meta}，经 unwrapCertEnvelope 解包——
 * 业务/HTTP 错误统一转译为 CertRequestError（保留 api-handbook 字符串错误码，
 * 供页面按 SCAN_IN_PROGRESS / CHANGE_IN_FLIGHT 等分支处理）。
 * 类型：字段名镜像后端 web 层 VO 的 json tag（internal/cert/web/*.go）。
 * 私钥：任何接口不返回明文私钥（详情仅 hasKey 布尔）。
 */

import type { AxiosError, AxiosResponse } from 'axios'
import { certAxios } from './request/cert'

// ==================== 信封与错误 ====================

/** api-handbook 错误载荷：code 为字符串错误码（如 CERT_HAS_REFS） */
export interface CertApiErrorPayload {
    code: string
    message: string
}

/** 证书域统一响应信封 */
export interface CertEnvelope<T = unknown> {
    success: boolean
    data?: T
    error?: CertApiErrorPayload
    meta?: unknown
}

/** 证书域请求错误：保留字符串错误码供调用方分支处理 */
export class CertRequestError extends Error {
    readonly code: string

    /**
     * 错误信封的结构化 meta（可选）。删除拦截 409 CERT_HAS_REFS 携带
     * deleteBlockedMeta{referenceStatus, refCount, reason, protectUntil}，
     * 台账页拦截 Modal 渲染「N 个活跃引用 / 保护期至 X 日」所需（任务 6.2）。
     */
    readonly meta?: unknown

    constructor(code: string, message: string, meta?: unknown) {
        super(message)
        this.name = 'CertRequestError'
        this.code = code
        this.meta = meta
    }
}

/** 非法信封（非 cert 后端响应或网关异常）的兜底错误码 */
const CODE_INVALID_ENVELOPE = 'INVALID_ENVELOPE'

function isEnvelope(v: unknown): v is CertEnvelope {
    return typeof v === 'object' && v !== null && typeof (v as CertEnvelope).success === 'boolean'
}

/**
 * 解开 {success, data, error, meta} 信封：成功返回 data；
 * 业务错误（2xx success=false）与非 2xx 错误信封均抛 CertRequestError；
 * 网络错误/无信封载荷原样抛出（不吞错）。
 */
export async function unwrapCertEnvelope<T>(p: Promise<AxiosResponse<CertEnvelope<T>>>): Promise<T> {
    let body: unknown
    try {
        body = (await p).data
    } catch (err) {
        const envelope = (err as AxiosError<CertEnvelope<T>>)?.response?.data
        if (isEnvelope(envelope) && !envelope.success && envelope.error) {
            throw new CertRequestError(envelope.error.code, envelope.error.message, envelope.meta)
        }
        throw err
    }
    if (!isEnvelope(body)) {
        throw new CertRequestError(CODE_INVALID_ENVELOPE, 'cert 接口响应格式错误')
    }
    if (!body.success) {
        throw new CertRequestError(
            body.error?.code ?? 'UNKNOWN',
            body.error?.message ?? 'cert 请求失败',
            body.meta,
        )
    }
    return body.data as T
}

// ==================== 枚举全集（api-handbook Data Contracts） ====================

/** 托管状态：完整托管 / 仅指纹登记 */
export type HostingStatus = 'complete' | 'fingerprint_only'

/** 变更单状态机 9 态（含 cancelled 取消终态） */
export type ChangeStatus =
    | 'draft'
    | 'pending_confirm'
    | 'executing'
    | 'verifying'
    | 'completed'
    | 'partial_completed'
    | 'rolled_back'
    | 'rollback_failed'
    | 'cancelled'

/** 变更项状态（执行/报告单项） */
export type ChangeItemStatus =
    | 'pending'
    | 'running'
    | 'success'
    | 'failed'
    | 'rate_limited'
    | 'rolled_back'
    | 'rollback_failed'
    | 'skipped'

/** TLS 探测状态 6 值（change_linked_diff=验证窗口内变更关联差异） */
export type ProbeStatus =
    | 'consistent'
    | 'diff'
    | 'change_linked_diff'
    | 'unreachable'
    | 'exempt'
    | 'wildcard_skipped'

/** 引用三态（"未发现引用" ≠ "无引用"） */
export type ReferenceStatus = 'has_refs' | 'no_refs_scanned' | 'blind_spot'

/** 到期分级告警去重状态（仅升级触发） */
export type ExpiryAlertLevel = 'none' | 'L30' | 'L14' | 'L7' | 'expired'

/** 批量导入会话状态（轮询终态） */
export type BatchSessionStatus = 'running' | 'completed' | 'partial_failed'

/** 批量导入单文件结果 */
export type BatchFileResult = 'complete' | 'fingerprintOnly' | 'failed'

/** 到期看板/台账筛选的剩余天数分档（互斥桶） */
export type DaysLeftTier = 'gt30' | 'le30' | 'le14' | 'le7' | 'expired'

/** 执行通道类型（ExecutionChannel.Type） */
export type ChannelType = 'cloud_api' | 'k8s_api' | 'bastion' | 'agent'

/** 云产品枚举（首期六产品） */
export type CloudProduct = 'cdn' | 'dcdn' | 'waf' | 'alb' | 'clb' | 'nlb'

// ==================== 台账类型 ====================

/** 台账列表行 */
/** 盘点容忍材料异常标记（发现导入容忍登记写入；缺省=正常） */
export type MaterialIssue = 'expired' | 'chain_incomplete'

export interface CertListItem {
    id: string
    fingerprint: string
    commonName: string
    sans: string[]
    issuer: string
    notAfter: string
    daysLeft: number
    hostingStatus: HostingStatus
    materialIssue?: MaterialIssue
    protectUntil: string | null
    refCount: number
}

/** 证书详情（不含明文私钥，仅 hasKey 布尔） */
export interface CertDetail {
    id: string
    fingerprint: string
    commonName: string
    sans: string[]
    issuer: string
    serialNumber: string
    notBefore: string
    notAfter: string
    daysLeft: number
    keyAlgorithm: string
    hostingStatus: HostingStatus
    materialIssue?: MaterialIssue
    hasKey: boolean
    expectedDomain?: string
    protectUntil: string | null
    expiryAlertLevel: ExpiryAlertLevel
    createdAt: string
    refCount: number
    referenceStatus: ReferenceStatus
}

/** 台账列表查询参数（服务端分页+筛选+搜索） */
export interface ListCertsParams {
    page?: number
    pageSize?: number
    hostingStatus?: HostingStatus
    daysLeft?: DaysLeftTier
    search?: string
}

/** 台账列表响应（data 载荷，分页信息随载荷返回） */
export interface ListCertsResponse {
    items: CertListItem[]
    total: number
    page: number
    pageSize: number
}

/** 台账统计（覆盖率双指标，GET /certs/stats） */
export interface CertStats {
    total: number
    complete: number
    fingerprintOnly: number
    missingRegistrations: number
    registrationRate: number
    replaceableRate: number
    fingerprintOnlyRate: number
    denominator: number
    denominatorSources: {
        scannedUniqueFingerprints: number
        manualOnlyFingerprints: number
    }
}

/** 导入证书响应（POST /certs） */
export interface ImportCertResult {
    certId: string
    fingerprint: string
    hostingStatus: HostingStatus
}

/** 批量导入单文件条目 */
export interface BatchImportFile {
    fileName: string
    result: BatchFileResult
    certId?: string
    errorReason?: string
}

/** 批量导入会话（POST /certs/batch 与 GET /certs/batch/:batchId 同构） */
export interface BatchImportSession {
    batchId: string
    status: BatchSessionStatus
    files: BatchImportFile[]
    progress: { total: number; done: number; failed: number }
}

// ==================== 引用关系类型 ====================

/** 正向引用单条（资源白名单字段） */
export interface CertReferenceItem {
    resourceId: string
    referencedCloudCertId: string
    accountKey?: string
    namespace?: string
    kind?: string
}

/** 引用分组（云×产品/集群） */
export interface CertReferenceGroup {
    cloud: string
    product: string
    clusterId?: string
    references: CertReferenceItem[]
}

/** 覆盖率元数据（分母=asset 资产盘点；denominatorAvailable=false 输出盲区声明） */
export interface CoverageMeta {
    cloud: string
    product: string
    covered: number
    total: number
    denominatorAvailable: boolean
    denominatorNote?: string
    lagging?: boolean
}

/** 正向引用视图（GET /certs/:id/references） */
export interface CertReferencesView {
    certId: string
    fingerprint: string
    referenceStatus: ReferenceStatus
    refCount: number
    reason?: string
    lastScanAt: string | null
    snapshotId?: string
    groups: CertReferenceGroup[]
    coverage: CoverageMeta[]
    coverageBoundary: string
}

/** 反向查询命中项（域名/资源 → 证书） */
export interface ReverseLookupItem {
    cloud?: string
    product?: string
    clusterId?: string
    namespace?: string
    kind?: string
    resourceId: string
    referencedCloudCertId: string
    accountKey?: string
}

/** 反向查询单证书卡片（同域名多证书并存时按指纹严格区分，API 逐指纹返回不合并） */
export interface ReverseLookupCert {
    fingerprint: string
    certId?: string
    registered: boolean
    commonName?: string
    sans?: string[]
    hostingStatus?: string
    referenceCount: number
    references: ReverseLookupItem[]
}

/** 反向查询响应（GET /certs/reverse；无匹配 → items 空数组，区别于错误） */
export interface ReverseLookupResponse {
    query: string
    count: number
    items: ReverseLookupCert[]
}

/** 立即扫描响应（同步至终态返回；防重 409 SCAN_IN_PROGRESS 走 CertRequestError.meta） */
export interface TriggerScanResult {
    snapshotId: string
    status: string
    failReason?: string
    referencesWritten?: number
    channelsAttempted?: number
    channelsFailed?: number
}

// ==================== 到期看板类型 ====================

/** 看板总览（countsByLevel 依次为 >30/≤30/≤14/≤7/已过期 五档） */
export interface DashboardSummary {
    countsByLevel: number[]
    diffAlertCount: number
    exemptCount: number
    wildcardSkippedCount: number
    registrationRate: number
    replaceableRate: number
    fingerprintOnlyRate: number
}

/** 看板行（probeStatus 空串=尚未探测；referencedClouds K8s 记 "k8s"） */
export interface DashboardItem {
    domain: string
    daysLeft: number
    level: DaysLeftTier
    hostingType: HostingStatus
    probeStatus: ProbeStatus | ''
    referencedClouds: string[]
    /** 归属证书 ID（抽屉「查看证书详情」跳转 /certs/:id；任务 6.4 增量） */
    certId: string
    /** 归属证书台账指纹（线上指纹比对基准） */
    fingerprint: string
    /** 最近探测时点；未探测为 null */
    lastProbeAt: string | null
    /** 线上生效证书指纹；不可达/跳过等无值场景为空串 */
    onlineFingerprint: string
}

/** 看板响应（GET /certs/dashboard，全角色含只读） */
export interface CertDashboardResponse {
    summary: DashboardSummary
    items: DashboardItem[]
    lastInspectionAt: string | null
}

// ==================== 变更管理类型 ====================

/** 部署目标（ChangeItem.resourceRef 持久化的 DeployTarget） */
export interface DeployTarget {
    channel: ChannelType
    cloud?: string
    product?: CloudProduct
    accountKey?: string
    clusterId?: string
    namespace?: string
    kind?: string
    resourceId: string
}

/** SAN 预检结果 */
export interface SanCheckResult {
    passed: boolean
    missing: string[]
    newSans: string[]
}

/** 变更清单单项 */
export interface ChangeListItem {
    itemId: string
    target: DeployTarget
    action: 'upload_and_bind' | 'patch_crd'
    autoChangeable: boolean
    reason?: string
}

/** 生成变更清单响应（POST /certs/changes） */
export interface ChangeList {
    orderId: string
    oldFingerprint: string
    newCertId: string
    snapshotId: string
    scanFreshnessHrs: number
    items: ChangeListItem[]
    sanCheck: SanCheckResult
    warnings: string[]
}

/** 变更单列表行 */
export interface ChangeOrder {
    id: string
    oldFingerprint: string
    newCertId: string
    status: ChangeStatus
    snapshotId: string
    currentBatch: number
    totalBatches: number
    paused: boolean
    verifyWindowUntil?: string
    creator: string
    createdAt: string
}

/** 变更单列表查询参数 */
export interface ListChangesParams {
    status?: ChangeStatus
    page?: number
    pageSize?: number
}

/** 变更单列表响应 */
export interface ListChangesResponse {
    items: ChangeOrder[]
    total: number
    page: number
    pageSize: number
}

/** 分批灰度配置（Confirm 入参；单批 ≤ floor(total/2)） */
export interface BatchConf {
    enabled: boolean
    batchSize: number
    maxBatchRatio: number
}

/** 批次信息（batchInfo） */
export interface ChangeBatchInfo {
    totalBatches: number
    currentBatch: number
    batchSize: number
    paused: boolean
    pausedAt?: string
}

/** 变更单详情项（含批次归属与状态） */
export interface ChangeDetailItem {
    itemId: string
    target: DeployTarget
    action: 'upload_and_bind' | 'patch_crd'
    autoChangeable: boolean
    reason?: string
    batchNo: number
    status: ChangeItemStatus
    error?: string
}

/** 报告汇总计数 */
export interface ChangeReportSummary {
    total: number
    success: number
    failed: number
    skipped: number
    rolledBack: number
}

/** 报告单项（与 ChangeItem 一一对应） */
export interface ChangeReportItem {
    itemId: string
    target: DeployTarget
    status: ChangeItemStatus
    errCode?: string
    latencyMs: number
}

/** 验证窗口汇总 */
export interface VerifySummary {
    windowUntil: string
    expectedNew: string
    probePass: number
    probeDiff: number
    probeSkipped: number
    unmet: number
}

/** 孤儿证书清理单项结果 */
export interface OrphanCleanupResult {
    cloud: string
    cloudCertId: string
    action: 'cleanup' | 'skip_keep'
    success: boolean
    at: string
}

/** 变更报告（GetReport 载荷） */
export interface ChangeReport {
    orderId: string
    status: ChangeStatus
    summary: ChangeReportSummary
    items: ChangeReportItem[]
    verify: VerifySummary
    orphanCleanup: OrphanCleanupResult[]
    unmetDomains: string[]
    finishedAt: string
}

/** 变更单详情（GET /certs/changes/:id；终态单附报告） */
export interface ChangeDetail {
    orderId: string
    oldFingerprint: string
    newCertId: string
    snapshotId: string
    scanFreshnessHrs: number
    status: ChangeStatus
    batchInfo?: ChangeBatchInfo
    verifyWindowUntil?: string
    protectUntil?: string
    creator: string
    createdAt: string
    items: ChangeDetailItem[]
    report?: ChangeReport
}

/** 执行进度单项（2s 轮询） */
export interface ChangeProgressItem {
    itemId: string
    status: ChangeItemStatus
    error?: string
    batchNo: number
}

/** 执行进度响应 */
export interface ChangeProgress {
    orderId: string
    status: ChangeStatus
    currentBatch: number
    itemStates: ChangeProgressItem[]
}

/** 变更审计日志条目（按单号查询，可与报告逐条比对） */
export interface ChangeAuditLog {
    at: string
    actor: string
    action:
        | 'create'
        | 'confirm'
        | 'execute'
        | 'item_result'
        | 'rollback'
        | 'verify'
        | 'orphan_cleanup'
        | (string & {})
    detail: string
    itemId?: string
}

/** 变更审计响应 */
export interface ChangeAuditResponse {
    orderId: string
    logs: ChangeAuditLog[]
}

// ==================== 全局配置类型 ====================

/** 阈值参数（界值服务端校验，越界 400 整体拒绝） */
export interface CertThresholds {
    scanFreshnessHours: number
    verifyWindowHours: number
    rollbackProtectDays: number
    verifyConfirmProbes: number
    verifyProbeIntervalMinutes: number
    pauseTimeoutHours: number
    recheckDelayMinutes: number
    itemHeartbeatTimeoutMinutes: number
    scanTimeoutHours: number
    expiryLevels: number[]
}

/** 验证窗口告警路由（change_linked_diff 专用通道） */
export interface VerifyWindowRoute {
    enabled: boolean
    webhookUrls: string[]
    emailGroup: string[]
}

/** 探测豁免条目 */
export interface CertExemption {
    domain: string
    reason?: string
    operator?: string
    createdAt: string
}

/** 全局配置视图（GET /certs/settings） */
export interface CertSettings {
    webhookUrls: string[]
    emailGroup: string[]
    channelConfirmed: boolean
    verifyWindowRoute?: VerifyWindowRoute
    wildcardProbeOverrides: Record<string, string>
    thresholds: CertThresholds
    exemptions: CertExemption[]
}

/** 更新全局配置载荷（PUT /certs/settings；thresholds 必填） */
export interface UpdateCertSettingsPayload {
    webhookUrls: string[]
    emailGroup: string[]
    verifyWindowRoute?: VerifyWindowRoute
    wildcardProbeOverrides: Record<string, string>
    thresholds: CertThresholds
}

/** 测试告警结果 */
export interface TestAlertResult {
    sent: boolean
    reason?: string
}

// ==================== 云端发现导入类型 ====================

/** 发现预览可解析降级原因（parseable=false 不可选；deferred_parse 仍可选） */
export type DiscoveryParseReason = 'deferred_parse' | 'unsupported_cloud' | 'iam_hosted'

/** 发现预览唯一证书条目（七字段；cloud+accountKey+cloudCertId 三元组定位） */
export interface DiscoveryPreviewEntry {
    cloud: string
    accountKey: string
    cloudCertId: string
    refCount: number
    inLedger: boolean
    /** 台账 RFC3339；未登记为占位文案「—（导入后补全）」（后端 DiscoveryNotAfterPending） */
    notAfter: string
    parseable: boolean
    parseReason?: DiscoveryParseReason
}

/** 发现预览响应（snapshotStartedAt 供前端按超 7 天提示重扫） */
export interface DiscoveryPreviewResponse {
    snapshotId: string
    snapshotStartedAt: string
    count: number
    items: DiscoveryPreviewEntry[]
}

/** 扫描通道部分失败记录（快照状态/failed 引导展示） */
export interface ScanChannelFailure {
    cloud?: string
    product: string
    account?: string
    reason: string
}

/** 最近快照状态（引导轮询：running→done 进预览 / failed 展示 partialFailures） */
export interface DiscoverySnapshotStatus {
    hasSnapshot: boolean
    snapshotId?: string
    status?: 'running' | 'done' | 'failed'
    startedAt?: string
    failReason?: string
    partialFailures: ScanChannelFailure[]
}

/** 发现导入请求条目（勾选项三元组） */
export interface DiscoveryImportItemInput {
    cloud: string
    accountKey: string
    cloudCertId: string
}

/** 发现导入单条目结果（pending→success/failed；失败记因不中断会话） */
export type DiscoveryItemResult = 'pending' | 'success' | 'failed'

/** 发现导入会话条目（三元组定位，区别于批量导入的 fileName 主键语义） */
export interface DiscoveryImportItem {
    cloud: string
    accountKey: string
    cloudCertId: string
    result: DiscoveryItemResult
    mappedCertId?: string
    errorReason?: string
}

/** 发现导入会话状态（轮询终态 completed/partial_failed，对齐批量导入语义） */
export type DiscoveryImportStatus = 'running' | 'completed' | 'partial_failed'

/** 发现导入会话（POST 创建响应与进度 GET 同构） */
export interface DiscoveryImportSession {
    sessionId: string
    status: DiscoveryImportStatus
    items: DiscoveryImportItem[]
    progress: { total: number; succeeded: number; failed: number }
    createdAt: string
    finishedAt?: string
}

/** 自定义 CRD 登记载荷 */
export interface CrdRegistrationPayload {
    clusterId: string
    apiGroup: string
    kind: string
    certFieldPath: string
}

/** 自定义 CRD 登记项（含固定枚举内置标记） */
export interface CrdRegistration {
    id: string
    clusterId: string
    apiGroup: string
    kind: string
    certFieldPath: string
    enabled: boolean
    builtin: boolean
    operator: string
    createdAt: string
}

// ==================== 导入证书 ====================

/** 导入证书（multipart：certFile 必填 + keyFile 可选缺省仅指纹登记 + 预期域名提示性比对） */
export function importCertApi(form: { certFile: File; keyFile?: File; expectedDomain?: string }) {
    const fd = new FormData()
    fd.append('certFile', form.certFile)
    if (form.keyFile) fd.append('keyFile', form.keyFile)
    if (form.expectedDomain) fd.append('expectedDomain', form.expectedDomain)
    return unwrapCertEnvelope<ImportCertResult>(certAxios.post<CertEnvelope<ImportCertResult>>('/certs', fd))
}

/**
 * 批量导入（multipart 多文件 certFiles + 逐文件可选 keyFiles，按去扩展名基名配对）。
 * 202 返回会话句柄，进度经 getBatchImportApi 轮询。
 */
export function batchImportCertsApi(files: { cert: File; key?: File }[]) {
    const fd = new FormData()
    for (const f of files) fd.append('certFiles', f.cert)
    for (const f of files) {
        if (f.key) fd.append('keyFiles', f.key)
    }
    return unwrapCertEnvelope<BatchImportSession>(
        certAxios.post<CertEnvelope<BatchImportSession>>('/certs/batch', fd)
    )
}

/** 批量导入会话轮询（终态 completed/partial_failed；会话 TTL 30 天） */
export function getBatchImportApi(batchId: string) {
    return unwrapCertEnvelope<BatchImportSession>(
        certAxios.get<CertEnvelope<BatchImportSession>>(`/certs/batch/${batchId}`)
    )
}

/** 补传私钥（仅指纹登记证书；匹配校验通过后升级完整托管） */
export function uploadCertKeyApi(id: string, keyFile: File) {
    const fd = new FormData()
    fd.append('keyFile', keyFile)
    return unwrapCertEnvelope<ImportCertResult>(
        certAxios.post<CertEnvelope<ImportCertResult>>(`/certs/${id}/key`, fd)
    )
}

// ==================== 台账查询 ====================

/** 证书列表（分页+筛选+搜索；搜索框支持域名/SAN/指纹片段） */
export function listCertsApi(params?: ListCertsParams) {
    return unwrapCertEnvelope<ListCertsResponse>(
        certAxios.get<CertEnvelope<ListCertsResponse>>('/certs', { params })
    )
}

/** 证书详情（不含明文私钥） */
export function getCertApi(id: string) {
    return unwrapCertEnvelope<CertDetail>(certAxios.get<CertEnvelope<CertDetail>>(`/certs/${id}`))
}

/** 删除证书（活跃引用/保护期拦截 409 CERT_HAS_REFS → CertRequestError） */
export function deleteCertApi(id: string) {
    return unwrapCertEnvelope<{ id: string; deleted: boolean }>(
        certAxios.delete<CertEnvelope<{ id: string; deleted: boolean }>>(`/certs/${id}`)
    )
}

/** 台账统计（覆盖率双指标，查询时实时聚合） */
export function getCertStatsApi() {
    return unwrapCertEnvelope<CertStats>(certAxios.get<CertEnvelope<CertStats>>('/certs/stats'))
}

// ==================== 引用关系 ====================

/** 正向引用（分组+覆盖率元数据+盲区声明） */
export function getCertReferencesApi(id: string) {
    return unwrapCertEnvelope<CertReferencesView>(
        certAxios.get<CertEnvelope<CertReferencesView>>(`/certs/${id}/references`)
    )
}

/** 反向查询（域名/资源 → 证书，按指纹区分并存证书；响应为 {query,count,items} 信封载荷） */
export function reverseLookupCertsApi(domain: string) {
    return unwrapCertEnvelope<ReverseLookupResponse>(
        certAxios.get<CertEnvelope<ReverseLookupResponse>>('/certs/reverse', { params: { domain } })
    )
}

/** 立即扫描（防重 409 SCAN_IN_PROGRESS → CertRequestError.code） */
export function triggerCertScanApi(id: string) {
    return unwrapCertEnvelope<TriggerScanResult>(
        certAxios.post<CertEnvelope<TriggerScanResult>>(`/certs/${id}/scan`)
    )
}

// ==================== 云端发现导入 ====================

/**
 * 发现预览（GET /certs/discovery/preview）：基于最近 done 快照的唯一证书清单
 * 纯 DB 聚合。无 done 快照 → 409 NO_SNAPSHOT（CertRequestError.code 分支引导）。
 */
export function getDiscoveryPreviewApi() {
    return unwrapCertEnvelope<DiscoveryPreviewResponse>(
        certAxios.get<CertEnvelope<DiscoveryPreviewResponse>>('/certs/discovery/preview')
    )
}

/** 最近快照状态（GET /certs/discovery/snapshot-status；无快照引导轮询数据源） */
export function getDiscoverySnapshotStatusApi() {
    return unwrapCertEnvelope<DiscoverySnapshotStatus>(
        certAxios.get<CertEnvelope<DiscoverySnapshotStatus>>('/certs/discovery/snapshot-status')
    )
}

/** 创建发现导入会话（勾选条目三元组异步逐条导入；会话先持久化再执行） */
export function startDiscoveryImportApi(items: DiscoveryImportItemInput[]) {
    return unwrapCertEnvelope<DiscoveryImportSession>(
        certAxios.post<CertEnvelope<DiscoveryImportSession>>('/certs/discovery/import', { items })
    )
}

/** 发现导入会话进度轮询（终态 completed/partial_failed） */
export function getDiscoveryImportApi(sessionId: string) {
    return unwrapCertEnvelope<DiscoveryImportSession>(
        certAxios.get<CertEnvelope<DiscoveryImportSession>>(`/certs/discovery/import/${sessionId}`)
    )
}

// ==================== 到期看板 ====================

/** 到期看板（全角色含只读查看者） */
export function getCertDashboardApi() {
    return unwrapCertEnvelope<CertDashboardResponse>(
        certAxios.get<CertEnvelope<CertDashboardResponse>>('/certs/dashboard')
    )
}

// ==================== 变更管理 ====================

/** 变更单列表（状态 Tab 筛选+分页） */
export function listChangesApi(params?: ListChangesParams) {
    return unwrapCertEnvelope<ListChangesResponse>(
        certAxios.get<CertEnvelope<ListChangesResponse>>('/certs/changes', { params })
    )
}

/**
 * 生成变更清单（oldFingerprint+newCertId；前置校验失败 409：
 * SCAN_STALE/SAN_INSUFFICIENT/CHANGE_IN_FLIGHT/NEW_CERT_FINGERPRINT_ONLY）。
 */
export function generateChangeListApi(data: { oldFingerprint: string; newCertId: string }) {
    return unwrapCertEnvelope<ChangeList>(
        certAxios.post<CertEnvelope<ChangeList>>('/certs/changes', data)
    )
}

/** 变更单/报告详情（终态单附 report） */
export function getChangeApi(id: string) {
    return unwrapCertEnvelope<ChangeDetail>(
        certAxios.get<CertEnvelope<ChangeDetail>>(`/certs/changes/${id}`)
    )
}

/** 确认执行（分批在此固化批次分配；快照时点重校验不一致拒绝） */
export function confirmChangeApi(id: string, batchConf?: BatchConf) {
    return unwrapCertEnvelope<void>(
        certAxios.post<CertEnvelope<void>>(`/certs/changes/${id}/confirm`, {
            batchConf: batchConf ?? null,
        })
    )
}

/** 触发批量执行（执行当前批 batchNo=currentBatch 的项） */
export function executeChangeApi(id: string) {
    return unwrapCertEnvelope<void>(
        certAxios.post<CertEnvelope<void>>(`/certs/changes/${id}/execute`)
    )
}

/** 人工续批（门控不满足 409 BATCH_NOT_CONFIRMABLE） */
export function confirmChangeBatchApi(id: string) {
    return unwrapCertEnvelope<void>(
        certAxios.post<CertEnvelope<void>>(`/certs/changes/${id}/confirm-batch`)
    )
}

/** 取消（不可取消状态 409 CHANGE_NOT_CANCELLABLE） */
export function cancelChangeApi(id: string) {
    return unwrapCertEnvelope<void>(
        certAxios.post<CertEnvelope<void>>(`/certs/changes/${id}/cancel`)
    )
}

/** 逐项进度轮询（2s） */
export function getChangeProgressApi(id: string) {
    return unwrapCertEnvelope<ChangeProgress>(
        certAxios.get<CertEnvelope<ChangeProgress>>(`/certs/changes/${id}/progress`)
    )
}

/** 回滚成功项（仅成功项；目标无效 409 ROLLBACK_TARGET_INVALID 转人工） */
export function rollbackChangeApi(id: string, itemIds: string[]) {
    return unwrapCertEnvelope<void>(
        certAxios.post<CertEnvelope<void>>(`/certs/changes/${id}/rollback`, { itemIds })
    )
}

/** 按变更单号查询审计流水（可与 ChangeReport 逐条比对一致） */
export function getChangeAuditApi(id: string) {
    return unwrapCertEnvelope<ChangeAuditResponse>(
        certAxios.get<CertEnvelope<ChangeAuditResponse>>(`/certs/changes/${id}/audit`)
    )
}

// ==================== 全局配置（主管/审计） ====================

/** 读取全局配置（告警配置+阈值+豁免清单） */
export function getCertSettingsApi() {
    return unwrapCertEnvelope<CertSettings>(certAxios.get<CertEnvelope<CertSettings>>('/certs/settings'))
}

/** 更新全局配置（thresholds 越界 400 整体拒绝） */
export function updateCertSettingsApi(payload: UpdateCertSettingsPayload) {
    return unwrapCertEnvelope<CertSettings>(
        certAxios.put<CertEnvelope<CertSettings>>('/certs/settings', payload)
    )
}

/** 添加探测豁免 */
export function addCertExemptionApi(data: { domain: string; reason?: string }) {
    return unwrapCertEnvelope<void>(
        certAxios.post<CertEnvelope<void>>('/certs/settings/exemptions', data)
    )
}

/** 移除探测豁免 */
export function removeCertExemptionApi(domain: string) {
    return unwrapCertEnvelope<{ domain: string; removed: boolean }>(
        certAxios.delete<CertEnvelope<{ domain: string; removed: boolean }>>(
            `/certs/settings/exemptions/${encodeURIComponent(domain)}`
        )
    )
}

/** 发送测试告警 */
export function testCertAlertApi() {
    return unwrapCertEnvelope<TestAlertResult>(
        certAxios.post<CertEnvelope<TestAlertResult>>('/certs/settings/test')
    )
}

/** 登记自定义 CRD（重复登记 409） */
export function createCrdRegistrationApi(data: CrdRegistrationPayload) {
    return unwrapCertEnvelope<{ id: string }>(
        certAxios.post<CertEnvelope<{ id: string }>>('/certs/settings/crds', data)
    )
}

/** CRD 登记列表（含 enabled 状态） */
export function listCrdRegistrationsApi() {
    return unwrapCertEnvelope<CrdRegistration[]>(
        certAxios.get<CertEnvelope<CrdRegistration[]>>('/certs/settings/crds')
    )
}

/** 删除 CRD 登记（该 CRD 回归扫描盲区并在视图声明） */
export function deleteCrdRegistrationApi(id: string) {
    return unwrapCertEnvelope<{ id: string; deleted: boolean }>(
        certAxios.delete<CertEnvelope<{ id: string; deleted: boolean }>>(`/certs/settings/crds/${id}`)
    )
}
