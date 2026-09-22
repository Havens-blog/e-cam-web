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

// ---- CDN 缓存分析(POST /cam/logs/cache-analyze;对应 e-cam-service service.CacheAnalyzeResponse + cdncache.CacheAnalyzeResult) ----

/** CDN 缓存分析请求(字段与诊断请求对齐 + confirm;维度集由编排固定 —— 当前窗 5 维度组 + 前窗 1 帧,无 dimension/metric) */
export interface LogCacheAnalyzeRequest {
    log_type: LogType
    start_time: number
    end_time: number
    /** 可选,原生检索式透传 */
    query?: string
    /** 可选,限定云 */
    clouds?: string[]
    /** 可选,限定云账号(平台内 ID) */
    account_ids?: number[]
    /** 可选,限定资源(域名) */
    resources?: string[]
    /** 可选,结构化字段筛选(AND 叠加) */
    filters?: FieldFilter[]
    /** 预估扫描量超限(窗口 > 6h)默认拦截后的人工确认放行 */
    confirm?: boolean
}

/** 缓存分析上下文:由视图按当前查询组装(诊断/缓存分析卡同构,仅 CDN Tab 开放) */
export type LogCacheAnalyzeContext = Omit<LogCacheAnalyzeRequest, 'log_type'>

/** 单档命中率(全请求/可缓存;命中 = hit+partial,未知计入分母不计入两侧) */
export interface CacheHitRateTier {
    /** 0-1 */
    rate: number
    /** 命中请求/字节(hit+partial) */
    numerator: number
    /** 总请求/字节 */
    denominator: number
    /** 分母 > 0 才有效(false = 前端显示占位) */
    available: boolean
}

/** 双口径命中率对(全请求/可缓存两档) */
export interface CacheHitRatePair {
    all: CacheHitRateTier
    cacheable: CacheHitRateTier
}

/** 域名命中率条目(未命中 Top N 域名,请求数降序 Top 8;已覆盖源近似口径) */
export interface CacheDomainHitStat {
    host: string
    /** 该域名全请求数 */
    requests: number
    /** 全请求口径 (hit+partial)/requests(partial/未知计入命中) */
    hit_rate: number
    /** 可缓存近似口径(仅剔除 cache_hit=error) */
    cacheable_hit_rate: number
    /** 该域名未命中(miss+error)占全局未命中 */
    miss_traffic_ratio: number
    /** 域名级字节命中率(命中字节 = 总 − 未命中;总字节 ≤0 时 0) */
    byte_hit_rate: number
    /** 字节帧完整(总字节>0),byte_hit_rate 有效 */
    byte_hit_available: boolean
    /** good / fair / poor / unknown(域名级阈值) */
    grade: string
}

/** 未命中 URI TOP 条目(查询串归一后;TopN 截断时占比为下界) */
export interface CacheURIMissTop {
    /** 归一路径(无查询串) */
    uri: string
    /** 归属域名(可空:聚合组键为纯路径形态时取不到,前端标注归属未知) */
    host: string
    /** 归并后未命中请求数 */
    miss_count: number
    /** 占全部未命中请求 */
    miss_share: number
    /** 归并的查询串变体数(≥2 = 同资源不同参数被拆散后归并) */
    variants: number
    /** 贡献最大变体的排序归一查询串(证据展示) */
    sample_query?: string
}

/** 状态码分布(4xx/5xx 占总响应占比;状态×cache_hit 二维交叉为后续增强) */
export interface CacheStatusOverview {
    /** 状态码分布合计 */
    total: number
    client_error_count: number
    server_error_count: number
    /** 4xx/总响应 */
    client_error_ratio: number
    /** 5xx/总响应 */
    server_error_ratio: number
}

/** 请求-字节 gap 双向归因(大文件回源带宽 / 小文件回源请求) */
export interface CacheGapAnalysis {
    /** 请求命中率(全请求) − 字节命中率(全请求);字节不可用时 0 */
    byte_gap_ratio: number
    large_file_gap: boolean
    small_file_reverse: boolean
}

/** 结构化优化项(非优档按未命中流量占比降序 Top 5;优档允许 0 条) */
export interface CacheOptimizationItem {
    /** 域名(空 = 全局) */
    domain?: string
    /** URI 前缀/归一路径(空 = 不限) */
    uri_prefix?: string
    /** add_cache_rule / tune_ttl / ignore_query_string / origin_verify */
    action: string
    /** 未命中流量占比(口径随项类型) */
    miss_traffic_ratio: number
    /** high / medium / low */
    confidence: string
    /** 低可信度(启发式判定,前端默认折叠) */
    low_confidence: boolean
    /** 判据证据(含具体数值;忽略查询串必附 miss 集中证据) */
    evidence: string
}

/** 前一等长窗口对比趋势 */
export interface CachePrevTrend {
    /** 前窗数据可用(false = 降级为当前窗绝对量判定) */
    available: boolean
    /** 前窗命中率(全请求口径,0-1) */
    prev_request_hit_rate: number
    /** 当前 − 前窗(0-1;正 = 上升) */
    delta: number
    /** up / flat / down */
    direction: string
    /** 下降 ≥ 阈值 → 提示关注 */
    alert: boolean
}

/** 规则引擎判定结论(双命中率/健康档位/排行/URI TOP/状态码/gap/优化项/趋势/口径标注) */
export interface CacheAnalyzeResult {
    /** good / fair / poor / unknown(可缓存口径档位) */
    grade: string
    request_hit_rate: CacheHitRatePair
    byte_hit_rate: CacheHitRatePair
    domain_ranking: CacheDomainHitStat[]
    miss_uri_top: CacheURIMissTop[]
    status: CacheStatusOverview
    gap: CacheGapAnalysis
    recommendations: CacheOptimizationItem[]
    prev_trend: CachePrevTrend
    /** 口径/降级标注(partial 上偏、可缓存近似等) */
    notes: string[]
}

/** 前一等长窗口 cache_hit 分布(趋势对比输入;total=0 = 前窗确实无数据) */
export interface CacheAnalyzePrevWindow {
    total: number
    cache_hit_dist?: TopNItem[]
}

/** CDN 缓存分析响应(引擎结论 + 口径输入明细 + per-source 状态) */
export interface LogCacheAnalyzeResponse {
    log_type: string
    /** 当前窗口时长(秒) */
    window_sec: number
    /** 当前窗总请求数(全源精确求和) */
    total: number
    /** 全请求字节总量(cache_hit×sum_bytes 求和;已覆盖源口径) */
    total_bytes: number
    /** 规则引擎判定结论 */
    result: CacheAnalyzeResult
    /** 前窗对比;缺省 = 前窗不可用(见 prev_error),total=0 = 前窗确实无数据 */
    prev?: CacheAnalyzePrevWindow
    /** 前窗不可用原因(空 = 成功/无数据) */
    prev_error?: string
    /** 前窗 per-source 状态(趋势"基于 X/Y 源"取此字段) */
    prev_sources?: AggregateSourceOutcome[]
    /** 当前窗 per-source 状态(跨维度合并:同源任一维度失败即标注) */
    sources: AggregateSourceOutcome[]
    /** 维度缺失/覆盖范围说明(缺失源在此标注,不白屏) */
    dimension_notes?: string
    /** 本次分析扫过的窗口帧数(当前窗 + 前窗,成本标注) */
    aggregate_frames: number
    /** AI 解读占位(后置:本接口不引入 LLM,恒空串;前端不引入模型调用) */
    summary: string
    cached: boolean
    cache_stale: boolean
}
