<template>
  <div class="cert-detail-page" aria-labelledby="cert-detail-title">
    <nav class="breadcrumb" aria-label="面包屑">
      <!-- 只读角色台账路由被拦截：面包屑父级渲染纯文本 -->
      <router-link v-if="!readonly" to="/certs">证书台账</router-link>
      <span v-else class="crumb-plain">证书台账</span>
      <span class="crumb-sep" aria-hidden="true">/</span>
      <span class="crumb-current">{{ detail?.commonName ?? '证书详情' }}</span>
    </nav>

    <div aria-live="polite">
      <!-- Loading：要素 + 引用区骨架（800ms 内返回直接渲染，不闪骨架） -->
      <template v-if="detailLoading">
        <div v-if="skeletonVisible" class="detail-skeleton" aria-hidden="true">
          <div class="skeleton-title" />
          <div class="skeleton-grid">
            <div class="skeleton-card" />
            <div class="skeleton-card" />
          </div>
          <div class="skeleton-ref" />
        </div>
        <div v-else class="loading-placeholder" aria-label="加载中" />
      </template>

      <!-- Error：详情加载失败（整页错误 + 重试） -->
      <div v-else-if="detailError" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">证书详情加载失败</div>
          <div class="state-desc">证书服务暂时不可用，请稍后重试。</div>
          <el-button class="state-cta" @click="refresh">重试</el-button>
        </div>
      </div>

      <!-- Populated -->
      <template v-else-if="detail">
        <div class="page-header">
          <div>
            <h1 id="cert-detail-title" class="page-title">{{ detail.commonName }}</h1>
            <div class="title-row">
              <span class="cert-badge" :class="`tone-${hostingStatusMeta(detail.hostingStatus).tone}`">
                {{ hostingStatusMeta(detail.hostingStatus).label }}
              </span>
              <span class="title-meta">证书 ID <span class="mono">{{ detail.id }}</span></span>
            </div>
          </div>
        </div>

        <ElementCard class="element-block" :cert="detail" :changes="changes" :changes-error="changesError" :readonly="readonly" />

        <!-- 引用关系卡：独立加载与错误处理（不受要素卡影响，反向亦然） -->
        <ReferenceCard class="ref-block" :cert-id="certId" :readonly="readonly" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 证书详情页（任务 6.3，UF-2）：/certs/:id。入口：台账行���击、看板抽屉「查看证书详情」（6.4）。
 * 面包屑「证书台账 / 域名」。要素卡（GET /certs/:id）与引用关系卡（GET /certs/:id/references）
 * 独立加载互不影响；关联变更历史复用 GET /certs/changes 列表按当前证书客户端过滤倒序
 * （旧证书指纹或新证书 ID 命中即关联；变更面仅管理角色可读，只读模式整块隐藏）。
 * 只读模式（6.1 角色机制）：仅查看要素与引用关系，隐藏「立即扫描」等操作入口。
 */
import type { CertDetail, ChangeOrder } from '@/api/cert'
import { listChangesApi } from '@/api/cert'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { hasCertManageAccess } from '@/utils/cert-permission'
import { getCertApi } from '@/api/cert'
import { hostingStatusMeta } from '../ledger/format'
import { filterChangeOrders } from './format'
import ElementCard from './components/ElementCard.vue'
import ReferenceCard from './components/ReferenceCard.vue'

const route = useRoute()
const userStore = useUserStore()

/** 只读模式：未持有 cert:manage 授权码的非管理员按只读查看者处理（deny-by-default） */
const readonly = computed(() =>
    !hasCertManageAccess({ isAdmin: userStore.isAdmin, permissions: userStore.permissions }),
)

const certId = computed(() => String(route.params.id ?? ''))

const detail = ref<CertDetail | null>(null)
const detailLoading = ref(true)
const detailError = ref(false)
const changes = ref<ChangeOrder[]>([])
const changesError = ref(false)

/** 骨架延迟（全局模式：800ms 内返回则直接渲染） */
const SKELETON_DELAY_MS = 800
let skeletonTimer: ReturnType<typeof setTimeout> | null = null
const skeletonVisible = ref(false)

async function loadDetail() {
    if (!certId.value) return
    detailLoading.value = !detail.value
    detailError.value = false
    beginSkeletonTimer()
    try {
        detail.value = await getCertApi(certId.value)
    } catch {
        if (detail.value) {
            // 路由参数切换后的加载失败保留旧证书渲染不塌陷（同页复用场景）
            detailLoading.value = false
            return
        }
        detailError.value = true
    } finally {
        detailLoading.value = false
        endSkeletonTimer()
    }
}

/** 关联变更历史：列表拉取 + 按当前证书过滤（只读角色无变更面权限，跳过） */
async function loadChanges() {
    if (readonly.value || !detail.value) return
    changesError.value = false
    try {
        const res = await listChangesApi({ page: 1, pageSize: 100 })
        changes.value = filterChangeOrders(res.items, {
            id: detail.value.id,
            fingerprint: detail.value.fingerprint,
        })
    } catch {
        changesError.value = true
    }
}

function refresh() {
    void loadDetail().then(loadChanges)
}

function beginSkeletonTimer() {
    skeletonVisible.value = false
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = setTimeout(() => {
        if (detailLoading.value) skeletonVisible.value = true
    }, SKELETON_DELAY_MS)
}

function endSkeletonTimer() {
    if (skeletonTimer) clearTimeout(skeletonTimer)
    skeletonTimer = null
    skeletonVisible.value = false
}

onMounted(refresh)

// 同组件在不同证书间复用（/certs/a → /certs/b）：随路由参数重载全部数据
watch(certId, () => {
    detail.value = null
    view_reset()
    refresh()
})

function view_reset() {
    changes.value = []
    changesError.value = false
}

onUnmounted(() => {
    endSkeletonTimer()
})
</script>

<style lang="scss" scoped>
// ===== Vercel 设计 token（ui-design Design System）+ Element Plus 变量对齐 =====
.cert-detail-page {
  --cert-accent: #0070f3;
  --cert-accent-hover: #3291ff;
  --cert-success: #50e3c2;
  --cert-warning: #f5a623;
  --cert-error: #ee0000;
  --cert-surface-alt: rgba(255, 255, 255, 0.05);

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
}

.crumb-plain {
  color: var(--text-secondary);
}

.crumb-sep {
  color: var(--text-secondary);
}

.crumb-current {
  color: var(--text-primary);
  font-weight: 500;
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
  word-break: break-all;
}

.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.title-meta {
  font-size: 13px;
  color: var(--text-secondary);

  .mono {
    font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--text-primary);
  }
}

.cert-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;

  &.tone-accent {
    color: var(--cert-accent);
    border-color: color-mix(in srgb, var(--cert-accent) 40%, transparent);
  }

  &.tone-secondary {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }
}

.element-block {
  margin-top: 4px;
}

.ref-block {
  margin-top: 16px;
}

// ===== Loading 骨架 =====
.detail-skeleton {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-title {
  height: 28px;
  width: 240px;
  border-radius: 6px;
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

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.skeleton-card {
  height: 220px;
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

.skeleton-ref {
  height: 280px;
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

@keyframes cert-skeleton-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

// ===== Error 态 =====
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

.loading-placeholder {
  min-height: 420px;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-title::after,
  .skeleton-card::after,
  .skeleton-ref::after {
    animation: none;
  }
}
</style>
