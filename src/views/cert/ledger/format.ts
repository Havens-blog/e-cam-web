/**
 * 证书台账页纯展示逻辑（任务 6.2）。
 *
 * 无 Vue / DOM 运行时依赖（copyText 除外，带能力探测），可被 node 环境单测
 * 直接导入（同 src/utils/cert-permission.ts 约定）。
 *
 * 依据：docs/features/ssl-cert-management/ui/ui-design.md「Component: 证书台账页」
 * （Layout/States/Interactions/Data Binding）+ 长文本规则/证书状态色/保护期标记，
 * prd/prd-ui-functions.md UF-1，design/tech-design.md Error Types & Codes。
 */

import type { HostingStatus } from '@/api/cert'

// ==================== 指纹 / mono 截断（长文本规则） ====================

/** 表格内指纹固定 mono 截断：首 8 + … + 末 8；短值原样（复制按钮取全文） */
export function truncateFingerprint(fp: string): string {
    if (fp.length <= 20) return fp
    return `${fp.slice(0, 8)}…${fp.slice(-8)}`
}

// ==================== 剩余天数徽章（证书状态色） ====================

export type LedgerTone = 'success' | 'warning' | 'error'

export interface DaysLeftBadge {
    text: string
    tone: LedgerTone
    /** 非色觉通道图标：✓ / ⚠ / ✗ */
    icon: string
}

/**
 * 剩余天数徽章：>30=Success；≤30 与 ≤14=Warning（≤14 色阶加深由样式层）；≤7/已过期=Error。
 * 负数渲染为「已过期 N 天」。
 */
export function daysLeftBadge(daysLeft: number): DaysLeftBadge {
    if (daysLeft <= 0) return { text: `已过期 ${-daysLeft} 天`, tone: 'error', icon: '✗' }
    const text = `${daysLeft} 天`
    if (daysLeft > 30) return { text, tone: 'success', icon: '✓' }
    if (daysLeft > 7) return { text, tone: 'warning', icon: '⚠' }
    return { text, tone: 'error', icon: '✗' }
}

// ==================== 托管状态徽章 ====================

export interface HostingStatusMeta {
    label: string
    tone: 'accent' | 'secondary'
}

/** 完整托管=accent（含私钥可发起更换）；仅指纹登记=secondary */
export function hostingStatusMeta(s: HostingStatus): HostingStatusMeta {
    return s === 'complete'
        ? { label: '完整托管', tone: 'accent' }
        : { label: '仅指纹登记', tone: 'secondary' }
}

// ==================== 材料异常徽章（盘点容忍标记） ====================

export interface MaterialIssueMeta {
    label: string
    tone: 'error' | 'warning'
}

/** expired=error（处置动作是换证）；chain_incomplete=warning（材料缺陷随换证解决） */
export function materialIssueMeta(issue?: string): MaterialIssueMeta | null {
    if (issue === 'expired') return { label: '材料异常：已过期', tone: 'error' }
    if (issue === 'chain_incomplete') return { label: '材料异常：链不完整', tone: 'warning' }
    return null
}

// ==================== 保护期（锁徽章 / 删除拦截依据） ====================

const MS_PER_DAY = 86_400_000

/**
 * 保护期剩余天数：protectUntil 在未来 → ceil(差值/天)；过期/null/非法 → 0。
 * UI 语义：>0 时保护期列显示「🔒 保护期 X 天」，其余显示「—」。
 */
export function protectDaysLeft(protectUntil: string | null | undefined, now: Date = new Date()): number {
    if (!protectUntil) return 0
    const until = Date.parse(protectUntil)
    if (Number.isNaN(until)) return 0
    const diff = until - now.getTime()
    if (diff <= 0) return 0
    return Math.ceil(diff / MS_PER_DAY)
}

// ==================== SAN 折叠（chips 超 3 个折叠 +N） ====================

export interface SanFold {
    visible: string[]
    hiddenCount: number
    folded: boolean
    /** 折叠态 +N chip 的悬浮/键盘焦点全文（tooltip 内容） */
    hiddenList: string[]
}

/** SAN chips 最多展示 maxVisible 个，超出折叠为「+N」（悬浮/焦点展开全部） */
export function foldSans(sans: readonly string[], maxVisible = 3): SanFold {
    const list = [...sans]
    if (list.length <= maxVisible) {
        return { visible: list, hiddenCount: 0, folded: false, hiddenList: [] }
    }
    const visible = list.slice(0, maxVisible)
    const hiddenList = list.slice(maxVisible)
    return { visible, hiddenCount: hiddenList.length, folded: true, hiddenList }
}

// ==================== 百分比（覆盖率双口径 / 占比） ====================

/** 小数比率（0~1，后端 float64 台账数/分母）→ 整数百分比；非法值显示「—」（不误导为 0%） */
export function formatPercent(rate: number): string {
    if (!Number.isFinite(rate)) return '—'
    const pct = Math.round(rate * 100)
    return `${Math.min(100, Math.max(0, pct))}%`
}

// ==================== 导入校验错误映射（四类 CERT_*） ====================

export interface ImportErrorItem {
    code: string
    /** 明确的中文分类文案 */
    label: string
    /** 服务端 detail（原文，不含私钥材料——后端保证 message 无敏感片段） */
    detail: string
}

const CERT_ERROR_LABELS: Record<string, string> = {
    CERT_KEY_MISMATCH: '私钥不匹配',
    CERT_CHAIN_INCOMPLETE: '证书链缺失',
    CERT_PARSE_FAIL: 'SAN 结构无法解析 / 已过期',
    CERT_DUPLICATE_FINGERPRINT: '重复指纹',
}

/** 最小错误形状（CertRequestError 及测试桩共用） */
interface CodeCarrier {
    code?: string
    message?: string
}

/**
 * 导入/补传校验失败 → 横幅逐项错误列表（单次提交通常一项；列表形态为逐项展示留出余地，
 * 批量场景复用）。未知错误码回退通用文案并保留服务端消息。
 */
export function importErrorItems(err: unknown): ImportErrorItem[] {
    const carrier = (err && typeof err === 'object' ? (err as CodeCarrier) : {}) as CodeCarrier
    const code = typeof carrier.code === 'string' && carrier.code ? carrier.code : 'UNKNOWN'
    const label = CERT_ERROR_LABELS[code] ?? '导入失败'
    const detail = typeof carrier.message === 'string' && carrier.message ? carrier.message : '请检查文件后重试'
    return [{ code, label, detail }]
}

// ==================== 预期域名提示性比对（客户端侧，不拦截） ====================

const DOMAIN_RE = /^(\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/

function normalizeDomain(d: string): string {
    return d.trim().toLowerCase().replace(/\.$/, '')
}

/**
 * 从 PEM 文本提取嵌入域名：base64 解码 DER 后扫描可打印 ASCII 串，过滤出域名形态。
 * 依据：SAN/CN 在 DER 中为 IA5String 原文字节（快速路径，不引入 ASN.1 依赖）；
 * 仅服务「预期域名 Warning 提示性比对」，非安全判定。
 */
export function extractPemDomains(pem: string): string[] {
    const body = pem
        .replace(/-----(BEGIN|END)[^-]+-----/g, '')
        .replace(/\s+/g, '')
    if (!body) return []
    let bytes: Uint8Array
    try {
        const bin = atob(body)
        bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    } catch {
        return []
    }
    const out: string[] = []
    let run = ''
    const flush = () => {
        const s = run.toLowerCase()
        if (s.length >= 4 && DOMAIN_RE.test(s) && !out.includes(s)) out.push(s)
        run = ''
    }
    for (const b of bytes) {
        if (b >= 0x21 && b <= 0x7e) {
            run += String.fromCharCode(b)
        } else {
            flush()
        }
    }
    flush()
    return out
}

/**
 * 预期域名是否被候选域名集合覆盖：精确相等，或通配符 *.example.com 覆盖其单层子域名。
 * 未覆盖 → 表单内 Warning 提示「SAN 未覆盖预期域名（提示性，不拦截）」。
 */
export function expectedDomainCovered(expected: string, domains: readonly string[]): boolean {
    const target = normalizeDomain(expected)
    if (!target) return true
    for (const raw of domains) {
        const d = normalizeDomain(raw)
        if (d === target) return true
        if (d.startsWith('*.')) {
            const parent = d.slice(2)
            if (target.endsWith(`.${parent}`) && target.length > parent.length + 1) return true
        }
    }
    return false
}

// ==================== 删除拦截（结构化原因） ====================

/** 后端 409 CERT_HAS_REFS 信封 meta（web/ledger_handler.go deleteBlockedMeta） */
export interface DeleteBlockedMeta {
    referenceStatus?: string
    refCount?: number
    reason?: string
    protectUntil?: string
    /** 测试注入当前时间 */
    now?: Date
}

/**
 * 拦截 Modal 原因文案：`N 个活跃引用 · 回滚保护期至 YYYY-MM-DD`；
 * blind_spot 沿用服务端 reason；无结构化信息回退通用文案。
 */
export function deleteBlockedSummary(meta: DeleteBlockedMeta | null | undefined): string {
    if (!meta) return '存在活跃引用或处于回滚保护期，禁止删除'
    const parts: string[] = []
    if ((meta.refCount ?? 0) > 0) parts.push(`${meta.refCount} 个活跃引用`)
    const days = protectDaysLeft(meta.protectUntil, meta.now)
    if (days > 0 && meta.protectUntil) {
        const until = new Date(Date.parse(meta.protectUntil))
        const y = until.getFullYear()
        const m = String(until.getMonth() + 1).padStart(2, '0')
        const d = String(until.getDate()).padStart(2, '0')
        parts.push(`回滚保护期至 ${y}-${m}-${d}`)
    }
    if (parts.length === 0) {
        const reason = typeof meta.reason === 'string' && meta.reason.trim() ? meta.reason.trim() : null
        if (reason) return reason
        return '存在活跃引用或处于回滚保护期，禁止删除'
    }
    return parts.join(' · ')
}

/** 行级删除预判：有引用或保护期内 → 直接拦截 Modal（无删除按钮）而非二次确认 */
export function canDeleteRow(
    row: { refCount?: number; protectUntil?: string | null },
    now: Date = new Date(),
): boolean {
    if ((row.refCount ?? 0) > 0) return false
    if (protectDaysLeft(row.protectUntil, now) > 0) return false
    return true
}

// ==================== 批量导入会话 ====================

/** 轮询终态：completed（全部成功）/ partial_failed（部分失败） */
export function isBatchTerminal(status: string): boolean {
    return status === 'completed' || status === 'partial_failed'
}

/** 进度百分比 = done/total，钳制 0~100；total<=0 → 0 */
export function batchProgressPercent(done: number, total: number): number {
    if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return 0
    return Math.min(100, Math.max(0, Math.round((done / total) * 100)))
}

/**
 * 去扩展名基名（后端按此配对 certFiles/keyFiles，web/cert_handler.go ImportBatch）。
 * 前端在逐文件附加私钥时将用户选择的私钥重命名为 `${base}.key` 保证配对成立。
 */
export function pairBaseName(fileName: string): string {
    const base = fileName.split(/[\\/]/).pop() ?? fileName
    const dot = base.lastIndexOf('.')
    if (dot <= 0) return base
    return base.slice(0, dot)
}

export interface BatchResultMeta {
    label: string
    tone: LedgerTone | 'accent' | 'secondary'
}

/** 逐文件结果徽章：成功 · 完整托管 / 成功 · 仅指纹登记 / 失败 */
export function batchResultMeta(result: string): BatchResultMeta {
    if (result === 'complete') return { label: '成功 · 完整托管', tone: 'accent' }
    if (result === 'fingerprintOnly') return { label: '成功 · 仅指纹登记', tone: 'secondary' }
    if (result === 'failed') return { label: '失败', tone: 'error' }
    return { label: '待处理', tone: 'secondary' }
}

// ==================== zip 解包（fflate 之后的名目分流） ====================

export interface NamedBytes {
    name: string
    bytes: Uint8Array
}

export interface ZipSplit {
    certs: NamedBytes[]
    keys: NamedBytes[]
}

function pemHead(bytes: Uint8Array, max = 64): string {
    let s = ''
    for (let i = 0; i < Math.min(max, bytes.length); i++) {
        const c = bytes[i] ?? 0
        if (c === 0x0a || c === 0x0d) continue
        s += String.fromCharCode(c)
    }
    return s
}

/**
 * 单条目证书/私钥判定：.key 扩展名 → key；.crt/.cer → cert；
 * .pem 按内容嗅探（PRIVATE KEY 头 → key，否则 cert）。
 */
export function sniffPemKind(name: string, bytes: Uint8Array): 'cert' | 'key' {
    const lower = name.toLowerCase()
    if (lower.endsWith('.key')) return 'key'
    if (lower.endsWith('.crt') || lower.endsWith('.cer')) return 'cert'
    const head = pemHead(bytes)
    return head.includes('PRIVATE KEY') ? 'key' : 'cert'
}

/**
 * zip 解包条目分流：证书（.pem/.crt/.cer）与私钥（.key 或内容嗅探），
 * 跳过目录与系统杂物（__MACOSX 等）；readme/其他扩展名忽略。
 * 输入为 fflate unzipSync 的 entries（name → bytes）。
 */
export function splitZipEntries(entries: Record<string, Uint8Array>): ZipSplit {
    const certs: NamedBytes[] = []
    const keys: NamedBytes[] = []
    for (const [name, bytes] of Object.entries(entries)) {
        if (name.endsWith('/')) continue
        const base = name.split(/[\\/]/).pop() ?? name
        if (base.startsWith('__MACOSX') || base.startsWith('.')) continue
        const lower = base.toLowerCase()
        if (!/\.(pem|crt|cer|key)$/.test(lower)) continue
        if (sniffPemKind(base, bytes) === 'key') keys.push({ name, bytes })
        else certs.push({ name, bytes })
    }
    return { certs, keys }
}

// ==================== 会话恢复持久化（中断重入） ====================

/** localStorage 键：上次批量导入会话 batchId（会话 TTL 30 天，服务端侧过期自清理） */
export const LAST_BATCH_STORAGE_KEY = 'cert.batchImport.lastBatchId'

/** 读取上次会话 batchId；storage 不可用或无记录 → null */
export function loadLastBatchId(storage: Storage | null | undefined = safeStorage()): string | null {
    try {
        return storage?.getItem(LAST_BATCH_STORAGE_KEY) ?? null
    } catch {
        return null
    }
}

/** 保存/清除上次会话 batchId（null 清除）；storage 不可用静默忽略 */
export function saveLastBatchId(id: string | null, storage: Storage | null | undefined = safeStorage()): void {
    try {
        if (id === null) storage?.removeItem(LAST_BATCH_STORAGE_KEY)
        else storage?.setItem(LAST_BATCH_STORAGE_KEY, id)
    } catch {
        /* 隐私模式等场景放弃持久化，不影响当次会话 */
    }
}

function safeStorage(): Storage | null {
    try {
        return typeof globalThis !== 'undefined' ? (globalThis.localStorage ?? null) : null
    } catch {
        return null
    }
}

// ==================== 页面四态 ====================

export type PageState = 'loading' | 'empty' | 'error' | 'populated'

/**
 * 台账页四态判定：loading 优先 → error（仅无数据时，刷新失败不塌陷已渲染列表）
 * → total=0 empty → populated。
 */
export function resolvePageState(args: { loading: boolean; error: boolean; total: number }): PageState {
    if (args.loading) return 'loading'
    if (args.error) return args.total > 0 ? 'populated' : 'error'
    return args.total > 0 ? 'populated' : 'empty'
}

// ==================== 剪贴板 ====================

/** 复制全文（指纹等）：优先 navigator.clipboard，降级 execCommand；成功返回 true */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            return true
        }
    } catch {
        /* 降级路径 */
    }
    try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
    } catch {
        return false
    }
}
