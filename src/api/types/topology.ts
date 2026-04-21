/**
 * 拓扑视图相关 TypeScript 类型定义
 * 字段与后端 VO 一一对应
 */

/** 拓扑节点 */
export interface TopoNode {
    id: string
    name: string
    type: string
    category: string
    provider: string
    region: string
    status: string
    source_collector: string
    dag_depth?: number
    attributes?: Record<string, any>
    updated_at?: string
}

/** 拓扑连线 */
export interface TopoEdge {
    id: string
    source_id: string
    target_id: string
    relation: string
    direction: string
    source_collector: string
    status: string
    last_seen_at?: string
    request_count?: number
    latency_p99?: number
    updated_at?: string
}

/** 拓扑统计信息 */
export interface TopoStats {
    node_count: number
    edge_count: number
    domain_count: number
    broken_count: number
    max_depth: number
}

/** 拓扑图完整数据 */
export interface TopoGraph {
    nodes: TopoNode[]
    edges: TopoEdge[]
    stats: TopoStats
}

/** 拓扑查询参数 */
export interface TopologyQueryParams {
    mode?: 'business' | 'instance'
    domain?: string
    resource_id?: string
    provider?: string
    region?: string
    type?: string
    source_collector?: string
    hide_silent?: boolean
}

/** DNS 入口域名列表项 */
export interface DomainItem {
    domain: string
    provider: string
    node_id: string
}

/** 节点详情（含上下游关系） */
export interface NodeDetail extends TopoNode {
    upstream_nodes: TopoNode[]
    downstream_nodes: TopoNode[]
    upstream_edges: TopoEdge[]
    downstream_edges: TopoEdge[]
}

/** 声明式注册请求 */
export interface LinkDeclarationRequest {
    source: string
    collector?: string
    node: {
        id: string
        name: string
        type: string
        category: string
        provider?: string
        region?: string
        attributes?: Record<string, any>
    }
    links?: {
        target: string
        target_type?: string
        relation: string
        direction?: string
        attributes?: Record<string, any>
    }[]
}

/** 声明数据（查询返回） */
export interface Declaration {
    id: string
    source: string
    collector: string
    node: {
        id: string
        name: string
        type: string
        category: string
        provider: string
        region: string
    }
    links: {
        target: string
        relation: string
        direction: string
    }[]
    tenant_id: string
    created_at: string
    updated_at: string
}

// ===== 常量 =====

/** 节点类型 */
export const NODE_TYPES = {
    DNS_RECORD: 'dns_record',
    CDN: 'cdn',
    WAF: 'waf',
    SLB: 'slb',
    ALB: 'alb',
    ELB: 'elb',
    GATEWAY: 'gateway',
    K8S_INGRESS: 'k8s_ingress',
    K8S_SERVICE: 'k8s_service',
    K8S_DEPLOYMENT: 'k8s_deployment',
    K8S_STATEFULSET: 'k8s_statefulset',
    ECS: 'ecs',
    RDS: 'rds',
    REDIS: 'redis',
    OSS: 'oss',
    S3: 's3',
    EXTERNAL: 'external',
    UNKNOWN: 'unknown',
} as const

/** 资源分类 */
export const CATEGORIES = {
    COMPUTE: 'compute',
    NETWORK: 'network',
    DATABASE: 'database',
    STORAGE: 'storage',
    MIDDLEWARE: 'middleware',
    SECURITY: 'security',
    CONTAINER: 'container',
    GATEWAY: 'gateway',
    DNS: 'dns',
} as const

/** 云厂商 */
export const PROVIDERS = {
    ALIYUN: 'aliyun',
    AWS: 'aws',
    TENCENT: 'tencent',
    HUAWEI: 'huawei',
    VOLCANO: 'volcano',
    SELF_HOSTED: 'self-hosted',
} as const

/** 数据来源 */
export const SOURCE_COLLECTORS = {
    CLOUD_API: 'cloud_api',
    K8S_API: 'k8s_api',
    DECLARATION: 'declaration',
    LOG: 'log',
    MANUAL: 'manual',
    DNS_API: 'dns_api',
} as const

/** 边状态 */
export const EDGE_STATUS = {
    ACTIVE: 'active',
    PENDING: 'pending',
} as const
