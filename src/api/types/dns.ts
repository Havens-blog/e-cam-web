/**
 * DNS 管理相关 TypeScript 类型定义
 * 字段与后端 VO 一一对应
 */

/** DNS 域名 */
export interface DnsDomain {
    domain_name: string
    provider: string
    account_id: number
    account_name: string
    record_count: number
    status: string
    domain_id: string
}

/** DNS 解析记录 */
export interface DnsRecord {
    record_id: string
    domain: string
    rr: string
    type: string
    value: string
    ttl: number
    priority: number
    /**
     * 权重（负载均衡解析，0-100）。
     * 后端以"无值即缺省/`null`"表达"该云或该记录无权重概念"（如阿里云仅负载均衡记录有权重、
     * 且该云权重只读；华为/火山不支持），前端统一展示为 `-`，不得当作 0 展示。
     */
    weight?: number | null
    line: string
    status: string
    provider: string
    account_id: number
    linked_resource?: LinkedResource
}

/** 关联资源 */
export interface LinkedResource {
    type: string
    name: string
    id: string
}

/** DNS 统计 */
export interface DnsStats {
    total_domains: number
    total_records: number
    provider_distribution: Record<string, number>
    record_type_distribution: Record<string, number>
}

/** 域名查询参数 */
export interface DnsDomainQuery {
    keyword?: string
    provider?: string
    account_id?: number
    offset?: number
    limit?: number
}

/** 解析记录查询参数 */
export interface DnsRecordQuery {
    keyword?: string
    record_type?: string
    offset?: number
    limit?: number
}

/** 创建解析记录请求 */
export interface CreateDnsRecordReq {
    account_id: number
    rr: string
    type: string
    value: string
    ttl?: number
    priority?: number
    line?: string
    /** 权重（0-100，可选）；仅对"可写"云可提交，否则后端 400060 拒绝 */
    weight?: number
}

/** 修改解析记录请求 */
export interface UpdateDnsRecordReq {
    account_id: number
    rr?: string
    type?: string
    value?: string
    ttl?: number
    priority?: number
    line?: string
    /** 权重（0-100，可选，缺省=不修改）；仅对"可写"云可提交，否则后端 400060 拒绝 */
    weight?: number
}
