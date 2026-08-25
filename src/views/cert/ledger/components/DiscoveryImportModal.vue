<template>
  <el-dialog
    v-model="visible"
    width="760px"
    align-center
    class="cert-modal discovery-modal"
    :close-on-click-modal="false"
    aria-labelledby="discovery-import-title"
    @closed="onClosed"
  >
    <template #header>
      <h3 id="discovery-import-title" class="modal-title">从云端导入</h3>
    </template>

    <!-- 加载中 -->
    <div v-if="state === 'loading'" class="ds-loading" aria-label="正在加载云端发现预览">
      <div class="ds-loading-line" />
      <div class="ds-loading-line ds-loading-line-short" />
      <div class="ds-loading-line" />
    </div>

    <!-- 无 done 快照引导（任务 8：触发扫描 → 轮询 snapshot-status → done 重进预览 / failed 明细+重试） -->
    <div v-else-if="state === 'no-snapshot'" class="ds-state" data-testid="discovery-no-snapshot">
      <div class="ds-state-icon" aria-hidden="true">📡</div>
      <div class="ds-state-title">暂无可用的扫描快照</div>
      <div class="ds-state-desc">
        云端发现导入基于最近一次完成的证书引用扫描结果生成清单，请先执行扫描并等待完成，再返回此处预览可导入证书。
      </div>

      <!-- idle：触发前引导（进入分支时已查一次快照状态，非 running/failed 落在此态） -->
      <template v-if="scanState === 'idle'">
        <div v-if="scanNotice" class="ds-scan-notice" role="status" data-testid="discovery-scan-notice">
          {{ scanNotice }}
        </div>
        <el-button
          type="primary"
          :loading="triggering"
          data-testid="discovery-trigger-scan"
          @click="triggerScan"
        >
          触发扫描并等待完成
        </el-button>
        <el-button data-testid="discovery-reload" :disabled="triggering" @click="loadPreview">重新检查</el-button>
      </template>

      <!-- running：扫描进行中（触发即转轮询，不依赖触发请求同步返回终态） -->
      <div
        v-else-if="scanState === 'running'"
        class="ds-scan-running"
        aria-live="polite"
        data-testid="discovery-scan-running"
      >
        <div class="ds-scan-spinner" aria-hidden="true" />
        <div class="ds-state-title">扫描进行中</div>
        <div class="ds-state-desc">
          正在五云与 K8s 上发现证书引用{{ scanStartedAtText ? `（开始于 ${scanStartedAtText}）` : '' }}，完成后将自动进入预览，无需手动刷新。
        </div>
      </div>

      <!-- failed：partialFailures 明细 + 重试入口 -->
      <div v-else class="ds-scan-failed" data-testid="discovery-scan-failed">
        <div class="ds-state-title">扫描未完成</div>
        <div class="ds-state-desc" data-testid="discovery-scan-failreason">
          {{ scanFailReason || '上次扫描未生成可用快照。' }}
        </div>
        <ul v-if="scanFailures.length > 0" class="ds-failures" data-testid="discovery-scan-failures">
          <li v-for="(f, i) in scanFailures" :key="i">{{ formatScanFailureEntry(f) }}</li>
        </ul>
        <div class="ds-scan-actions">
          <el-button type="primary" :loading="triggering" data-testid="discovery-retry-scan" @click="triggerScan">
            重试扫描
          </el-button>
          <el-button data-testid="discovery-reload" :disabled="triggering" @click="loadPreview">重新检查</el-button>
        </div>
      </div>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="state === 'error'" class="ds-state" data-testid="discovery-error">
      <div class="ds-state-icon ds-state-icon-error" aria-hidden="true">⚠</div>
      <div class="ds-state-title">预览加载失败</div>
      <div class="ds-state-desc">{{ errorMsg }}</div>
      <el-button @click="loadPreview">重试</el-button>
    </div>

    <!-- 导入进度（任务 7：确认后切换；进度计数 + 逐条结果 + 终态失败原因可见） -->
    <div v-else-if="state === 'importing'" class="ds-import" data-testid="discovery-import-progress">
      <template v-if="importRunning">
        <el-progress :percentage="importPercent" :stroke-width="8" :show-text="false" aria-label="云端发现导入进度" />
        <div class="ds-import-progresstext" data-testid="discovery-import-progress-text" aria-live="polite">
          导入中：{{ importSummary.done }}/{{ importSummary.total }} · 成功 {{ importSummary.succeeded }} · 失败
          {{ importSummary.failed }}
        </div>
      </template>
      <div v-else class="ds-import-summary" aria-live="polite" data-testid="discovery-import-summary">
        <span v-if="importStatus === 'completed'" class="ds-import-flag ds-import-flag-ok">✓ 全部完成</span>
        <span v-else class="ds-import-flag ds-import-flag-err">✗ 部分失败</span>
        <span class="ds-import-meta">成功 {{ importSummary.succeeded }} / 失败 {{ importSummary.failed }}</span>
      </div>

      <div class="ds-import-list">
        <div
          v-for="it in importItems"
          :key="discoveryEntryKey(it)"
          class="ds-import-row"
          :class="{ 'ds-import-row-muted': it.result === 'pending' }"
          data-testid="discovery-import-item"
        >
          <span class="ds-cert-id" :title="it.cloudCertId">{{ it.cloudCertId }}</span>
          <span class="ds-account">{{ cloudDisplayName(it.cloud) }} · {{ it.accountKey }}</span>
          <span class="ds-tag" :class="`ds-import-tone-${discoveryItemResultMeta(it.result).tone}`">
            {{ discoveryItemResultMeta(it.result).label }}
          </span>
          <span v-if="it.result === 'success' && it.mappedCertId" class="ds-import-note">{{ it.mappedCertId }}</span>
          <span
            v-else-if="it.errorReason"
            class="ds-import-note ds-import-note-error"
            data-testid="discovery-import-item-error"
          >
            {{ it.errorReason }}
          </span>
        </div>
      </div>
      <p v-if="!importRunning && importSummary.failed > 0" class="ds-import-hint">
        失败条目不中断会话；可重新打开预览仅重跑剩余项（已在台账项自动跳过，幂等）。
      </p>
    </div>

    <!-- 预览清单 -->
    <template v-else-if="state === 'loaded'">
      <el-alert
        v-if="stale"
        type="warning"
        :closable="false"
        show-icon
        class="ds-stale-alert"
        data-testid="discovery-stale-alert"
      >
        快照已超过 {{ SNAPSHOT_STALE_DAYS }} 天（{{ snapshotTimeText }}），清单可能与云端现状存在漂移，建议先重新执行引用扫描。
      </el-alert>

      <div class="ds-meta" aria-live="polite">
        <span>共 {{ summary.total }} 张证书</span>
        <span class="ds-meta-dot" aria-hidden="true">·</span>
        <span>待登记 {{ summary.selectable }}</span>
        <span class="ds-meta-dot" aria-hidden="true">·</span>
        <span>已在台账 {{ summary.inLedger }}</span>
        <span class="ds-meta-dot" aria-hidden="true">·</span>
        <span>暂不支持 {{ summary.unsupported }}</span>
        <span class="ds-meta-spacer" />
        <span class="ds-meta-time">快照时间：{{ snapshotTimeText || '—' }}</span>
      </div>

      <div v-if="groups.length === 0" class="ds-state" data-testid="discovery-empty-list">
        <div class="ds-state-title">快照内未发现可展示的云端证书</div>
        <div class="ds-state-desc">可重新执行引用扫描后再次预览。</div>
      </div>

      <!-- 按云分组（大清单分组折叠即可，无需虚拟滚动） -->
      <div v-else class="ds-groups">
        <div
          v-for="g in groups"
          :key="g.cloud"
          class="ds-group"
          :class="{ 'ds-group-unsupported': g.unsupported }"
          data-testid="discovery-group"
        >
          <div
            class="ds-group-head"
            role="button"
            tabindex="0"
            :aria-expanded="!isCollapsed(g.cloud)"
            :aria-label="`分组 ${g.label}（${g.entries.length} 张）`"
            @click="toggleCollapse(g.cloud)"
            @keydown.enter.prevent="toggleCollapse(g.cloud)"
          >
            <span class="ds-chevron" :class="{ 'ds-chevron-open': !isCollapsed(g.cloud) }" aria-hidden="true">▸</span>
            <span
              v-if="!g.unsupported"
              class="ds-group-check"
              data-testid="discovery-group-check"
              @click.stop
              @keydown.stop
            >
              <el-checkbox
                :model-value="groupChecked(g)"
                :indeterminate="groupIndeterminate(g)"
                :aria-label="`全选 ${g.label} 待登记证书`"
                @change="() => toggleGroup(g)"
              />
            </span>
            <span v-else class="ds-group-lock" aria-hidden="true">🔒</span>
            <span class="ds-group-title">{{ g.label }}</span>
            <span class="ds-group-count">{{ g.entries.length }} 张</span>
            <span v-if="g.unsupported" class="ds-group-hint" data-testid="discovery-unsupported-hint">
              {{ g.unsupportedHint }}
            </span>
            <span v-else-if="groupSelectableCount(g) === 0" class="ds-group-hint">全部已在台账</span>
          </div>
          <div v-show="!isCollapsed(g.cloud)" class="ds-rows">
            <div
              v-for="e in g.entries"
              :key="discoveryEntryKey(e)"
              class="ds-row"
              :class="{ 'ds-row-muted': !isEntrySelectable(e) }"
              data-testid="discovery-row"
            >
              <el-checkbox
                :model-value="selected.has(discoveryEntryKey(e))"
                :disabled="!isEntrySelectable(e)"
                :aria-label="`选择 ${e.cloudCertId}`"
                data-testid="discovery-row-check"
                @change="() => toggleEntry(e)"
              />
              <span class="ds-cert-id" :title="e.cloudCertId">{{ e.cloudCertId }}</span>
              <span class="ds-account" :title="e.accountKey">{{ e.accountKey }}</span>
              <span class="ds-refcount">{{ e.refCount }} 个引用</span>
              <span class="ds-notafter" :class="{ 'ds-notafter-pending': e.notAfter === NOT_AFTER_PENDING }">
                {{ formatNotAfter(e.notAfter) }}
              </span>
              <span v-if="e.inLedger" class="ds-tag ds-tag-muted" data-testid="discovery-inledger-tag">已在台账</span>
              <span v-else-if="e.parseReason" class="ds-tag" data-testid="discovery-reason-tag">
                {{ parseReasonHint(e.parseReason) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <!-- 进度视图：running 期间仍可关闭（会话服务端持久化，浏览器中断不丢结果；重开预览即最新台账口径） -->
      <template v-if="state === 'importing'">
        <el-button @click="visible = false">关闭</el-button>
        <el-button v-if="importRunning" type="primary" disabled>导入中…</el-button>
        <el-button v-else type="primary" @click="visible = false">完成</el-button>
      </template>
      <template v-else>
        <el-button :disabled="state === 'loading' || importing" @click="visible = false">关闭</el-button>
        <!-- 确认导入：POST /discovery/import → 切换进度视图轮询（任务 7） -->
        <el-button
          type="primary"
          :loading="importing"
          :disabled="selectedCount === 0"
          data-testid="discovery-import-submit"
          @click="onConfirmImport"
        >
          导入所选（{{ selectedCount }} 张）
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 从云端导入预览 Modal（cert-cloud-discovery-import 任务 6 + 任务 8 无快照引导 +
 * 任务 7 确认导入与进度轮询）。
 *
 * 数据源：最近 done 扫描快照的纯 DB 聚合（GET /certs/discovery/preview），
 * 无 done 快照 → 409 NO_SNAPSHOT 进入引导分支（任务 8）：先查一次
 * snapshot-status 区分「从未扫描→触发首次扫描 / running→轮询 / failed→
 * partialFailures 明细+重试」，触发扫描沿用既有 POST /certs/:id/scan
 * （同步至终态语义——不等待其响应体，触发即转 snapshot-status 轮询，
 * 409 SCAN_IN_PROGRESS 防重与请求超时/中断均由轮询兜底）。
 * 交互：按云分组（组折叠承载大清单）、已在台账灰选不可勾、不可解析组
 * （华为云/AWS IAM-hosted）整组不可选并提示、默认全选未登记可选项、
 * 快照超 7 天显著提示建议重扫、未登记 notAfter 占位「—（导入后补全）」。
 * 确认导入（任务 7）：勾选三元组 POST /discovery/import（202 初始快照）→
 * 切换进度视图按批量导入同族间隔（2s setInterval + in-flight 防重入 + 单次
 * 失败退避）轮询 GET 会话进度直至终态（completed/partial_failed），进度计数
 * 与逐条结果/失败原因（errorReason）可见；终态停轮询并 emit completed 供
 * 父级刷新台账列表（新增登记项立即可见）。浏览器中断不丢结果（会话服务端
 * 持久化）：running 期关闭仅停本地轮询，不做复杂恢复 UI（重开预览即最新
 * 台账口径，重跑入口保留、幂等）。
 * 独立新组件：不修改 BatchImportModal/进度组件内部实现（Hard Rule）。
 * 视图逻辑收敛在 ../discovery.ts 纯函数层（分组/判定/过期计算/进度派生）。
 */
import type {
    DiscoveryImportItem,
    DiscoveryImportSession,
    DiscoveryImportStatus,
    DiscoveryPreviewEntry,
    DiscoveryPreviewResponse,
    DiscoverySnapshotStatus,
    ScanChannelFailure,
} from '@/api/cert'
import {
    getDiscoveryImportApi,
    getDiscoveryPreviewApi,
    getDiscoverySnapshotStatusApi,
    listCertsApi,
    startDiscoveryImportApi,
    triggerCertScanApi,
} from '@/api/cert'
import { ElAlert, ElButton, ElCheckbox, ElDialog, ElMessage, ElProgress } from 'element-plus'
import { computed, onBeforeUnmount, ref } from 'vue'
import { batchProgressPercent } from '../format'
import {
    DISCOVERY_IMPORT_POLL_INTERVAL_MS,
    DISCOVERY_NOT_AFTER_PENDING,
    DISCOVERY_SCAN_POLL_INTERVAL_MS,
    DISCOVERY_SNAPSHOT_STALE_DAYS,
    cloudDisplayName,
    defaultSelection,
    discoveryEntryKey,
    discoveryItemResultMeta,
    formatNotAfter,
    formatScanFailureEntry,
    formatSnapshotTime,
    groupPreviewEntries,
    groupSelectableKeys,
    isDiscoveryImportTerminal,
    isEntrySelectable,
    isNoSnapshotError,
    isSnapshotStale,
    parseReasonHint,
    summarizeImportSession,
    summarizePreview,
} from '../discovery'

/** 模板直接使用的常量（script setup 模板作用域） */
const SNAPSHOT_STALE_DAYS = DISCOVERY_SNAPSHOT_STALE_DAYS
const NOT_AFTER_PENDING = DISCOVERY_NOT_AFTER_PENDING

type ModalState = 'loading' | 'loaded' | 'no-snapshot' | 'error' | 'importing'

/** 无快照引导子状态（进入分支时先查一次 snapshot-status 收敛到此态机） */
type ScanGuideState = 'idle' | 'running' | 'failed'

const emit = defineEmits<{
    /** 导入会话到达终态（completed/partial_failed）：父级刷新台账列表与统计 */
    (e: 'completed'): void
}>()

const visible = ref(false)
const state = ref<ModalState>('loading')
const errorMsg = ref('')
const preview = ref<DiscoveryPreviewResponse | null>(null)
/** 勾选键集（cloud|accountKey|cloudCertId）；整体替换保持不可变更新 */
const selected = ref<Set<string>>(new Set())
/** 折叠的分组 cloud 键集（默认全展开） */
const collapsed = ref<Set<string>>(new Set())

// ===== 确认导入与进度轮询（任务 7） =====

/** 导入会话（POST 202 初始快照起，轮询整体替换保持不可变更新��� */
const importSession = ref<DiscoveryImportSession | null>(null)
/** 确认导入提交中（POST /discovery/import 在途窗口） */
const importing = ref(false)
let importTimer: ReturnType<typeof setInterval> | null = null
let importPollInFlight = false
/** 终态完成事件已发标记（同一会话至多 emit 一次 completed） */
let importCompletedEmitted = false

// ===== 无快照引导（任务 8） =====

const scanState = ref<ScanGuideState>('idle')
/** 触发中（解析触发入口 + 发出触发请求的短暂窗口；轮询期按钮退化为不可重复触发） */
const triggering = ref(false)
const scanStartedAtText = ref('')
const scanFailReason = ref('')
const scanFailures = ref<ScanChannelFailure[]>([])
/** idle 态内联提示（空台账无法挂载既有触发端点等非错误堆栈信息��� */
const scanNotice = ref('')
let statusTimer: ReturnType<typeof setInterval> | null = null
let statusPollInFlight = false

const groups = computed(() => (preview.value ? groupPreviewEntries(preview.value.items) : []))
const summary = computed(() => summarizePreview(preview.value?.items ?? []))
const stale = computed(() => isSnapshotStale(preview.value?.snapshotStartedAt))
const snapshotTimeText = computed(() => formatSnapshotTime(preview.value?.snapshotStartedAt))
const selectedCount = computed(() => selected.value.size)

// ===== 确认导入与进度轮询（任务 7） =====

const importItems = computed<DiscoveryImportItem[]>(() => importSession.value?.items ?? [])
const importStatus = computed<DiscoveryImportStatus>(() => importSession.value?.status ?? 'running')
const importRunning = computed(() => state.value === 'importing' && !isDiscoveryImportTerminal(importStatus.value))
const importSummary = computed(() =>
    importSession.value
        ? summarizeImportSession(importSession.value)
        : { total: 0, done: 0, succeeded: 0, failed: 0, pending: 0 },
)
const importPercent = computed(() => batchProgressPercent(importSummary.value.done, importSummary.value.total))

/**
 * 确认导入：勾选条目三元组 POST /discovery/import（202 初始快照）→ 切换
 * 进度视图并启动会话进度轮询。POST 失败留在预览视图 Toast 错误（可重试）。
 */
async function onConfirmImport() {
    if (importing.value || importRunning.value || selectedCount.value === 0) return
    const items = (preview.value?.items ?? [])
        .filter((e) => selected.value.has(discoveryEntryKey(e)))
        .map((e) => ({ cloud: e.cloud, accountKey: e.accountKey, cloudCertId: e.cloudCertId }))
    if (items.length === 0) return
    importing.value = true
    try {
        const s = await startDiscoveryImportApi(items)
        // 关闭竞态：POST 在途期间用户已关闭 Modal → 丢弃本地跟踪（服务端会话
        // 照常执行，结果由重开预览/父级刷新体现，不做复杂恢复 UI）
        if (!visible.value) return
        importSession.value = s
        state.value = 'importing'
        if (isDiscoveryImportTerminal(s.status)) {
            notifyImportFinished(s)
        } else {
            startImportPolling()
        }
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '云端导入会话创建失败')
    } finally {
        importing.value = false
    }
}

/**
 * 会话进度轮询（与批量导入进度轮询同族交互模式，不改其内部）：2s
 * setInterval + in-flight 防重入 + 单次失败退避下个周期；终态
 * （completed/partial_failed）停轮询并触发完成通告与列表刷新事件。
 */
function startImportPolling() {
    stopImportPolling()
    importTimer = setInterval(async () => {
        const id = importSession.value?.sessionId
        if (!id || importPollInFlight) return
        importPollInFlight = true
        try {
            const s = await getDiscoveryImportApi(id)
            if (importSession.value?.sessionId === id) importSession.value = s
            if (isDiscoveryImportTerminal(s.status)) {
                stopImportPolling()
                notifyImportFinished(s)
            }
        } catch {
            /* 单次轮询失败退避到下个周期（会话服务端持久化，不中断跟踪） */
        } finally {
            importPollInFlight = false
        }
    }, DISCOVERY_IMPORT_POLL_INTERVAL_MS)
}

function stopImportPolling() {
    if (importTimer) clearInterval(importTimer)
    importTimer = null
    importPollInFlight = false
}

/** 终态通告（一次）+ 完成事件（父级刷新台账：新增登记项立即可见） */
function notifyImportFinished(s: DiscoveryImportSession) {
    const sum = summarizeImportSession(s)
    if (s.status === 'completed') {
        ElMessage.success(`云端导入完成：${sum.succeeded} 成功 / ${sum.failed} 失败`)
    } else {
        ElMessage.warning(`云端导入部分失败：${sum.succeeded} 成功 / ${sum.failed} 失败，失败原因见逐条结果`)
    }
    if (!importCompletedEmitted) {
        importCompletedEmitted = true
        emit('completed')
    }
}

/** 打开 Modal 并加载预览（台账页空态 CTA / 工具栏按钮双入口调用） */
function open() {
    visible.value = true
    loadPreview()
}

async function loadPreview() {
    resetScanGuide()
    state.value = 'loading'
    errorMsg.value = ''
    selected.value = new Set()
    preview.value = null
    try {
        const res = await getDiscoveryPreviewApi()
        preview.value = res
        // 默认勾选全部未登记可选项（已在台账灰选、不可解析组不可选）
        selected.value = defaultSelection(res.items)
        state.value = 'loaded'
    } catch (err) {
        if (isNoSnapshotError(err)) {
            // 409 NO_SNAPSHOT → 引导分支：先查一次快照状态收敛子状态
            state.value = 'no-snapshot'
            void checkSnapshotStatus()
        } else {
            state.value = 'error'
            errorMsg.value = err instanceof Error ? err.message : '云端发现预览加载失败'
        }
    }
}

/**
 * 进入引导分支时的快照状态首查：区分「从未扫描（hasSnapshot=false）→
 * 触发首次扫描」/「running → 直接轮询」/「failed → 明细+重试」/「done →
 * 预览 409 与本次查询之间快照恰好完成（竞态）→ 重取预览」。
 */
async function checkSnapshotStatus() {
    try {
        const st = await getDiscoverySnapshotStatusApi()
        if (state.value !== 'no-snapshot') return
        applySnapshotStatus(st)
    } catch {
        /* 首查失败保持 idle 引导（触发按钮仍可用，触发后由轮询兜底） */
    }
}

function applySnapshotStatus(st: DiscoverySnapshotStatus) {
    if (!st.hasSnapshot || !st.status) {
        scanState.value = 'idle'
        return
    }
    if (st.status === 'running') {
        enterRunning(st)
        return
    }
    if (st.status === 'failed') {
        enterFailed(st)
        return
    }
    // done：竞态下快照刚完成 → 直接重取预览进入列表
    void loadPreview()
}

/**
 * 触发扫描（idle 引导按钮 / failed 重试共用）。既有 POST /certs/:id/scan 为
 * 同步至终态语义——不等待其响应体（多账号规模下分钟级返回或被网关/浏览器
 * 超时中断），触发即转 snapshot-status 轮询；409 SCAN_IN_PROGRESS（running
 * 防重）与请求中断同样由轮询兜底。该端点需挂载一张台账证书（存在性校验
 * 404），空台账时给出定时扫描提示（后端每日 02:00 天级全量扫描）。
 */
async function triggerScan() {
    if (triggering.value || scanState.value === 'running') return
    triggering.value = true
    scanNotice.value = ''
    try {
        const res = await listCertsApi({ page: 1, pageSize: 1 })
        const certId = res.items[0]?.id
        if (!certId) {
            scanNotice.value =
                '台账暂无证书可挂载扫描触发：系统每日 02:00 定时执行全量扫描，可稍后重试，或先手工导入证书后再次触发。'
            return
        }
        // fire-and-forget：不 await 响应体终态，立即进入轮询视图
        void triggerCertScanApi(certId).catch(() => {
            /* 触发请求失败/中断由轮询兜底（后端 running 防重 + 15 分钟超时恢复） */
        })
        enterRunning()
    } catch {
        scanNotice.value = '暂时无法触发扫描，请稍后重试。'
    } finally {
        triggering.value = false
    }
}

/** 进入 running 子状态并启动 snapshot-status 轮询（幂等：重复调用先停旧定时器） */
function enterRunning(st?: DiscoverySnapshotStatus) {
    scanState.value = 'running'
    scanNotice.value = ''
    scanFailReason.value = ''
    scanFailures.value = []
    scanStartedAtText.value = st?.startedAt ? formatSnapshotTime(st.startedAt) : ''
    startStatusPolling()
}

/** 进入 failed 子状态（partialFailures 明细 + failReason） */
function enterFailed(st: Pick<DiscoverySnapshotStatus, 'failReason' | 'partialFailures'>) {
    stopStatusPolling()
    scanState.value = 'failed'
    scanNotice.value = ''
    scanFailReason.value = st.failReason ?? ''
    scanFailures.value = [...st.partialFailures]
}

/**
 * snapshot-status 轮询（与批量导入进度轮询同族：2s setInterval + in-flight
 * 防重入 + 单次失败退避下个周期）。done → 停轮询并自动重取预览进入列表；
 * failed → 停轮询进明细视图；hasSnapshot=false（快照被清理等漂移）→ 回 idle。
 */
function startStatusPolling() {
    stopStatusPolling()
    statusTimer = setInterval(async () => {
        if (!visible.value || statusPollInFlight) return
        statusPollInFlight = true
        try {
            const st = await getDiscoverySnapshotStatusApi()
            if (state.value !== 'no-snapshot') return
            if (!st.hasSnapshot || !st.status) {
                // 快照消失（漂移）：回 idle 引导，等待用户重新触发
                stopStatusPolling()
                scanState.value = 'idle'
                return
            }
            if (st.status === 'running') {
                if (!scanStartedAtText.value && st.startedAt) {
                    scanStartedAtText.value = formatSnapshotTime(st.startedAt)
                }
                return
            }
            stopStatusPolling()
            if (st.status === 'done') {
                // done → 自动拉取预览进入列表（AC：不依赖手动刷新）
                await loadPreview()
            } else {
                enterFailed(st)
            }
        } catch {
            /* 单次轮询失败退避到下个周期，不打断引导 */
        } finally {
            statusPollInFlight = false
        }
    }, DISCOVERY_SCAN_POLL_INTERVAL_MS)
}

function stopStatusPolling() {
    if (statusTimer) clearInterval(statusTimer)
    statusTimer = null
    statusPollInFlight = false
}

/** 重置无快照引导子状态（重取预览 / 关闭 Modal 时；同时停轮询） */
function resetScanGuide() {
    stopStatusPolling()
    scanState.value = 'idle'
    triggering.value = false
    scanStartedAtText.value = ''
    scanFailReason.value = ''
    scanFailures.value = []
    scanNotice.value = ''
}

function onClosed() {
    // 重开时 loadPreview 会整体重置；关闭即丢弃当前预览/导入态���快照时点数据
    // 不跨会话驻留；导入会话由服务端持久化，重开按最新台账口径重取预览）
    resetScanGuide()
    stopImportPolling()
    importSession.value = null
    importing.value = false
    importCompletedEmitted = false
    preview.value = null
    selected.value = new Set()
    collapsed.value = new Set()
    state.value = 'loading'
    errorMsg.value = ''
}

// 组件卸载兜底停轮询（测试 unmount / 页面离开；含快照状态与导入进度两类轮询）
onBeforeUnmount(() => {
    stopStatusPolling()
    stopImportPolling()
})

// ===== 分组折叠（大清单性能：分组折叠即可，无需虚拟滚动） =====

function isCollapsed(cloud: string): boolean {
    return collapsed.value.has(cloud)
}

function toggleCollapse(cloud: string) {
    const next = new Set(collapsed.value)
    if (next.has(cloud)) {
        next.delete(cloud)
    } else {
        next.add(cloud)
    }
    collapsed.value = next
}

// ===== 勾选交互 =====

function groupSelectableCount(g: { entries: DiscoveryPreviewEntry[] }): number {
    return groupSelectableKeys(g).length
}

function groupChecked(g: { entries: DiscoveryPreviewEntry[] }): boolean {
    const keys = groupSelectableKeys(g)
    return keys.length > 0 && keys.every((k) => selected.value.has(k))
}

function groupIndeterminate(g: { entries: DiscoveryPreviewEntry[] }): boolean {
    const keys = groupSelectableKeys(g)
    const hit = keys.filter((k) => selected.value.has(k)).length
    return hit > 0 && hit < keys.length
}

/** 组头复选框：全选/清空本组待登记项（不可选条目不受影响） */
function toggleGroup(g: { entries: DiscoveryPreviewEntry[] }) {
    const keys = groupSelectableKeys(g)
    if (keys.length === 0) return
    const allSelected = keys.every((k) => selected.value.has(k))
    const next = new Set(selected.value)
    for (const k of keys) {
        if (allSelected) {
            next.delete(k)
        } else {
            next.add(k)
        }
    }
    selected.value = next
}

/** 行复选框切换（disabled 行不会触发 change，无需二次防御） */
function toggleEntry(e: DiscoveryPreviewEntry) {
    const key = discoveryEntryKey(e)
    const next = new Set(selected.value)
    if (next.has(key)) {
        next.delete(key)
    } else {
        next.add(key)
    }
    selected.value = next
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

// ===== 加载骨架 =====
.ds-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 0 16px;
}

.ds-loading-line {
  height: 14px;
  border-radius: 6px;
  background: var(--cert-surface-alt, rgba(255, 255, 255, 0.05));
  animation: ds-loading-wave 1.2s ease-in-out infinite;

  &.ds-loading-line-short {
    width: 60%;
  }
}

@keyframes ds-loading-wave {
  0% {
    opacity: 0.4;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ds-loading-line {
    animation: none;
  }
}

// ===== 状态分支（无快照引导占位 / 错误 / 空清单） =====
.ds-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 24px;
  text-align: center;
}

.ds-state-icon {
  font-size: 32px;
  line-height: 1;
}

.ds-state-icon-error {
  color: var(--cert-error, #ee0000);
}

.ds-state-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.ds-state-desc {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 480px;
}

.ds-state-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

// ===== 无快照引导子状态（任务 8：触发前提示 / 扫描进行中 / 失败明细） =====
.ds-scan-notice {
  font-size: 12px;
  color: var(--cert-warning-deep, #d98c0a);
  max-width: 480px;
  line-height: 1.6;
}

.ds-scan-running {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.ds-scan-spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border-base);
  border-top-color: var(--cert-accent, #0070f3);
  animation: ds-scan-spin 0.8s linear infinite;
  margin: 4px 0 2px;
}

@keyframes ds-scan-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ds-scan-spinner {
    animation: none;
  }
}

.ds-scan-failed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.ds-failures {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 520px;
  max-height: 180px;
  overflow-y: auto;
  text-align: left;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;

  li {
    font-size: 12px;
    color: var(--text-secondary);
    padding: 5px 10px;
    line-height: 1.5;
    word-break: break-all;

    & + li {
      border-top: 1px solid var(--border-subtle);
    }
  }
}

.ds-scan-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

// ===== 快照过期提示 =====
.ds-stale-alert {
  margin-bottom: 12px;
}

// ===== 摘要行 =====
.ds-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 0 0 10px;
  flex-wrap: wrap;
}

.ds-meta-spacer {
  flex: 1;
}

.ds-meta-time {
  font-size: 12px;
}

// ===== 分组 =====
.ds-groups {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.ds-group {
  & + & {
    border-top: 1px solid var(--border-base);
  }
}

.ds-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--cert-surface-alt, rgba(255, 255, 255, 0.05));
  font-size: 13px;
  user-select: none;

  &:hover {
    background: color-mix(in srgb, var(--cert-accent, #0070f3) 6%, transparent);
  }
}

.ds-chevron {
  display: inline-block;
  transition: transform 150ms ease;
  color: var(--text-secondary);
  font-size: 12px;

  &.ds-chevron-open {
    transform: rotate(90deg);
  }
}

.ds-group-check {
  display: inline-flex;
}

.ds-group-lock {
  font-size: 13px;
}

.ds-group-title {
  font-weight: 600;
  color: var(--text-primary);
}

.ds-group-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.ds-group-hint {
  font-size: 12px;
  color: var(--cert-warning-deep, #d98c0a);
}

.ds-group-unsupported .ds-group-title {
  color: var(--text-secondary);
}

// ===== 条目行 =====
.ds-rows {
  display: flex;
  flex-direction: column;
}

.ds-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 8px 28px;
  font-size: 13px;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }
}

.ds-row-muted {
  opacity: 0.55;
}

.ds-cert-id {
  font-family: var(--cert-font-mono, monospace);
  font-size: 12px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.ds-account {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

.ds-refcount {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ds-notafter {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
}

.ds-notafter-pending {
  color: var(--text-secondary);
}

.ds-tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--cert-accent, #0070f3) 40%, transparent);
  color: var(--cert-accent, #0070f3);
  white-space: nowrap;

  &.ds-tag-muted {
    color: var(--text-secondary);
    border-color: var(--border-base);
  }
}

// ===== 导入进度视图（任务 7：进度计数 + 逐条结果 + 终态失败原因） =====
.ds-import {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ds-import-progresstext {
  font-size: 13px;
  color: var(--text-secondary);
}

.ds-import-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.ds-import-flag {
  font-weight: 600;
  color: var(--text-primary);

  &.ds-import-flag-ok {
    color: var(--cert-success, #50e3c2);
  }

  &.ds-import-flag-err {
    color: var(--cert-error, #ee0000);
  }
}

.ds-import-meta {
  color: var(--text-secondary);
}

.ds-import-list {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.ds-import-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;

  & + & {
    border-top: 1px solid var(--border-subtle);
  }
}

.ds-import-row-muted {
  opacity: 0.55;
}

.ds-import-tone-accent {
  color: var(--cert-accent, #0070f3);
  border-color: color-mix(in srgb, var(--cert-accent, #0070f3) 40%, transparent);
}

.ds-import-tone-secondary {
  color: var(--text-secondary);
  border-color: var(--border-base);
}

.ds-import-tone-error {
  color: var(--cert-error, #ee0000);
  border-color: color-mix(in srgb, var(--cert-error, #ee0000) 40%, transparent);
}

.ds-import-note {
  font-family: var(--cert-font-mono, monospace);
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.ds-import-note-error {
    color: var(--cert-error, #ee0000);
  }
}

.ds-import-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
