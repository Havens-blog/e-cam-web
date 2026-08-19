/**
 * 变更管理（列表/向导/报告详情）纯展示逻辑（任务 6.5，UF-4）。
 *
 * 无 Vue / DOM 运行时依赖，可被 node 环境单测直接导入
 * （同 src/views/cert/ledger/format.ts、detail/format.ts、dashboard/format.ts 约定）。
 *
 * 依据：docs/features/ssl-cert-management/ui/ui-design.md
 * 「Component: 变更管理列表 + 变更向导」「Component: 变更报告详情页」
 * （含向导步间导航/状态转换语义/只读恢复）、prd/prd-ui-functions.md UF-4、
 * design/tech-design.md Interface 3 ChangeService + 分批执行门控与批次分配、
 * ui/prototype/changes.html / changes-new.html / change-report.html。
 *
 * Hard Rules（任务 6.5）：
 * - 回滚入口仅 执行中(出现失败项后)/验证中/部分完成 三态可见，且仅作用于执行成功项。
 * - 确认操作仅运维工程师角色可见可用；全程走留审计的服务端端点。
 * - 执行期间清单快照固定：前端不提供执行中增删清单项的任何入口
 *   （本模块不产出任何清单项编辑辅助函数）。
 *
 * API 口径适配（6.1 client 镜像后端 VO，字段缺失处的派生策略）：
 * - 列表行无 progress/protectDaysLeft 字段 → 活跃行（执行中/验证中）经
 *   getChangeProgressApi 10s 轮询派生进度；保护期徽章从可选 protectUntil 派生
 *   （后端列表 VO 补充该字段后自动生效；报告详情页取 ChangeDetail.protectUntil 实数）。
 * - CHANGE_IN_FLIGHT 错误信封不含冲突单号 → 互斥卡跳转变更管理列表（活跃态可寻源单）。
 * - 无逐项验证结论端点 → Step6/卡4 以执行状态徽章 + verify 汇总 + unmetDomains 呈现。
 * - 无草稿持久化端点（POST /changes 直建待确认单）→ 向导「存为草稿」= 生成过清单的
 *   单据已在服务端持久化为待确认态（列表「继续编辑」恢复），未生成清单的选择进度
 *   存 sessionStorage（WIZARD_DRAFT_KEY，仅同浏览器恢复）。
 */

import type {
    ChangeDetailItem,
    ChangeItemStatus,
    ChangeListItem,
    ChangeOrder,
    ChangeStatus,
    DeployTarget,
    OrphanCleanupResult,
    VerifySummary,
} from '@/api/cert'
import { cloudLabel, productLabel } from '../detail/format'
import { protectDaysLeft } from '../ledger/format'

// ==================== 状态 Tab（列表页） ====================

/** 列表状态 Tab 键（全集：待确认含草稿；已回滚/回滚失败合并） */
export type ChangeTabKey = 'all' | 'pending' | 'executing' | 'verifying' | 'partial' | 'completed' | 'rollback'

export interface ChangeTabDef {
    key: ChangeTabKey
    label: string
}

/** 状态 Tab 全集（ui-design 列表页 Layout；顺序与原型 changes.html 一致） */
export const CHANGE_TABS: ChangeTabDef[] = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待确认' },
    { key: 'executing', label: '执行中' },
    { key: 'verifying', label: '验证中' },
    { key: 'partial', label: '部分完成' },
    { key: 'completed', label: '已完成' },
    { key: 'rollback', label: '已回滚 / 回滚失败' },
]

/** 状态 → Tab 归属；cancelled 不入任何 Tab（仅「全部」可见，Tab 全集不含取消态） */
export function statusToTab(status: ChangeStatus): ChangeTabKey | null {
    switch (status) {
        case 'draft':
        case 'pending_confirm':
            return 'pending'
        case 'executing':
            return 'executing'
        case 'verifying':
            return 'verifying'
        case 'partial_completed':
            return 'partial'
        case 'completed':
            return 'completed'
        case 'rolled_back':
        case 'rollback_failed':
            return 'rollback'
        default:
            return null
    }
}

/** 各 Tab 计数（全部 = 行总数；cancelled 仅计入「全部」） */
export function tabCounts(rows: readonly ChangeOrder[]): Record<ChangeTabKey, number> {
    const counts: Record<ChangeTabKey, number> = {
        all: rows.length,
        pending: 0,
        executing: 0,
        verifying: 0,
        partial: 0,
        completed: 0,
        rollback: 0,
    }
    for (const r of rows) {
        const tab = statusToTab(r.status)
        if (tab) counts[tab] += 1
    }
    return counts
}

/** 按 Tab 过滤行（客户端执行——计数与合并 Tab 需全集数据） */
export function filterRowsByTab(rows: readonly ChangeOrder[], tab: ChangeTabKey): ChangeOrder[] {
    if (tab === 'all') return [...rows]
    return rows.filter((r) => statusToTab(r.status) === tab)
}

/** 草稿/待确认行操作为「继续编辑」（进入向导恢复���，其余为「详情」（报告页） */
export function isEditableRow(status: ChangeStatus): boolean {
    return status === 'draft' || status === 'pending_confirm'
}

/** 执行中/验证中行 → 列表 10s 轮询刷新（AC：活跃行轮询） */
export function isActiveRowStatus(status: ChangeStatus): boolean {
    return status === 'executing' || status === 'verifying'
}

// ==================== 进度派生（progress itemStates → 计数与文案） ====================

/** 逐项状态最小形状（ChangeProgressItem / ChangeDetailItem 均满足） */
export interface ItemStateLike {
    status: ChangeItemStatus | string
}

/** 逐项状态计数汇总 */
export interface ExecProgress {
    total: number
    succeeded: number
    failed: number
    running: number
    rateLimited: number
    pending: number
    skipped: number
    rolledBack: number
    /** 终态项数 = 总数 −（待执行/执行中/限流重试中） */
    terminal: number
}

const EMPTY_PROGRESS: ExecProgress = {
    total: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    rateLimited: 0,
    pending: 0,
    skipped: 0,
    rolledBack: 0,
    terminal: 0,
}

/** 汇总逐项状态（空数组 → 全零计数，不渲染误导进度） */
export function summarizeProgress(states: readonly ItemStateLike[]): ExecProgress {
    const p = { ...EMPTY_PROGRESS, total: states.length }
    for (const s of states) {
        switch (s.status) {
            case 'success':
                p.succeeded += 1
                break
            case 'failed':
                p.failed += 1
                break
            case 'running':
                p.running += 1
                break
            case 'rate_limited':
                p.rateLimited += 1
                break
            case 'pending':
                p.pending += 1
                break
            case 'skipped':
                p.skipped += 1
                break
            case 'rolled_back':
            case 'rollback_failed':
                p.rolledBack += 1
                break
            default:
                break
        }
    }
    p.terminal = p.total - p.pending - p.running - p.rateLimited
    return p
}

/** 出现失败项判定（回滚入口出现条件之一；限流重试中不算失败） */
export function hasFailedItem(states: readonly ItemStateLike[]): boolean {
    return states.some((s) => s.status === 'failed')
}

/** 全部清单项达到终态（Step5→Step6 自动进入条件） */
export function allItemsTerminal(states: readonly ItemStateLike[]): boolean {
    return states.length > 0 && states.every((s) => s.status !== 'pending' && s.status !== 'running' && s.status !== 'rate_limited')
}

/** 进度列文案：活跃行 `8/10 · 2 失败`；无失败 `8/10`；未开始 `—` */
export function progressText(p: ExecProgress): string {
    if (p.total === 0) return '—'
    const done = p.succeeded + p.failed + p.rolledBack
    const base = `${done}/${p.total}`
    if (p.failed > 0) return `${base} · ${p.failed} 失败`
    if (p.rateLimited > 0) return `${base} · ${p.rateLimited} 重试中`
    return base
}

/** 批次信息文案：`批次 1/3（批间暂停）`；非分批/未固化 → 空串 */
export function batchText(row: Pick<ChangeOrder, 'currentBatch' | 'totalBatches' | 'paused'>): string {
    if (!row.totalBatches || row.totalBatches <= 1) return ''
    const paused = row.paused ? '（批间暂停）' : ''
    return `批次 ${row.currentBatch}/${row.totalBatches}${paused}`
}

/** 终态事件 a11y 通告文案（aria-live polite；spinner 运行态不通告） */
export function progressAnnouncement(p: ExecProgress): string {
    const done = p.succeeded + p.failed + p.rolledBack
    const failed = p.failed > 0 ? `，失败 ${p.failed}` : ''
    return `已完成 ${done}/${p.total}${failed}`
}

// ==================== 分批门控（首批 ≤ floor(总量/2)，PRD ≤50%） ====================

/** 首批上限 = floor(total/2)，至少 1（总量 1 时免分批，cap 不参与） */
export function firstBatchCap(total: number): number {
    return Math.max(1, Math.floor(total / 2))
}

/** 是否需要分批：总量 >1 才可分批（≤1 免分批，原型 Step4 hint） */
export function needsBatching(total: number): boolean {
    return total > 1
}

/** 钳制首批数量到 [1, floor(total/2)]（输入超限/非法回退上限） */
export function clampBatchSize(value: number, total: number): number {
    if (!Number.isFinite(value)) return firstBatchCap(total)
    return Math.min(Math.max(1, Math.floor(value)), firstBatchCap(total))
}

// ==================== 7 步向导（步定义/闸门/只读回看/草稿） ====================

export interface WizardStepDef {
    n: number
    key: string
    title: string
}

/** 7 步（原型 changes-new.html 步骤条） */
export const WIZARD_STEPS: WizardStepDef[] = [
    { n: 1, key: 'select', title: '选择证书' },
    { n: 2, key: 'precheck', title: '前置校验' },
    { n: 3, key: 'list', title: '变更清单' },
    { n: 4, key: 'confirm', title: '确认执行' },
    { n: 5, key: 'progress', title: '执行进度' },
    { n: 6, key: 'verify', title: '验证窗口' },
    { n: 7, key: 'report', title: '报告入口' },
]

/** 下一步闸门状态（各步校验通过条件，ui-design 向导步间导航） */
export interface WizardGateState {
    /** Step1：旧/新证书均已选定 */
    oldCertId: string | null
    newCertId: string | null
    /** Step2：双预检通过（清单生成成功即新鲜度+SAN 双过） */
    precheckPassed: boolean
    /** Step3：清单生成完成 */
    listGenerated: boolean
    /** Step4：确认执行已完成（进入 Step5 的语义闸门） */
    confirmed: boolean
}

/** 下一步可用判定（Step4→5 由确认动作触发，不在常规下一步序列） */
export function canAdvance(step: number, state: WizardGateState): boolean {
    switch (step) {
        case 1:
            return Boolean(state.oldCertId && state.newCertId)
        case 2:
            return state.precheckPassed
        case 3:
            return state.listGenerated
        case 4:
            return state.confirmed
        default:
            return false
    }
}

/** 闸门未满足时的 tooltip 缺失项说明（按钮 disabled + tooltip） */
export function stepGateHint(step: number): string {
    switch (step) {
        case 1:
            return '下一步需满足：旧/新证书均已选定'
        case 2:
            return '下一步需满足：扫描新鲜度与 SAN 预检均通过'
        case 3:
            return '下一步需满足：变更清单生成完成'
        case 4:
            return '需确认执行后进入执行进度'
        default:
            return ''
    }
}

/** 只读回看模式：查看步 < 当前步（已完成步可回点查看，不可修改已提交内容） */
export function isReadonlyLookback(viewingStep: number, currentStep: number): boolean {
    return viewingStep < currentStep
}

/** 存为草稿仅 Step1~4（Step5 起已进入执行，无回退语义） */
export function canSaveDraft(step: number): boolean {
    return step >= 1 && step <= 4
}

/**
 * 由轮询状态推导向导落点：executing→5 / verifying→6 / 终态→7 /
 * 待确认→4（清单已生成待确认）。用于向导内自动步进与重入定位。
 */
export function stepFromStatus(status: ChangeStatus): number {
    switch (status) {
        case 'executing':
            return 5
        case 'verifying':
            return 6
        case 'completed':
        case 'partial_completed':
        case 'rolled_back':
        case 'rollback_failed':
        case 'cancelled':
            return 7
        default:
            return 4
    }
}

/** 变更单是否已进入执行阶段（向导重入时不再允许改选证书/重生成清单） */
export function isExecutionPhase(status: ChangeStatus): boolean {
    return stepFromStatus(status) >= 5
}

// ==================== Step1 预选（?certId=） ====================

/** 预选资格：完整托管且有活跃引用（ui-design 台账页 Interactions「带 ?certId= 进入向导」） */
export function preselectEligible(cert: {
    hostingStatus: string
    refCount: number
}): boolean {
    return cert.hostingStatus === 'complete' && cert.refCount > 0
}

/** 预选不合规时的置顶提示（不锁选择器、不跳步） */
export const PRESELECT_INELIGIBLE_NOTICE = '该证书无活跃引用或不可更换，请重新选择旧证书（选择器未锁定）'

// ==================== Step2 前置校验阻断卡 ====================

export type PrecheckBlockKind = 'scan_stale' | 'san' | 'mutex' | 'fingerprint_only' | 'error'

export interface PrecheckBlock {
    kind: PrecheckBlockKind
    title: string
    body: string
    /** 引导动作：scan=立即扫描 / back=返回上一步 / view-order=查看在途单 */
    action: 'scan' | 'back' | 'view-order'
}

/** 生成清单 409 错误码 → 阻断卡（CertRequestError.code 分支渲染） */
export function precheckBlockFromError(code: string): PrecheckBlock {
    switch (code) {
        case 'SCAN_STALE':
            return {
                kind: 'scan_stale',
                title: '扫描新鲜度超期，阻断清单生成',
                body: '旧证书最近扫描超出新鲜度阈值（默认 24h）。请重新扫描后再生成清单。',
                action: 'scan',
            }
        case 'SAN_INSUFFICIENT':
            return {
                kind: 'san',
                title: 'SAN 覆盖不满足，阻断清单生成',
                body: '新证书 SAN 未覆盖旧证书全部目标域名，缺失域名见清单生成结果的 missing 清单。',
                action: 'back',
            }
        case 'CHANGE_IN_FLIGHT':
            return {
                kind: 'mutex',
                title: '存在在途变更单',
                body: '该旧证书已有未完成的变更单（待确认/执行中/验证中），不允许重复发起。',
                action: 'view-order',
            }
        case 'NEW_CERT_FINGERPRINT_ONLY':
            return {
                kind: 'fingerprint_only',
                title: '新证书仅指纹登记',
                body: '新证书无私钥（仅指纹登记），无法上传云证书库执行更换。请在台账补传私钥后重试。',
                action: 'back',
            }
        default:
            return {
                kind: 'error',
                title: '预检失败',
                body: '清单生成服务暂时不可用，请重试或返回上一步。',
                action: 'back',
            }
    }
}

// ==================== Step3 清单分区与目标文案 ====================

export interface ListPartition {
    executable: ChangeListItem[]
    blocked: ChangeListItem[]
}

/** 可执行项 / 不可执行项分区（autoChangeable 判定；不可执行不静默放行） */
export function partitionListItems(items: readonly ChangeListItem[]): ListPartition {
    const executable: ChangeListItem[] = []
    const blocked: ChangeListItem[] = []
    for (const it of items) {
        if (it.autoChangeable) executable.push(it)
        else blocked.push(it)
    }
    return { executable, blocked }
}

/** 不可执行项「出路」（reason 前缀 → 出路文案；后端 reason 常量见 changelist_generator.go） */
export function blockedExit(reason?: string): string {
    if (!reason) return '走其管理链路或人工处理'
    if (reason.includes('ERR_DISCOVERY_ONLY')) return '二期部署器开放，或手工更换'
    if (reason.startsWith('K8S_MANAGEMENT_')) return '走其管理链路（GitOps / 控制器）变更'
    return '走其管理链路或人工处理'
}

/** 计划动作文案（upload_and_bind=云证书库替换绑定 / patch_crd=CRD 证书引用替换） */
export function actionLabel(action: string): string {
    if (action === 'upload_and_bind') return '替换证书'
    if (action === 'patch_crd') return '替换 TLS Secret'
    return action
}

/** 目标定位文案：云通道 `阿里云 · DCDN`；K8s 通道 `K8s · Ingress`（cluster 细节 tooltip 由组件层拼装） */
export function targetLocationLabel(target: DeployTarget): string {
    if (target.channel === 'k8s_api') {
        const kind = target.kind ?? 'CRD'
        return `K8s · ${kind}`
    }
    const cloud = target.cloud ? cloudLabel(target.cloud) : '云'
    const product = target.product ? productLabel(target.product) : ''
    return product ? `${cloud} · ${product}` : cloud
}

// ==================== 逐项状态徽章（Step5/卡2/恢复视图共用） ====================

export type ItemBadgeTone = 'success' | 'error' | 'warning' | 'accent' | 'secondary'

export interface ItemStatusBadge {
    label: string
    tone: ItemBadgeTone
    /** 非色觉通道图标（执行中用 CSS spinner，icon 为空） */
    icon: string
    spinner?: boolean
}

/** 变更项状态徽章（状态语义色 + 图标/文字双通道；限流重试中=Warning） */
export function itemStatusBadge(status: ChangeItemStatus | string): ItemStatusBadge {
    switch (status) {
        case 'success':
            return { label: '成功', tone: 'success', icon: '✓' }
        case 'failed':
            return { label: '失败', tone: 'error', icon: '✗' }
        case 'running':
            return { label: '执行中', tone: 'accent', icon: '', spinner: true }
        case 'rate_limited':
            return { label: '限流重试中', tone: 'warning', icon: '⚠' }
        case 'pending':
            return { label: '待执行', tone: 'secondary', icon: '○' }
        case 'rolled_back':
            return { label: '已回滚', tone: 'secondary', icon: '⟲' }
        case 'rollback_failed':
            return { label: '回滚失败', tone: 'error', icon: '⚠' }
        case 'skipped':
            return { label: '跳过', tone: 'secondary', icon: '—' }
        default:
            return { label: String(status), tone: 'secondary', icon: '—' }
    }
}

// ==================== 验证窗口倒计时（a11y：跨小时档/归零才通告） ====================

export interface CountdownParts {
    hours: number
    minutes: number
    seconds: number
    totalSeconds: number
    expired: boolean
}

/** 倒计时分解（非法/缺失时间 → expired，全零；窗口 2~24h，小时位不进位为天） */
export function countdownParts(until: string | null | undefined, now: Date = new Date()): CountdownParts {
    const expiredParts: CountdownParts = { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, expired: true }
    if (!until) return expiredParts
    const t = Date.parse(until)
    if (Number.isNaN(t)) return expiredParts
    const totalSeconds = Math.floor((t - now.getTime()) / 1000)
    if (totalSeconds <= 0) return expiredParts
    return {
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        totalSeconds,
        expired: false,
    }
}

function pad2(v: number): string {
    return v < 10 ? `0${v}` : String(v)
}

/** 倒计时���示：`23:59:59`；reduced-motion 隐藏秒位仅显时分（无障碍规范） */
export function countdownText(parts: CountdownParts, reducedMotion = false): string {
    if (parts.expired) return '00:00:00'
    const hm = `${pad2(parts.hours)}:${pad2(parts.minutes)}`
    return reducedMotion ? hm : `${hm}:${pad2(parts.seconds)}`
}

/** 倒计时静态 aria-label（高频 tick 不通告，仅静态描述总时长） */
export function countdownAriaLabel(parts: CountdownParts): string {
    if (parts.expired) return '验证窗口已关闭'
    const hours = Math.max(1, Math.ceil(parts.totalSeconds / 3600))
    return `验证窗口剩余约 ${hours} 小时`
}

/** 小时档（跨档才发一次 polite 通告；归零 = -1 档） */
export function countdownHourBucket(parts: CountdownParts): number {
    if (parts.expired) return -1
    return Math.max(1, Math.ceil(parts.totalSeconds / 3600))
}

/** 是否应通告（小时档变化含归零；同档秒级跳动不通告） */
export function shouldAnnounceCountdown(prevBucket: number | null, nextBucket: number): boolean {
    return prevBucket !== null && prevBucket !== nextBucket
}

// ==================== 回滚（Hard Rule：三态可见 + 仅成功项） ====================

/** 回滚范围：仅本次执行成功项（失败项引用未被改动，无需回滚） */
export function rollbackScopeItems<T extends { status: ChangeItemStatus | string }>(states: readonly T[]): T[] {
    return states.filter((s) => s.status === 'success')
}

/**
 * 回滚入口可见性（Hard Rule）：仅 执行中(出现失败项后)/验证中/部分完成 三态。
 */
export function canRollbackNow(status: ChangeStatus, hasFailed: boolean): boolean {
    if (status === 'verifying') return true
    if (status === 'partial_completed') return true
    return status === 'executing' && hasFailed
}

/** 回滚 Modal 范围行（最小形状：向导行视图与详情项统一映射） */
export interface RollbackScopeRow {
    itemId: string
    resourceId: string
    location: string
}

/** 详情清单项 → 回滚范围行（仅成功项；资源要素定位文案预派生） */
export function rollbackScopeRows(items: readonly ChangeDetailItem[]): RollbackScopeRow[] {
    return rollbackScopeItems(items).map((it) => ({
        itemId: it.itemId,
        resourceId: it.target.resourceId,
        location: targetLocationLabel(it.target),
    }))
}

// ==================== 只读恢复视图（报告详情页置顶区） ====================

export type ResumeMode = 'step5' | 'step6' | 'partial' | 'edit' | 'none'

/**
 * 恢复模式推导：执行中→内嵌 Step5 / 验证中→内嵌 Step6 /
 * 部分完成（保护期内）→回滚入口+保护期徽章（无轮询，窗口已关闭）/
 * 草稿·待确认→「继续编辑」跳向导 / 其余（终态过保护期）→无恢复区。
 */
export function resumeMode(
    status: ChangeStatus,
    protectUntil?: string | null,
    now: Date = new Date(),
): ResumeMode {
    switch (status) {
        case 'executing':
            return 'step5'
        case 'verifying':
            return 'step6'
        case 'partial_completed':
            return protectDaysLeft(protectUntil, now) > 0 ? 'partial' : 'none'
        case 'draft':
        case 'pending_confirm':
            return 'edit'
        default:
            return 'none'
        }
}

/** 报告详情页轮询节奏：常态 2s，连续失败退避至 10s（封顶） */
export const RESUME_POLL_MS = 2_000
export const RESUME_BACKOFF_MS = 10_000

/** 退避间隔（失败次数 0 → 2s；1 次 → 4s；≥2 次 → 10s 封顶） */
export function nextPollDelay(consecutiveFailures: number): number {
    if (consecutiveFailures <= 0) return RESUME_POLL_MS
    if (consecutiveFailures === 1) return 4_000
    return RESUME_BACKOFF_MS
}

// ==================== 报告卡（卡2 筛选 / 卡3 回滚 / 卡4 验证结论 / 卡5 孤儿清理） ====================

/** 卡2 结果筛选（全部/仅失败/仅限流重试/仅跳过；批次筛选另由 batchNo 参数承载） */
export type ResultFilter = '' | 'failed' | 'rate_limited' | 'skipped'

export const RESULT_FILTER_OPTIONS: { value: ResultFilter; label: string }[] = [
    { value: '', label: '全部' },
    { value: 'failed', label: '仅失败' },
    { value: 'rate_limited', label: '仅限流重试' },
    { value: 'skipped', label: '仅跳过' },
]

/** 卡2 逐项结果过滤（结果筛选 + 批次筛选；null 批次 = 不筛） */
export function filterReportItems<T extends { status: ChangeItemStatus | string; batchNo: number }>(
    items: readonly T[],
    resultFilter: ResultFilter,
    batchNo: number | null = null,
): T[] {
    return items.filter((it) => {
        if (resultFilter && it.status !== resultFilter) return false
        if (batchNo !== null && it.batchNo !== batchNo) return false
        return true
    })
}

/** 批次选项（去重升序；0=未分批固化） */
export function batchOptions(items: readonly { batchNo: number }[]): number[] {
    const set = new Set(items.map((it) => it.batchNo))
    return [...set].sort((a, b) => a - b)
}

/** 卡3 回滚状态行：rolled_back / rollback_failed 项；空 → 「未执行回滚」 */
export function rollbackReportItems(items: readonly { status: ChangeItemStatus | string }[]): ChangeDetailItem[] {
    return items.filter(
        (it) => it.status === 'rolled_back' || it.status === 'rollback_failed',
    ) as ChangeDetailItem[]
}

/** 卡4 窗口结论摘要（窗口关闭时间 + 达标/差异/未达标计数 + 状态结论）；时区取 UTC（RFC3339 原样可复现） */
export function verifyConclusion(verify: VerifySummary | null | undefined): string {
    if (!verify || !verify.windowUntil) return '验证窗口未开启（执行未完成）。窗口关闭时间与结论摘要将在完成后展示。'
    const closed = new Date(verify.windowUntil)
    const closedAt = Number.isNaN(closed.getTime())
        ? '—'
        : `${closed.getUTCFullYear()}-${pad2(closed.getUTCMonth() + 1)}-${pad2(closed.getUTCDate())} ${pad2(closed.getUTCHours())}:${pad2(closed.getUTCMinutes())}`
    const unmet = verify.unmet > 0 ? `，未达标 ${verify.unmet} 项转常规差异告警` : ''
    return `窗口关闭于 ${closedAt}：达标 ${verify.probePass} / 差异 ${verify.probeDiff} / 跳过 ${verify.probeSkipped}${unmet}`
}

/** 卡5 清理动作文案 */
export function orphanActionLabel(action: OrphanCleanupResult['action']): string {
    return action === 'cleanup' ? '删除云侧旧证书' : '暂留（保护期内/人工保留）'
}

// ==================== 向导草稿持久化（sessionStorage） ====================

export const WIZARD_DRAFT_KEY = 'cert.changeWizard.draft'

/** 向导草稿（未生成清单的选择进度；已生成清单的单据由服务端待确认态承载） */
export interface WizardDraft {
    /** 已生成的变更单 ID（清单生成成功后即有） */
    orderId?: string
    oldCertId?: string
    oldFingerprint?: string
    newCertId?: string
    /** 保存时所处步骤（恢复定位参考） */
    savedStep: number
    savedAt: string
}

function safeSessionStorage(): Storage | null {
    try {
        return typeof globalThis !== 'undefined' ? (globalThis.sessionStorage ?? null) : null
    } catch {
        return null
    }
}

/** 保存向导草稿（storage 不可用静默忽略，不影响当次会话） */
export function saveWizardDraft(draft: WizardDraft, storage: Storage | null | undefined = safeSessionStorage()): void {
    try {
        storage?.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft))
    } catch {
        /* 隐私模式等场景放弃持久化 */
    }
}

/** 读取向导草稿（无记录/损坏 → null） */
export function loadWizardDraft(storage: Storage | null | undefined = safeSessionStorage()): WizardDraft | null {
    try {
        const raw = storage?.getItem(WIZARD_DRAFT_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<WizardDraft>
        if (typeof parsed.savedStep !== 'number') return null
        return {
            orderId: typeof parsed.orderId === 'string' ? parsed.orderId : undefined,
            oldCertId: typeof parsed.oldCertId === 'string' ? parsed.oldCertId : undefined,
            oldFingerprint: typeof parsed.oldFingerprint === 'string' ? parsed.oldFingerprint : undefined,
            newCertId: typeof parsed.newCertId === 'string' ? parsed.newCertId : undefined,
            savedStep: parsed.savedStep,
            savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
        }
    } catch {
        return null
    }
}

/** 清除向导草稿（null 安全） */
export function clearWizardDraft(storage: Storage | null | undefined = safeSessionStorage()): void {
    try {
        storage?.removeItem(WIZARD_DRAFT_KEY)
    } catch {
        /* 忽略 */
    }
}

// ==================== 旧→新 列展示（列表/报告页头共用） ====================

/** 指纹/ID mono 截断（首 8 + … + 末 8，长文本规则） */
export function truncateMiddle(v: string, head = 8, tail = 8): string {
    if (v.length <= head + tail + 1) return v
    return `${v.slice(0, head)}…${v.slice(-tail)}`
}

/** 列表「旧证书 → 新证书」列保护期徽章天数（行级 protectUntil 可选字段；缺失 → 0 不显示） */
export function rowProtectDaysLeft(protectUntil?: string | null, now: Date = new Date()): number {
    return protectDaysLeft(protectUntil ?? null, now)
}
