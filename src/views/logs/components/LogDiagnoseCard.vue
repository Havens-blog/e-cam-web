<template>
  <div class="diagnose-card">
    <!-- 折叠头:独立于统计/明细区块,仅 WAF Tab 由父级条件渲染 -->
    <button
      type="button"
      class="diagnose-toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <el-icon :size="14">
        <ArrowDown v-if="expanded" />
        <ArrowRight v-else />
      </el-icon>
      <span class="toggle-title">流量诊断</span>
      <span class="toggle-hint">WAF 被刷检测:对当前查询做风险判定,手动触发(多一帧前窗聚合扫描)</span>
    </button>

    <div v-show="expanded" class="diagnose-body">
      <!-- 触发行:复用当前查询上下文(时间窗/云/域名/检索式/字段筛选) -->
      <div class="diagnose-actions">
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!context"
          aria-label="开始流量诊断"
          @click="runDiagnose"
        >
          {{ hasResult ? '重新诊断' : '开始诊断' }}
        </el-button>
        <span v-if="context" class="diagnose-scope" :title="scopeTitle">
          诊断范围:{{ scopeTitle }}
        </span>
      </div>

      <!-- 加载态(当前窗 + 前窗两帧聚合,秒级到数十秒) -->
      <div v-if="loading" class="diagnose-progress" role="status" aria-live="polite">
        正在诊断(当前窗 + 前窗聚合)· 已耗时 {{ elapsed }} 秒,请稍候
      </div>

      <!-- 失败态(可重试) -->
      <div v-else-if="error" class="diagnose-error">
        <el-alert type="error" :closable="false" title="诊断失败" :description="error" />
        <el-button class="diagnose-retry" size="small" type="primary" plain @click="runDiagnose">
          重试
        </el-button>
      </div>

      <!-- 结果 -->
      <template v-else-if="resp">
        <div class="diagnose-result">
          <div class="diagnose-summary">
            <el-tag class="risk-tag" :type="riskLevelTagType(result.risk_level)" effect="dark">
              {{ riskLevelLabel(result.risk_level) }}
            </el-tag>
            <span class="risk-score">风险分 {{ result.risk_score }}/100</span>
            <el-tag class="attack-tag" :type="attackTypeTagType(result.attack_type)">
              疑似:{{ attackTypeLabel(result.attack_type) }}
            </el-tag>
            <el-tag v-if="resp.cached" class="cached-tag" type="info" size="small">缓存</el-tag>
            <span class="window-meta">
              窗口 {{ formatCount(resp.window_sec) }} 秒 · 共 {{ formatCount(resp.total) }} 次
            </span>
          </div>

          <!-- 降级/判据完整性标注(不白屏:降级仍渲染结论) -->
          <el-alert
            v-if="result.degraded"
            class="diagnose-alert-degraded"
            type="warning"
            :closable="false"
            title="判定降级"
            :description="result.degraded_reason || '部分判据缺失,结论按可用判据得出'"
          />
          <el-alert
            v-if="resp.dimension_notes"
            class="diagnose-alert-notes"
            type="info"
            :closable="false"
            :title="`部分判据缺失:${resp.dimension_notes}`"
          />

          <!-- 趋势对比:当前窗 vs 前一等长窗口 -->
          <div class="diagnose-trend">
            <div class="trend-row">
              <span class="trend-cur">当前窗 {{ formatCount(resp.total) }} 次</span>
              <span v-if="hasPrev" class="trend-prev">前窗 {{ formatCount(resp.prev!.total) }} 次</span>
              <span v-else class="trend-missing">前窗 无数据</span>
              <span class="trend-surge">突增:<b>{{ formatSurge(result.surge_multiplier) }}</b></span>
            </div>
            <div v-if="!hasPrev && resp.prev_error" class="trend-note">
              前窗对比不可用:{{ resp.prev_error }}
            </div>
          </div>

          <!-- Top 攻击源 IP(请求数 + 占比;点击追加 client_ip 筛选) -->
          <div class="diagnose-sources">
            <div class="section-title">Top 攻击源 IP</div>
            <div v-if="result.top_sources.length" class="source-list">
              <button
                v-for="(s, i) in result.top_sources"
                :key="s.ip"
                type="button"
                class="source-row drillable"
                :title="`筛选 来源IP = ${s.ip}`"
                @click="drill('client_ip', s.ip)"
              >
                <span class="rank">{{ i + 1 }}</span>
                <span class="src-ip">{{ s.ip }}</span>
                <span class="src-count">{{ formatCount(s.count) }} 次</span>
                <span class="src-share">{{ formatShare(s.share) }}</span>
              </button>
            </div>
            <div v-else class="section-empty">窗口内无 Top 攻击源数据</div>
          </div>

          <!-- 请求量高的 URI/URL(攻击目标/被刷路径定位;点击追加 uri 筛选) -->
          <div class="diagnose-uris">
            <div class="section-title">请求量高的 URI/URL</div>
            <div v-if="(resp.top_uris ?? []).length" class="source-list">
              <button
                v-for="(u, i) in (resp.top_uris ?? []).slice(0, 8)"
                :key="u.name"
                type="button"
                class="source-row drillable"
                :title="`筛选 请求路径 = ${u.name}`"
                @click="drill('uri', u.name)"
              >
                <span class="rank">{{ i + 1 }}</span>
                <span class="src-ip uri-name">{{ u.name }}</span>
                <span class="src-count">{{ formatCount(u.count) }} 次</span>
                <span class="src-share">{{ formatShare(resp.total ? u.count / resp.total : 0) }}</span>
              </button>
            </div>
            <div v-else class="section-empty">窗口内无 URI 分布数据(源未开索引,见上方判据标注)</div>
          </div>

          <!-- 状态码/动作分布(点击追加 status / action 筛选;用原生 button 承载
               点击,规避 el-tag 事件透传差异,与 IP/URI 行同一交互路径) -->
          <div class="diagnose-buckets">
            <div class="section-title">状态码分布</div>
            <div v-if="(resp.status_codes ?? []).length" class="bucket-tags">
              <button
                v-for="s in (resp.status_codes ?? []).slice(0, 6)"
                :key="s.name"
                type="button"
                class="bucket-tag drillable"
                :title="`筛选 状态码 = ${s.name}`"
                @click="drill('status', s.name)"
              >
                {{ s.name }} · {{ formatCount(s.count) }}
              </button>
            </div>
            <div v-else class="section-empty">窗口内无状态码分布数据</div>
          </div>
          <div class="diagnose-buckets">
            <div class="section-title">动作分布</div>
            <div v-if="(resp.actions ?? []).length" class="bucket-tags">
              <button
                v-for="a in (resp.actions ?? []).slice(0, 6)"
                :key="a.name"
                type="button"
                class="bucket-tag drillable"
                :title="`筛选 处置动作 = ${a.name}`"
                @click="drill('action', a.name)"
              >
                {{ a.name }} · {{ formatCount(a.count) }}
              </button>
            </div>
            <div v-else class="section-empty">窗口内无动作分布数据</div>
          </div>

          <!-- 来源分布(后端无地域聚合,按云账号展示各源窗口请求数) -->
          <div class="diagnose-geo">
            <div class="section-title">来源分布(按云账号)</div>
            <div v-if="resp.sources.length" class="geo-tags">
              <el-tag
                v-for="s in resp.sources"
                :key="s.cloud + s.account_id"
                class="geo-tag"
                :type="s.error ? 'danger' : 'info'"
                size="small"
                :title="s.error || undefined"
              >
                {{ cloudLabel(s.cloud) }}·{{ s.account_name }}:{{ s.error ? '失败' : formatCount(s.total) + ' 次' }}
              </el-tag>
            </div>
            <div v-else class="section-empty">无来源数据</div>
          </div>

          <!-- 措施清单(≥3 条,可复制) -->
          <div class="diagnose-measures">
            <div class="section-title">
              措施清单
              <el-button
                class="measures-copy"
                size="small"
                text
                type="primary"
                aria-label="复制措施清单"
                @click="copyMeasures"
              >
                复制
              </el-button>
            </div>
            <ol class="measures">
              <li v-for="(m, i) in result.measures" :key="i">{{ m }}</li>
            </ol>
          </div>

          <!-- AI 解读(后置:后端占位字段,接入模型前恒空串,不渲染) -->
          <div v-if="resp.summary" class="diagnose-summary-text">{{ resp.summary }}</div>
        </div>
      </template>

      <!-- 空闲提示 -->
      <div v-else class="diagnose-idle">
        点击「开始诊断」对当前查询窗口执行被刷判定(当前窗 + 前窗两帧聚合,手动触发以控制扫描成本)
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * WAF 流量诊断卡(任务 3):折叠卡 + 手动触发 + 结果展示/降级。
 * - 请求体 = 当前查询上下文(时间窗/云/域名/检索式/字段筛选)+ log_type:waf;
 *   无 dimension/metric(维度集由后端诊断编排固定);
 * - 展示:风险等级徽标(el-tag 色映射 高=danger/中=warning/低=primary/无=success)、
 *   风险分、疑似攻击类型、Top 攻击源 IP(请求数+占比)、来源分布(按云账号)、
 *   趋势对比(突增倍数)、措施清单(可复制);
 * - 降级不白屏:前窗缺失(prev 缺省/prev_error)、degraded、dimension_notes
 *   均给提示,结论照常渲染;失败可重试;
 * - 独立于既有统计/明细区块,不改变其行为;不引入任何模型调用(AI 解读后置,
 *   summary 为后端占位)。
 */
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import type { LogDiagnoseContext, LogDiagnoseResponse } from '@/api/types/logs'
import { diagnoseLogsApi } from '@/api/logs'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, ref } from 'vue'
import {
    attackTypeLabel,
    attackTypeTagType,
    formatCount,
    formatShare,
    formatSurge,
    riskLevelLabel,
    riskLevelTagType,
} from '../diagnose'
import { cloudLabel, formatLogTime } from '../format'

const props = defineProps<{
    /** 诊断上下文(父组件按当前查询组装;null = 时间窗未就绪) */
    context: LogDiagnoseContext | null
}>()

/** 下钻事件:点击 Top 源/URI/状态码/动作 → 父组件追加字段筛选并重查(判定→定位闭环) */
const emit = defineEmits<{
    (e: 'drilldown', payload: { field: string; value: string }): void
}>()

/** 点击发射下钻;value 内部有符号时按原值(匹配语义交给筛选项,不做转义) */
function drill(field: string, value: string) {
    if (!value || value === '—' || value === '-') return
    emit('drilldown', { field, value })
}

const expanded = ref(false)
const loading = ref(false)
const error = ref('')
const resp = ref<LogDiagnoseResponse | null>(null)

const hasResult = computed(() => resp.value !== null)
const result = computed(() => resp.value!.result)
/** 前窗是否可用(缺省 = 前窗不可用/无数据,total=0 = 前窗确实为空) */
const hasPrev = computed(() => resp.value?.prev !== undefined)

const scopeTitle = computed(() => {
    if (!props.context) return ''
    return `${formatLogTime(props.context.start_time)} → ${formatLogTime(props.context.end_time)}`
})

// ---- 诊断进行中计时(与查询进度态同款文字化回馈) ----
const elapsed = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startTimer() {
    stopTimer()
    elapsed.value = 0
    timer = setInterval(() => {
        elapsed.value += 1
    }, 1000)
}

function stopTimer() {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
}

onBeforeUnmount(stopTimer)

async function runDiagnose() {
    if (loading.value || !props.context) return
    loading.value = true
    error.value = ''
    startTimer()
    try {
        resp.value = await diagnoseLogsApi({ log_type: 'waf', ...props.context })
    } catch (e) {
        resp.value = null
        error.value = e instanceof Error ? e.message : String(e)
    } finally {
        stopTimer()
        loading.value = false
    }
}

async function copyMeasures() {
    if (!resp.value) return
    try {
        await navigator.clipboard.writeText((resp.value.result.measures ?? []).join('\n'))
        ElMessage.success('措施清单已复制')
    } catch {
        ElMessage.error('复制失败,请手动选择文本复制')
    }
}
</script>

<style scoped>
.diagnose-card {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 8px;
}
.diagnose-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--el-text-color-primary);
    font-size: 13px;
    border-radius: 4px;
}
.diagnose-toggle:hover {
    background: var(--el-fill-color-light);
}
.toggle-title {
    font-weight: 600;
}
.toggle-hint {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: normal;
}
.diagnose-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px;
}
.diagnose-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.diagnose-scope {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.diagnose-progress {
    font-size: 13px;
    color: var(--el-text-color-primary);
}
.diagnose-error {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
}
.diagnose-result {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.diagnose-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.risk-score {
    font-weight: 600;
    font-size: 13px;
}
.window-meta {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-left: auto;
}
.trend-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
}
.trend-missing {
    color: var(--el-color-warning);
}
.trend-surge b {
    color: var(--el-color-danger);
}
.trend-note {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
}
.section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 4px;
}
.section-empty {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.source-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 0;
    font-size: 13px;
}
/* 可下钻行/标签:按钮语义重置 + hover 提示可点击 */
.drillable {
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font: inherit;
    border-radius: 4px;
}
.source-row.drillable {
    padding: 3px 6px;
}
.source-row.drillable:hover {
    background: var(--el-fill-color-light);
}
.bucket-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
/* 标签观感的原生按钮:视觉贴近 el-tag(背景/圆角/小字号),语义为按钮可点 */
.bucket-tag {
    border: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 12px;
    line-height: 1.6;
    cursor: pointer;
    transition: all 0.15s;
}
.bucket-tag:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
}
.source-row .rank {
    width: 18px;
    color: var(--el-text-color-secondary);
}
.source-row .src-ip {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
    min-width: 120px;
}
/* 长 URI 限宽省略,完整值在 title */
.source-row .uri-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 60%;
}
.source-row .src-share {
    color: var(--el-text-color-secondary);
}
.geo-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.measures {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.9;
}
.diagnose-summary-text {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}
</style>
