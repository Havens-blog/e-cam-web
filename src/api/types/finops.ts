/**
 * FinOps 多云成本分析 API 类型定义
 */

// ==================== 通用参数 ====================

/** 成本查询通用筛选参数 */
export interface CostFilterParams {
    provider?: string
    service_type?: string
    region?: string
    account_id?: number
    start_date?: string
    end_date?: string
}

// ==================== 成本概览 ====================

/** GET /cost/summary 响应 */
export interface CostSummary {
    current_month_amount: number
    last_month_amount: number
    mom_change_percent: number
    elapsed_days?: number
}

// ==================== 成本趋势 ====================

/** GET /cost/trend 请求参数 */
export interface CostTrendParams extends CostFilterParams {
    granularity: 'daily' | 'weekly' | 'monthly'
}

/** 趋势数据点 */
export interface CostTrendPoint {
    date: string
    amount: number
    amount_cny: number
}

// ==================== 成本分布 ====================

/** GET /cost/distribution 请求参数 */
export interface CostDistributionParams extends CostFilterParams {
    dimension: 'provider' | 'service_type' | 'region'
}

/** 分布项 */
export interface CostDistItem {
    key: string
    amount: number
    amount_cny: number
    percent: number
}

// ==================== 同比环比 ====================

/** GET /cost/comparison 响应 */
export interface ComparisonResult {
    current_amount: number
    previous_amount: number
    change_percent: number
    current_period: string
    previous_period: string
}

// ==================== 预算管理 ====================

export interface BudgetRule {
    id: number
    name: string
    amount_limit: number
    period: string
    scope_type: string
    scope_value: string
    thresholds: number[]
    status: string
    create_time: number
    update_time: number
}

export interface CreateBudgetRequest {
    name: string
    amount_limit: number
    period: string
    scope_type: string
    scope_value: string
    thresholds: number[]
}

export interface BudgetProgress {
    budget_id: number
    name: string
    amount_limit: number
    current_spend: number
    progress_percent: number
    remaining: number
}

// ==================== 成本分摊 ====================

export interface AllocationRule {
    id: number
    name: string
    rule_type: string
    dimension_combos: DimensionCombo[]
    priority: number
    status: string
}

export interface DimensionCombo {
    dimensions: DimensionFilter[]
    target_id: string
    target_name: string
    ratio: number
}

export interface DimensionFilter {
    dim_type: string
    dim_value: string
}

export interface CreateAllocationRuleRequest {
    name: string
    rule_type: string
    dimension_combos: DimensionCombo[]
    priority: number
}

// ==================== 异常检测 ====================

export interface CostAnomaly {
    id: number
    dimension: string
    dimension_value: string
    anomaly_date: string
    actual_amount: number
    baseline_amount: number
    deviation_pct: number
    severity: 'info' | 'warning' | 'critical'
    possible_cause: string
    create_time: number
}

// ==================== 优化建议 ====================

export interface Recommendation {
    id: number
    type: 'downsize' | 'release_disk' | 'convert_prepaid'
    provider: string
    account_id: number
    resource_id: string
    resource_name: string
    region: string
    reason: string
    estimated_saving: number
    status: 'pending' | 'dismissed'
    create_time: number
}

// ==================== 采集管理 ====================

export interface CollectLog {
    id: number
    account_id: number
    provider: string
    status: string
    /** 采集开始时间（后端 RFC3339 / UTC），如 2026-10-27T03:19:19.24Z */
    start_time: string
    end_time: string
    /** 账期范围（后端 RFC3339 / UTC），展示时需转本地时区 */
    bill_start: string
    bill_end: string
    record_count: number
    duration_ms: number
    error_msg: string
    tenant_id: number
    /** 建日志时间（毫秒时间戳）。后端 JSON 字段名为 ctime，不是 create_time */
    ctime: number
}

export interface ManualCollectRequest {
    account_id: number
    start_date: string // YYYY-MM-DD，前端传入，API 层转换为 RFC3339
    end_date: string   // YYYY-MM-DD，前端传入，API 层转换为 RFC3339
}
