<template>
  <section class="step1" aria-labelledby="step1-title">
    <div class="card intro-card">
      <h2 id="step1-title">选择旧证书与新证书</h2>
      <p class="text-secondary intro-desc">
        新证书须先在台账导入为「完整托管」（向导内不提供上传入口）。若台账无完整托管证书，请返回台账导入。
      </p>
    </div>

    <!-- ?certId= 预选不合规置顶提示（不锁选择器不跳步） -->
    <el-alert
      v-if="preselectNotice"
      type="warning"
      :closable="false"
      show-icon
      class="preselect-notice"
      role="alert"
    >
      {{ preselectNotice }}
    </el-alert>

    <div class="grid-2">
      <!-- 旧证书选择器（完整托管且有活跃引用；执行开始后锁定） -->
      <div class="card selector-card">
        <h3>旧证书</h3>
        <el-select
          :model-value="oldCert?.id ?? ''"
          filterable
          remote
          clearable
          :remote-method="searchOld"
          :loading="oldLoading"
          :disabled="locked"
          placeholder="按域名 / SAN / 指纹（支持前缀）检索"
          aria-label="选择旧证书"
          class="selector"
          @change="onOldChange"
          @focus="ensureOldOptions"
        >
          <el-option
            v-for="c in oldOptions"
            :key="c.id"
            :label="c.commonName"
            :value="c.id"
          >
            <div class="option-row">
              <span class="option-name">{{ c.commonName }}</span>
              <span class="mono option-fp">{{ truncateMiddle(c.fingerprint) }}</span>
              <span class="option-days">{{ c.daysLeft }} 天</span>
            </div>
          </el-option>
        </el-select>

        <!-- 检索失败错误态：与空态分流，避免网络/服务错误被渲染成「无候选」 -->
        <el-alert
          v-if="oldSearchError"
          type="error"
          :closable="false"
          show-icon
          class="search-error"
          role="alert"
        >
          <template #title>旧证书列表加载失败，请重试</template>
          <div class="new-empty-actions">
            <el-button size="small" @click="searchOld('')">重试</el-button>
          </div>
        </el-alert>

        <div v-if="oldCert" class="selected-card" aria-live="polite">
          <div class="row">
            <strong>{{ oldCert.commonName }}</strong>
            <span class="chg-badge tone-accent">{{ hostingStatusMeta(oldCert.hostingStatus).label }}</span>
            <span class="chg-badge tone-success">{{ oldCert.daysLeft }} 天</span>
          </div>
          <div class="text-secondary text-sm mono selected-fp">
            {{ truncateMiddle(oldCert.fingerprint) }} · 引用 {{ oldCert.refCount }}
          </div>
        </div>
      </div>

      <!-- 新证书选择器（台账「完整托管」，排除已选旧证书） -->
      <div class="card selector-card">
        <h3>新证书</h3>
        <el-select
          :model-value="newCert?.id ?? ''"
          filterable
          remote
          clearable
          :remote-method="searchNew"
          :loading="newLoading"
          :disabled="locked"
          placeholder="检索台账「完整托管」证书"
          aria-label="选择新证书"
          class="selector"
          @change="onNewChange"
          @focus="ensureNewOptions"
        >
          <el-option
            v-for="c in sortedNewOptions"
            :key="c.id"
            :label="c.commonName"
            :value="c.id"
          >
            <div class="option-row">
              <span class="option-name">{{ c.commonName }}</span>
              <span class="mono option-fp">{{ truncateMiddle(c.fingerprint) }}</span>
              <span class="option-days">{{ c.daysLeft }} 天</span>
            </div>
          </el-option>
        </el-select>

        <!-- 新证书自动匹配提示（与旧证书同名/域名相关；已自动选中时不再展示） -->
        <el-alert
          v-if="!newCert && strongNewMatches.length > 1"
          type="info"
          :closable="false"
          show-icon
          class="auto-match-note"
          role="status"
        >
          <template #title>检测到同名完整托管证书 {{ strongNewMatches.length }} 张，请选择其一</template>
        </el-alert>
        <el-alert
          v-else-if="!newCert && strongNewMatches.length === 0 && sanOverlapNewOptions.length > 0"
          type="info"
          :closable="false"
          show-icon
          class="auto-match-note"
          role="status"
        >
          <template #title>未找到同名完整托管证书，已按域名相关排序（{{ sanOverlapNewOptions.length }} 张）</template>
        </el-alert>

        <div v-if="newCert && newCertIsAutoMatch" class="auto-match-selected" aria-live="polite">
          ✓ 已自动匹配同名新证书（可手动更换）
        </div>

        <div v-if="newCert" class="selected-card" aria-live="polite">
          <div class="row">
            <strong>{{ newCert.commonName }}</strong>
            <span class="chg-badge tone-accent">{{ hostingStatusMeta(newCert.hostingStatus).label }}</span>
            <span class="chg-badge tone-success">{{ newCert.daysLeft }} 天</span>
          </div>
          <div class="text-secondary text-sm mono selected-fp">{{ truncateMiddle(newCert.fingerprint) }}</div>
        </div>

        <!-- 检索失败错误态：优先于空态展示（newEmpty 已排除检索失败） -->
        <el-alert
          v-if="newSearchError"
          type="error"
          :closable="false"
          show-icon
          class="search-error"
          role="alert"
        >
          <template #title>新证书列表加载失败，请重试</template>
          <div class="new-empty-actions">
            <el-button size="small" @click="searchNew('')">重试</el-button>
          </div>
        </el-alert>

        <!-- 无完整托管候选 → 空态卡 + 返回台账导入（已选旧证书暂存草稿） -->
        <el-alert
          v-if="newEmpty"
          type="info"
          :closable="false"
          show-icon
          class="new-empty"
        >
          <template #title>暂无完整托管证书</template>
          台账中无完整托管证书可选，请先返回台账导入（已选旧证书将随草稿保留）。
          <div class="new-empty-actions">
            <el-button size="small" tag="router-link" to="/certs">返回台账导入</el-button>
          </div>
        </el-alert>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Step1 选择证书（AC2）：旧证书选择器（按域名/SAN/指纹检索台账，下拉行 =
 * 域名 + 指纹 mono 截断 + 剩余天数；限完整托管且有活跃引用）+ 新证书选择器
 * （候选集限「完整托管」、排除已选旧证书；无候选 → 空态卡 +「返回台账导入」，
 * 跳转 /certs 不暂存跳步）。选中后卡片回显要素。执行开始后选择器锁定
 * （Hard Rule：执行期间清单快照固定）。
 */
import type { CertListItem } from '@/api/cert'
import { listCertsApi } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { hostingStatusMeta } from '../../../ledger/format'
import { truncateMiddle } from '../../format'

const props = defineProps<{
    oldCert: CertListItem | null
    newCert: CertListItem | null
    /** ?certId= 预选不合规置顶提示 */
    preselectNotice?: string
    /** 执行开始后锁定选择器 */
    locked?: boolean
}>()

const emit = defineEmits<{
    (e: 'update:oldCert', v: CertListItem | null): void
    (e: 'update:newCert', v: CertListItem | null): void
}>()

const oldOptions = ref<CertListItem[]>([])
const newOptions = ref<CertListItem[]>([])
const oldLoading = ref(false)
const newLoading = ref(false)
// 检索失败标记：空态与错误态分流，避免网络/服务错误被误渲染为「暂无完整托管证书」业务空态
const oldSearchError = ref(false)
const newSearchError = ref(false)

/** 旧证书候选：完整托管 + 有活跃引用（变更对象=旧证书的引用资源） */
async function searchOld(query: string) {
    oldLoading.value = true
    oldSearchError.value = false
    try {
        const res = await listCertsApi({ search: query || undefined, pageSize: 50 })
        oldOptions.value = res.items.filter(
            (c) => c.hostingStatus === 'complete' && c.refCount > 0,
        )
    } catch (err) {
        console.error('旧证书候选检索失败:', err)
        oldOptions.value = []
        oldSearchError.value = true
        ElMessage.error({ message: '旧证书列表加载失败，请重试', grouping: true })
    } finally {
        oldLoading.value = false
    }
}

/** 新证书候选：完整托管，排除已选旧证书 */
async function searchNew(query: string) {
    newLoading.value = true
    newSearchError.value = false
    try {
        const res = await listCertsApi({ search: query || undefined, pageSize: 50 })
        newOptions.value = res.items.filter(
            (c) => c.hostingStatus === 'complete' && c.id !== props.oldCert?.id,
        )
    } catch (err) {
        console.error('新证书候选检索失败:', err)
        newOptions.value = []
        newSearchError.value = true
        ElMessage.error({ message: '新证书列表加载失败，请重试', grouping: true })
    } finally {
        newLoading.value = false
    }
}

function ensureOldOptions() {
    if (oldOptions.value.length === 0) void searchOld('')
}

function ensureNewOptions() {
    if (newOptions.value.length === 0) void searchNew('')
}

function onOldChange(id: string | '') {
    if (!id) {
        emit('update:oldCert', null)
        return
    }
    const found = oldOptions.value.find((c) => c.id === id)
    if (found) emit('update:oldCert', found)
    // 旧证书变化由下方 watch 统一刷新新证书候选（排除项 + 自动匹配触发）
}

function onNewChange(id: string | '') {
    if (!id) {
        emit('update:newCert', null)
        return
    }
    const found = newOptions.value.find((c) => c.id === id)
    if (found) emit('update:newCert', found)
}

// ---------------------------------------------------------------------
// 新证书自动匹配：旧证书确定后，按同名(CN)/SAN 交集对完整托管候选排序，
// 恰一个同名强匹配时自动带上（用户已选/多同名时不覆盖，仅提示）。
// ---------------------------------------------------------------------

/** 与旧证书的匹配评分：2=同名(CN) 1=SAN 交集 0=无关 */
function matchScore(oldCert: CertListItem | null, c: CertListItem): number {
    if (!oldCert) return 0
    const norm = (s: string) => s.trim().toLowerCase()
    if (norm(c.commonName) === norm(oldCert.commonName)) return 2
    const oldSans = new Set(oldCert.sans.map(norm))
    if (c.sans.some((s) => oldSans.has(norm(s)))) return 1
    return 0
}

/** 同名强匹配候选（score>=2，自动选中依据） */
const strongNewMatches = computed<CertListItem[]>(() =>
    newOptions.value.filter((c) => matchScore(props.oldCert, c) >= 2),
)

/** SAN 交集候选（score>=1，排序与提示依据） */
const sanOverlapNewOptions = computed<CertListItem[]>(() =>
    newOptions.value.filter((c) => matchScore(props.oldCert, c) >= 1),
)

/** 新证书候选：匹配度降序（同名 → SAN 交集 → 无关），同级按到期晚优先 */
const sortedNewOptions = computed<CertListItem[]>(() =>
    [...newOptions.value]
        .sort((a, b) => matchScore(props.oldCert, b) - matchScore(props.oldCert, a) || b.daysLeft - a.daysLeft),
)

/** 当前选中新证书是否为自动匹配的同名证书（回显"已自动匹配"标记） */
const newCertIsAutoMatch = computed<boolean>(
    () => !!props.newCert && matchScore(props.oldCert, props.newCert) >= 2,
)

/** 恰一个同名强匹配且新证书未选 → 自动带上 */
function tryAutoSelectNew() {
    if (props.newCert) return
    if (strongNewMatches.value.length === 1) {
        emit('update:newCert', strongNewMatches.value[0])
    }
}

// 旧证书变化（含 ?certId= 预选落定）→ 刷新新证书候选（排除项 + 自动匹配）
watch(
    () => props.oldCert?.id,
    () => void searchNew(''),
)

// 候选或旧证书就绪后尝试自动选中（用户已选时不覆盖）
watch(
    () => [newOptions.value, props.oldCert?.id] as const,
    () => tryAutoSelectNew(),
)

/** 无完整托管候选空态（首屏加载完成后判定；检索失败时展示错误态而非空态） */
const newEmpty = ref(false)
watch(
    newOptions,
    (v) => {
        newEmpty.value =
            v.length === 0 && !newLoading.value && !props.newCert && !newSearchError.value
    },
    { immediate: false },
)

// 首屏拉取候选（供下拉与空态判定���
void searchOld('')
void searchNew('')
</script>

<style lang="scss" scoped>
.step1 {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.intro-card {
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.intro-desc {
  margin: 8px 0 0;
  font-size: 13px;
}

.preselect-notice {
  border-radius: 8px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 1023px) {
    grid-template-columns: 1fr;
  }
}

.selector-card {
  h3 {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.selector {
  width: 100%;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.option-name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-fp {
  color: var(--text-secondary);
  font-size: 12px;
}

.option-days {
  margin-left: auto;
  color: #a1a1a1;
  font-size: 12px;
  white-space: nowrap;
}

.selected-card {
  margin-top: 16px;
  border: 1px solid color-mix(in srgb, var(--cert-accent, #0070f3) 45%, transparent);
  border-radius: 8px;
  padding: 12px;

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .selected-fp {
    margin-top: 8px;
  }
}

.chg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;

  &.tone-accent {
    color: #0070f3;
    border-color: color-mix(in srgb, #0070f3 40%, transparent);
  }

  &.tone-success {
    color: #50e3c2;
    border-color: color-mix(in srgb, #50e3c2 40%, transparent);
  }
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 12px;
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.new-empty {
  margin-top: 16px;
  border-radius: 8px;
}

.auto-match-note {
  margin-top: 12px;
  border-radius: 8px;
}

.auto-match-selected {
  margin-top: 12px;
  font-size: 12px;
  color: #50e3c2;
}

.search-error {
  margin-top: 16px;
  border-radius: 8px;
}

.new-empty-actions {
  margin-top: 8px;
}
</style>
