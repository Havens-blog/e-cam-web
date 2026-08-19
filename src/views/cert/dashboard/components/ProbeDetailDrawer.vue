<template>
  <el-drawer
    :model-value="visible"
    size="480px"
    class="cert-probe-drawer"
    :with-header="false"
    aria-label="子域名探测详情"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div v-if="item" class="drawer-inner" role="dialog" aria-label="子域名探测详情">
      <div class="drawer-header">
        <h3 class="drawer-title">{{ item.domain }}</h3>
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
          <dt>线上指纹</dt>
          <dd class="mono">
            <template v-if="item.onlineFingerprint">
              {{ truncateFingerprint(item.onlineFingerprint) }}
              <el-tooltip content="复制完整线上指纹" placement="top">
                <button
                  type="button"
                  class="copy-btn"
                  :aria-label="`复制 ${item.domain} 的线上指纹`"
                  @click="onCopy(item.onlineFingerprint)"
                >
                  <el-icon><CopyDocument /></el-icon>
                </button>
              </el-tooltip>
            </template>
            <template v-else>—</template>
          </dd>
          <dt>台账指纹</dt>
          <dd class="mono">
            {{ truncateFingerprint(item.fingerprint) }}
            <el-tooltip content="复制完整台账指纹" placement="top">
              <button
                type="button"
                class="copy-btn"
                :aria-label="`复制 ${item.domain} 的台账指纹`"
                @click="onCopy(item.fingerprint)"
              >
                <el-icon><CopyDocument /></el-icon>
              </button>
            </el-tooltip>
          </dd>
          <dt>差异说明</dt>
          <dd>{{ probeReason(item.probeStatus) }}</dd>
        </dl>
        <p class="readonly-note">
          差异告警由巡检自动触达告警接收人，无需人工上报；本抽屉仅提供只读操作。
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
 * 子域名探测详情抽屉（AC4/AC5）：证书要素 + 最近探测详情（时间/线上指纹/差异说明）
 * + 台账指纹比对。底部仅两个入口——「复制差异摘要」（纯文本，四要素）与
 * 「查看证书详情」（跳转 /certs/:id，全角色可达的只读入口）；
 * Hard Rule：不出现任何变更类操作（扫描/发起更换/配置）。
 */
import type { DashboardItem } from '@/api/cert'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { daysLeftBadge, hostingStatusMeta, truncateFingerprint, copyText } from '../../ledger/format'
import { diffSummaryText, probeBadge, probeReason, relativeTimeDash } from '../format'

const props = defineProps<{
    visible: boolean
    item: DashboardItem | null
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const copying = ref(false)

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
