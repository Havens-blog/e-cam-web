/**
 * 多云统一日志查询 API 类型(对应 e-cam-service internal/logquery 三接口)
 */

/** 日志类型(cdn / waf / slb) */
export type LogType = 'cdn' | 'waf' | 'slb'

/** 统一字段定义(动态列驱动:后端加字段,前端自动多列) */
export interface LogFieldDef {
    key: string
    label: string
    fixed: boolean
}

/** 日志类型元数据(字段字典 + 时间范围约束) */
export interface LogTypeMeta {
    type: LogType
    label: string
    fields: LogFieldDef[]
    max_window_days: number
}

/** 日志源(域名 / LB 实例 / WAF 流) */
export interface LogSource {
    cloud: string
    account_id: string
    account_name: string
    region: string
    log_type: LogType
    /** 域名 / LB 实例 ID / 分发 ID */
    resource_id: string
    name: string
    /** 投递是否开启(查询可用性) */
    enabled: boolean
    /** 未开启原因 / 延迟特征等引导信息 */
    note: string
}

/** 日志公共元数据 */
export interface LogMeta {
    cloud: string
    account_id: string
    account_name: string
    region: string
    resource_id: string
    /** 源标识(SLS project/logstore、LTS group/stream、S3 bucket/key) */
    source: string
}

/** 原始字段全量保留(详情抽屉零丢失出口) */
export type LogRaw = Record<string, unknown>

/** CDN 访问日志统一模型 */
export interface CDNLogEntry {
    meta: LogMeta
    timestamp: number
    client_ip: string
    method: string
    url: string
    host: string
    status: number
    bytes_sent: number
    /** 归一枚举: hit / miss / partial / error / "-" */
    cache_hit: string
    latency_ms: number
    referer: string
    user_agent: string
    edge_node: string
    request_id: string
    raw: LogRaw
}

/** WAF 日志统一模型 */
export interface WAFLogEntry {
    meta: LogMeta
    timestamp: number
    client_ip: string
    host: string
    uri: string
    method: string
    rule_id: string
    rule_name: string
    /** 归一枚举: block / alert / allow / pass */
    action: string
    /** 归一: low / medium / high / "-" */
    severity: string
    status: number
    user_agent: string
    geo: string
    raw: LogRaw
}

/** 负载均衡访问日志统一模型 */
export interface SLBLogEntry {
    meta: LogMeta
    timestamp: number
    client_ip: string
    client_port: number
    target_ip: string
    target_port: number
    listener_port: number
    protocol: string
    method: string
    url: string
    host: string
    status: number
    request_length: number
    bytes_sent: number
    latency_ms: number
    upstream_latency_ms: number
    upstream_status: number
    tls_protocol: string
    tls_cipher: string
    request_id: string
    user_agent: string
    raw: LogRaw
}

/** 统一日志条目(三 schema 联合;按 timestamp 排序展示) */
export type LogEntry = CDNLogEntry | WAFLogEntry | SLBLogEntry

/** 联邦查询请求 */
export interface LogSearchRequest {
    log_type: LogType
    /** Unix 毫秒 UTC(含) */
    start_time: number
    end_time: number
    /** 可选,原生检索式透传(各云语法由后端 provider 翻译) */
    query?: string
    /** 可选,限定云 */
    clouds?: string[]
    /** 可选,限定云账号(平台内 ID) */
    account_ids?: number[]
    /** 可选,限定资源(域名 / LB ID) */
    resources?: string[]
    /** 单源上限(默认 100,硬顶 500) */
    limit?: number
}

/** 单源查询状态(失败不静默) */
export interface LogSourceOutcome {
    cloud: string
    account_id: string
    account_name: string
    count: number
    /** 失败原因(空 = 成功) */
    error: string
    duration_ms: number
}

/** 联邦查询响应 */
export interface LogSearchResponse {
    log_type: string
    total: number
    /** 任一源触顶或联邦超时 */
    truncated: boolean
    /** 时间倒序 */
    entries: LogEntry[]
    sources: LogSourceOutcome[]
}
