<template>
  <div class="logs-page" aria-labelledby="logs-title">
    <div class="page-header">
      <h1 id="logs-title" class="page-title">日志查询</h1>
      <span class="page-sub">多云 CDN / WAF / 负载均衡统一视图 · 联邦实时查询</span>
    </div>

    <!-- 日志类型 + 筛选区 -->
    <div class="filter-card">
      <el-tabs v-model="activeType" class="type-tabs" @tab-change="onTypeChange">
        <el-tab-pane v-for="t in typeMetas" :key="t.type" :label="t.label" :name="t.type" />
      </el-tabs>

      <div class="filter-row">
        <el-date-picker
          v-model="timeRange"
          class="filter-time"
          type="datetimerange"
          range-separator="→"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          :disabled-date="disableOutsideWindow"
          @change="onTimeChange"
        />
        <el-select
          v-model="selectedClouds"
          class="filter-clouds"
          multiple
          collapse-tags
          clearable
          placeholder="全部云"
          aria-label="按云筛选"
          @change="onCloudsChange"
        >
          <el-option v-for="c in availableClouds" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
        <el-select
          v-model="selectedResources"
          class="filter-resources"
          multiple
          filterable
          collapse-tags
          clearable
          placeholder="全部日志源"
          aria-label="按日志源筛选"
          :loading="sourcesLoading"
        >
          <el-option-group v-for="g in sourceGroups" :key="g.key" :label="g.label">
            <el-option
              v-for="s in g.sources"
              :key="s.resource_id"
              :label="s.name"
              :value="s.resource_id"
              :disabled="!s.enabled"
            >
              <span class="source-option">
                <span>{{ s.name }}</span>
                <span v-if="!s.enabled" class="source-disabled">未投递</span>
              </span>
            </el-option>
          </el-option-group>
        </el-select>
        <el-input
          v-model="keyword"
          class="filter-keyword"
          clearable
          placeholder="关键词 / 原生检索式(可选)"
          aria-label="检索关键词"
          @keyup.enter="doSearch"
        />
        <el-button type="primary" :loading="searching" @click="doSearch">查询</el-button>
      </div>

      <!-- 未开启投递的源:引导卡片 -->
      <el-alert
        v-if="disabledSources.length"
        type="warning"
        :closable="false"
        class="delivery-alert"
      >
        <template #title>
          {{ disabledSources.length }} 个日志源未开启投递(已从可选列表禁用):
        </template>
        <div class="delivery-notes">
          <div v-for="s in disabledSources.slice(0, 4)" :key="s.resource_id" class="delivery-note">
            <b>{{ s.name }}</b> · {{ s.note }}
          </div>
          <div v-if="disabledSources.length > 4" class="delivery-note">…其余 {{ disabledSources.length - 4 }} 个见源列表</div>
        </div>
      </el-alert>
    </div>

    <!-- per-source 状态(失败不静默) -->
    <div v-if="resp" class="sources-strip">
      <span class="strip-label">查询源:</span>
      <el-tag
        v-for="s in resp.sources"
        :key="s.cloud + s.account_id"
        :type="s.error ? 'danger' : 'success'"
        size="small"
        class="source-tag"
      >
        {{ cloudLabel(s.cloud) }}·{{ s.account_name }}:{{ s.error ? '失败' : s.count + ' 条' }}
      </el-tag>
      <el-tag v-if="resp.truncated" type="warning" size="small">结果已���断(可缩小时间范围或加筛选)</el-tag>
      <span class="strip-total">共 {{ resp.total }} 条</span>
    </div>

    <!-- 结果表(动态列) -->
    <div class="table-card">
      <template v-if="searching">
        <div class="table-skeleton" aria-hidden="true">
          <div v-for="i in 6" :key="i" class="skeleton-row" />
        </div>
      </template>
      <div v-else-if="searchError" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">查询失败</div>
          <div class="state-desc">{{ searchError }}</div>
          <el-button class="state-cta" @click="doSearch">重试</el-button>
        </div>
      </div>
      <div v-else-if="!resp || resp.entries.length === 0" class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">🔍</div>
          <div class="state-title">暂无日志</div>
          <div class="state-desc">
            {{ resp && resp.sources.length === 0
              ? '当前租户没有活跃云账号或所选云未接入。'
              : '该时间窗口内无匹配日志,尝试放大时间范围或放宽筛选。' }}
          </div>
        </div>
      </div>
      <template v-else>
        <el-table
          :data="resp.entries"
          class="log-table"
          size="small"
          stripe
          @row-click="openDetail"
        >
          <el-table-column
            v-for="f in currentFields"
            :key="f.key"
            :label="f.label"
            :min-width="columnWidth(f.key)"
            :show-overflow-tooltip="true"
          >
            <template #default="{ row }">
              <template v-if="f.key === 'timestamp'">
                <span class="cell-mono">{{ formatLogTime(row.timestamp) }}</span>
              </template>
              <template v-else-if="f.key === 'meta.cloud'">
                {{ cloudLabel(row.meta.cloud) }}
              </template>
              <template v-else-if="f.key === 'status'">
                <el-tag :type="statusTagType(row.status)" size="small" effect="plain">
                  {{ row.status || '—' }}
                </el-tag>
              </template>
              <template v-else-if="f.key === 'action'">
                <el-tag :type="actionTagType(row.action)" size="small" effect="plain">{{ row.action || '—' }}</el-tag>
              </template>
              <template v-else-if="f.key === 'severity'">
                <el-tag :type="severityTagType(row.severity)" size="small" effect="plain">{{ row.severity || '—' }}</el-tag>
              </template>
              <template v-else-if="f.key === 'cache_hit'">
                <el-tag :type="cacheHitTagType(row.cache_hit)" size="small" effect="plain">{{ row.cache_hit || '—' }}</el-tag>
              </template>
              <template v-else-if="f.key === 'bytes_sent'">
                <span class="cell-mono">{{ formatBytes(row.bytes_sent) }}</span>
              </template>
              <template v-else-if="isMono(f.key)">
                <span class="cell-mono">{{ dashIfEmpty(cellValue(row, f.key)) }}</span>
              </template>
              <template v-else>
                {{ dashIfEmpty(cellValue(row, f.key)) }}
              </template>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>

    <LogDetailDrawer v-model:visible="drawerVisible" :entry="detailEntry" :fields="drawerFields" />
  </div>
</template>

<script setup lang="ts">
/**
 * 多云统一日志查询页(Phase 5):
 * - 三类型 Tab(CDN/WAF/SLB),字段字典接口驱动动态列(后端加字段前端自动多列);
 * - 时间范围按类型上限约束(CDN 7d / SLB 3d,与后端一致);
 * - 日志源按云·账号分组,未开启投递的源禁用并给引导文案;
 * - 联邦查询 per-source 状态条(失败不静默)+ 截断提示;
 * - 行点击开详情抽屉:统一字段 + Raw 原始字段 JSON(信息零丢失)。
 */
import { getLogSourcesApi, getLogTypesApi, searchLogsApi } from '@/api/logs'
import type {
    LogEntry,
    LogSearchResponse,
    LogSource,
    LogType,
    LogTypeMeta,
} from '@/api/types/logs'
import { computed, onMounted, ref } from 'vue'
import LogDetailDrawer from './components/LogDetailDrawer.vue'
import {
    actionTagType,
    cacheHitTagType,
    cellValue,
    cloudLabel,
    dashIfEmpty,
    defaultWindowMs,
    formatBytes,
    formatLogTime,
    severityTagType,
    statusTagType,
} from './format'

const typeMetas = ref<LogTypeMeta[]>([])
const activeType = ref<LogType>('cdn')
const sources = ref<LogSource[]>([])
const sourcesLoading = ref(false)

const timeRange = ref<[Date, Date] | null>(null)
const selectedClouds = ref<string[]>([])
const selectedResources = ref<string[]>([])
const keyword = ref('')

const searching = ref(false)
const searchError = ref('')
const resp = ref<LogSearchResponse | null>(null)

const drawerVisible = ref(false)
const detailEntry = ref<LogEntry | null>(null)

const currentMeta = computed(() => typeMetas.value.find((t) => t.type === activeType.value))
const currentFields = computed(() => currentMeta.value?.fields ?? [])

// ---- 日志源分组(云·账号 -> 源) ----
const cloudOrder = ['aliyun', 'huawei', 'aws', 'tencent', 'volcano']

const filteredSources = computed(() =>
    selectedClouds.value.length
        ? sources.value.filter((s) => selectedClouds.value.includes(s.cloud))
        : sources.value,
)

const sourceGroups = computed(() => {
    const map = new Map<string, LogSource[]>()
    for (const s of filteredSources.value) {
        const key = `${s.cloud}·${s.account_name}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(s)
    }
    return Array.from(map.entries())
        .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
        .map(([key, list]) => ({ key, label: key, sources: list }))
})

function groupRank(groupKey: string): number {
    const idx = cloudOrder.findIndex((c) => groupKey.startsWith(c))
    return idx < 0 ? cloudOrder.length : idx
}

const availableClouds = computed(() => {
    const seen = new Map<string, string>()
    for (const s of sources.value) {
        if (!seen.has(s.cloud)) seen.set(s.cloud, cloudLabel(s.cloud))
    }
    return Array.from(seen.entries())
        .sort((a, b) => cloudOrder.indexOf(a[0]) - cloudOrder.indexOf(b[0]))
        .map(([value, label]) => ({ value, label }))
})

const disabledSources = computed(() => filteredSources.value.filter((s) => !s.enabled))

// ---- 详情抽屉字段(剔除 meta.* 固定列,统一字段平铺) ----
const drawerFields = computed(() =>
    currentFields.value
        .filter((f) => !f.key.startsWith('meta.'))
        .map((f) => ({ key: f.key, label: f.label })),
)

// ---- 加载 ----
onMounted(async () => {
    resetTimeRange()
    try {
        typeMetas.value = await getLogTypesApi()
    } catch {
        // 字段字典失败仍可手输检索,提示空字典
        typeMetas.value = []
    }
    await loadSources()
})

async function loadSources() {
    sourcesLoading.value = true
    try {
        sources.value = await getLogSourcesApi({ log_type: activeType.value })
        // 清除已失效的资源选择
        const valid = new Set(sources.value.map((s) => s.resource_id))
        selectedResources.value = selectedResources.value.filter((r) => valid.has(r))
    } catch {
        sources.value = []
    } finally {
        sourcesLoading.value = false
    }
}

function onTypeChange() {
    resp.value = null
    selectedResources.value = []
    resetTimeRange()
    void loadSources()
}

function onCloudsChange() {
    // 云变化只影响可选源展示,已有资源选择按有效性保留(loadSources 会清理)
    void loadSources()
}

// ---- 时间窗口约束(与后端一致:按类型上限) ----
function resetTimeRange() {
    const end = Date.now()
    const window = defaultWindowMs(currentMeta.value?.max_window_days ?? 7)
    // 默认 6 小时:CloudFront 标准日志小时级投递,1h 窗口内活跃域名太少;
    // 仍受类型上限钳制(CDN 7d / SLB 3d)
    timeRange.value = [new Date(end - Math.min(window, 6 * 3600_000)), new Date(end)]
}

function disableOutsideWindow(d: Date): boolean {
    const days = currentMeta.value?.max_window_days ?? 7
    const floor = Date.now() - days * 24 * 3600_000
    return d.getTime() < floor || d.getTime() > Date.now()
}

function onTimeChange() {
    // 超窗自动收紧到上限(与 disableOutsideWindow 双保险)
    const days = currentMeta.value?.max_window_days ?? 7
    const floor = Date.now() - days * 24 * 3600_000
    if (timeRange.value && timeRange.value[0].getTime() < floor) {
        timeRange.value = [new Date(floor), timeRange.value[1]]
    }
}

// ---- 查询 ----
async function doSearch() {
    if (!timeRange.value) return
    searching.value = true
    searchError.value = ''
    try {
        resp.value = await searchLogsApi({
            log_type: activeType.value,
            start_time: timeRange.value[0].getTime(),
            end_time: timeRange.value[1].getTime(),
            query: keyword.value || undefined,
            clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
            resources: selectedResources.value.length ? selectedResources.value : undefined,
            limit: 100,
        })
    } catch (e) {
        resp.value = null
        searchError.value = e instanceof Error ? e.message : String(e)
    } finally {
        searching.value = false
    }
}

// ---- 详情 ----
function openDetail(row: LogEntry) {
    detailEntry.value = row
    drawerVisible.value = true
}

// ---- 渲染辅助 ----
function isMono(key: string): boolean {
    return ['client_ip', 'target_ip', 'request_id', 'edge_node', 'meta.region',
        'meta.resource_id', 'meta.account_name', 'tls_protocol', 'rule_id', 'geo'].includes(key)
}

function columnWidth(key: string): number {
    if (key === 'timestamp') return 140
    if (key === 'url' || key === 'uri') return 280
    if (key === 'user_agent' || key === 'referer') return 220
    if (key === 'meta.resource_id') return 160
    if (key === 'status' || key === 'method' || key === 'action' || key === 'severity' || key === 'cache_hit') return 88
    return 130
}
</script>

<style scoped>
.logs-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
}
.page-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
}
.page-title {
    margin: 0;
    font-size: 20px;
}
.page-sub {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}
.filter-card {
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 4px 16px 12px;
    border: 1px solid var(--el-border-color-lighter);
}
.type-tabs :deep(.el-tabs__header) {
    margin-bottom: 8px;
}
.filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.filter-time {
    width: 360px;
}
.filter-clouds {
    width: 180px;
}
.filter-resources {
    width: 280px;
}
.filter-keyword {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
}
.source-option {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}
.source-disabled {
    color: var(--el-color-warning);
    font-size: 12px;
}
.delivery-alert {
    margin-top: 8px;
}
.delivery-notes {
    font-size: 12px;
    line-height: 1.8;
}
.delivery-note {
    color: var(--el-text-color-regular);
}
.sources-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}
.strip-label,
.strip-total {
    color: var(--el-text-color-secondary);
}
.source-tag {
    font-size: 12px;
}
.table-card {
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 8px;
    border: 1px solid var(--el-border-color-lighter);
}
.log-table {
    width: 100%;
    cursor: pointer;
}
.cell-mono {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
}
.state-card {
    padding: 48px 0;
    text-align: center;
}
.state-icon {
    font-size: 32px;
    margin-bottom: 8px;
}
.state-icon-error {
    color: var(--el-color-danger);
}
.state-title {
    font-weight: 600;
    margin-bottom: 4px;
}
.state-desc {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-bottom: 12px;
}
.table-skeleton {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
}
.skeleton-row {
    height: 28px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--el-fill-color-light) 25%, var(--el-fill-color) 37%, var(--el-fill-color-light) 63%);
    background-size: 400% 100%;
    animation: skeleton-loading 1.4s ease infinite;
}
@keyframes skeleton-loading {
    0% {
        background-position: 100% 50%;
    }
    100% {
        background-position: 0 50%;
    }
}
</style>
