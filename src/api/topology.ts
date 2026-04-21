/**
 * 拓扑视图 API 接口
 */

import instance from './request/service'
import type {
    Declaration,
    DomainItem,
    LinkDeclarationRequest,
    NodeDetail,
    TopoGraph,
    TopologyQueryParams,
    TopoStats,
} from './types/topology'

const BASE = '/cam/topology'

/** 查询拓扑图（业务链路 / 实例归属） */
export function getTopologyApi(params: TopologyQueryParams) {
    return instance.get<TopoGraph>({
        url: `${BASE}`,
        params,
    })
}

/** 获取所有 DNS 入口域名列表 */
export function getTopologyDomainsApi() {
    return instance.get<{ domains: DomainItem[] }>({
        url: `${BASE}/domains`,
    })
}

/** 获取单个节点详情（含上下游关系） */
export function getTopologyNodeApi(id: string) {
    return instance.get<NodeDetail>({
        url: `${BASE}/node/${id}`,
    })
}

/** 获取拓扑统计信息 */
export function getTopologyStatsApi() {
    return instance.get<TopoStats>({
        url: `${BASE}/stats`,
    })
}

/** 声明式注册拓扑数据 */
export function postDeclarationApi(data: LinkDeclarationRequest) {
    return instance.post<void>({
        url: `${BASE}/declarations`,
        data,
    })
}

/** 查询已注册的声明数据 */
export function getDeclarationsApi() {
    return instance.get<Declaration[]>({
        url: `${BASE}/declarations`,
    })
}

/** 按来源删除声明数据 */
export function deleteDeclarationApi(source: string) {
    return instance.delete<{ deleted: number }>({
        url: `${BASE}/declarations/${source}`,
    })
}
