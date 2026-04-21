/**
 * DNS 管理 API 接口
 */

import instance from './request/service';
import type {
    CreateDnsRecordReq,
    DnsDomain,
    DnsDomainQuery,
    DnsRecord,
    DnsRecordQuery,
    DnsStats,
    UpdateDnsRecordReq,
} from './types/dns';

const BASE = '/cam/dns'

/** 查询域名列表 */
export function getDnsDomainsApi(params: DnsDomainQuery) {
    return instance.get<{ items: DnsDomain[]; total: number }>({
        url: `${BASE}/domains`,
        params,
    })
}

/** 查询解析记录列表 */
export function getDnsRecordsApi(domain: string, params: DnsRecordQuery) {
    return instance.get<{ items: DnsRecord[]; total: number }>({
        url: `${BASE}/domains/${domain}/records`,
        params,
    })
}

/** 创建解析记录 */
export function createDnsRecordApi(domain: string, data: CreateDnsRecordReq) {
    return instance.post<DnsRecord>({
        url: `${BASE}/domains/${domain}/records`,
        data,
    })
}

/** 修改解析记录 */
export function updateDnsRecordApi(domain: string, recordId: string, data: UpdateDnsRecordReq) {
    return instance.put<DnsRecord>({
        url: `${BASE}/domains/${domain}/records/${recordId}`,
        data,
    })
}

/** 删除解析记录 */
export function deleteDnsRecordApi(domain: string, recordId: string) {
    return instance.delete<void>({
        url: `${BASE}/domains/${domain}/records/${recordId}`,
    })
}

/** 批量删除解析记录 */
export function batchDeleteDnsRecordsApi(domain: string, data: { record_ids: string[] }) {
    return instance.post<{ total: number; success_count: number; failed_count: number; failures: { record_id: string; error: string }[] }>({
        url: `${BASE}/domains/${domain}/records/batch-delete`,
        data,
    })
}

/** 查询 DNS 统计数据 */
export function getDnsStatsApi() {
    return instance.get<DnsStats>({
        url: `${BASE}/stats`,
    })
}

/** 跨域名搜索解析记录（用于拓扑入口域名选择） */
export function searchDnsRecordsApi(params: { keyword: string; limit?: number }) {
    return instance.get<{ items: DnsRecord[]; total: number }>({
        url: `${BASE}/records/search`,
        params,
    })
}
