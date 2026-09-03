<template>
  <div class="cert-ledger-page" aria-labelledby="cert-ledger-title">
    <div class="page-header">
      <h1 id="cert-ledger-title" class="page-title">证书台账</h1>
      <div class="page-actions">
        <el-button @click="discoveryModal?.open()">从云端导入</el-button>
        <el-button @click="batchModal?.open()">批量导入</el-button>
        <el-button type="primary" @click="importModal?.open()">导入证书</el-button>
      </div>
    </div>

    <div aria-live="polite">
      <!-- Loading：骨架屏（3 卡 + 5 行），800ms 内返回则直接渲染（不闪骨架） -->
      <template v-if="pageState === 'loading'">
        <div v-if="skeletonVisible" class="stats-grid-skeleton" aria-hidden="true">
          <div v-for="i in 3" :key="i" class="skeleton-card" />
        </div>
        <div v-if="skeletonVisible" class="table-skeleton" aria-hidden="true">
          <div v-for="i in 5" :key="i" class="skeleton-row" />
        </div>
        <div v-else class="loading-placeholder" aria-label="加载中" />
      </template>

      <!-- Empty：空态引导（从云端导入存量证书优先 + 批量上传兜底） -->
      <div v-else-if="pageState === 'empty'" class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">🔐</div>
          <div class="state-title">暂无证书</div>
          <div class="state-desc">尚未导入任何证书，可从云端发现并导入存量证书，或批量上传 PEM 文件完成首次登记。</div>
          <div class="state-cta-group">
            <el-button type="primary" class="state-cta" @click="discoveryModal?.open()">从云端导入存量证书</el-button>
            <el-button class="state-cta" @click="batchModal?.open()">批量上传 PEM 文件</el-button>
          </div>
        </div>
      </div>

      <!-- Error：错误 + 重试 -->
      <div v-else-if="pageState === 'error'" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">证书列表加载失败</div>
          <div class="state-desc">证书台账服务暂时不可用，请稍后重试。</div>
          <el-button class="state-cta" @click="refreshAll">重试</el-button>
        </div>
      </div>

      <!-- Populated：统计卡 + 表格 -->
      <template v-else>
        <StatsCards :stats="stats" :stats-error="statsError" />
        <CertTable
          class="table-block"
          :rows="rows"
          :total="total"
          :page="page"
          :page-size="pageSize"
          :disabled="listLoading"
          :highlight-id="highlightId"
          @query-change="onQueryChange"
          @page-change="onPageChange"
          @row-click="goDetail"
          @view="goDetail"
          @initiate-change="goChangeWizard"
          @supply-key="openSupplyKey"
          @delete="onDelete"
        />
      </template>
    </div>

    <ImportCertModal ref="importModal" @imported="onImported" />
    <BatchImportModal ref="batchModal" @completed="refreshAll" />
    <UploadKeyModal ref="keyModal" @upgraded="refreshAll" />
    <!-- 从云端导入（独立组件）：预览/勾选/引导（任务 6/8）+ 导入进度轮询（任务 7）；终态完成即刷新台账（新增登记项立即可见） -->
    <DiscoveryImportModal ref="discoveryModal" @completed="refreshAll" />

    <!-- 删除拦截 Modal：仅说明原因（N 个引用 / 保护期至 X 日），无删除按钮 -->
    <el-dialog
      v-model="deleteIntercept.visible"
      title="无法删除"
      width="480px"
      align-center
      class="cert-modal"
      aria-labelledby="delete-intercept-title"
    >
      <template #header>
        <h3 id="delete-intercept-title" class="modal-title">无法删除</h3>
      </template>
      <div class="intercept-banner" role="alert">
        <span class="intercept-icon" aria-hidden="true">🔒</span>
        <div>
          <div class="intercept-title">该证书存在活跃引用或处于回滚保护期</div>
          <div class="intercept-body">{{ deleteIntercept.summary }}</div>
          <div class="intercept-hint">请先解除引用或等待保护期结束后再删除。</div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="deleteIntercept.visible = false">知道了</el-button>
      </template>
    </el-dialog>

    <!-- 删除二次确认 Modal（红色后果说明） -->
    <el-dialog
      v-model="deleteConfirm.visible"
      title="确认删除证书"
      width="480px"
      align-center
      class="cert-modal"
      :close-on-click-modal="!deleteConfirm.deleting"
      :close-on-press-escape="!deleteConfirm.deleting"
      :show-close="!deleteConfirm.deleting"
      aria-labelledby="delete-confirm-title"
    >
      <template #header>
        <h3 id="delete-confirm-title" class="modal-title">确认删除证书</h3>
      </template>
      <div class="confirm-banner" role="alert">
        <span class="confirm-icon" aria-hidden="true">✗</span>
        <div>
          <div class="confirm-title">该操作不可逆</div>
          <div class="confirm-body">
            删除后证书及其指纹记录将永久移除，无法恢复。确认删除 {{ deleteConfirm.row?.commonName }}？
          </div>
        </div>
      </div>
      <template #footer>
        <el-button :disabled="deleteConfirm.deleting" @click="deleteConfirm.visible = false">取消</el-button>
        <el-button type="danger" :loading="deleteConfirm.deleting" @click="confirmDelete">确认删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 证书台账页（UF-1，任务 6.2）：/certs，菜单「证书管理 › 证书台账」。
 * 只读角色不可达（6.1 路由守卫 certManageOnly 拦截）。
 *
 * 四态（loading 骨架 [3 卡+5 行，800ms 内直接渲染] / empty 引导批量导入 / error 重试 /
 * populated）；统计卡 GET /certs/stats；列表 GET /certs 服务端分页（20/页）+ 搜索/筛选；
 * 导入/批量导入/补传私钥/删除拦截（行级预判 + 服务端 409 CERT_HAS_REFS 结构化 meta 双保险）。
 * 服务端列表排序为 notAfter asc（到期优先），「新证书置顶」按 API 可达语义实现为
 * 刷新 + 行高亮（accent 描边），Toast 附指纹。
 */
import type { CertListItem, CertStats, DaysLeftTier, HostingStatus } from '@/api/cert'
import { CertRequestError, deleteCertApi, getCertStatsApi, listCertsApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import BatchImportModal from './components/BatchImportModal.vue'
import CertTable from './components/CertTable.vue'
import DiscoveryImportModal from './components/DiscoveryImportModal.vue'
import ImportCertModal from './components/ImportCertModal.vue'
import StatsCards from './components/StatsCards.vue'
import UploadKeyModal from './components/UploadKeyModal.vue'
import { canDeleteRow, deleteBlockedSummary, resolvePageState, type DeleteBlockedMeta } from './format'

const router = useRouter()

const rows = ref<CertListItem[]>([])
const total = ref(0)
const stats = ref<CertStats | null>(null)
const statsError = ref(false)
const page = ref(1)
const pageSize = 20
const search = ref('')
const hostingStatus = ref<HostingStatus | ''>('')
const daysLeft = ref<DaysLeftTier | ''>('')
const listLoading = ref(true)
const loadError = ref(false)
const highlightId = ref<string | null>(null)
const skeletonVisible = ref(false)

const importModal = ref<InstanceType<typeof ImportCertModal> | null>(null)
const batchModal = ref<InstanceType<typeof BatchImportModal> | null>(null)
const keyModal = ref<InstanceType<typeof UploadKeyModal> | null>(null)
const discoveryModal = ref<InstanceType<typeof DiscoveryImportModal> | null>(null)

const deleteIntercept = reactive({ visible: false, summary: '' })
const deleteConfirm = reactive({ visible: false, row: null as CertListItem | null, deleting: false })

/** 骨架延迟（全局模式：800ms 内返回则直接渲染） */
const SKELETON_DELAY_MS = 800
let skeletonTimer: ReturnType<typeof setTimeout> | null = null
let highlightTimer: ReturnType<typeof setTimeout> | null = null

const pageState = computed(() =>
    resolvePageState({ loading: listLoading.value && rows.value.length === 0, error: loadError.value, total: total.value }),
)

function beginSkeletonTimer() {
    skeletonVisible.value = false
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = setTimeout(() => {
        if (listLoading.value) skeletonVisible.value = true
    }, SKELETON_DELAY_MS)
}

function endSkeletonTimer() {
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = null
    skeletonVisible.value = false
}

async function fetchList() {
    listLoading.value = true
    loadError.value = false
    beginSkeletonTimer()
    try {
        const res = await listCertsApi({
            page: page.value,
            pageSize,
            ...(search.value ? { search: search.value } : {}),
            ...(hostingStatus.value ? { hostingStatus: hostingStatus.value } : {}),
            ...(daysLeft.value ? { daysLeft: daysLeft.value } : {}),
        })
        rows.value = res.items
        total.value = res.total
    } catch (err) {
        loadError.value = true
        // 已有数据的刷新失败不塌陷页面（resolvePageState 维持 populated），以 Toast 提示
        if (rows.value.length > 0) {
            ElMessage.error(err instanceof Error ? err.message : '证书列表刷新失败')
        }
    } finally {
        listLoading.value = false
        endSkeletonTimer()
    }
}

async function fetchStats() {
    try {
        stats.value = await getCertStatsApi()
        statsError.value = false
    } catch (err) {
        // 统计卡加载失败：保留「-」占位（列表仍可用，不塌陷页面），但必须显式反馈，
        // 避免三张统计卡静默降级为「-」被误读为「数据为零」
        stats.value = null
        statsError.value = true
        console.error('[cert-ledger] 统计加载失败:', err)
        ElMessage.error(err instanceof Error && err.message ? err.message : '统计加载失败')
    }
}

function refreshAll() {
    page.value = 1
    void fetchList()
    void fetchStats()
}

function onQueryChange(q: { search?: string; hostingStatus?: HostingStatus | ''; daysLeft?: DaysLeftTier | '' }) {
    search.value = q.search ?? ''
    hostingStatus.value = q.hostingStatus ?? ''
    daysLeft.value = q.daysLeft ?? ''
    page.value = 1
    void fetchList()
}

function onPageChange(p: number) {
    page.value = p
    void fetchList()
}

function goDetail(row: CertListItem) {
    void router.push(`/certs/${row.id}`)
}

function goChangeWizard(row: CertListItem) {
    void router.push(`/certs/changes/new?certId=${encodeURIComponent(row.id)}`)
}

function openSupplyKey(row: CertListItem) {
    keyModal.value?.open(row)
}

function onImported(payload: { certId: string; fingerprint: string }) {
    // 列表刷新 + 新证书行高亮（服务端 notAfter asc 排序，置顶以高亮提示替代）
    refreshAll()
    highlightId.value = payload.certId
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
        highlightId.value = null
    }, 5000)
}

function onDelete(row: CertListItem) {
    if (canDeleteRow(row)) {
        deleteConfirm.row = row
        deleteConfirm.visible = true
    } else {
        // 行级预判拦截：有活跃引用 / 保护期内 → 仅说明原因，无删除按钮
        deleteIntercept.summary = deleteBlockedSummary({
            refCount: row.refCount,
            protectUntil: row.protectUntil ?? undefined,
        })
        deleteIntercept.visible = true
    }
}

async function confirmDelete() {
    const row = deleteConfirm.row
    if (!row || deleteConfirm.deleting) return
    deleteConfirm.deleting = true
    try {
        await deleteCertApi(row.id)
        ElMessage.success('证书已删除')
        deleteConfirm.visible = false
        deleteConfirm.row = null
        refreshAll()
    } catch (err) {
        if (err instanceof CertRequestError && err.code === 'CERT_HAS_REFS') {
            // 服务端拦截（含 blind_spot 行级不可见的原因）：切换为拦截 Modal 展示结构化原因
            deleteConfirm.visible = false
            deleteIntercept.summary = deleteBlockedSummary(err.meta as DeleteBlockedMeta | undefined)
            deleteIntercept.visible = true
        } else {
            ElMessage.error(err instanceof Error ? err.message : '删除失败，请重试')
        }
    } finally {
        deleteConfirm.deleting = false
    }
}

onMounted(() => {
    refreshAll()
})

onUnmounted(() => {
    endSkeletonTimer()
    if (highlightTimer) clearTimeout(highlightTimer)
})
</script>

<style lang="scss" scoped>
// ===== Vercel 设计 token（ui-design Design System）+ Element Plus 变量对齐 =====
.cert-ledger-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
  --cert-success: #50e3c2;
  --cert-warning: #f5a623;
  --cert-warning-deep: #d98c0a;
  --cert-error: #ee0000;
  --cert-surface-alt: rgba(255, 255, 255, 0.05);
  --cert-highlight-bg: rgba(0, 112, 243, 0.08);
  --cert-font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  // Element Plus 主题对齐（仅本页作用域）
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

  // 无障碍：可见 focus ring（2px accent + 2px offset）
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

.page-actions {
  display: flex;
  gap: 8px;
}

.table-block {
  margin-top: 16px;
}

// ===== 骨架屏（loading 态：3 卡 + 5 行） =====
.stats-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.skeleton-card {
  height: 120px;
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

.state-cta-group {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

// ===== 删除拦截 / 二次确认横幅 =====
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.intercept-banner {
  display: flex;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cert-warning) 40%, transparent);
  background: color-mix(in srgb, var(--cert-warning) 8%, transparent);
  border-radius: 8px;
  padding: 12px;
}

.intercept-icon {
  font-size: 16px;
}

.intercept-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.intercept-body {
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.intercept-hint {
  font-size: 12px;
  color: var(--text-secondary);
}

.confirm-banner {
  display: flex;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--cert-error) 40%, transparent);
  background: color-mix(in srgb, var(--cert-error) 10%, transparent);
  border-radius: 8px;
  padding: 12px;
}

.confirm-icon {
  color: var(--cert-error);
  font-weight: 700;
}

.confirm-title {
  font-weight: 600;
  color: var(--cert-error);
  margin-bottom: 4px;
}

.confirm-body {
  font-size: 13px;
  color: var(--text-primary);
}

// 动效偏好：reduce 时禁用过渡与骨架动画
@media (prefers-reduced-motion: reduce) {
  .skeleton-card::after,
  .skeleton-row::after {
    animation: none;
  }
}
</style>
