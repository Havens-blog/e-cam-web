<template>
  <el-drawer
    :model-value="visible"
    size="480px"
    class="cert-probe-drawer"
    :with-header="false"
    aria-label="证书探测详情"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div v-if="item" class="drawer-inner" role="dialog" aria-label="证书探测详情">
      <div class="drawer-header">
        <h3 class="drawer-title">{{ item.commonName }}</h3>
        <button type="button" class="drawer-close" aria-label="关闭抽屉" @click="close">×</button>
      </div>
      <div class="drawer-body">
        <dl class="kv">
          <dt>剩余天数</dt>
          <dd>
            <span class="dash-badge" :class="`tone-${daysLeftBadge(item.daysLeft).tone}`">
              <span class="badge-icon" aria-hidden="true">{{ daysLeftBadge(item.daysLeft).icon }}</span>
              {{ daysLeftBadge(item.daysLeft).text }}
            </span>
          </dd>
          <dt>托管类型</dt>
          <dd>{{ hostingStatusMeta(item.hostingType).label }}</dd>
          <dt>签发者</dt>
          <dd>{{ item.issuer || '—' }}</dd>
          <dt>引用状态</dt>
          <dd>{{ referenceStatusLabel(item.referenceStatus) }}</dd>
          <dt>探测状态</dt>
          <dd>
            <span
              class="dash-badge"
              :class="`tone-${probeBadge(item.probeStatus).tone}`"
              :aria-label="probeBadge(item.probeStatus).tooltip"
            >
              <span class="badge-icon" aria-hidden="true">{{ probeBadge(item.probeStatus).icon }}</span>
              {{ probeBadge(item.probeStatus).label }}
            </span>
          </dd>
          <dt>最近探测</dt>
          <dd>{{ item.lastProbeAt ? relativeTimeDash(item.lastProbeAt) : '—' }}</dd>
          <dt>台账指纹</dt>
          <dd class="mono">
            {{ truncateFingerprint(item.fingerprint) }}
            <el-tooltip content="复制完整台账指纹" placement="top">
              <button
                type="button"
                class="copy-btn"
                :aria-label="`复制 ${item.commonName} 的台账指纹`"
                @click="onCopy(item.fingerprint)"
              >
                <el-icon><CopyDocument /></el-icon>
              </button>
            </el-tooltip>
          </dd>
        </dl>

        <!-- 证书多 SAN 探测视图：该证全部 SAN 逐条探测真相（最差优先序；SAN>20 折叠前 20） -->
        <div class="san-section" aria-label="SAN 探测明细">
          <div class="san-section-title">
            SAN 探测明细（{{ item.sans.length }} 个，风险优先）
            <span v-if="sanLoading" class="san-loading">加载中…</span>
          </div>
          <ul class="san-list">
            <li v-for="e in visibleSanEntries" :key="e.san" class="san-row">
              <div class="san-row-main">
                <span class="san-name">{{ e.san }}</span>
                <span
                  class="dash-badge"
                  :class="`tone-${probeBadge(sanStatus(e)).tone}`"
                  :aria-label="`探测状态：${probeBadge(sanStatus(e)).label}`"
                >
                  <span class="badge-icon" aria-hidden="true">{{ probeBadge(sanStatus(e)).icon }}</span>
                  {{ probeBadge(sanStatus(e)).label }}
                </span>
              </div>
              <div class="san-row-sub">
                <span>{{ e.probe?.probeAt ? relativeTimeDash(e.probe.probeAt) : '尚未探测' }}</span>
                <span v-if="e.probe?.onlineFingerprint" class="mono">线上 {{ truncateFingerprint(e.probe.onlineFingerprint) }}</span>
              </div>
            </li>
          </ul>
          <button
            v-if="foldedSanEntries.length > 0"
            type="button"
            class="san-expand"
            :aria-expanded="sansExpanded"
            @click="sansExpanded = !sansExpanded"
          >
            {{ sansExpanded ? '收起' : `展开其余 ${foldedSanEntries.length} 个 SAN` }}
          </button>
        </div>

        <p class="readonly-note">
          行徽标为最差优先聚合；本视图保留该证全部 SAN 逐条探测真相。差异告警由巡检自动触达告警接收人，本抽屉仅提供只读操作。
        </p>
      </div>
      <div class="drawer-footer">
        <el-button class="full-width" :loading="copying" @click="onCopySummary">复制差异摘要</el-button>
        <RouterLink
          v-if="item.certId"
          class="detail-link full-width"
          :to="`/certs/${item.certId}`"
          aria-label="查看证书详情（只读模式）"
        >
          查看证书详情
        </RouterLink>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 证书探测详情抽屉（证书粒度多 SAN 视图，dashboard-cert-granularity 任务 2）：
 * 头部证书摘录（到期/托管/签发者/引用三态/聚合探测徽标/台账指纹）+ 该证全部 SAN
 * 逐条探测列表（数据源 GET /certs/probes LatestPerDomain，按 SAN 域名映射）。
 * SAN>20 折叠（NFR 锚定阈值）：默认最差优先前 20，其余可展开（并列同态不细分）。
 * 底部仅两个入口——「复制差异摘要」（纯文本）与「查看证书详情」（/certs/:id 只读）；
 * Hard Rule：不出现任何变更类操作（扫描/发起更换/配置）。
 */
import type { CertProbeResult, DashboardItem, ProbeStatus } from '@/api/cert'
import { getCertProbesApi } from '@/api/cert'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { daysLeftBadge, hostingStatusMeta, truncateFingerprint, copyText } from '../../ledger/format'
import {
    SAN_FOLD_LIMIT,
    buildSanProbeEntries,
    diffSummaryText,
    probeBadge,
    referenceStatusLabel,
    relativeTimeDash,
    type SanProbeEntry,
} from '../format'

const props = defineProps<{
    visible: boolean
    item: DashboardItem | null
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const copying = ref(false)
const sanLoading = ref(false)
const probeByDomain = ref<Map<string, CertProbeResult>>(new Map())
const sansExpanded = ref(false)

/** 该证全部 SAN → 最差优先探测条目（并列同态保持 SAN 原序） */
const sanEntries = computed<SanProbeEntry[]>(() =>
    props.item ? buildSanProbeEntries(props.item.sans, probeByDomain.value) : [],
)

/** SAN 超阈值默认折叠为最差优先前 20，其余经「展开」披露 */
const visibleSanEntries = computed(() =>
    sansExpanded.value ? sanEntries.value : sanEntries.value.slice(0, SAN_FOLD_LIMIT),
)
const foldedSanEntries = computed(() => (sansExpanded.value ? [] : sanEntries.value.slice(SAN_FOLD_LIMIT)))

function sanStatus(e: SanProbeEntry): ProbeStatus | '' {
    return (e.probe?.status as ProbeStatus | '') ?? ''
}

// 每次打开拉取该证 SAN 的探测明细（LatestPerDomain；失败不塌陷聚合徽标，逐条降级「未探测」）
watch(
    () => props.visible,
    async (v) => {
        if (!v) return
        sansExpanded.value = false
        probeByDomain.value = new Map()
        if (!props.item || props.item.sans.length === 0) return
        sanLoading.value = true
        try {
            const probes = await getCertProbesApi()
            const map = new Map<string, CertProbeResult>()
            for (const p of probes) map.set(p.domain, p)
            probeByDomain.value = map
        } catch {
            ElMessage.error('SAN 探测明细加载失败，请稍后重试')
        } finally {
            sanLoading.value = false
        }
    },
)

function close() {
    emit('update:visible', false)
}

async function onCopy(text: string) {
    const ok = await copyText(text)
    if (ok) ElMessage.success('已复制')
    else ElMessage.error('复制失败，请手动复制')
}

async function onCopySummary() {
    if (!props.item || copying.value) return
    copying.value = true
    const ok = await copyText(diffSummaryText(props.item))
    copying.value = false
    if (ok) ElMessage.success('差异摘要已复制')
    else ElMessage.error('复制失败，请手动复制')
}
</script>

<style lang="scss" scoped>
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: -16px;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-base);
}

.drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.drawer-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;

  &:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.kv {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px 16px;
  margin: 0;

  dt {
    font-size: 13px;
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-all;
  }
}

.mono {
  font-family: var(--cert-font-mono, 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: 4px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  vertical-align: middle;

  &:hover {
    color: var(--cert-accent);
    background: var(--cert-surface-alt);
  }
}

.san-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-base);
}

.san-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.san-loading {
  margin-left: 8px;
  font-weight: 400;
  font-size: 12px;
  color: var(--text-secondary);
}

.san-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.san-row {
  padding: 8px 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.san-row-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.san-name {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-all;
}

.san-row-sub {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.san-expand {
  margin-top: 10px;
  padding: 4px 12px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    color: var(--cert-accent);
    border-color: var(--cert-accent);
  }
}

.readonly-note {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.drawer-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border-base);
}

.full-width {
  width: 100%;
}

.detail-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 32px;
  padding: 0 15px;
  border-radius: 6px;
  background: var(--cert-accent);
  color: #ffffff;
  font-size: 14px;
  text-decoration: none;
  transition: background 150ms ease;

  &:hover {
    background: var(--cert-accent-hover);
  }
}

.dash-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;

  .badge-icon {
    font-size: 11px;
  }

  &.tone-success {
    color: var(--cert-success);
    border-color: color-mix(in srgb, var(--cert-success) 40%, transparent);
  }

  &.tone-warning {
    color: var(--cert-warning);
    border-color: color-mix(in srgb, var(--cert-warning) 40%, transparent);
  }

  &.tone-error {
    color: var(--cert-error);
    border-color: color-mix(in srgb, var(--cert-error) 40%, transparent);
  }

  &.tone-secondary {
    color: #a1a1a1;
    border-color: var(--border-base);
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-link {
    transition: none;
  }
}
</style>
