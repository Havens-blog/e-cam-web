<template>
  <div class="element-grid">
    <!-- 左：证书要素（SAN chips / 签发者 / 指纹可复制 / 托管状态徽章） -->
    <div class="cert-card">
      <h2 class="card-title">证书要素</h2>
      <dl class="kv">
        <dt>签发者</dt>
        <dd>{{ cert.issuer || '—' }}</dd>
        <dt>指纹</dt>
        <dd class="mono-cell">
          <span class="mono">{{ truncateFingerprint(cert.fingerprint) }}</span>
          <el-tooltip content="复制完整指纹" placement="top">
            <button
              type="button"
              class="copy-btn"
              :aria-label="`复制证书 ${cert.commonName} 的完整指纹`"
              @click="onCopyFingerprint"
            >
              <el-icon><CopyDocument /></el-icon>
            </button>
          </el-tooltip>
        </dd>
        <dt>托管状态</dt>
        <dd>
          <span class="cert-badge" :class="`tone-${hostingMeta.tone}`">{{ hostingMeta.label }}</span>
        </dd>
      </dl>
      <div class="section-label">SAN 列表</div>
      <div class="san-row">
        <span v-for="san in sanFold.visible" :key="san" class="san-chip">{{ san }}</span>
        <el-tooltip v-if="sanFold.folded" :content="sanFold.hiddenList.join(' · ')" placement="top">
          <span class="san-chip san-more" tabindex="0">+{{ sanFold.hiddenCount }}</span>
        </el-tooltip>
      </div>
    </div>

    <!-- 右：有效期与托管（进度条状态色 / 私钥已加密托管 / 关联变更历史） -->
    <div class="cert-card">
      <h2 class="card-title">有效期与托管</h2>
      <dl class="kv">
        <dt>有效期</dt>
        <dd>{{ formatDate(cert.notBefore) }} ~ {{ formatDate(cert.notAfter) }}</dd>
        <dt>剩余</dt>
        <dd>
          <span class="cert-badge" :class="badgeClass">
            <span v-if="badge.icon" class="badge-icon" aria-hidden="true">{{ badge.icon }}</span>
            <span v-else class="spinner" aria-hidden="true" />
            {{ badge.text }}
          </span>
          <div class="validity-progress" aria-hidden="true">
            <div class="progress-fill" :class="`fill-${badge.tone}`" :style="{ width: `${consumed}%` }" />
          </div>
          <span class="progress-note">已消耗 {{ consumed }}%</span>
        </dd>
        <dt>私钥</dt>
        <dd>
          <span class="cert-badge tone-secondary">
            <span class="badge-icon" aria-hidden="true">🔒</span>
            {{ cert.hasKey ? '已加密托管' : '未托管私钥' }}
          </span>
        </dd>
      </dl>

      <!-- 关联变更历史：只读角色无变更面数据权限（GET /certs/changes 403），整块隐藏 -->
      <template v-if="!readonly">
        <div class="section-label">关联变更历史</div>
        <div v-if="changesError" class="history-hint">变更历史加载失败，刷新页面可重试</div>
        <div v-else-if="!changes.length" class="history-hint">暂无关联变更单</div>
        <div v-else class="link-list">
          <router-link
            v-for="o in changes"
            :key="o.id"
            class="history-row"
            :to="`/certs/changes/${o.id}`"
          >
            <span class="mono order-id">{{ o.id }}</span>
            <span class="cert-badge" :class="`tone-${changeStatusMeta(o.status).tone}`">
              <span v-if="changeStatusMeta(o.status).icon" class="badge-icon" aria-hidden="true">
                {{ changeStatusMeta(o.status).icon }}
              </span>
              <span v-else class="spinner" aria-hidden="true" />
              {{ changeStatusMeta(o.status).label }}
            </span>
            <span class="history-desc">{{ formatDate(o.createdAt) }}</span>
          </router-link>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 证书要素卡（ui-design Layout 2 列）：左 SAN chips（>3 折叠 +N，悬浮/焦点展开）/
 * 签发者 / 指纹（mono 截断 + 行内复制取全文）/ 托管状态徽章；右 有效期进度条
 * （剩余天数着状态色 + 已消耗百分比）/ 私钥「已加密托管」（永不返回明文）/
 * 关联变更历史列表（按当前证书过滤倒序，AC1）。
 */
import type { CertDetail, ChangeOrder } from '@/api/cert'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { computed } from 'vue'
import { copyText, daysLeftBadge, foldSans, hostingStatusMeta, truncateFingerprint } from '../../ledger/format'
import { changeStatusMeta, validityConsumedPercent } from '../format'

const props = defineProps<{
    cert: CertDetail
    /** 关联变更单（父级已按当前证书过滤倒序） */
    changes: ChangeOrder[]
    /** 变更历史加载失败（卡片降级提示，不阻塞要素展示） */
    changesError?: boolean
    /** 只读模式：隐藏变更历史（数据面 403）与操作入口 */
    readonly?: boolean
}>()

const hostingMeta = computed(() => hostingStatusMeta(props.cert.hostingStatus))
const badge = computed(() => daysLeftBadge(props.cert.daysLeft))
/** ≤14 天 Warning 色阶加深（ui-design 证书状态色） */
const badgeClass = computed(() => ({
    [`tone-${badge.value.tone}`]: true,
    'tone-deep': badge.value.tone === 'warning' && props.cert.daysLeft <= 14,
}))
const consumed = computed(() => validityConsumedPercent(props.cert.notBefore, props.cert.notAfter))
const sanFold = computed(() => foldSans(props.cert.sans.length ? props.cert.sans : [props.cert.commonName]))

function formatDate(iso: string) {
    const d = dayjs(iso)
    return d.isValid() ? d.format('YYYY-MM-DD') : '—'
}

async function onCopyFingerprint() {
    const ok = await copyText(props.cert.fingerprint)
    if (ok) ElMessage.success('已复制')
    else ElMessage.error('复制失败，请手动复制')
}
</script>

<style lang="scss" scoped>
.element-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.cert-card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.card-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.kv {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 12px 16px;
  margin: 0;

  dt {
    font-size: 13px;
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-size: 13px;
    color: var(--text-primary);
    min-width: 0;
  }
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.mono-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;

  .mono {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;

  &:hover {
    color: var(--cert-accent, #0070f3);
    background: rgba(255, 255, 255, 0.05);
  }
}

.section-label {
  margin: 16px 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.san-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.san-chip {
  font-size: 12px;
  padding: 1px 8px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  color: var(--text-secondary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.san-more {
  color: var(--text-primary);
  cursor: default;
}

.validity-progress {
  margin: 8px 0 4px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 150ms ease;

  &.fill-success {
    background: #50e3c2;
  }

  &.fill-warning {
    background: #f5a623;
  }

  &.fill-error {
    background: #ee0000;
  }
}

.progress-note {
  font-size: 12px;
  color: var(--text-secondary);
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

  .badge-icon {
    font-size: 11px;
  }

  &.tone-success {
    color: #50e3c2;
    border-color: color-mix(in srgb, #50e3c2 40%, transparent);
  }

  &.tone-warning {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);

    &.tone-deep {
      color: #d98c0a;
    }
  }

  &.tone-error {
    color: #ee0000;
    border-color: color-mix(in srgb, #ee0000 40%, transparent);
  }

  &.tone-accent {
    color: var(--cert-accent, #0070f3);
    border-color: color-mix(in srgb, var(--cert-accent, #0070f3) 40%, transparent);
  }

  &.tone-secondary {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }

  &.tone-verifying {
    color: #8b5cf6;
    border-color: color-mix(in srgb, #8b5cf6 40%, transparent);
  }
}

.spinner {
  width: 10px;
  height: 10px;
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

.history-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--text-primary);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &:focus-visible {
    outline: 2px solid var(--cert-accent, #0070f3);
    outline-offset: 2px;
  }
}

.order-id {
  color: var(--text-primary);
}

.history-desc {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }

  .spinner {
    animation: none;
  }
}
</style>
