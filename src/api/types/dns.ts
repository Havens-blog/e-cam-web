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
}
