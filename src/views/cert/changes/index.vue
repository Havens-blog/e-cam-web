<template>
  <div class="cert-changes-page" aria-labelledby="cert-changes-title">
    <div class="page-header">
      <h1 id="cert-changes-title" class="page-title">变更管理</h1>
      <div class="header-actions">
        <el-button
          v-if="settingsVisible"
          tag="router-link"
          to="/certs/settings"
          class="btn-secondary"
        >
          配置
        </el-button>
        <el-button tag="router-link" to="/certs/changes/new" type="primary">新建变更</el-button>
      </div>
    </div>

    <div aria-live="polite">
      <!-- Loading：5 行骨架 -->
      <template v-if="pageState === 'loading'">
        <div class="table-skeleton" aria-hidden="true">
          <div v-for="i in 5" :key="i" class="skeleton-row" />
        </div>
      </template>

      <!-- Empty：暂无变更单 + 新建变更 CTA -->
      <div v-else-if="pageState === 'empty'" class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">🔄</div>
          <div class="state-title">暂无变更单</div>
          <div class="state-desc">尚未发起任何证书变更，可从台账或此处新建变更。</div>
          <el-button class="state-cta" tag="router-link" to="/certs/changes/new" type="primary">
            新建变更
          </el-button>
        </div>
      </div>

      <!-- Error：卡内错误提示 + 重试 -->
      <div v-else-if="pageState === 'error'" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">变更列表加载失败</div>
          <div class="state-desc">变更服务暂时不可用，请稍后重试。</div>
          <el-button class="state-cta" @click="refresh">重试</el-button>
        </div>
      </div>

      <!-- Populated：状态 Tab + 表格 -->
      <template v-else>
        <StatusTabs v-model="activeTab" :counts="counts" />
        <ChangeTable
          class="table-block"
          :rows="shownRows"
          :progress-map="progressMap"
          @row-click="onRowClick"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 变更管理列表页（UF-4，任务 6.5）：/certs/changes，菜单「证书管理 › 变更管理」。
 *
 * 四态（loading 5 行骨架 / empty「暂无变更单」+新建变更 CTA / error 重试 / populated）；
 * 状态 Tab 全集（待确认含草稿；已回滚/回滚失败合并，行徽章区分），Tab 计数与过滤
 * 客户端执行（合并 Tab 需全集数据）。执行中/验证中行 10s 轮询：刷新列表 +
 * 逐活跃行拉取 progress 派生「成功/失败/总数」进度（列表 VO 不含进度字段的
 * 派生策略见 ../format.ts 头注）。配置入口仅主管可见（cert:settings）。
 * 行点击：草稿/待确认 → 向导恢复编辑；其余 → 报告详情页。
 */
import type { ChangeOrder } from '@/api/cert'
import { getChangeProgressApi, listChangesApi } from '@/api/cert'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { hasCertSettingsAccess } from '@/utils/cert-permission'
import { resolvePageState } from '../ledger/format'
import ChangeTable from './components/ChangeTable.vue'
import StatusTabs from './components/StatusTabs.vue'
import type { ChangeTabKey, ExecProgress } from './format'
import { filterRowsByTab, isActiveRowStatus, summarizeProgress, tabCounts } from './format'

const router = useRouter()
const userStore = useUserStore()

const rows = ref<ChangeOrder[]>([])
const loading = ref(true)
const loadError = ref(false)
const activeTab = ref<ChangeTabKey>('all')
/** id → 进度汇总（活跃行轮询派生；终态行首屏一次性补齐） */
const progressMap = ref<Record<string, ExecProgress>>({})

/** 列表 10s 轮询间隔（Implementation Notes：列表 10s） */
const LIST_POLL_MS = 10_000
let pollTimer: ReturnType<typeof setInterval> | null = null

/** 配置入口仅主管/审计（ui-design 列表页头；授权码对齐点 cert-permission.ts） */
const settingsVisible = computed(() =>
    hasCertSettingsAccess({ isAdmin: userStore.isAdmin, permissions: userStore.permissions }),
)

const counts = computed(() => tabCounts(rows.value))

const shownRows = computed(() => filterRowsByTab(rows.value, activeTab.value))

/** 活跃行（执行中/验证中）—— 10s 轮询对象 */
const activeRows = computed(() => rows.value.filter((r) => isActiveRowStatus(r.status)))

const pageState = computed(() =>
    resolvePageState({ loading: loading.value && rows.value.length === 0, error: loadError.value, total: rows.value.length }),
)

async function refresh() {
    loading.value = true
    loadError.value = false
    try {
        const res = await listChangesApi({ page: 1, pageSize: 200 })
        rows.value = res.items
        // 终态/待确认行进度一次性补齐（活跃行交给轮询）
        await fillProgress(
            res.items.filter((r) => !isActiveRowStatus(r.status)).map((r) => r.id),
        )
    } catch {
        loadError.value = true
    } finally {
        loading.value = false
    }
}

/** 并行拉取行进度派生计数（失败静默——进度列回退批次文案） */
async function fillProgress(ids: string[]) {
    if (ids.length === 0) return
    const results = await Promise.allSettled(ids.map((id) => getChangeProgressApi(id)))
    const next = { ...progressMap.value }
    results.forEach((r, i) => {
        const id = ids[i]
        if (id !== undefined && r.status === 'fulfilled') {
            next[id] = summarizeProgress(r.value.itemStates)
        }
    })
    progressMap.value = next
}

/** 10s tick：有活跃行才轮询（列表刷新捕捉状态迁移 + 活跃行进度派生） */
async function pollTick() {
    if (activeRows.value.length === 0) return
    try {
        const res = await listChangesApi({ page: 1, pageSize: 200 })
        rows.value = res.items
        await fillProgress(res.items.filter((r) => isActiveRowStatus(r.status)).map((r) => r.id))
    } catch {
        /* 轮询失败静默，下个 tick 重试 */
    }
}

function startPolling() {
    stopPolling()
    pollTimer = setInterval(() => void pollTick(), LIST_POLL_MS)
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
}

function onRowClick(row: ChangeOrder) {
    void router.push(
        row.status === 'draft' || row.status === 'pending_confirm'
            ? `/certs/changes/new?orderId=${encodeURIComponent(row.id)}`
            : `/certs/changes/${row.id}`,
    )
}

onMounted(() => {
    void refresh()
    startPolling()
})

onUnmounted(stopPolling)
</script>

<style lang="scss" scoped>
// ===== Vercel 设计 token（同台账/看板页约定） =====
.cert-changes-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
  --cert-success: #50e3c2;
  --cert-warning: #f5a623;
  --cert-error: #ee0000;
  --cert-surface-alt: rgba(255, 255, 255, 0.05);
  --cert-font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

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

.header-actions {
  display: flex;
  gap: 8px;
}

.table-block {
  margin-top: 4px;
}

.table-skeleton {
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
    animation: chg-skeleton-wave 1.2s ease-in-out infinite;
  }
}

@keyframes chg-skeleton-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

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
  .skeleton-row::after {
    animation: none;
  }
}
</style>

<style lang="scss">
/* cert 模块统一按钮样式钩子（audit cert-1 H2）：btn-secondary / btn-ghost 原为无定义空挂 class，
   弹窗玻璃风格已由全局 .el-dialog 覆盖。见 src/views/cert/styles/ui-classes.scss */
@import '@/views/cert/styles/ui-classes.scss';
</style>
