<template>
  <div class="detail-panel">
    <!-- Header -->
    <div class="dp-header">
      <div class="dp-header-info">
        <span class="dp-icon" :style="{ background: iconColor }">
          {{ typeIcon }}
        </span>
        <div>
          <div class="dp-title" :class="{ 'dp-title-link': isCmdbInstance }" @click="isCmdbInstance && goAssetDetail()">
            {{ displayName }}
            <el-icon v-if="isCmdbInstance" :size="12" style="margin-left: 4px; vertical-align: middle;"><Link /></el-icon>
          </div>
          <div class="dp-subtitle">{{ displayType }}</div>
        </div>
      </div>
      <el-button link @click="emit('close')"><el-icon :size="18"><Close /></el-icon></el-button>
    </div>

    <div v-if="loading" v-loading="true" class="dp-loading"></div>
    <div v-else-if="detail" class="dp-body">
      <!-- 状态卡片 -->
      <div class="dp-status-card">
        <div class="dp-status-row">
          <el-tag :type="detail.status === 'active' ? 'success' : detail.status === 'error' ? 'danger' : 'info'" size="small" effect="dark" round>
            {{ statusText }}
          </el-tag>
          <span v-if="providerLabel" class="dp-provider-badge" :style="{ color: providerColor, borderColor: providerColor + '40', background: providerColor + '10' }">
            {{ providerLabel }}
          </span>
        </div>
        <div v-if="detail.source_collector" class="dp-meta">
          <span class="dp-meta-label">数据来源</span>
          <span class="dp-meta-value">{{ detail.source_collector }}</span>
        </div>
      </div>

      <!-- 关键属性 -->
      <div v-if="keyAttrs.length > 0" class="dp-section">
        <div class="dp-section-title">关键信息</div>
        <div v-for="attr in keyAttrs" :key="attr.key" class="dp-attr-row">
          <span class="dp-attr-label">{{ attr.label }}</span>
          <span class="dp-attr-value" :title="String(attr.value)">{{ attr.value }}</span>
        </div>
      </div>

      <!-- 聚合节点详情 -->
      <div v-if="detail.attributes?.is_aggregated" class="dp-section">
        <div class="dp-section-title">包含实例 ({{ detail.attributes.count }})</div>
        <div v-for="name in (detail.attributes.sample_names || [])" :key="name" class="dp-attr-row">
          <span class="dp-attr-value" style="text-align: left; max-width: 100%">{{ name }}</span>
        </div>
        <div v-if="(detail.attributes.count || 0) > 3" class="dp-meta" style="border: none; padding-top: 4px">
          <span class="dp-meta-label">... 等 {{ detail.attributes.count }} 个实例</span>
        </div>
      </div>

      <!-- 上游节点 -->
      <div v-if="upstreamNodes.length > 0" class="dp-section">
        <div class="dp-section-title">
          <el-icon><Top /></el-icon> 上游 ({{ upstreamNodes.length }})
        </div>
        <div v-for="n in upstreamNodes" :key="n.id" class="dp-rel-card" @click="emit('close'); store.selectNode(n.id)">
          <span class="dp-rel-dot" :style="{ background: getNodeColor(n) }"></span>
          <div class="dp-rel-info">
            <span class="dp-rel-name">{{ n.name }}</span>
            <span class="dp-rel-type">{{ typeLabel(n.type) }}{{ n.provider ? ' · ' + providerName(n.provider) : '' }}</span>
          </div>
          <el-icon class="dp-rel-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- 下游节点 -->
      <div v-if="downstreamNodes.length > 0" class="dp-section">
        <div class="dp-section-title">
          <el-icon><Bottom /></el-icon> 下游 ({{ downstreamNodes.length }})
        </div>
        <div v-for="item in downstreamItems" :key="item.node.id" class="dp-rel-card" @click="emit('close'); store.selectNode(item.node.id)">
          <span class="dp-rel-dot" :style="{ background: getNodeColor(item.node) }"></span>
          <div class="dp-rel-info">
            <span class="dp-rel-name">{{ item.node.name }}</span>
            <span class="dp-rel-type">{{ typeLabel(item.node.type) }}{{ item.node.provider ? ' · ' + providerName(item.node.provider) : '' }}</span>
            <!-- APM 边指标 -->
            <div v-if="item.edge && item.edge.source_collector === 'apm' && item.edge.attributes" class="dp-apm-metrics">
              <span class="dp-metric">QPS: {{ formatNum(item.edge.attributes.qps) }}</span>
              <span class="dp-metric">P99: {{ formatNum(item.edge.attributes.latency_p99) }}ms</span>
              <span class="dp-metric" :class="{ 'dp-metric-error': Number(item.edge.attributes.error_rate || 0) > 5 }">
                错误率: {{ formatNum(item.edge.attributes.error_rate) }}%
              </span>
            </div>
            <!-- APM 边关联域名 -->
            <div v-if="item.edge && item.edge.attributes?.domains?.length > 0" class="dp-domains">
              <el-tag v-for="d in (item.edge.attributes?.domains || []).filter((i: any) => i != null)" :key="d" size="small" type="info">{{ d }}</el-tag>
            </div>
          </div>
          <el-icon class="dp-rel-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- 全部属性（折叠） -->
      <div v-if="detail.attributes && Object.keys(detail.attributes).length > 0" class="dp-section">
        <el-collapse>
          <el-collapse-item :title="`全部属性 (${Object.keys(detail.attributes).length})`">
            <div v-for="(val, key) in detail.attributes" :key="String(key)" class="dp-attr-row">
              <span class="dp-attr-label">{{ String(key) }}</span>
              <span class="dp-attr-value" :title="String(val ?? '')">{{ formatAttrValue(val) }}</span>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <div v-else class="dp-empty">
      <el-empty description="暂无节点信息" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NodeDetail, TopoNode } from '@/api/types/topology'
import { useTopologyStore } from '@/stores/topology'
import { ArrowRight, Bottom, Close, Link, Top } from '@element-plus/icons-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getNodeColor, getProviderColor } from '../composables/useTopologyChart'

const TN: Record<string, string> = { dns_record: 'DNS', cdn: 'CDN', waf: 'WAF', slb: 'SLB', alb: 'ALB', nlb: 'NLB', elb: 'ELB', eni: 'ENI', gateway: '网关', k8s_ingress: 'Ingress', k8s_service: 'Service', k8s_deployment: 'Deployment', ecs: 'ECS', rds: 'RDS', redis: 'Redis', mongodb: 'MongoDB', oss: 'OSS', external: '外部', unknown: '未知' }
const PNMap: Record<string, string> = { aliyun: '阿里云', aws: 'AWS', tencent: '腾讯云', huawei: '华为云', volcano: '火山引擎', volcengine: '火山引擎' }
const TI: Record<string, string> = { dns_record: '🌐', cdn: '⚡', waf: '🛡', slb: '⚖', alb: '⚖', nlb: '⚖', eni: '🔌', ecs: '🖥', rds: '🗄', redis: '📦', oss: '💾', external: '🔗', unknown: '❓' }
const ST: Record<string, string> = { active: '运行中', error: '异常', inactive: '已停止', pending: '待处理' }

// CDN/WAF 关键属性映射
const KEY_ATTRS: Record<string, { key: string; label: string }[]> = {
  cdn: [
    { key: 'domain_name', label: '加速域名' },
    { key: 'cname', label: 'CNAME' },
    { key: 'business_type', label: '业务类型' },
    { key: 'service_area', label: '服务区域' },
    { key: 'origin_host', label: '回源地址' },
    { key: 'https_enabled', label: 'HTTPS' },
  ],
  waf: [
    { key: 'domain_name', label: '防护域名' },
    { key: 'cname', label: 'CNAME' },
    { key: 'source_ips', label: '回源地址' },
    { key: 'edition', label: '版本' },
    { key: 'qps', label: 'QPS' },
    { key: 'waf_enabled', label: 'WAF 防护' },
  ],
  slb: [
    { key: 'address', label: 'VIP' },
    { key: 'address_type', label: '地址类型' },
    { key: 'load_balancer_type', label: 'LB 类型' },
    { key: 'bandwidth', label: '带宽' },
    { key: 'backend_server_count', label: '后端数量' },
  ],
  alb: [
    { key: 'full_address', label: '完整地址' },
    { key: 'address', label: 'VIP' },
    { key: 'address_type', label: '地址类型' },
    { key: 'load_balancer_type', label: 'LB 类型' },
    { key: 'bandwidth', label: '带宽' },
    { key: 'backend_server_count', label: '后端数量' },
  ],
  nlb: [
    { key: 'full_address', label: '完整地址' },
    { key: 'address', label: 'VIP' },
    { key: 'address_type', label: '地址类型' },
  ],
  dns_record: [
    { key: 'record_type', label: '记录类型' },
    { key: 'record_value', label: '记录值' },
    { key: 'rr', label: '主机记录' },
  ],
  external: [
    { key: 'full_address', label: '完整地址' },
  ],
}

const props = defineProps<{ nodeId: string | null }>()
const emit = defineEmits<{ close: [] }>()
const store = useTopologyStore()
const detail = ref<NodeDetail | null>(null)
const loading = ref(false)
const router = useRouter()

function typeLabel(t: string) { return TN[t] || t }
function providerName(p: string) { return PNMap[p] || p }

const displayName = computed(() => detail.value?.name || '—')
const displayType = computed(() => {
  const d = detail.value
  if (!d) return ''
  const t = typeLabel(d.type)
  const p = d.provider ? providerName(d.provider) : ''
  return p ? `${t} · ${p}` : t
})
const iconColor = computed(() => detail.value ? getNodeColor(detail.value as TopoNode) : '#64748b')
const typeIcon = computed(() => detail.value ? (TI[detail.value.type] || '📦') : '📦')
const statusText = computed(() => detail.value ? (ST[detail.value.status] || detail.value.status) : '')
const providerLabel = computed(() => detail.value?.provider ? PNMap[detail.value.provider] || detail.value.provider : '')
const providerColor = computed(() => detail.value?.provider ? getProviderColor(detail.value.provider) : '#64748b')

const keyAttrs = computed(() => {
  const d = detail.value
  if (!d?.attributes) return []
  const defs = KEY_ATTRS[d.type] || []
  return defs
    .map(def => ({ key: def.key, label: def.label, value: d.attributes?.[def.key] }))
    .filter(a => a.value !== undefined && a.value !== null && a.value !== '')
})

const upstreamNodes = computed(() => (detail.value?.upstream_nodes || []).filter((n: any) => n != null))
const downstreamNodes = computed(() => (detail.value?.downstream_nodes || []).filter((n: any) => n != null))

/** 下游节点及其关联边（用于展示 APM 指标） */
const downstreamItems = computed(() => {
  const graph = store.graphData
  const nodeId = props.nodeId
  if (!graph || !nodeId) return []
  return downstreamNodes.value.map((node: TopoNode) => {
    const edge = (graph.edges || []).find(
      (e) => e?.source_id === nodeId && e?.target_id === node.id
    ) ?? null
    return { node, edge }
  })
})

function formatNum(val: unknown): string {
  const n = Number(val)
  if (isNaN(n)) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

/** 是否是 CMDB 实例节点（可跳转到资产详情） */
const isCmdbInstance = computed(() => {
  const id = detail.value?.id
  return id ? id.startsWith('inst-') : false
})

/** 跳转到资产详情页 */
function goAssetDetail() {
  const d = detail.value
  if (!d || !d.id?.startsWith('inst-')) return
  // 用 asset_id 或 asset_name 作为搜索关键词跳转到 CMDB 实例列表
  const keyword = d.attributes?.asset_id || d.attributes?.domain_name || d.name || ''
  const modelUID = d.attributes?.model_uid || ''
  const query: Record<string, string> = {}
  if (keyword) query.keyword = String(keyword)
  if (modelUID) query.model_uid = String(modelUID)
  router.push({ path: '/cmdb/instances', query })
}

function formatAttrValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? '是' : '否'
  if (Array.isArray(val)) return val.length === 0 ? '—' : JSON.stringify(val)
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

/** 优先从本地图数据构建节点详情，避免不必要的 API 调用 */
function loadDetail(id: string | null) {
  if (!id) { detail.value = null; return }
  loading.value = true
  // 直接从 store 的图数据构建详情（live builder 模式下节点不在 MongoDB 中）
  detail.value = buildLocalDetail(id)
  loading.value = false
}

function buildLocalDetail(nodeId: string): NodeDetail | null {
  const graph = store.graphData
  if (!graph) return null
  const node = graph.nodes?.find((n: any) => n?.id === nodeId)
  if (!node) return null

  const upNodes: TopoNode[] = []
  const downNodes: TopoNode[] = []
  for (const e of (graph.edges || [])) {
    if (!e) continue
    if (e.target_id === nodeId) {
      const src = graph.nodes?.find((n: any) => n?.id === e.source_id)
      if (src) upNodes.push(src)
    }
    if (e.source_id === nodeId) {
      const tgt = graph.nodes?.find((n: any) => n?.id === e.target_id)
      if (tgt) downNodes.push(tgt)
    }
  }

  return { ...node, upstream_nodes: upNodes, downstream_nodes: downNodes } as NodeDetail
}

watch(() => props.nodeId, (id) => loadDetail(id))
onMounted(() => loadDetail(props.nodeId))
</script>

<style scoped>
.detail-panel {
  background: var(--bg-elevated);
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

/* Header */
.dp-header {
  padding: 18px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-base) 100%);
}
.dp-header-info { display: flex; align-items: center; gap: 12px; }
.dp-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}
.dp-title { font-size: 15px; font-weight: 600; line-height: 1.3; }
.dp-title-link { cursor: pointer; color: var(--el-color-primary); }
.dp-title-link:hover { text-decoration: underline; }
.dp-subtitle { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

/* Body */
.dp-body { flex: 1; overflow-y: auto; }
.dp-loading { height: 200px; }
.dp-empty { flex: 1; display: flex; align-items: center; justify-content: center; }

/* Status card */
.dp-status-card {
  margin: 16px 20px; padding: 14px 16px;
  background: var(--bg-base); border-radius: 10px;
  border: 1px solid var(--border-subtle);
}
.dp-status-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dp-provider-badge {
  font-size: 11px; font-weight: 600; padding: 2px 10px;
  border-radius: 20px; border: 1px solid;
}
.dp-meta { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-subtle); }
.dp-meta-label { font-size: 12px; color: var(--text-tertiary); }
.dp-meta-value { font-size: 12px; font-weight: 500; }

/* Sections */
.dp-section { padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
.dp-section-title {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
}

/* Attribute rows */
.dp-attr-row {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 6px 0; gap: 12px;
}
.dp-attr-label { font-size: 12px; color: var(--text-tertiary); flex-shrink: 0; min-width: 80px; }
.dp-attr-value {
  font-size: 12px; font-weight: 500; text-align: right;
  max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Relation cards */
.dp-rel-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; margin-bottom: 6px;
  background: var(--bg-base); border: 1px solid var(--border-subtle);
  border-radius: 8px; cursor: pointer; transition: all 0.2s;
}
.dp-rel-card:hover {
  background: var(--bg-elevated); border-color: var(--border-strong);
  transform: translateX(2px);
}
.dp-rel-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dp-rel-info { flex: 1; min-width: 0; }
.dp-rel-name { font-size: 13px; font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-rel-type { font-size: 11px; color: var(--text-tertiary); }
.dp-rel-arrow { color: var(--text-tertiary); flex-shrink: 0; }

/* APM metrics in downstream cards */
.dp-apm-metrics { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
.dp-metric { font-size: 11px; color: var(--text-tertiary); }
.dp-metric-error { color: var(--accent-red); font-weight: 600; }
.dp-domains { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }

/* Collapse override */
.dp-section :deep(.el-collapse) { border: none; }
.dp-section :deep(.el-collapse-item__header) {
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  background: transparent; border: none; height: 32px; line-height: 32px;
}
.dp-section :deep(.el-collapse-item__wrap) { background: transparent; border: none; }
.dp-section :deep(.el-collapse-item__content) { padding: 0; }
</style>
