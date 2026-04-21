import type { DomainItem, TopoGraph } from '@/api/types/topology'

/**
 * Mock 数据：贴合 business-topo-dag.html 原型图的 4 条链路
 * 后端可用后删除此文件，在 useTopologyData.ts 中去掉 fallback 即可
 */

export const MOCK_DOMAINS: DomainItem[] = [
    { domain: 'api.example.com', provider: 'aliyun', node_id: 'dns-api' },
    { domain: 'web.example.com', provider: 'aws', node_id: 'dns-web' },
    { domain: 'static.example.com', provider: 'aliyun', node_id: 'dns-static' },
    { domain: 'admin.example.com', provider: 'aliyun', node_id: 'dns-admin' },
]

export const MOCK_GRAPH: TopoGraph = {
    nodes: [
        // Chain A: api.example.com (full 8-depth, 阿里云)
        { id: 'dns-api', name: 'api.example.com', type: 'dns_record', category: 'dns', provider: 'aliyun', region: '', status: 'active', source_collector: 'dns_api', dag_depth: 0, attributes: { record_type: 'CNAME', record_value: 'cdn-ali.example.com' } },
        { id: 'cdn-ali', name: 'CDN-阿里云', type: 'cdn', category: 'network', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 1, attributes: { hit_rate: '87%' } },
        { id: 'waf-pro', name: 'WAF-Pro', type: 'waf', category: 'security', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 2, attributes: { blocked: '342/h' } },
        { id: 'slb-api', name: 'SLB-API', type: 'slb', category: 'network', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 3, attributes: { connections: 8200 } },
        { id: 'gw-biz', name: 'BizGateway-v2', type: 'gateway', category: 'gateway', provider: 'self-hosted', region: 'cn-hangzhou', status: 'active', source_collector: 'declaration', dag_depth: 4, attributes: { routes: 48, cluster: 'K8s-hz', namespace: 'prod' } },
        { id: 'svc-user', name: 'user-svc', type: 'k8s_service', category: 'container', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'k8s_api', dag_depth: 5, attributes: { endpoints: 3, cluster: 'K8s-hz', namespace: 'prod' } },
        { id: 'svc-order', name: 'order-svc', type: 'k8s_service', category: 'container', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'k8s_api', dag_depth: 5, attributes: { endpoints: 5, cluster: 'K8s-hz', namespace: 'prod' } },
        { id: 'dep-user', name: 'user-deploy', type: 'k8s_deployment', category: 'container', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'k8s_api', dag_depth: 6, attributes: { replicas: 3, ready_replicas: 3, cluster: 'K8s-hz', namespace: 'prod' } },
        { id: 'dep-order', name: 'order-deploy', type: 'k8s_deployment', category: 'container', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'k8s_api', dag_depth: 6, attributes: { replicas: 5, ready_replicas: 5, cluster: 'K8s-hz', namespace: 'prod' } },
        { id: 'rds-mysql', name: 'RDS-MySQL', type: 'rds', category: 'database', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 7, attributes: { connections: 120, iops: 3400 } },
        { id: 'redis-cache', name: 'Redis-缓存', type: 'redis', category: 'database', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 7, attributes: { memory_usage: '62%' } },
        // Chain B: web.example.com (no CDN, AWS)
        { id: 'dns-web', name: 'web.example.com', type: 'dns_record', category: 'dns', provider: 'aws', region: '', status: 'active', source_collector: 'dns_api', dag_depth: 0, attributes: { record_type: 'CNAME', record_value: 'waf-xxx.awswaf.com' } },
        { id: 'waf-aws', name: 'AWS WAF', type: 'waf', category: 'security', provider: 'aws', region: 'us-east-1', status: 'active', source_collector: 'cloud_api', dag_depth: 1 },
        { id: 'alb-web', name: 'ALB-Web', type: 'alb', category: 'network', provider: 'aws', region: 'us-east-1', status: 'active', source_collector: 'cloud_api', dag_depth: 2 },
        { id: 'ingress-nginx', name: 'Nginx Ingress', type: 'k8s_ingress', category: 'gateway', provider: 'aws', region: 'us-east-1', status: 'active', source_collector: 'k8s_api', dag_depth: 3, attributes: { cluster: 'EKS-us', namespace: 'prod' } },
        { id: 'svc-frontend', name: 'web-frontend', type: 'k8s_service', category: 'container', provider: 'aws', region: 'us-east-1', status: 'active', source_collector: 'k8s_api', dag_depth: 4, attributes: { endpoints: 4, cluster: 'EKS-us', namespace: 'prod' } },
        { id: 'dep-frontend', name: 'frontend-deploy', type: 'k8s_deployment', category: 'container', provider: 'aws', region: 'us-east-1', status: 'active', source_collector: 'k8s_api', dag_depth: 5, attributes: { replicas: 4, ready_replicas: 4, cluster: 'EKS-us', namespace: 'prod' } },

        // Chain C: static.example.com → CDN → OSS (short, 3 nodes)
        { id: 'dns-static', name: 'static.example.com', type: 'dns_record', category: 'dns', provider: 'aliyun', region: '', status: 'active', source_collector: 'dns_api', dag_depth: 0, attributes: { record_type: 'CNAME', record_value: 'static.cdn.aliyuncs.com' } },
        { id: 'cdn-static', name: 'CDN-静态', type: 'cdn', category: 'network', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 1, attributes: { hit_rate: '96%' } },
        { id: 'oss-static', name: 'OSS-static-prod', type: 'oss', category: 'storage', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 2, attributes: { capacity: '2.3TB' } },

        // Chain D: admin.example.com → SLB → ECS → ??? (broken link)
        { id: 'dns-admin', name: 'admin.example.com', type: 'dns_record', category: 'dns', provider: 'aliyun', region: '', status: 'active', source_collector: 'dns_api', dag_depth: 0, attributes: { record_type: 'A', record_value: '47.96.xx.xx' } },
        { id: 'slb-admin', name: 'SLB-Admin', type: 'slb', category: 'network', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 1 },
        { id: 'ecs-admin', name: 'ECS-Admin-01', type: 'ecs', category: 'compute', provider: 'aliyun', region: 'cn-hangzhou', status: 'active', source_collector: 'cloud_api', dag_depth: 2, attributes: { ip: '10.0.1.5' } },
        { id: 'unknown-1', name: '未知下游', type: 'unknown', category: 'network', provider: '', region: '', status: 'unknown', source_collector: '', dag_depth: 3, attributes: { is_broken: true } },
    ],
    edges: [
        // Chain A edges
        { id: 'e-a1', source_id: 'dns-api', target_id: 'cdn-ali', relation: 'resolve', direction: 'outbound', source_collector: 'dns_api', status: 'active' },
        { id: 'e-a2', source_id: 'cdn-ali', target_id: 'waf-pro', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },
        { id: 'e-a3', source_id: 'waf-pro', target_id: 'slb-api', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },
        { id: 'e-a4', source_id: 'slb-api', target_id: 'gw-biz', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },
        { id: 'e-a5', source_id: 'gw-biz', target_id: 'svc-user', relation: 'route', direction: 'outbound', source_collector: 'declaration', status: 'active' },
        { id: 'e-a6', source_id: 'gw-biz', target_id: 'svc-order', relation: 'route', direction: 'outbound', source_collector: 'declaration', status: 'active' },
        { id: 'e-a7', source_id: 'svc-user', target_id: 'dep-user', relation: 'route', direction: 'outbound', source_collector: 'k8s_api', status: 'active' },
        { id: 'e-a8', source_id: 'svc-order', target_id: 'dep-order', relation: 'route', direction: 'outbound', source_collector: 'k8s_api', status: 'active' },
        { id: 'e-a9', source_id: 'dep-user', target_id: 'rds-mysql', relation: 'depends_on', direction: 'outbound', source_collector: 'log', status: 'active', last_seen_at: new Date().toISOString(), request_count: 12400 },
        { id: 'e-a10', source_id: 'dep-user', target_id: 'redis-cache', relation: 'depends_on', direction: 'outbound', source_collector: 'log', status: 'active', last_seen_at: new Date().toISOString(), request_count: 8900 },
        { id: 'e-a11', source_id: 'dep-order', target_id: 'redis-cache', relation: 'depends_on', direction: 'outbound', source_collector: 'log', status: 'active', last_seen_at: new Date().toISOString(), request_count: 5600 },
        // Chain B edges
        { id: 'e-b1', source_id: 'dns-web', target_id: 'waf-aws', relation: 'resolve', direction: 'outbound', source_collector: 'dns_api', status: 'active' },
        { id: 'e-b2', source_id: 'waf-aws', target_id: 'alb-web', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },
        { id: 'e-b3', source_id: 'alb-web', target_id: 'ingress-nginx', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },
        { id: 'e-b4', source_id: 'ingress-nginx', target_id: 'svc-frontend', relation: 'route', direction: 'outbound', source_collector: 'k8s_api', status: 'active' },
        { id: 'e-b5', source_id: 'svc-frontend', target_id: 'dep-frontend', relation: 'route', direction: 'outbound', source_collector: 'k8s_api', status: 'active' },
        // Chain B → shared Redis
        { id: 'e-b6', source_id: 'dep-frontend', target_id: 'redis-cache', relation: 'depends_on', direction: 'outbound', source_collector: 'log', status: 'active', last_seen_at: new Date().toISOString(), request_count: 3200 },

        // Chain C edges
        { id: 'e-c1', source_id: 'dns-static', target_id: 'cdn-static', relation: 'resolve', direction: 'outbound', source_collector: 'dns_api', status: 'active' },
        { id: 'e-c2', source_id: 'cdn-static', target_id: 'oss-static', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },

        // Chain D edges
        { id: 'e-d1', source_id: 'dns-admin', target_id: 'slb-admin', relation: 'resolve', direction: 'outbound', source_collector: 'dns_api', status: 'active' },
        { id: 'e-d2', source_id: 'slb-admin', target_id: 'ecs-admin', relation: 'route', direction: 'outbound', source_collector: 'cloud_api', status: 'active' },
        // Broken link
        { id: 'e-d3', source_id: 'ecs-admin', target_id: 'unknown-1', relation: 'route', direction: 'outbound', source_collector: '', status: 'pending' },
    ],
    stats: {
        node_count: 22,
        edge_count: 20,
        domain_count: 4,
        broken_count: 1,
        max_depth: 7,
    },
}
