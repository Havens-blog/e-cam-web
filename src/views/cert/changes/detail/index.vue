<template>
  <div class="cert-change-report-page" aria-labelledby="report-title">
    <!-- 面包屑：变更管理 / CHG-XXXX -->
    <nav class="breadcrumb" aria-label="面包屑">
      <router-link to="/certs/changes">变更管理</router-link>
      <span class="sep" aria-hidden="true">/</span>
      <span class="current mono" aria-current="page">{{ orderId }}</span>
    </nav>

    <div aria-live="polite">
      <!-- Loading：页头 + 5 卡骨架 -->
      <template v-if="loading && !detail">
        <div class="card skeleton-head" aria-hidden="true">
          <div class="skeleton-line" />
          <div class="skeleton-line short" />
        </div>
        <div v-for="i in 3" :key="i" class="card skeleton-card" aria-hidden="true">
          <div class="skeleton-line" />
          <div class="skeleton-line short" />
        </div>
      </template>

      <!-- Error：整卡重试 -->
      <div v-else-if="!detail" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">报告加载失败</div>
          <div class="state-desc">报告服务暂时不可用；恢复态轮询将自动退避重试（2s→10s），不中断。</div>
          <el-button class="state-cta" @click="refresh">重试</el-button>
        </div>
      </div>

      <template v-else>
        <!-- 页头：单号 + 状态徽章 + 旧→新指纹 + 导出 + 执行剩余批 -->
        <div class="page-header">
          <div>
            <h1 id="report-title" class="page-title">
              <span class="mono">{{ detail.orderId }}</span>
              <span
                class="chg-badge"
                :class="`tone-${changeStatusMeta(detail.status).tone}`"
              >
                <span v-if="changeStatusMeta(detail.status).spinner" class="spinner" aria-hidden="true" />
                <span v-else class="badge-icon" aria-hidden="true">{{ changeStatusMeta(detail.status).icon }}</span>
                {{ changeStatusMeta(detail.status).label }}
              </span>
            </h1>
            <div class="header-meta">
              <span class="mono meta-fp" :title="detail.oldFingerprint">{{ truncateMiddle(detail.oldFingerprint) }}</span>
              <span aria-hidden="true">→</span>
              <span class="mono meta-fp" :title="detail.newCertId">{{ truncateMiddle(detail.newCertId) }}</span>
              <el-tooltip content="复制旧证书指纹" placement="top">
                <button type="button" class="btn-icon" aria-label="复制旧证书指纹" @click="copyFp">
                  ⧉
                </button>
              </el-tooltip>
              <span class="text-secondary text-sm">{{ detail.creator }} · {{ formatDate(detail.createdAt) }}</span>
            </div>
          </div>
          <div class="header-actions">
            <el-button class="btn-secondary" @click="exportReport">导出</el-button>
            <el-button
              v-if="remainingEntryVisible && canConfirm"
              class="btn-secondary"
              @click="remainingVisible = true"
            >
              执行剩余批
            </el-button>
          </div>
        </div>

        <!-- 只读恢复区（执行中/验证中内嵌 Step5/Step6；部分完成回滚入口；草稿继续编辑） -->
        <ResumeView
          v-if="resumeActive"
          :order-id="detail.orderId"
          :detail="detail"
          @detail-refresh="onDetailRefresh"
        />

        <!-- 5 卡报告（终态全量；活跃态展示已完成卡[清单]） -->
        <ReportCards
          :items="detail.items"
          :report="detail.report ?? null"
          :orphan-cleanup="detail.report?.orphanCleanup ?? []"
        />

        <!-- 执行剩余批 Modal（人工确认；入口=存在剩余批且首批验证通过） -->
        <RemainingBatchModal
          v-model:visible="remainingVisible"
          :order-id="detail.orderId"
          :remaining-items="remainingItems"
          @resumed="refresh"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 变更报告详情页（UF-4，任务 6.5）：/certs/changes/:id。执行中/验证中单据以
 * 只读恢复视图复用本页（ResumeView 内嵌向导 Step5/Step6 组件，重入轮询自动
 * 恢复）；部分完成[保护期内]回滚入口+保护期徽章；草稿/待确认「继续编辑」
 * 跳向导。5 卡报告（清单/逐项结果[批次+结果筛选]/回滚状态/验证结论[未达标
 * 清单+窗口结论]/孤儿清理）+ 导出（JSON）+ 执行剩余批（人工确认，Hard Rule
 * 确认操作仅工程师——cert:manage 门面 + 后端 EIAM 兜底）。
 */
import type { ChangeDetail } from '@/api/cert'
import { getChangeApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { hasCertManageAccess } from '@/utils/cert-permission'
import { copyText } from '../../ledger/format'
import { changeStatusMeta } from '../../detail/format'
import RemainingBatchModal from '../components/RemainingBatchModal.vue'
import ReportCards from './components/ReportCards.vue'
import ResumeView from './components/ResumeView.vue'
import { resumeMode, truncateMiddle } from '../format'

const route = useRoute()
const userStore = useUserStore()

const orderId = computed(() => String(route.params.id ?? ''))
const detail = ref<ChangeDetail | null>(null)
const loading = ref(true)
const remainingVisible = ref(false)

/** Hard Rule：确认类操作（执行剩余批）仅运维工程师可见可用 */
const canConfirm = computed(() =>
    hasCertManageAccess({ isAdmin: userStore.isAdmin, permissions: userStore.permissions }),
)

/** 恢复区可见（执行中/验证中/部分完成[保护期内]/草稿·待确认提示） */
const resumeActive = computed(() =>
    detail.value ? resumeMode(detail.value.status, detail.value.protectUntil) !== 'none' : false,
)

/** 执行剩余批入口：存在剩余批且首批验证通过（批间暂停） */
const remainingEntryVisible = computed(() => {
    const d = detail.value
    if (!d?.batchInfo) return false
    const bi = d.batchInfo
    return bi.totalBatches > 1 && bi.currentBatch < bi.totalBatches && bi.paused
})

/** 剩余批清单项（batchNo > currentBatch；快照固定仅整批推进） */
const remainingItems = computed(() => {
    const d = detail.value
    if (!d?.batchInfo) return []
    return d.items.filter((it) => it.batchNo > d.batchInfo!.currentBatch)
})

async function refresh() {
    if (!orderId.value) return
    loading.value = !detail.value
    try {
        detail.value = await getChangeApi(orderId.value)
    } catch {
        // 轮询刷新失败不塌陷已渲染报告；首次加载失败显示整卡重试
    } finally {
        loading.value = false
    }
}

function onDetailRefresh(d: ChangeDetail) {
    detail.value = d
}

async function copyFp() {
    if (!detail.value) return
    const ok = await copyText(detail.value.oldFingerprint)
    if (ok) ElMessage.success('已复制')
}

function formatDate(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ')
}

/** 导出报告（JSON；PDF 由后续任务跟进——数据面 JSON 已含全量卡数据） */
function exportReport() {
    if (!detail.value) return
    try {
        const blob = new Blob([JSON.stringify(detail.value, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${detail.value.orderId}-report.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        ElMessage.success('报告导出已开始（JSON）')
    } catch {
        ElMessage.error('报告导出失败，请重试')
    }
}

onMounted(() => {
    void refresh()
})
</script>

<style lang="scss" scoped>
.cert-change-report-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
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

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;

  a {
    color: var(--cert-accent);
    text-decoration: none;

    &:hover {
      color: var(--cert-accent-hover);
    }
  }

  .sep {
    color: var(--text-secondary);
  }

  .current {
    color: var(--text-primary);
  }
}

.mono {
  font-family: var(--cert-font-mono);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.meta-fp {
  font-size: 13px;
  color: var(--text-secondary);
}

.btn-icon {
  appearance: none;
  background: transparent;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  width: 26px;
  height: 26px;
  cursor: pointer;
  line-height: 1;

  &:hover {
    color: var(--text-primary);
    border-color: var(--cert-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent);
    outline-offset: 2px;
  }
}

.header-actions {
  display: flex;
  gap: 8px;
}

.chg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;

  .badge-icon {
    font-size: 11px;
  }

  &.tone-accent {
    color: var(--cert-accent);
    border-color: color-mix(in srgb, var(--cert-accent) 40%, transparent);
  }

  &.tone-success {
    color: #50e3c2;
    border-color: color-mix(in srgb, #50e3c2 40%, transparent);
  }

  &.tone-warning {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
  }

  &.tone-error {
    color: #ee0000;
    border-color: color-mix(in srgb, #ee0000 40%, transparent);
  }

  &.tone-verifying {
    color: #8b5cf6;
    border-color: color-mix(in srgb, #8b5cf6 40%, transparent);
  }

  &.tone-secondary {
    color: #a1a1a1;
    border-color: var(--border-base);
  }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--cert-accent) 30%, transparent);
  border-top-color: var(--cert-accent);
  border-radius: 50%;
  animation: report-spin 0.8s linear infinite;
}

@keyframes report-spin {
  to {
    transform: rotate(360deg);
  }
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.skeleton-head,
.skeleton-card {
  padding: 24px;
}

.skeleton-line {
  height: 16px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;

  & + .skeleton-line {
    margin-top: 12px;
  }

  &.short {
    width: 60%;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: report-wave 1.2s ease-in-out infinite;
  }
}

@keyframes report-wave {
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
  color: #ee0000;
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

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }

  .skeleton-line::after {
    animation: none;
  }
}
</style>
