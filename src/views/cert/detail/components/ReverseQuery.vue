<template>
  <div class="reverse-query">
    <!-- 搜索框（域名/资源名，回车或「查询」按钮触发） -->
    <div class="toolbar">
      <el-input
        v-model="query"
        class="reverse-input"
        type="search"
        placeholder="输入域名 / 资源名查询其引用的证书"
        aria-label="反向查询（域名 / 资源名）"
        clearable
        @keyup.enter="run"
      />
      <el-button type="primary" :loading="state === 'loading'" @click="run">查询</el-button>
    </div>

    <div class="results" aria-live="polite">
      <!-- 初始态：未执行查询的输入引导（区别于「未查询到」空态） -->
      <div v-if="state === 'initial'" class="state-hint">
        <span class="hint-icon" aria-hidden="true">🔍</span>
        输入域名或资源名后查询其引用的证书
      </div>

      <div v-else-if="state === 'loading'" class="state-hint" aria-label="反向查询中">
        查询中…
      </div>

      <!-- 无匹配空态（区别于初始态文案） -->
      <div v-else-if="state === 'no-match'" class="state-hint">
        <span class="hint-icon" aria-hidden="true">🔍</span>
        未查询到引用该域名/资源的证书
      </div>

      <!-- 结果：证书卡片列表（按指纹分组严格区分并存证书，不合并展示——Hard Rule） -->
      <template v-else>
        <div
          v-for="card in results"
          :key="card.fingerprint"
          class="reverse-card"
        >
          <div class="card-head">
            <span class="cn-chip">{{ card.commonName || card.sans?.[0] || '（未知域名）' }}</span>
            <span v-if="card.registered" class="cert-badge" :class="`tone-${hostingTone(card.hostingStatus)}`">
              {{ hostingLabel(card.hostingStatus) }}
            </span>
            <span v-else class="cert-badge tone-ghost">未登记</span>
            <span class="ref-count">{{ card.referenceCount }} 处引用</span>
          </div>
          <dl class="kv">
            <dt>指纹</dt>
            <dd class="mono-cell">
              <span class="mono">{{ truncateFingerprint(card.fingerprint) }}</span>
              <el-tooltip content="复制完整指纹" placement="top">
                <button
                  type="button"
                  class="copy-btn"
                  :aria-label="`复制证书 ${card.commonName ?? card.fingerprint} 的完整指纹`"
                  @click="onCopy(card.fingerprint, card.commonName)"
                >
                  <el-icon><CopyDocument /></el-icon>
                </button>
              </el-tooltip>
            </dd>
            <dt>引用资源</dt>
            <dd>
              <div
                v-for="(r, i) in card.references"
                :key="`${r.resourceId}|${r.referencedCloudCertId}|${i}`"
                class="ref-row"
              >
                <span class="mono">{{ r.resourceId }}</span>
                <span class="ref-meta">{{ refMeta(r) }}</span>
              </div>
            </dd>
          </dl>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 反向查询 Tab（UF-2 AC5）：域名/资源名搜索 → 该域名/资源引用的证书卡片列表。
 * 结果按指纹严格区分（API 逐指纹返回，逐卡渲染指纹 mono + 复制，不合并——Hard Rule：
 * 同域名多证书并存按指纹严格区分）。无匹配 → 「未查询到引用该域名/资源的证书」
 * （区别于未执行查询的初始态）。
 */
import type { ReverseLookupCert, ReverseLookupItem } from '@/api/cert'
import { reverseLookupCertsApi } from '@/api/cert'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { copyText, truncateFingerprint } from '../../ledger/format'
import { resolveReverseState } from '../format'

const query = ref('')
const loading = ref(false)
/** null=尚未取得结果（初始态判定依据） */
const results = ref<ReverseLookupCert[] | null>(null)
const searchedQuery = ref('')

const state = computed(() =>
    resolveReverseState(searchedQuery.value, loading.value, results.value === null ? null : results.value.length),
)

async function run() {
    const q = query.value.trim()
    if (!q || loading.value) return
    loading.value = true
    try {
        const res = await reverseLookupCertsApi(q)
        results.value = res.items
        searchedQuery.value = q
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '反向查询失败，请重试')
    } finally {
        loading.value = false
    }
}

function hostingLabel(s?: string): string {
    return s === 'complete' ? '完整托管' : s === 'fingerprint_only' ? '仅指纹登记' : '已登记'
}

function hostingTone(s?: string): string {
    return s === 'fingerprint_only' ? 'secondary' : 'accent'
}

/** 引用资源行元信息：云 · 产品（· 集群）（· 云账号） */
function refMeta(r: ReverseLookupItem): string {
    const parts: string[] = []
    if (r.cloud) parts.push(r.cloud)
    if (r.product) parts.push(r.product)
    if (r.clusterId) parts.push(r.clusterId)
    if (r.accountKey) parts.push(r.accountKey)
    return parts.join(' · ') || '—'
}

async function onCopy(fingerprint: string, label?: string) {
    const ok = await copyText(fingerprint)
    if (ok) ElMessage.success('已复制')
    else ElMessage.error(`复制失败，请手动复制 ${label ?? ''}`.trim())
}
</script>

<style lang="scss" scoped>
.reverse-query {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar {
  display: flex;
  gap: 8px;
}

.reverse-input {
  flex: 1;
}

.state-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.hint-icon {
  font-size: 16px;
}

.reverse-card {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 14px 16px;

  & + & {
    margin-top: 8px;
  }
}

.card-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.cn-chip {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 1px 10px;
  border: 1px solid var(--border-base);
  border-radius: 999px;
}

.cert-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;

  &.tone-accent {
    color: var(--cert-accent, #0070f3);
    border-color: color-mix(in srgb, var(--cert-accent, #0070f3) 40%, transparent);
  }

  &.tone-secondary {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }

  &.tone-ghost {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
  }
}

.ref-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-secondary);
}

.kv {
  display: grid;
  grid-template-columns: 84px 1fr;
  gap: 8px 16px;
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

.mono-cell {
  display: flex;
  align-items: center;
  gap: 4px;

  .mono {
    font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--text-secondary);
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

.ref-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;

  .mono {
    font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--text-primary);
  }
}

.ref-meta {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
