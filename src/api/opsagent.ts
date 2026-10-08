/**
 * 运维 Agent API（D:/Haven/opsagent，任务 5.2 对话排障）。
 *
 * 端点契约：docs/features/haven-opsagent/design/api-handbook.md（§1 chat、
 * §2 correct）。传输：opsagentAxios（./request/opsagent.ts）。
 * 信封：{code, message, data}——成功 code ∈ {0, "0", 200}（chat/correct 手写
 * 字符串 "0"，其余端点经 web.OK 写数字 0），业务错误 code 为字符串 ERR_*；
 * 经 unwrapOpsagent 解包，非成功 code 抛 OpsagentRequestError（保留 code 供
 * 页面按 ERR_PERSIST_FAILED 等分支处理）。
 * 类型：字段名镜像后端 web 层 DTO 的 json tag（internal/web/*.go + domain 类型）。
 */

import type { AxiosError, AxiosResponse } from 'axios'
import { opsagentAxios } from './request/opsagent'

// ==================== 信封与错误 ====================

/** opsagent 统一响应信封：code 为数字 0（web.OK）或字符串 "0"/ERR_*（chat 手写） */
export interface OpsagentEnvelope<T = unknown> {
    code: number | string
    message: string
    data?: T
}

/** opsagent 请求错误：保留字符串错误码供调用方分支处理 */
export class OpsagentRequestError extends Error {
    readonly code: string
    /** persist-failed（200 + ERR_PERSIST_FAILED）时 data 仍携带可用诊断正文 */
    readonly data?: unknown

    constructor(code: string, message: string, data?: unknown) {
        super(message)
        this.name = 'OpsagentRequestError'
        this.code = code
        this.data = data
    }
}

/** 成功 code 判定：数字 0/200 与字符串 "0"/"200" 均视为成功 */
function isSuccessCode(code: unknown): boolean {
    return code === 0 || code === '0' || code === 200 || code === '200'
}

/**
 * 解开 {code, message, data} 信封：成功返回 data；业务错误（含 200 + ERR_*）
 * 抛 OpsagentRequestError 并携带 data（persist-failed 的 report 仍可用）；
 * 网络错误/无信封载荷原样抛出（不吞错）。
 */
export async function unwrapOpsagent<T>(p: Promise<AxiosResponse<OpsagentEnvelope<T>>>): Promise<T> {
    let body: OpsagentEnvelope<T>
    try {
        body = (await p).data
    } catch (err) {
        const envelope = (err as AxiosError<OpsagentEnvelope<T>>)?.response?.data
        if (envelope && typeof envelope === 'object' && 'code' in envelope) {
            throw new OpsagentRequestError(
                String(envelope.code),
                envelope.message ?? 'opsagent 请求失败',
                envelope.data,
            )
        }
        throw err
    }
    if (!body || typeof body !== 'object' || !('code' in body)) {
        throw new OpsagentRequestError('INVALID_ENVELOPE', 'opsagent 接口响应格式错误')
    }
    if (!isSuccessCode(body.code)) {
        throw new OpsagentRequestError(
            String(body.code),
            body.message ?? 'opsagent 请求失败',
            body.data,
        )
    }
    return body.data as T
}

// ==================== 意图 / 排障参数 ====================

/** 意图类型（tech-design Interface 1：diagnose|resource|out_of_scope） */
export type IntentType = 'diagnose' | 'resource' | 'out_of_scope'

/** 时间窗（RFC3339；End-Start ≤ 24h） */
export interface Timeframe {
    startTime: string
    endTime: string
}

/** 意图抽取的排障参数（IntentClassifier 输出 / L2 预置查询预填） */
export interface DiagnoseParams {
    serviceName: string
    metric?: string
    timeframe: Timeframe
    logTypes?: string[]
}

/** 备选意图（供一键纠正） */
export interface IntentCandidate {
    type: IntentType
    confidence: number
    params: DiagnoseParams
}

// ==================== 编排产物（诊断）====================

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'
export type RiskLevel = 'read' | 'low' | 'high'
export type CitationSourceType = 'log' | 'metric' | 'asset' | 'alert'

/** 数据源引用（Supporting Evidence） */
export interface Citation {
    sourceType: CitationSourceType
    sourceKey: string
    snippet: string
}

export interface Conclusion {
    text: string
    citation: string[]
}

export interface DispositionStep {
    step: string
    risk: RiskLevel
    action: string
    executed: boolean
}

/** 编排调用链步骤（Diagnosis.trace 元素） */
export interface TraceStep {
    step: number
    agent: string
    action: string
    source?: string
    durationMs: number
    summary: string
    degradeLevel?: number
}

export interface Diagnosis {
    id: string
    sessionId: string
    tenant: string
    rootCause: string
    confidence: number
    severity: Severity
    riskLevel: RiskLevel
    conclusions: Conclusion[]
    disposition: DispositionStep[]
    citations: Citation[]
    degraded: boolean
    truncated: boolean
    trace: TraceStep[]
}

/** 预置查询条目（L2 响应 settings.preset_queries） */
export interface PresetQuery {
    id: string
    label: string
    params: DiagnoseParams
}

// ==================== 对话响应 ====================

/** 响应 type：正常报告 / L2 预置入口 / 超能力引导 / 澄清 / L3 明示降级 */
export type ChatType = 'report' | 'preset_entries' | 'guided' | 'clarify' | 'degraded_notice'

/** chat/correct 响应 data（api-handbook §1/§2 同形） */
export interface ChatData {
    sessionId: string
    diagnosis: Diagnosis | null
    report: string
    type: ChatType
    needsClarify: boolean
    candidates: IntentCandidate[]
    degradeLevel: number
    presets: PresetQuery[]
    /** 202 异步回退（同步编排超出延迟预算）：{sessionId, status:"running"} */
    status?: string
}

// ==================== 端点 ====================

const BASE = '/opsagent'

/** 发起对话排障（POST /opsagent/chat） */
export function chatApi(data: { message: string; requestId?: string }): Promise<ChatData> {
    return unwrapOpsagent<ChatData>(opsagentAxios.post(`${BASE}/chat`, data))
}

/** 会话内纠正（POST /opsagent/chat/:sessionId/correct，targetIntent+params XOR message） */
export function correctApi(
    sessionId: string,
    data: { targetIntent?: IntentType; params?: DiagnoseParams; message?: string; requestId?: string },
): Promise<ChatData> {
    return unwrapOpsagent<ChatData>(opsagentAxios.post(`${BASE}/chat/${sessionId}/correct`, data))
}