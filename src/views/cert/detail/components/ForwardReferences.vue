<template>
  <div class="forward-refs">
    <!-- Hard Rule：盲区声明横幅常驻、不可关闭、不可被筛选隐藏 -->
    <div class="blind-banner" role="note" aria-label="盲区声明（常驻）">
      <span class="banner-icon" aria-hidden="true">⚠</span>
      <div>
        <div class="banner-title">盲区声明</div>
        <div class="banner-body">本视图不含 VM Nginx 配置级引用。</div>
      </div>
    </div>

    <!-- 扫描元数据行：最近扫描时间 + 各云覆盖率（total=-1 → 分母不可用）+ 立即扫描 -->
    <div class="meta-row" :class="{ 'meta-stale': stale }">
      <span class="meta-item" :class="{ 'meta-warn-text': stale }">
        {{ stale ? '⚠ ' : '' }}最近扫描 {{ relativeTime(view.lastScanAt) }}{{ stale ? '（已超期）' : '' }}
      </span>
      <template v-if="coverageChips.length">
        <span class="meta-dot" aria-hidden="true">·</span>
        <span class="meta-item coverage-item">
          覆盖率：
          <span
            v-for="c in coverageChips"
            :key="c.cloud"
            class="coverage-chip"
            :class="{ unavailable: !c.denominatorAvailable, lagging: c.lagging }"
          >
            {{ c.label }} {{ c.text }}
          </span>
        </span>
      </template>
      <div class="meta-spacer" />
      <!-- 只读模式隐藏操作入口（ui-design 只读角色路由拦截节） -->
      <el-button
        v-if="!readonly"
        size="small"
        class="scan-btn"
        :disabled="scanning"
        @click="emit('trigger-scan')"
      >
        <span v-if="scanning" class="spinner" aria-hidden="true" />
        {{ scanning ? '扫描中' : '立即扫描' }}
      </el-button>
    </div>

    <!-- 未发现引用 ≠ 无引用（三态派生，区别于空态文案） -->
    <div v-if="view.referenceStatus === 'no_refs_scanned'" class="notice-card" role="status">
      <span class="notice-icon" aria-hidden="true">🔍</span>
      {{ noRefsNotice(view.lastScanAt) }}
    </div>

    <template v-else>
      <div v-if="view.referenceStatus === 'blind_spot'" class="notice-card notice-blind" role="status">
        <span class="notice-icon" aria-hidden="true">⚠</span>
        {{ blindSpotNotice(view.reason) }}
      </div>

      <!-- 筛选行：云▾/产品▾/集群▾级联（集群仅 K8s 组）+ 资源名搜索 300ms 防抖 -->
      <div class="toolbar">
        <el-select v-model="cloud" class="toolbar-select" aria-label="筛选云" @change="onCloudChange">
          <el-option label="云：全部" value="" />
          <el-option v-for="c in options.clouds" :key="c" :label="cloudLabel(c)" :value="c" />
        </el-select>
        <el-select v-model="product" class="toolbar-select" aria-label="筛选产品">
          <el-option label="产品：全部" value="" />
          <el-option v-for="p in options.products" :key="p" :label="productLabel(p)" :value="p" />
        </el-select>
        <el-select
          v-model="cluster"
          class="toolbar-select"
          aria-label="筛选集群（仅 K8s 引用）"
          :disabled="!options.clusters.length"
        >
          <el-option label="集群：全部" value="" />
          <el-option v-for="c in options.clusters" :key="c" :label="c" :value="c" />
        </el-select>
        <el-input
          v-model="keywordInput"
          class="toolbar-search"
          type="search"
          placeholder="搜索资源名 / 资源 ID（300ms 防抖）"
          aria-label="搜索资源"
          clearable
          @input="onKeywordInput"
        />
      </div>

      <!-- 分组折叠列表（筛选状态变化经 aria-live 通告，ui-design 表格语义） -->
      <div class="groups" aria-live="polite">
        <span class="sr-only">{{ announceText }}</span>
        <template v-if="filtered.length">
          <div v-for="g in filtered" :key="groupKey(g)" class="accordion-item" :class="{ open: isExpanded(g) }">
            <button
              type="button"
              class="accordion-header"
              :aria-expanded="isExpanded(g)"
              @click="toggle(g)"
            >
              <span class="chevron" aria-hidden="true">▸</span>
              {{ groupLabel(g) }}
              <span class="count-badge">{{ g.references.length }}</span>
            </button>
            <div v-show="isExpanded(g)" class="accordion-body">
              <table class="data-table">
                <thead>
                  <tr>
                    <th scope="col">资源 ID</th>
                    <th scope="col">云侧证书 ID</th>
                    <th scope="col">账号 / 命名空间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="item in g.references"
                    :key="`${g.cloud}|${g.product}|${g.clusterId ?? ''}|${item.resourceId}|${item.referencedCloudCertId}`"
                    class="clickable-row"
                    tabindex="0"
                    @click="emit('open-resource', { group: g, item })"
                    @keydown.enter.prevent="emit('open-resource', { group: g, item })"
                    @keydown.space.prevent="emit('open-resource', { group: g, item })"
                  >
                    <td class="cell-mono">{{ item.resourceId }}</td>
                    <td class="cell-mono">{{ item.referencedCloudCertId }}</td>
                    <td>{{ accountCell(item) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
        <div v-else class="no-match" role="status">
          <span class="notice-icon" aria-hidden="true">🔍</span>
          无匹配引用
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 正向引用 Tab（UF-2 AC4）：盲区横幅（Hard Rule 常驻）→ 扫描元数据行（超期 Warning）→
 * 级联筛选（云/产品/集群，集群仅 K8s 组）+ 资源名搜索（300ms 防抖，清空恢复全量）→
 * cloud·product 分组折叠（默认展开前 2 组，150ms 过渡）→ 资源行点击开抽屉。
 * 未发现引用态（no_refs_scanned）显示三态文案，不渲染筛选与分组。
 */
import type { CertReferenceGroup, CertReferenceItem, CertReferencesView } from '@/api/cert'
import { computed, reactive, ref, watch } from 'vue'
import {
    EMPTY_FORWARD_FILTERS,
    blindSpotNotice,
    cloudLabel,
    coverageSummary,
    filterForwardGroups,
    forwardFilterOptions,
    groupLabel,
    k8sClusterCount,
    noRefsNotice,
    productLabel,
    relativeTime,
    scanStale,
} from '../format'

const props = defineProps<{
    view: CertReferencesView
    /** 扫描进行中（防重：按钮 disabled + 「扫描中」） */
    scanning?: boolean
    /** 只读模式：隐藏「立即扫描」操作入口 */
    readonly?: boolean
}>()

const emit = defineEmits<{
    (e: 'trigger-scan'): void
    (e: 'open-resource', payload: { group: CertReferenceGroup; item: CertReferenceItem }): void
}>()

const filters = reactive({ ...EMPTY_FORWARD_FILTERS })
const keywordInput = ref('')
let keywordTimer: ReturnType<typeof setTimeout> | null = null

/** 资源名搜索 300ms 防抖（输入即过滤，空查询恢复全量） */
function onKeywordInput() {
    if (keywordTimer) clearTimeout(keywordTimer)
    keywordTimer = setTimeout(() => {
        filters.keyword = keywordInput.value
    }, 300)
}

const cloud = computed({
    get: () => filters.cloud,
    set: (v: string) => {
        filters.cloud = v
    },
})
const product = computed({
    get: () => filters.product,
    set: (v: string) => {
        filters.product = v
    },
})
const cluster = computed({
    get: () => filters.cluster,
    set: (v: string) => {
        filters.cluster = v
    },
})

const stale = computed(() => scanStale(props.view.lastScanAt))
const coverageChips = computed(() =>
    coverageSummary(props.view.coverage, k8sClusterCount(props.view.groups)),
)
const options = computed(() => forwardFilterOptions(props.view.groups, filters.cloud))
const filtered = computed(() => filterForwardGroups(props.view.groups, filters))

/** 云切换级联：产品/集群选项变化后不在集合内的选择回退为「全部」 */
function onCloudChange() {
    if (filters.product && !options.value.products.includes(filters.product)) filters.product = ''
    if (filters.cluster && !options.value.clusters.includes(filters.cluster)) filters.cluster = ''
}

// ==================== 分组折叠（默认展开前 2 组；筛选变化重置为新结果前 2 组） ====================

function groupKey(g: CertReferenceGroup): string {
    return `${g.cloud}|${g.product}|${g.clusterId ?? ''}`
}

const expandedKeys = ref(new Set<string>())

function resetExpanded() {
    expandedKeys.value = new Set(filtered.value.slice(0, 2).map(groupKey))
}

function isExpanded(g: CertReferenceGroup): boolean {
    return expandedKeys.value.has(groupKey(g))
}

function toggle(g: CertReferenceGroup) {
    const key = groupKey(g)
    const next = new Set(expandedKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expandedKeys.value = next
}

watch(
    () => [filters.cloud, filters.product, filters.cluster, filters.keyword],
    () => resetExpanded(),
)
resetExpanded()

/** K8s 引用行的账号列：accountKey 缺省时展示 命名空间 · Kind */
function accountCell(item: CertReferenceItem): string {
    if (item.accountKey) return item.accountKey
    if (item.namespace) return item.kind ? `${item.namespace} · ${item.kind}` : item.namespace
    return '—'
}

/** aria-live 通告文��（筛选状态变化；高频输入经防抖后仅按结果态通告一次） */
const announceText = computed(() => {
    const hasFilter =
        filters.cloud || filters.product || filters.cluster || filters.keyword.trim()
    if (!filtered.value.length) return hasFilter ? '无匹配引用' : '暂无引用分组'
    const rows = filtered.value.reduce((n, g) => n + g.references.length, 0)
    return `${filtered.value.length} 组 ${rows} 条引用`
})
</script>

<style lang="scss" scoped>
.forward-refs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// Hard Rule：盲区横幅常驻（无关闭钮，Warning 底色）
.blind-banner {
  display: flex;
  gap: 10px;
  border: 1px solid color-mix(in srgb, #f5a623 40%, transparent);
  background: color-mix(in srgb, #f5a623 8%, transparent);
  border-radius: 8px;
  padding: 10px 12px;
}

.banner-icon {
  color: #f5a623;
  font-size: 14px;
}

.banner-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.banner-body {
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;

  &.meta-stale {
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
    background: color-mix(in srgb, #f5a623 6%, transparent);
  }
}

.meta-item {
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-warn-text {
  color: #f5a623;
}

.meta-dot {
  color: var(--text-secondary);
}

.coverage-item {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.coverage-chip {
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-primary);

  &.unavailable {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
  }

  &.lagging {
    color: #f5a623;
  }
}

.meta-spacer {
  flex: 1;
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

.notice-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.notice-blind {
  border-color: color-mix(in srgb, #f5a623 40%, transparent);
  background: color-mix(in srgb, #f5a623 5%, transparent);
}

.notice-icon {
  font-size: 16px;
}

.no-match {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.toolbar-select {
  width: 160px;
}

.toolbar-search {
  width: 280px;
  margin-left: auto;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.accordion-item {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;

  & + & {
    margin-top: 8px;
  }
}

.accordion-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent, #0070f3);
    outline-offset: -2px;
  }

  .chevron {
    transition: transform 150ms ease;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .open & .chevron {
    transform: rotate(90deg);
  }
}

.count-badge {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
  border: 1px solid var(--border-base);
  border-radius: 999px;
  padding: 0 8px;
}

.accordion-body {
  border-top: 1px solid var(--border-base);
  transition: height 150ms ease;
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
}

.clickable-row {
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent, #0070f3);
    outline-offset: -2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .accordion-header .chevron,
  .accordion-body {
    transition: none;
  }

  .spinner {
    animation: none;
  }
}
</style>
