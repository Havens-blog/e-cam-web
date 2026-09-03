<template>
  <div class="cert-probes-page" aria-labelledby="cert-probes-title">
    <div class="page-header">
      <h1 id="cert-probes-title" class="page-title">探测结果</h1>
      <span class="page-sub">每域最近一次 TLS 拨测（含 DNS 源子域名）</span>
    </div>

    <div aria-live="polite">
      <!-- Loading：仅初始加载（无数据）显示骨架；已有数据刷新保留表格防高度塌缩 -->
      <template v-if="loading && !rows.length">
        <div class="table-skeleton" aria-hidden="true">
          <div v-for="i in 5" :key="i" class="skeleton-row" />
        </div>
      </template>

      <!-- Error：仅无数据时整卡提示；已有数据刷新失败走行内提示不打断浏览 -->
      <div v-else-if="error && !rows.length" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">探测结果加载失败</div>
          <div class="state-desc">{{ error }}</div>
          <el-button class="state-cta" @click="load">重试</el-button>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="!filtered.length" class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">🔍</div>
          <div class="state-title">暂无探测结果</div>
          <div class="state-desc">
            {{ rows.length ? '当前筛选无匹配，调整筛选重试。' : '尚未执行 TLS 探测，等待下一次巡检。' }}
          </div>
        </div>
      </div>

      <!-- Populated -->
      <template v-else>
        <div v-if="loading" class="refresh-bar" role="status">
          <span class="spinner" aria-hidden="true" />
          正在刷新探测结果…
        </div>

        <div class="toolbar">
          <el-input
            v-model="keyword"
            class="toolbar-search"
            type="search"
            placeholder="搜索域名 / 子域名"
            aria-label="搜索域名"
            clearable
          />
          <el-select v-model="statusFilter" class="toolbar-select" aria-label="按状态筛选">
            <el-option v-for="o in PROBE_STATUS_FILTERS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <el-select v-model="linkFilter" class="toolbar-select" aria-label="按链路层筛选">
            <el-option v-for="o in PROBE_LINK_FILTERS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <div class="toolbar-spacer" />
          <el-button
            class="scan-btn"
            :disabled="scanning"
            @click="triggerScan"
          >
            <span v-if="scanning" class="spinner" aria-hidden="true" />
            {{ scanning ? '探测中' : '立即探测' }}
          </el-button>
          <el-button :loading="loading" class="refresh-btn" @click="load">刷新</el-button>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th scope="col">域名 / 子域名</th>
                <th scope="col">记录类型</th>
                <th scope="col">解析地址</th>
                <th scope="col">链路层</th>
                <th scope="col">探测状态</th>
                <th scope="col">TLS 版本</th>
                <th scope="col">证书到期</th>
                <th scope="col">线上指纹</th>
                <th scope="col">探测时间</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="g in groups" :key="g.root">
                <tr class="group-row" :aria-expanded="isExpanded(g.root)" @click="toggleGroup(g.root)">
                  <td colspan="9">
                    <span class="chevron" :class="{ expanded: isExpanded(g.root) }" aria-hidden="true">▶</span>
                    <span class="group-root cell-mono">{{ g.root }}</span>
                    <span class="group-summary">{{ groupSummary(g.rows) }}</span>
                    <el-button
                      class="group-probe-btn"
                      size="small"
                      text
                      :disabled="scanning"
                      @click.stop="triggerRootScan(g.root, g.rows)"
                    >
                      <span v-if="scanningRoot === g.root" class="spinner" aria-hidden="true" />
                      {{ scanningRoot === g.root ? '探测中' : '探测此域' }}
                    </el-button>
                  </td>
                </tr>
                <template v-if="isExpanded(g.root)">
                  <tr v-for="r in g.rows" :key="r.domain" class="sub-row">
                    <td class="cell-mono sub-domain">{{ r.domain }}</td>
                    <td class="cell-mono">{{ recordTypeLabel(r.recordType) }}</td>
                    <td class="cell-mono record-value" :title="r.recordValue || ''">{{ recordValueText(r.recordValue) }}</td>
                    <td>{{ linkedResourceLabel(r.linkedResource) }}</td>
                    <td>
                      <span class="probe-badge" :class="probeBadgeClass(r.status)">
                        <span class="badge-icon" aria-hidden="true">{{ probeBadge(r.status as ProbeStatus).icon }}</span>
                        {{ probeBadge(r.status as ProbeStatus).label }}
                      </span>
                    </td>
                    <td class="cell-mono">{{ r.tlsVersion || '—' }}</td>
                    <td class="cell-mono">{{ certExpiryDate(r.onlineNotAfter) || '—' }}</td>
                    <td class="cell-mono">
                      <template v-if="r.onlineFingerprint">
                        <span class="fp">{{ truncateFingerprint(r.onlineFingerprint) }}</span>
                        <button
                          type="button"
                          class="copy-btn"
                          title="复制完整指纹"
                          :aria-label="`复制 ${r.domain} 的线上指纹`"
                          @click="onCopy(r.onlineFingerprint!, r.domain)"
                        >
                          <el-icon><CopyDocument /></el-icon>
                        </button>
                      </template>
                      <span v-else>—</span>
                    </td>
                    <td class="cell-mono">{{ relativeTimeDash(r.probeAt) }}</td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 探测结果列表页（GET /certs/probes）：每域最近一次 TLS 拨测，含 DNS 源探测的子域名行。
 * 域名搜索 + 状态/链路层筛选；状态徽章复用看板 probeBadge；线上到期相对时间展示。
 * 全角色只读（与到期看板同级，不标 certManageOnly）。
 */
import type { CertProbeResult, ProbeStatus } from '@/api/cert'
import { getCertProbesApi, triggerCertProbeScanApi } from '@/api/cert'
import { CertRequestError } from '@/api/cert'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { probeBadge, relativeTimeDash } from '../dashboard/format'
import { copyText, truncateFingerprint } from '../ledger/format'
import {
    PROBE_LINK_FILTERS,
    PROBE_STATUS_FILTERS,
    certExpiryDate,
    groupProbeResults,
    groupSummary,
    isProbeFilterActive,
    linkedResourceLabel,
    matchDomain,
    probeBadgeClass,
    recordTypeLabel,
    recordValueText,
    type ProbeResultGroup,
} from './format'

const rows = ref<CertProbeResult[]>([])
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const statusFilter = ref('')
const linkFilter = ref('')
const scanning = ref(false)
const scanningRoot = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null

const collapsed = ref<Record<string, boolean>>({})

/** 根域分组视图（过滤后的行按根域折叠；搜索/筛选激活时全部展开） */
const groups = computed<ProbeResultGroup[]>(() => groupProbeResults(filtered.value))

/** 搜索/状态/链路任一筛选激活 → 全部展开（否则命中组被折叠看不见） */
const filterActive = computed(() => isProbeFilterActive(keyword.value, statusFilter.value, linkFilter.value))

function isExpanded(root: string): boolean {
    return filterActive.value || !collapsed.value[root]
}

function toggleGroup(root: string): void {
    collapsed.value = { ...collapsed.value, [root]: !collapsed.value[root] }
}

const filtered = computed(() =>
    rows.value.filter((r) => {
        if (!matchDomain(r.domain, keyword.value.trim())) return false
        if (statusFilter.value && r.status !== statusFilter.value) return false
        if (linkFilter.value === 'san') {
            if (r.linkedResource) return false
        } else if (linkFilter.value && r.linkedResource !== linkFilter.value) {
            return false
        }
        return true
    }),
)

let loadInFlight = false

async function load() {
    if (loadInFlight) return // 轮询 tick 与手动刷新重叠时跳过重复请求
    loadInFlight = true
    loading.value = true
    error.value = ''
    try {
        rows.value = await getCertProbesApi()
    } catch (err) {
        error.value = err instanceof Error ? err.message : '探测结果获取失败，请重试'
    } finally {
        loadInFlight = false
        loading.value = false
    }
}

async function onCopy(fp: string, domain: string) {
    const ok = await copyText(fp)
    if (ok) ElMessage.success('已复制')
    else ElMessage.error(`复制失败，请手动复制 ${domain} 的指纹`)
}

/** 触发前最大的 probeAt（ms）——轮询到此值推进即本轮完成 */
function maxProbeAtMs(): number {
    return rows.value.reduce((m, r) => {
        const t = Date.parse(r.probeAt)
        return Number.isNaN(t) ? m : Math.max(m, t)
    }, 0)
}

const SCAN_POLL_INTERVAL_MS = 5_000
const SCAN_POLL_MAX_MS = 6 * 60_000

/** 立即触发 DNS 源探测：202 后轮询 /probes 至 probeAt 推进或超时 */
async function triggerScan() {
    if (scanning.value) return
    scanning.value = true
    const baseline = maxProbeAtMs()
    try {
        await triggerCertProbeScanApi()
        startPolling(baseline)
    } catch (err) {
        scanning.value = false
        scanningRoot.value = '' 
        const code = err instanceof CertRequestError ? err.code : ''
        if (code === 'SCAN_IN_PROGRESS') {
            ElMessage.warning('探测正在进行中，稍后自动刷新')
            startPolling(baseline)
            return
        }
        ElMessage.error(err instanceof Error ? err.message : '触发探测失败，请重试')
    }
}

/** 组头定向探测：202 后轮询至该组 probeAt 推进（其余组不动，完成判定更精准） */
async function triggerRootScan(root: string, groupRows: CertProbeResult[]) {
    if (scanning.value) return
    scanning.value = true
    scanningRoot.value = root
    const baseline = groupRows.reduce((m, r) => {
        const t = Date.parse(r.probeAt)
        return Number.isNaN(t) ? m : Math.max(m, t)
    }, 0)
    try {
        await triggerCertProbeScanApi(root)
        startPolling(baseline)
    } catch (err) {
        scanning.value = false
        scanningRoot.value = ''
        const code = err instanceof CertRequestError ? err.code : ''
        if (code === 'SCAN_IN_PROGRESS') {
            ElMessage.warning('探测正在进行中，稍后自动刷新')
            startPolling(baseline)
            return
        }
        if (code === 'PROBE_NO_TARGETS') {
            ElMessage.warning(`根域名 ${root} 下无可拨测目标（DNS 记录未同步或域名不存在）`)
            return
        }
        ElMessage.error(err instanceof Error ? err.message : '触发探测失败，请重试')
    }
}

function startPolling(baseline: number) {
    stopPolling()
    const startedAt = Date.now()
    const tick = async () => {
        await load()
        // 本轮完成：出现比 baseline 更新的 probeAt
        if (maxProbeAtMs() > baseline) {
            scanning.value = false
            scanningRoot.value = ''
            ElMessage.success('探测完成，结果已刷新')
            return
        }
        if (Date.now() - startedAt > SCAN_POLL_MAX_MS) {
            scanning.value = false
            scanningRoot.value = ''
            ElMessage.info('探测仍在后台进行，已停止自动刷新，请稍后手动刷新')
            return
        }
        pollTimer = setTimeout(tick, SCAN_POLL_INTERVAL_MS)
    }
    pollTimer = setTimeout(tick, SCAN_POLL_INTERVAL_MS)
}

function stopPolling() {
    if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
    }
}

onMounted(load)
onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
.cert-probes-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-sub {
  font-size: 12px;
  color: var(--text-secondary);
}

.state-card {
  display: flex;
  justify-content: center;
  padding: 40px 16px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
}

.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.state-icon {
  font-size: 24px;
}

.state-icon-error {
  color: #ef4444;
}

.state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.state-desc {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 420px;
  text-align: center;
}

.state-cta {
  margin-top: 8px;
}

.table-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  height: 44px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--border-base) 40%, transparent) 25%,
    color-mix(in srgb, var(--border-base) 60%, transparent) 37%,
    color-mix(in srgb, var(--border-base) 40%, transparent) 63%
  );
  background-size: 400% 100%;
  animation: cert-skel 1.4s ease infinite;
}

@keyframes cert-skel {
  0% { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.refresh-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 2px;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-search {
  width: 280px;
}

.toolbar-select {
  width: 140px;
}

.toolbar-spacer {
  flex: 1;
}

.refresh-btn {
  min-width: 80px;
}

.scan-btn {
  min-width: 96px;
}

.spinner {
  width: 11px;
  height: 11px;
  margin-right: 4px;
  border-radius: 50%;
  border: 1.5px solid currentcolor;
  border-top-color: transparent;
  display: inline-block;
  animation: cert-spin 0.8s linear infinite;
}

@keyframes cert-spin {
  to {
    transform: rotate(360deg);
  }
}

.table-wrap {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;
}

.group-row {
  cursor: pointer;
  user-select: none;

  td {
    background: rgba(255, 255, 255, 0.04);
    padding: 8px 14px;
    border-bottom: 1px solid var(--border-base);
  }

  &:hover td {
    background: rgba(255, 255, 255, 0.06);
  }
}

.chevron {
  display: inline-block;
  margin-right: 8px;
  font-size: 10px;
  color: var(--text-secondary);
  transition: transform 0.15s ease;

  &.expanded {
    transform: rotate(90deg);
  }
}

.group-root {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-summary {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.group-probe-btn {
  margin-left: 16px;
  font-size: 12px;
}

.sub-row .sub-domain {
  padding-left: 30px;
}

.record-value {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  th {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    text-align: left;
    padding: 8px 14px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid var(--border-base);
    white-space: nowrap;
  }

  td {
    font-size: 13px;
    color: var(--text-primary);
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-base);
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.cell-mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.probe-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-base);

  &.tone-success { color: #10b981; border-color: color-mix(in srgb, #10b981 40%, transparent); }
  &.tone-error { color: #ef4444; border-color: color-mix(in srgb, #ef4444 40%, transparent); }
  &.tone-warning { color: #f5a623; border-color: color-mix(in srgb, #f5a623 40%, transparent); }
  &.tone-secondary { color: var(--text-secondary); }
}

.badge-icon {
  font-size: 11px;
}

.fp {
  margin-right: 4px;
}

.copy-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;

  &:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-row {
    animation: none;
  }
}
</style>
