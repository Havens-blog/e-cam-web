<template>
  <div class="filter-panel">
    <div class="fp-header">
      <div class="fp-title"><el-icon><Filter /></el-icon> 筛选条件</div>
      <el-button link type="primary" size="small" @click="store.resetFilters()">重置</el-button>
    </div>

    <!-- 域名选择 -->
    <div class="fp-section">
      <div class="fp-label">入口域名</div>
      <el-select
        v-model="store.selectedDomain"
        placeholder="输入搜索域名"
        clearable
        filterable
        remote
        :remote-method="searchDomains"
        :loading="domainSearchLoading"
        size="small"
        style="width:100%"
      >
        <el-option
          v-for="d in domainOptions.filter(i => i != null)"
          :key="d.value"
          :label="d.label"
          :value="d.value"
        >
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis">{{ d.label }}</span>
            <span style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">{{ d.type || d.provider }}</span>
          </div>
        </el-option>
      </el-select>
    </div>

    <!-- 云厂商 -->
    <div class="fp-section">
      <div class="fp-label">云厂商</div>
      <div class="chip-group">
        <div v-for="p in providers" :key="p.value" class="chip" :class="{ active: store.selectedProviders.includes(p.value) }" @click="toggleProvider(p.value)">
          <span class="chip-dot" :style="{ background: p.color }"></span> {{ p.label }}
        </div>
      </div>
    </div>

    <!-- 数据来源 -->
    <div class="fp-section">
      <div class="fp-label">数据来源</div>
      <div class="chip-group">
        <div v-for="s in sources" :key="s.value" class="chip" :class="{ active: store.selectedSourceCollectors.includes(s.value) }" @click="toggleSource(s.value)">
          <span class="chip-dot" :style="{ background: s.color }"></span> {{ s.label }}
        </div>
      </div>
    </div>

    <!-- 开关 -->
    <div class="fp-section">
      <div class="switch-row">
        <span>隐藏沉默链路</span>
        <el-switch v-model="store.hideSilent" size="small" />
      </div>
      <div class="switch-row">
        <span>仅显示断链</span>
        <el-switch v-model="store.showBrokenOnly" size="small" />
      </div>
    </div>

    <!-- 统计 -->
    <div v-if="store.graphData" class="fp-section">
      <div class="fp-label">链路概览</div>
      <div class="stat-row"><span>域名入口</span><strong>{{ store.graphData.stats.domain_count }}</strong></div>
      <div class="stat-row"><span>链路节点</span><strong>{{ store.graphData.stats.node_count }}</strong></div>
      <div class="stat-row"><span>活跃连线</span><strong class="ok">{{ store.graphData.stats.edge_count }}</strong></div>
      <div class="stat-row"><span>断链节点</span><strong class="ng">{{ store.graphData.stats.broken_count }}</strong></div>
      <div class="stat-row"><span>最大深度</span><strong>{{ store.graphData.stats.max_depth }}</strong></div>
    </div>

    <!-- 图例 -->
    <div class="fp-section">
      <div class="fp-label">图例 - 节点类型</div>
      <div class="legend-grid">
        <div v-for="l in nodeLegend" :key="l.type" class="legend-item">
          <span class="legend-dot" :style="{ background: l.color }"></span> {{ l.label }}
        </div>
      </div>
      <div class="fp-label" style="margin-top:12px">图例 - 连线</div>
      <div class="legend-col">
        <div class="legend-item"><span class="legend-line active"></span> 活跃</div>
        <div class="legend-item"><span class="legend-line silent"></span> 沉默</div>
        <div class="legend-item"><span class="legend-line broken"></span> 断链</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getDnsDomainsApi, searchDnsRecordsApi } from '@/api/dns'
import { useTopologyStore } from '@/stores/topology'
import { Filter } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue'

const store = useTopologyStore()

interface DomainOption { value: string; label: string; provider: string; type?: string }
const domainOptions = ref<DomainOption[]>([])
const domainSearchLoading = ref(false)

/** 加载初始主域名列表 */
async function loadMainDomains() {
  const options: DomainOption[] = []
  for (const d of (store.domainList || []).filter(i => i != null)) {
    options.push({ value: d.domain, label: d.domain, provider: d.provider, type: '主域名' })
  }
  try {
    const res = await getDnsDomainsApi({ limit: 100 })
    const data = (res as any)?.data || res
    for (const d of (data?.items || []).filter((i: any) => i != null)) {
      const domain = d.domain_name || d.domain || d.name
      if (domain && !options.some(o => o.value === domain)) {
        options.push({ value: domain, label: domain, provider: d.provider || '', type: '主域名' })
      }
    }
  } catch { /* ignore */ }
  domainOptions.value = options
}

/** 搜索域名：调跨域名搜索 API，一次性搜所有域名下的记录 */
async function searchDomains(query: string) {
  if (!query) { await loadMainDomains(); return }
  domainSearchLoading.value = true
  try {
    const options: DomainOption[] = []
    const seen = new Set<string>()
    // 本地匹配主域名
    for (const d of domainOptions.value) {
      if (d.value.includes(query)) { options.push(d); seen.add(d.value) }
    }
    // 调跨域名搜索 API
    try {
      const res = await searchDnsRecordsApi({ keyword: query, limit: 50 })
      const data = (res as any)?.data || res
      for (const r of (data?.items || []).filter((i: any) => i != null)) {
        const rr = r.rr || ''
        const domain = r.domain || ''
        const fullDomain = rr === '@' ? domain : `${rr}.${domain}`
        if (fullDomain && !seen.has(fullDomain)) {
          seen.add(fullDomain)
          options.push({
            value: fullDomain, label: fullDomain, provider: r.provider || '',
            type: `${r.type || 'A'} → ${(r.value || '').substring(0, 35)}`
          })
        }
      }
    } catch { /* ignore */ }
    domainOptions.value = options
  } finally { domainSearchLoading.value = false }
}

onMounted(() => { loadMainDomains() })

const providers = [
  { value: 'aliyun', label: '阿里云', color: '#ff6a00' },
  { value: 'aws', label: 'AWS', color: '#ff9900' },
  { value: 'tencent', label: '腾讯云', color: '#00a4ff' },
  { value: 'huawei', label: '华为云', color: '#cf0a2c' },
  { value: 'volcano', label: '火山引擎', color: '#3370ff' },
]
const sources = [
  { value: 'cloud_api', label: '云API', color: '#3b82f6' },
  { value: 'k8s_api', label: 'K8s', color: '#10b981' },
  { value: 'log', label: '日志', color: '#f59e0b' },
  { value: 'declaration', label: '声明', color: '#818cf8' },
]
const nodeLegend = [
  { type: 'dns', label: 'DNS', color: '#a78bfa' },
  { type: 'cdn', label: 'CDN', color: '#c084fc' },
  { type: 'waf', label: 'WAF', color: '#f87171' },
  { type: 'lb', label: '负载均衡', color: '#38bdf8' },
  { type: 'gw', label: '网关', color: '#fbbf24' },
  { type: 'svc', label: 'Service', color: '#818cf8' },
  { type: 'deploy', label: 'Deployment', color: '#34d399' },
  { type: 'data', label: '数据库/存储', color: '#f472b6' },
  { type: 'ext', label: '外部/未知', color: '#64748b' },
]

function toggleProvider(v: string) {
  const idx = store.selectedProviders.indexOf(v)
  if (idx >= 0) store.selectedProviders.splice(idx, 1)
  else store.selectedProviders.push(v)
}
function toggleSource(v: string) {
  const idx = store.selectedSourceCollectors.indexOf(v)
  if (idx >= 0) store.selectedSourceCollectors.splice(idx, 1)
  else store.selectedSourceCollectors.push(v)
}
</script>

<style scoped>
.filter-panel { background: var(--bg-elevated); border-right: 1px solid var(--border-subtle); overflow-y: auto; display: flex; flex-direction: column; }
.fp-header { padding: 16px 18px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; }
.fp-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.fp-section { padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); }
.fp-label { font-size: 11px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; }
.chip-group { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid var(--border-subtle); color: var(--text-secondary); transition: all 0.2s; }
.chip:hover { border-color: var(--border-strong); color: var(--text-primary); }
.chip.active { border-color: var(--accent-blue); background: rgba(59,130,246,0.12); color: var(--accent-blue); }
.chip-dot { width: 8px; height: 8px; border-radius: 50%; }
.switch-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; font-size: 13px; color: var(--text-secondary); }
.stat-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; font-size: 12px; color: var(--text-tertiary); }
.stat-row strong { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.stat-row strong.ok { color: var(--accent-green); }
.stat-row strong.ng { color: var(--accent-red); }
.legend-grid { display: flex; flex-direction: column; gap: 4px; }
.legend-col { display: flex; flex-direction: column; gap: 4px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-secondary); }
.legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.legend-line { width: 24px; height: 0; flex-shrink: 0; }
.legend-line.active { border-top: 2px solid var(--accent-green); }
.legend-line.silent { border-top: 2px solid var(--text-tertiary); opacity: 0.3; }
.legend-line.broken { border-top: 2px dashed var(--accent-red); }
</style>
