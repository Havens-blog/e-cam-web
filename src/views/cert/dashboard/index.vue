<template>
  <div class="cert-dashboard-page" aria-labelledby="cert-dashboard-title">
    <div class="page-header">
      <h1 id="cert-dashboard-title" class="page-title">到期看板</h1>
    </div>

    <!-- a11y：筛选变化通告（AC6，aria-live polite；视觉隐藏） -->
    <div class="sr-only" aria-live="polite">{{ announcement }}</div>

    <div aria-live="polite">
      <!-- Loading：卡骨架 + 表骨架（800ms 内返回直接渲染，不闪骨架） -->
      <template v-if="pageState === 'loading'">
        <div v-if="skeletonVisible" class="cards-skeleton" aria-hidden="true">
          <div v-for="i in 5" :key="`lv-${i}`" class="skeleton-card" />
        </div>
        <div v-if="skeletonVisible" class="cards-skeleton two" aria-hidden="true">
          <div v-for="i in 2" :key="`sp-${i}`" class="skeleton-card" />
        </div>
        <div v-if="skeletonVisible" class="table-skeleton" aria-hidden="true">
          <div v-for="i in 5" :key="i" class="skeleton-row" />
        </div>
        <div v-else class="loading-placeholder" aria-label="加载中" />
      </template>

      <!-- Empty：暂无证书，等待导入（只读无操作入口，无导入 CTA） -->
      <div v-else-if="pageState === 'empty'" class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">📋</div>
          <div class="state-title">暂无证书，等待导入</div>
          <div class="state-desc">尚未登记任何证书，到期与探测数据为空。</div>
        </div>
      </div>

      <!-- Error：错误提示 + 重试 -->
      <div v-else-if="pageState === 'error'" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">看板数据加载失败</div>
          <div class="state-desc">台账 / 探测数据服务暂时不可用，请稍后重试。</div>
          <el-button class="state-cta" @click="refresh">重试</el-button>
        </div>
      </div>

      <!-- Populated：总览卡 + 筛选 + 表格 -->
      <template v-else>
        <OverviewCards
          :summary="data?.summary ?? null"
          :selected-level="filter.level"
          :selected-special="filter.special"
          @select-level="onLevelCard"
          @select-special="onSpecialCard"
        />
        <DashboardTable
          class="table-block"
          :rows="shownItems"
          :items="items"
          :filter="filter"
          :disabled="false"
          :hidden-count="data?.summary.hiddenCount ?? 0"
          :last-inspection-at="data?.lastInspectionAt ?? null"
          :wildcard-skipped-count="data?.summary.wildcardSkippedCount ?? 0"
          @filter-change="onFilterChange"
          @row-click="openDrawer"
          @show-all-change="onShowAllChange"
        />
      </template>
    </div>

    <!-- 子域名探测详情抽屉（全角色只读：复制摘要 + 查看详情） -->
    <ProbeDetailDrawer v-model:visible="drawerVisible" :item="drawerItem" />
  </div>
</template>

<script setup lang="ts">
/**
 * 到期看板页（UF-3，任务 6.4）：/certs/dashboard，菜单「证书管理 › 到期看板」。
 * 全角色可见（只读查看者的默认页与唯一菜单入口）。
 *
 * 四态（loading 骨架 [7 卡+5 行，800ms 内直接渲染] / empty「暂无证书，等待导入」 /
 * error 重试 / populated）；数据 GET /certs/dashboard（summary+items+lastInspectionAt）；
 * 5 级总览卡 + 差异/豁免次级卡与工具栏三维筛选（状态分级/云多选/托管类型）全部
 * 客户端过滤，filter 为唯一状态源（卡片与下拉联动，选中卡 Accent 高亮再点取消）；
 * 分级卡/特殊卡激活即按总规则豁免孤儿隐藏（风险维度经任务 2 状态机强制
 * includeHidden 重拉，属性维度不豁免）；筛选状态同步 URL query 保留深链
 * （弥合移除跳台账跳转）。筛选变化经 aria-live polite 通告（AC6）。
 * 行点击 → 探测详情抽屉。
 *
 * Hard Rule：本页无任何变更类操作入口（扫描/发起更换/配置），差异告警由巡检
 * 自动触达，只读者无需人工上报。
 */
import type { CertDashboardResponse, CertProbeResult, DashboardItem, DaysLeftTier } from '@/api/cert'
import { getCertDashboardApi, getCertProbesApi } from '@/api/cert'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardTable from './components/DashboardTable.vue'
import OverviewCards from './components/OverviewCards.vue'
import ProbeDetailDrawer from './components/ProbeDetailDrawer.vue'
import {
    EMPTY_DASHBOARD_FILTER,
    filterAnnouncement,
    filterDashboardItems,
    filterFromQuery,
    filterToQuery,
    loadHiddenExpanded,
    type DashboardFilter,
} from './format'
import { resolvePageState } from '../ledger/format'

const data = ref<CertDashboardResponse | null>(null)
const loading = ref(true)
const loadError = ref(false)
const skeletonVisible = ref(false)
const filter = ref<DashboardFilter>({ ...EMPTY_DASHBOARD_FILTER })
const announcement = ref('')
const drawerVisible = ref(false)
const drawerItem = ref<DashboardItem | null>(null)
const router = useRouter()
const route = useRoute()

/**
 * 豁免接线（任务 2）：生效 includeHidden = 开关持久化态初始；开关切换/风险维度卡
 * 豁免（子组件状态机经 show-all-change 上抛，含强制开启与清除恢复）变化时重拉全量。
 * 隐藏判定始终在服务端执行，前端不派生三态。
 */
function safeLocalStorage(): Storage | null {
    try {
        return window.localStorage
    } catch {
        return null
    }
}

const includeHidden = ref(loadHiddenExpanded(safeLocalStorage()))

/** 骨架延迟（全局模式：800ms 内返回则直接渲染） */
const SKELETON_DELAY_MS = 800
let skeletonTimer: ReturnType<typeof setTimeout> | null = null

const items = computed(() => data.value?.items ?? [])

/**
 * 逐 SAN 探测明细（特殊卡谓词数据源，GET /certs/probes LatestPerDomain 按 SAN 映射）：
 * 明细在位时 diff/exempt 特殊卡按「存在任一 SAN 为该状态」筛出证书行（exempt 等
 * 低优先态被行聚合徽标更差态掩盖仍可筛中）；加载失败降级行徽标相等，不塌陷。
 */
const probeByDomain = ref<ReadonlyMap<string, CertProbeResult>>(new Map())

async function loadProbes() {
    try {
        const probes = await getCertProbesApi()
        const map = new Map<string, CertProbeResult>()
        for (const p of probes) map.set(p.domain, p)
        probeByDomain.value = map
    } catch {
        probeByDomain.value = new Map()
    }
}

const shownItems = computed(() => filterDashboardItems(items.value, filter.value, probeByDomain.value))

const pageState = computed(() =>
    resolvePageState({
        loading: loading.value && items.value.length === 0,
        error: loadError.value,
        total: items.value.length,
    }),
)

function beginSkeletonTimer() {
    skeletonVisible.value = false
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = setTimeout(() => {
        if (loading.value) skeletonVisible.value = true
    }, SKELETON_DELAY_MS)
}

function endSkeletonTimer() {
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = null
    skeletonVisible.value = false
}

async function refresh() {
    loading.value = true
    loadError.value = false
    beginSkeletonTimer()
    try {
        data.value = await getCertDashboardApi({ includeHidden: includeHidden.value || undefined })
    } catch {
        loadError.value = true
        // 已有数据的刷新失败不塌陷页面（resolvePageState 维持 populated）
    } finally {
        loading.value = false
        endSkeletonTimer()
    }
}

/** 开关/豁免强制（子组件状态机）变化：生效视图变化才以 includeHidden 重拉 */
function onShowAllChange(showAll: boolean) {
    if (showAll === includeHidden.value) return
    includeHidden.value = showAll
    void refresh()
}

/**
 * 状态分级卡：页内筛选（选中高亮、再点取消）——filter 单一状态源，与工具栏下拉
 * 同一状态；激活即风险维度豁免（任务 2 状态机强制 includeHidden 重拉，主表行数
 * == 该档 countsByLevel 总计数），清除恢复原开关态。
 */
function onLevelCard(tier: DaysLeftTier) {
    filter.value = { ...filter.value, level: filter.value.level === tier ? '' : tier }
}

/** 差异告警卡 / 豁免卡：点击选中 / 再点取消（同为风险维度豁免触发器） */
function onSpecialCard(kind: 'diff' | 'exempt') {
    filter.value = { ...filter.value, special: filter.value.special === kind ? '' : kind }
}

function onFilterChange(patch: Partial<DashboardFilter>) {
    filter.value = { ...filter.value, ...patch }
}

function openDrawer(row: DashboardItem) {
    drawerItem.value = row
    drawerVisible.value = true
}

// 筛选变化 → aria-live 通告（shown/total 计数）
watch(
    [filter, shownItems],
    () => {
        announcement.value = filterAnnouncement(filter.value, shownItems.value.length, items.value.length)
    },
    { deep: true },
)

// ===== 筛选状态 ⇄ URL query（深链保留，弥合移除跳台账跳转） =====

const QUERY_KEYS = ['level', 'clouds', 'hosting', 'special'] as const

/** 深链恢复：mount 时由 URL query 初始化筛选（在首拉前，通知与豁免状态机口径一致） */
function restoreFilterFromQuery() {
    filter.value = { ...EMPTY_DASHBOARD_FILTER, ...filterFromQuery(route.query) }
}

// 筛选变化 → URL query 同步（replace 不产生历史噪音；与当前 query 一致时跳过）
watch(
    filter,
    (f) => {
        const next = filterToQuery(f)
        const current: Record<string, string> = {}
        for (const key of QUERY_KEYS) {
            const v = route.query[key]
            if (typeof v === 'string' && v !== '') current[key] = v
        }
        if (JSON.stringify(current) === JSON.stringify(next)) return
        const query = { ...route.query }
        for (const key of QUERY_KEYS) delete query[key]
        Object.assign(query, next)
        void router.replace({ query })
    },
    { deep: true },
)

onMounted(() => {
    restoreFilterFromQuery()
    void refresh()
    void loadProbes()
})

onUnmounted(() => {
    endSkeletonTimer()
})
</script>

<style lang="scss" scoped>
// ===== Vercel 设计 token（ui-design Design System）+ Element Plus 变量对齐（同台账页） =====
.cert-dashboard-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
  --cert-success: #50e3c2;
  --cert-warning: #f5a623;
  --cert-error: #ee0000;
  --cert-surface-alt: rgba(255, 255, 255, 0.05);
  --cert-font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --el-color-primary: var(--cert-accent);
  --el-color-primary-light-3: #3291ff;
  --el-color-primary-light-5: #66aaff;
  --el-color-primary-light-7: #99c8ff;
  --el-color-primary-light-8: #b3d6ff;
  --el-color-primary-light-9: #cce4ff;
  --el-color-primary-dark-2: #0058bd;
  --el-color-success: var(--cert-success);
  --el-color-warning: var(--cert-warning);
  --el-color-danger: var(--cert-error);
  --el-border-radius-base: 6px;

  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;

  :focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: 2px;
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.table-block {
  margin-top: 16px;
}

// ===== 视觉隐藏（aria-live 通告区） =====
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// ===== 骨架屏（loading 态：5+2 卡 + 5 行） =====
.cards-skeleton {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;

  &.two {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);

    &.two {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;

    &.two {
      grid-template-columns: 1fr;
    }
  }

  & + .cards-skeleton {
    margin-top: 16px;
  }
}

.skeleton-card {
  height: 108px;
  border-radius: 12px;
  background: var(--cert-surface-alt);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: cert-skeleton-wave 1.2s ease-in-out infinite;
  }
}

.table-skeleton {
  margin-top: 16px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  overflow: hidden;
}

.skeleton-row {
  height: 56px;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }

  position: relative;
  overflow: hidden;
  background: var(--cert-surface-alt);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: cert-skeleton-wave 1.2s ease-in-out infinite;
  }
}

@keyframes cert-skeleton-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.loading-placeholder {
  min-height: 420px;
}

// ===== 空态 / 错误态 =====
.state-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 64px 24px;
  text-align: center;
}

.state-icon {
  font-size: 40px;
  line-height: 1;
}

.state-icon-error {
  color: var(--cert-error);
}

.state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.state-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.state-cta {
  margin-top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-card::after,
  .skeleton-row::after {
    animation: none;
  }
}
</style>
