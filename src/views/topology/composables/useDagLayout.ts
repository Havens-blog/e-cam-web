import type { TopoEdge, TopoNode } from '@/api/types/topology'

const COLUMN_GAP = 200
const ROW_GAP = 100
const PADDING_LEFT = 80
const PADDING_TOP = 60

export interface NodePosition {
    x: number
    y: number
}

export function computeDagPositions(
    nodes: TopoNode[],
    _edges: TopoEdge[]
): Map<string, NodePosition> {
    const positions = new Map<string, NodePosition>()
    if (nodes.length === 0) return positions

    const depthGroups = new Map<number, TopoNode[]>()
    for (const node of nodes) {
        const depth = node.dag_depth ?? 0
        const group = depthGroups.get(depth) ?? []
        group.push(node)
        depthGroups.set(depth, group)
    }

    for (const [depth, group] of depthGroups) {
        const x = PADDING_LEFT + depth * COLUMN_GAP
        const totalHeight = (group.length - 1) * ROW_GAP
        const startY = PADDING_TOP + (400 - totalHeight / 2)
        for (let i = 0; i < group.length; i++) {
            const node = group[i]
            if (node) {
                positions.set(node.id, { x, y: startY + i * ROW_GAP })
            }
        }
    }
    return positions
}

export function getDepthColumnTitle(nodes: TopoNode[], depth: number): string | null {
    const group = nodes.filter(n => (n.dag_depth ?? 0) === depth)
    if (group.length === 0) return null
    const types = new Set(group.map(n => n.type))
    if (types.size === 1) return typeDisplayName(group[0]?.type ?? '')
    return null
}

export function typeDisplayName(type: string): string {
    const map: Record<string, string> = {
        dns_record: 'DNS', cdn: 'CDN', waf: 'WAF',
        slb: 'SLB', alb: 'ALB', elb: 'ELB',
        gateway: '网关', k8s_ingress: 'Ingress',
        k8s_service: 'Service', k8s_deployment: 'Deployment',
        k8s_statefulset: 'StatefulSet', ecs: 'ECS',
        rds: 'RDS', redis: 'Redis', oss: 'OSS', s3: 'S3',
        external: '外部服务', unknown: '未知',
    }
    return map[type] || type
}

export function getMaxDepth(nodes: TopoNode[]): number {
    let max = 0
    for (const n of nodes) {
        const d = n.dag_depth ?? 0
        if (d > max) max = d
    }
    return max
}

export function aggregateNodes(
    nodes: TopoNode[],
    edges: TopoEdge[],
    threshold = 10
): { nodes: TopoNode[]; edges: TopoEdge[]; aggregatedGroups: Map<string, TopoNode[]> } {
    const aggregatedGroups = new Map<string, TopoNode[]>()
    const resultNodes: TopoNode[] = []
    const removedIds = new Set<string>()

    const groups = new Map<string, TopoNode[]>()
    for (const n of nodes) {
        const key = `${n.dag_depth ?? 0}-${n.type}`
        const g = groups.get(key) ?? []
        g.push(n)
        groups.set(key, g)
    }

    for (const [key, group] of groups) {
        if (group.length > threshold) {
            const firstNode = group[0]!
            const aggNode: TopoNode = {
                id: `agg-${key}`,
                name: `${typeDisplayName(firstNode.type)} ×${group.length}`,
                type: firstNode.type,
                category: firstNode.category,
                provider: '', region: '', status: 'active', source_collector: '',
                dag_depth: firstNode.dag_depth,
                attributes: { is_aggregated: true, count: group.length },
            }
            resultNodes.push(aggNode)
            aggregatedGroups.set(aggNode.id, group)
            for (const n of group) removedIds.add(n.id)
        } else {
            resultNodes.push(...group)
        }
    }

    const resultEdges: TopoEdge[] = []
    const seenEdgeKeys = new Set<string>()
    for (const e of edges) {
        const newEdge = { ...e }
        if (removedIds.has(e.source_id)) {
            const sn = nodes.find(n => n.id === e.source_id)
            if (sn) newEdge.source_id = `agg-${sn.dag_depth ?? 0}-${sn.type}`
        }
        if (removedIds.has(e.target_id)) {
            const tn = nodes.find(n => n.id === e.target_id)
            if (tn) newEdge.target_id = `agg-${tn.dag_depth ?? 0}-${tn.type}`
        }
        const ek = `${newEdge.source_id}-${newEdge.target_id}`
        if (!seenEdgeKeys.has(ek)) {
            seenEdgeKeys.add(ek)
            resultEdges.push(newEdge)
        }
    }

    return { nodes: resultNodes, edges: resultEdges, aggregatedGroups }
}
