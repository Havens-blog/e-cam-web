import type { TopoEdge, TopoGraph, TopoNode } from '@/api/types/topology'
import { SOURCE_COLLECTORS } from '@/api/types/topology'
import { useTopologyStore } from '@/stores/topology'
import { aggregateNodes, computeDagPositions } from './useDagLayout'
const TC: Record<string, string> = { dns_record: '#a78bfa', cdn: '#c084fc', waf: '#f87171', slb: '#38bdf8', alb: '#38bdf8', elb: '#38bdf8', gateway: '#fbbf24', k8s_ingress: '#fbbf24', k8s_service: '#818cf8', k8s_deployment: '#34d399', k8s_statefulset: '#34d399', ecs: '#818cf8', rds: '#f472b6', redis: '#f472b6', oss: '#f472b6', s3: '#f472b6', external: '#64748b', unknown: '#64748b' }
const CC: Record<string, string> = { dns: '#a78bfa', network: '#38bdf8', security: '#f87171', gateway: '#fbbf24', container: '#818cf8', compute: '#818cf8', database: '#f472b6', storage: '#f472b6', middleware: '#fb923c' }
const PC: Record<string, string> = { aliyun: '#ff6a00', aws: '#ff9900', tencent: '#00a4ff', huawei: '#cf0a2c', volcano: '#3370ff', 'self-hosted': '#6366f1' }
const TS: Record<string, string> = { dns_record: 'circle', cdn: 'diamond', waf: 'triangle', slb: 'roundRect', alb: 'roundRect', elb: 'roundRect', nlb: 'roundRect', eni: 'circle', gateway: 'roundRect', k8s_ingress: 'roundRect', k8s_service: 'circle', k8s_deployment: 'rect', k8s_statefulset: 'rect', ecs: 'rect', rds: 'circle', redis: 'circle', oss: 'diamond', s3: 'diamond', external: 'circle', unknown: 'circle' }
const TN: Record<string, string> = { dns_record: 'DNS', cdn: 'CDN', waf: 'WAF', slb: 'SLB', alb: 'ALB', nlb: 'NLB', elb: 'ELB', eni: 'ENI', gateway: '网关', k8s_ingress: 'Ingress', k8s_service: 'Service', k8s_deployment: 'Deployment', k8s_statefulset: 'StatefulSet', ecs: 'ECS', rds: 'RDS', redis: 'Redis', mongodb: 'MongoDB', oss: 'OSS', s3: 'S3', nas: 'NAS', eip: 'EIP', vpc: 'VPC', external: '外部', unknown: '未知' }
const PN: Record<string, string> = { aliyun: '阿里云', aws: 'AWS', tencent: '腾讯云', huawei: '华为云', volcano: '火山引擎', volcengine: '火山引擎' }
export function getNodeColor(n: TopoNode): string { return TC[n.type] || CC[n.category] || '#64748b' }
export function getProviderColor(p: string): string { return PC[p] || '#6366f1' }

/** 生成节点显示标签：DNS 显示域名，APM 服务显示服务名，CMDB 实例显示"类型 · 云厂商" */
function nodeLabel(n: TopoNode): string {
    // DNS 入口节点：显示域名
    if (n.type === 'dns_record') return n.name
    // APM 服务节点：显示服务名（去掉 svc- 前缀）
    if (n.source_collector === 'apm' || n.id?.startsWith('svc-')) {
        return n.name || n.id?.replace(/^svc-/, '') || '未知服务'
    }
    // 有云厂商信息的 CMDB 实例：显示 "类型 · 云厂商"
    const typeName = TN[n.type] || n.type?.toUpperCase() || '未知'
    if (n.provider) {
        const providerName = PN[n.provider] || n.provider
        return `${typeName} · ${providerName}`
    }
    // 外部节点：尝试从 CNAME 地址中提取简短标识
    if (n.type === 'external' || n.type === 'waf' || n.type === 'cdn' || n.type === 'slb') {
        if (!n.provider && n.name?.includes('.')) {
            // 从 CNAME 地址识别云厂商
            const name = n.name.toLowerCase()
            if (name.includes('yundunwaf') || name.includes('alicdn') || name.includes('kunlun') || name.includes('aliyuncsslb')) return `${typeName} · 阿里云`
            if (name.includes('vedcdnlb') || name.includes('volccdn') || name.includes('volcengine')) return `${typeName} · 火山引擎`
            if (name.includes('cdnhw')) return `${typeName} · 华为云`
            if (name.includes('dnsv1') || name.includes('tdns')) return `${typeName} · 腾讯云`
            if (name.includes('cloudfront') || name.includes('amazonaws')) return `${typeName} · AWS`
            return `${typeName} · 外部`
        }
    }
    // 其他：显示名称
    return n.name || typeName
}
function sz(n: TopoNode): number { if (n.type === 'dns_record') return 56; if (n.attributes?.is_aggregated) return 60; if (['slb', 'alb', 'elb', 'gateway', 'k8s_ingress'].includes(n.type)) return 52; if (['cdn', 'waf'].includes(n.type)) return 48; return 44 }

/** APM 边样式：根据 qps 和 error_rate 计算线条粗细和颜色 */
export function apmEdgeStyle(e: TopoEdge): Record<string, unknown> {
    const attrs = e.attributes || {}
    const qps = Number(attrs.qps) || 0
    const errorRate = Number(attrs.error_rate) || 0

    // 线条粗细：QPS 映射到 [1, 5] 范围，log10 映射
    const width = Math.min(5, Math.max(1, 1 + Math.log10(Math.max(qps, 1)) * 1.5))

    // 线条颜色：按错误率阈值
    let color: string
    if (errorRate > 5) {
        color = '#ef4444' // 红色：error_rate > 5%
    } else if (errorRate > 1) {
        color = '#f97316' // 橙色：1% < error_rate <= 5%
    } else {
        color = '#3b82f6' // 蓝色：error_rate <= 1%
    }

    return { color, width, type: 'solid', opacity: 0.7 }
}

function es(e: TopoEdge): Record<string, unknown> {
    if (e.source_collector === SOURCE_COLLECTORS.APM) return apmEdgeStyle(e)
    if (e.status === 'pending') return { color: '#ef4444', width: 1.5, type: [4, 4], opacity: 0.5 }
    if (e.last_seen_at && new Date(e.last_seen_at).getTime() < Date.now() - 86400000) return { color: '#64748b', width: 1, type: 'solid', opacity: 0.2 }
    return { color: '#10b981', width: 1.8, type: [8, 4], opacity: 0.5 }
}

/** APM 边 tooltip 内容 */
export function apmEdgeTooltip(e: TopoEdge, activeDomain?: string): string {
    const attrs = e.attributes || {}

    // 域名筛选激活时优先显示域名维度指标
    let metrics = { qps: attrs.qps, latency_p99: attrs.latency_p99, error_rate: attrs.error_rate }
    if (activeDomain && attrs.domain_metrics) {
        const dm = attrs.domain_metrics[activeDomain]
        if (dm) metrics = dm
    }

    const lines = [
        '<strong>APM 调用</strong>',
        `QPS: ${Number(metrics.qps || 0).toFixed(1)}`,
        `P99 延迟: ${Number(metrics.latency_p99 || 0).toFixed(1)} ms`,
        `错误率: ${Number(metrics.error_rate || 0).toFixed(2)}%`,
    ]
    if (attrs.last_seen_at) {
        lines.push(`更新时间: ${new Date(attrs.last_seen_at).toLocaleString()}`)
    }
    if (attrs.domains?.length > 0) {
        lines.push(`关联域名: ${attrs.domains.join(', ')}`)
    }
    return lines.join('<br/>')
}
function xt(n: TopoNode): string { const p: string[] = [], a = n.attributes || {}; if (a.record_type) p.push(`${a.record_type} → ${a.record_value}`); if (a.replicas !== undefined) p.push(`Pods: ${a.ready_replicas ?? '?'}/${a.replicas}`); if (a.is_aggregated) p.push(`包含 ${a.count} 个节点`); p.push(`来源: ${n.source_collector}`); return p.join(' | ') }

/**
 * 计算每条边的 curveness：
 * - 如果源节点只有 1 条出边 → curveness=0（直线）
 * - 如果源节点有多条出边 → 按索引分配 curveness（曲线，避免重叠）
 */
function computeEdgeCurveness(edges: TopoEdge[]): Map<string, number> {
    const result = new Map<string, number>()
    // 按 source_id 分组
    const groups = new Map<string, TopoEdge[]>()
    for (const e of edges) {
        const g = groups.get(e.source_id) ?? []
        g.push(e)
        groups.set(e.source_id, g)
    }
    for (const [, group] of groups) {
        if (group.length === 1) {
            const first = group[0]
            if (first) result.set(first.id, 0)
        } else {
            const step = 0.3 / Math.max(group.length - 1, 1)
            const start = -0.15
            for (let i = 0; i < group.length; i++) {
                const item = group[i]
                if (item) result.set(item.id, start + i * step)
            }
        }
    }
    return result
}

export function buildChartOption(graph: TopoGraph, layout: 'dag' | 'force'): Record<string, unknown> {
    const { nodes, edges: allEdges } = aggregateNodes(graph.nodes || [], graph.edges || [])
    const store = useTopologyStore()

    // 检测是否为纯 APM 拓扑（无域名筛选时）
    const isApmOnly = !store.selectedDomain && nodes.every((n: TopoNode) => n.source_collector === 'apm' || n.id?.startsWith('svc-'))
    // APM 纯拓扑强制使用力导向布局（网状结构不适合 DAG）
    const effectiveLayout = isApmOnly ? 'force' : layout

    // Task 8.6: Filter APM edges based on store state
    const edges = allEdges.filter((e: TopoEdge) => {
        if (e.source_collector !== SOURCE_COLLECTORS.APM) return true
        // Hide all APM edges if showApmEdges is off
        if (!store.showApmEdges) return false
        // When domain filter is active, handle internal calls (empty domains)
        if (store.selectedDomain) {
            const domains = e.attributes?.domains as string[] | undefined
            const isInternalCall = !domains || domains.length === 0
            if (isInternalCall && !store.showInternalCalls) return false
        }
        return true
    })

    const pos = effectiveLayout === 'dag' ? computeDagPositions(nodes, edges) : undefined
    const curveness = computeEdgeCurveness(edges)
    const activeDomain = store.selectedDomain || undefined

    // 力导向参数：APM 拓扑节点多，需要更大排斥力和边长
    const forceParams = isApmOnly
        ? { repulsion: 800, edgeLength: [150, 300], gravity: 0.03, friction: 0.6 }
        : { repulsion: 300, edgeLength: [100, 200], gravity: 0.05 }

    return {
        backgroundColor: 'transparent',
        animation: false,
        tooltip: {
            trigger: 'item',
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            textStyle: { color: 'var(--text-primary)', fontSize: 12 },
            formatter: (params: any) => {
                // Edge tooltip
                if (params.dataType === 'edge' && params.data?.edgeData) {
                    const edgeData = params.data.edgeData as TopoEdge
                    if (edgeData.source_collector === SOURCE_COLLECTORS.APM) {
                        return apmEdgeTooltip(edgeData, activeDomain)
                    }
                }
                // Node tooltip (default)
                if (params.dataType === 'node' && params.data?.extra) {
                    return `<strong>${params.data.name}</strong><br/>${params.data.extra}`
                }
                return undefined
            },
        },
        series: [{
            type: 'graph', layout: effectiveLayout === 'force' ? 'force' : 'none',
            animation: isApmOnly, animationDurationUpdate: 300, data: nodes.map((n: TopoNode) => ({
                id: n.id, name: n.name, x: pos?.get(n.id)?.x, y: pos?.get(n.id)?.y,
                symbol: TS[n.type] || 'circle', symbolSize: sz(n),
                itemStyle: { color: getNodeColor(n), borderColor: getNodeColor(n), borderWidth: 2, shadowBlur: 8, shadowColor: `${getNodeColor(n)}33` },
                label: { show: true, formatter: nodeLabel(n), fontSize: isApmOnly ? 11 : 10, color: '#94a3b8', position: 'bottom', distance: 8 },
                draggable: true,
                nodeType: n.type, provider: n.provider, extra: xt(n), attributes: n.attributes,
            })),
            edges: edges.map((e: TopoEdge) => ({
                source: e.source_id, target: e.target_id,
                lineStyle: { ...es(e), curveness: curveness.get(e.id) ?? 0 },
                symbol: ['none', 'arrow'], symbolSize: [0, 8], relation: e.relation,
                edgeData: e,
            })),
            force: effectiveLayout === 'force' ? forceParams : undefined,
            roam: 'scale', draggable: true,
            emphasis: { focus: 'adjacency', lineStyle: { width: 3, opacity: 0.8 } },
        }],
    }
}
