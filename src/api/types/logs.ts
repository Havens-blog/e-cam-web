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
    /**
     * 该类型已建分析索引(可聚合)的字段清单:分组聚合维度白名单。
     * 含字典字段键与云上原始列名;空 = 探测失败/无账号,维度下拉回退全量字典。
     */
    aggregatable?: string[]
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

/** 结构化字段筛选条件(字段字典 key;AND 叠加,语义在归一化字段上) */
export interface FieldFilter {
    /** client_ip / host / status / rule_name ...(/types 字段字典 key) */
    field: string
    /** eq / neq / contains / prefix */
    op: string
    value: string
}

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
    /** 可选,结构化字段筛选(AND 叠加) */
    filters?: FieldFilter[]
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

/** 聚合请求(与查询对齐,无 limit——聚合下推云引擎不受采样约束) */
export interface LogAggregateRequest {
    log_type: LogType
    start_time: number
    end_time: number
    query?: string
    clouds?: string[]
    resources?: string[]
    /** 可选,结构化字段筛选(可下推的源生效,否则显式标注) */
    filters?: FieldFilter[]
    /** 分组维度(/types 字段 key;空 = 该类型默认维度) */
    dimension?: string
    /** count / sum_bytes / avg_latency / p99_latency(空 = count) */
    metric?: string
}

/** 时间分桶(窗口真实分布) */
export interface AggregateBucket {
    /** 桶起点 Unix 毫秒 UTC */
    timestamp: number
    count: number
}

/** 聚合 TopN 条目(自定义维度/指标) */
export interface TopNItem {
    name: string
    /** 组内条目数(跨源按名求和) */
    count: number
    /** 指标值(count 时 = count;avg/p99/sum 数值指标时承载) */
    value?: number
}

/** 单源聚合状态(不支持聚合的源显式标注) */
export interface AggregateSourceOutcome {
    cloud: string
    account_id: string
    account_name: string
    /** 该源窗口精确总数 */
    total: number
    /** 失败/不支持原因(空 = 成功) */
    error: string
    duration_ms: number
}

/** 联邦聚合响应(跨源分桶求和、TopN 归并) */
export interface LogAggregateResponse {
    log_type: string
    /** 窗口精确总数 */
    total: number
    buckets: AggregateBucket[]
    topn: TopNItem[]
    sources: AggregateSourceOutcome[]
    /** 部分源维度/指标不可下推的说明(趋势/总数仍有效,仅 TopN 缺失) */
    topn_skip?: string
}

// ---- WAF 流量诊断(POST /cam/logs/diagnose;对应 e-cam-service service.DiagnoseResponse) ----

/** WAF 流量诊断请求(字段与聚合请求对齐,无 dimension/metric —— 维度集由诊断编排固定) */
export interface LogDiagnoseRequest {
    log_type: LogType
    start_time: number
    end_time: number
    /** 可选,原生检索式透传 */
    query?: string
    clouds?: string[]
    resources?: string[]
    /** 可选,结构化字段筛选(AND 叠加) */
    filters?: FieldFilter[]
}

/** 诊断上下文:由视图按当前查询组装(诊断卡不含 log_type,仅 WAF Tab 开放) */
export type LogDiagnoseContext = Omit<LogDiagnoseRequest, 'log_type'>

/** 前一等长窗口对比值(突增判据) */
export interface LogDiagnosePrevWindow {
    total: number
    /** 前窗 Top1 IP 请求数(0 = 无 Top IP 数据) */
    top_ip_count: number
}

/** Top 攻击源(占比 = 该 IP 请求数 / 当前窗 Total) */
export interface LogDiagnoseSource {
    ip: string
    count: number
    share: number
}

/** 规则引擎判定结论 */
export interface LogDiagnoseResult {
    /** 0-100 */
    risk_score: number
    /** none / low / medium / high */
    risk_level: 'none' | 'low' | 'medium' | 'high'
    /** normal / cc_flood / crawler / brute_force / normal_burst */
    attack_type: 'normal' | 'cc_flood' | 'crawler' | 'brute_force' | 'normal_burst'
    /** 措施文案(≥3 条,含具体值插值) */
    measures: string[]
    /** Top 攻击源 IP(后端默认前 5,含占比) */
    top_sources: LogDiagnoseSource[]
    /** 判据缺失降级标注(前窗无数据/窗口时长缺失) */
    degraded: boolean
    /** 降级原因(空 = 未降级) */
    degraded_reason?: string
    /** 突增倍数(0 = 前窗无数据未计算) */
    surge_multiplier: number
}

/** WAF 流量诊断响应(判定结论 + 判据输入明细 + per-source 状态) */
export interface LogDiagnoseResponse {
    log_type: string
    /** 当前窗口时长(秒) */
    window_sec: number
    /** 当前窗总请求数(全源精确求和) */
    total: number
    buckets: AggregateBucket[]
    top_ips: TopNItem[]
    top_uas: TopNItem[]
    /** 请求量高的 URI/URL TopN(某源未开索引时部分缺失,dimension_notes 说明) */
    top_uris: TopNItem[]
    status_codes: TopNItem[]
    actions: TopNItem[]
    /** 前窗对比;缺省 = 前窗不可用(见 prev_error),total=0 = 前窗确实无数据 */
    prev?: LogDiagnosePrevWindow
    /** 前窗不可用原因(空 = 成功/无数据) */
    prev_error?: string
    /** 前窗 per-source 状态 */
    prev_sources?: AggregateSourceOutcome[]
    /** 规则引擎判定结论 */
    result: LogDiagnoseResult
    /** 当前窗 per-source 状态(来源分布按云账号展示用) */
    sources: AggregateSourceOutcome[]
    /** 非主维度缺失说明(某源维度聚合失败/不可下推) */
    dimension_notes?: string
    /** 本次诊断扫过的窗口帧数(当前窗 + 前窗,成本标注) */
    aggregate_frames: number
    /** AI 解读(后置占位:模型接入前恒空串,前端不引入任何模型调用) */
    summary: string
    cached: boolean
    cache_stale: boolean
}
