<template>
  <div class="cache-card">
    <!-- 折叠头:独立于统计/明细区块,仅 CDN Tab 由父级条件渲染 -->
    <button
      type="button"
      class="cache-toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <el-icon :size="14">
        <ArrowDown v-if="expanded" />
        <ArrowRight v-else />
      </el-icon>
      <span class="toggle-title">缓存分析</span>
      <span class="toggle-hint">CDN 缓存健康度:双口径命中率/未命中归因/优化建议,手动触发(当前窗 + 前窗两帧聚合扫描)</span>
    </button>

    <div v-show="expanded" class="cache-body">
      <!-- 触发行:复用当前查询上下文(时间窗/云/域名/检索式/字段筛选) -->
      <div class="cache-actions">
        <el-button
          type="primary"
          :loading="loading"
          :disabled="!context"
          aria-label="开始缓存分析"
          @click="runAnalyze()"
        >
          {{ hasResult ? '重新分析' : '开始分析' }}
        </el-button>
        <span v-if="context" class="cache-scope" :title="scopeTitle">
          分析范围:{{ scopeTitle }}
        </span>
      </div>

      <!-- 加载态(当前窗 5 维度组 + 前窗 1 帧,秒级到数十秒) -->
      <div v-if="loading" class="cache-progress" role="status" aria-live="polite">
        正在分析(当前窗 + 前窗聚合)· 已耗时 {{ elapsed }} 秒,请稍候
      </div>

      <!-- 失败态(可重试;预估扫描量拦截时给出确认放行) -->
      <div v-else-if="error" class="cache-error">
        <el-alert type="error" :closable="false" title="分析失败" :description="error" />
        <div class="cache-error-actions">
          <el-button size="small" type="primary" plain @click="runAnalyze()">
            重试
          </el-button>
          <el-button
            v-if="scanConfirmNeeded"
            size="small"
            type="warning"
            aria-label="确认并继续分析"
            @click="runAnalyze(true)"
          >
            确认并继续分析
          </el-button>
        </div>
      </div>

      <!-- 结果 -->
      <template v-else-if="resp">
        <div class="cache-result">
          <div class="cache-summary">
            <el-tag class="grade-tag" :type="cacheGradeTagType(result.grade)" effect="dark">
              {{ cacheGradeLabel(result.grade) }}
            </el-tag>
            <span class="grade-note">健康档位(可缓存口径)</span>
            <el-tag v-if="resp.cached" class="cached-tag" type="info" size="small">缓存</el-tag>
            <span class="window-meta">
              窗口 {{ formatCount(resp.window_sec) }} 秒 · 共 {{ formatCount(resp.total) }} 次 ·
              {{ formatCacheBytes(resp.total_bytes) }}
            </span>
          </div>

          <!-- 维度缺失/覆盖范围标注(不白屏:降级仍渲染结论) -->
          <el-alert
            v-if="resp.dimension_notes"
            class="cache-alert-notes"
            type="info"
            :closable="false"
            :title="`部分判据缺失:${resp.dimension_notes}`"
          />

          <!-- 双命中率总览(请求/字节 × 全请求/可缓存;口径标注逐条列出) -->
          <div class="cache-overview">
            <div class="section-title">命中率总览(已覆盖源命中率)</div>
            <div class="rate-grid">
              <div class="rate-cell">
                <span class="rate-label">请求命中率(全请求)</span>
                <span class="rate-value">{{ tierRateText(result.request_hit_rate.all) }}</span>
                <div class="rate-bar"><div class="rate-bar-fill" :style="{ width: tierPct(result.request_hit_rate.all) }" /></div>
                <span class="rate-frac">{{ tierFrac(result.request_hit_rate.all, false) }}</span>
              </div>
              <div class="rate-cell">
                <span class="rate-label">请求命中率(可缓存)</span>
                <span class="rate-value">{{ tierRateText(result.request_hit_rate.cacheable) }}</span>
                <div class="rate-bar"><div class="rate-bar-fill" :style="{ width: tierPct(result.request_hit_rate.cacheable) }" /></div>
                <span class="rate-frac">{{ tierFrac(result.request_hit_rate.cacheable, false) }}</span>
              </div>
              <div class="rate-cell">
                <span class="rate-label">字节命中率(全请求)</span>
                <span class="rate-value">{{ tierRateText(result.byte_hit_rate.all) }}</span>
                <div class="rate-bar"><div class="rate-bar-fill" :style="{ width: tierPct(result.byte_hit_rate.all) }" /></div>
                <span class="rate-frac">{{ tierFrac(result.byte_hit_rate.all, true) }}</span>
              </div>
              <div class="rate-cell">
                <span class="rate-label">字节命中率(可缓存)</span>
                <span class="rate-value">{{ tierRateText(result.byte_hit_rate.cacheable) }}</span>
                <div class="rate-bar"><div class="rate-bar-fill" :style="{ width: tierPct(result.byte_hit_rate.cacheable) }" /></div>
                <span class="rate-frac">{{ tierFrac(result.byte_hit_rate.cacheable, true) }}</span>
              </div>
            </div>
            <ul v-if="result.notes.length" class="rate-notes">
              <li v-for="n in result.notes" :key="n">{{ n }}</li>
            </ul>
          </div>

          <!-- 前窗对比:对比基期 + 基于 X/Y 源 + ↑↓ 趋势 -->
          <div class="cache-trend">
            <div class="trend-row">
              <span v-if="result.prev_trend.available" class="trend-base">
                对比基期:{{ formatPrevBase(resp.window_sec) }}
              </span>
              <span v-if="result.prev_trend.available" class="trend-delta">
                命中率 {{ formatRate(result.request_hit_rate.all.rate) }} → 前窗 {{ formatRate(result.prev_trend.prev_request_hit_rate) }}
                <b :class="`direction-${result.prev_trend.direction}`">{{ cacheDirectionLabel(result.prev_trend.direction) }}</b>
              </span>
              <span v-else class="trend-missing">前窗 无数据</span>
              <span v-if="trendSources" class="trend-sources">{{ trendSources }}</span>
              <el-tag
                v-if="result.prev_trend.available && result.prev_trend.alert"
                class="trend-alert"
                type="danger"
                size="small"
              >
                命中率下降,建议关注
              </el-tag>
            </div>
            <div v-if="missingSources.length" class="trend-note">
              前窗缺失源:{{ missingSources.join(',') }}(未参与趋势对比)
            </div>
            <div v-if="!result.prev_trend.available && resp.prev_error" class="trend-note">
              前窗对比不可用:{{ resp.prev_error }}
            </div>
          </div>

          <!-- 域名命中率排行(未命中 Top N 域名;双口径分列 + 档位角标) -->
          <div class="cache-domains">
            <div class="section-title">域名命中率排行 Top 8(已覆盖源命中率)</div>
            <template v-if="result.domain_ranking.length">
              <div class="domain-head" aria-hidden="true">
                <span>域名</span>
                <span>请求数</span>
                <span>命中率(全请求)</span>
                <span>可缓存口径</span>
                <span>未命中占比</span>
                <span>档位</span>
              </div>
              <button
                v-for="(d, i) in result.domain_ranking"
                :key="d.host"
                type="button"
                class="domain-row drillable"
                :title="`筛选 域名 = ${d.host}`"
                @click="drill('host', d.host)"
              >
                <span class="rank">{{ i + 1 }}</span>
                <span class="domain-name">{{ d.host }}</span>
                <span class="domain-requests">{{ formatCount(d.requests) }}</span>
                <span class="domain-rate">{{ formatRate(d.hit_rate) }}</span>
                <span class="domain-rate">{{ formatRate(d.cacheable_hit_rate) }}</span>
                <span class="domain-miss">{{ formatRate(d.miss_traffic_ratio) }}</span>
                <el-tag class="domain-grade" size="small" :type="cacheGradeTagType(d.grade)">
                  {{ cacheGradeLabel(d.grade) }}
                </el-tag>
              </button>
            </template>
            <div v-else class="section-empty">窗口内无域名命中率数据(源未开 cache_hit 索引,见上方判据标注)</div>
          </div>

          <!-- 未命中 URI TOP(查询串归一后;归属域名取不到时标注归属未知) -->
          <div class="cache-uris">
            <div class="section-title">未命中 URI TOP(查询串归一后)</div>
            <div v-if="result.miss_uri_top.length" class="source-list">
              <button
                v-for="(u, i) in result.miss_uri_top"
                :key="u.uri"
                type="button"
                class="uri-row drillable"
                :title="uriRowTitle(u)"
                @click="drill('url', u.uri)"
              >
                <span class="rank">{{ i + 1 }}</span>
                <span class="uri-name">{{ u.uri }}</span>
                <span class="uri-host">{{ u.host || '归属未知' }}</span>
                <span class="uri-count">{{ formatCount(u.miss_count) }} 次</span>
                <span class="uri-share">{{ formatRate(u.miss_share) }}</span>
                <span v-if="u.variants >= 2" class="uri-variants">{{ u.variants }} 个查询串变体已归并</span>
              </button>
            </div>
            <div v-else class="section-empty">窗口内无未命中 URI 数据(源未开 url 索引或无未命中,见上方判据标注)</div>
          </div>

          <!-- 状态码分布(4xx/5xx 占总响应占比;状态×cache_hit 交叉为后续增强) -->
          <div class="cache-status">
            <div class="section-title">状态码分布</div>
            <div class="status-tags">
              <span class="status-tag">总响应 {{ formatCount(result.status.total) }} 次</span>
              <span class="status-tag status-4xx">4xx:{{ formatCount(result.status.client_error_count) }} 次({{ formatRate(result.status.client_error_ratio) }})</span>
              <span class="status-tag status-5xx">5xx:{{ formatCount(result.status.server_error_count) }} 次({{ formatRate(result.status.server_error_ratio) }})</span>
            </div>
          </div>

          <!-- 结构化优化项(非优档 Top 5;低可信默认折叠;统一标注) -->
          <div class="cache-optimizations">
            <div class="section-title">
              优化项(非优档按未命中流量占比排序)
              <el-button
                class="opt-copy"
                size="small"
                text
                type="primary"
                aria-label="复制优化项清单"
                @click="copyOptimizations"
              >
                复制
              </el-button>
            </div>
            <div class="opt-note">建议,执行前请验证(仅供人工参考,不自动生效)</div>
            <ol v-if="optVisible.length" class="opt-list">
              <li v-for="(o, i) in optVisible" :key="`v${i}`" class="opt-item">
                <span class="opt-target">{{ o.domain || '全局' }}<template v-if="o.uri_prefix"> · {{ o.uri_prefix }}</template></span>
                → {{ optimizationActionLabel(o.action) }}
                <span class="opt-meta">(未命中流量占比 {{ formatRate(o.miss_traffic_ratio) }},{{ confidenceLabel(o.confidence) }})</span>
                <div v-if="o.evidence" class="opt-evidence">证据:{{ o.evidence }}</div>
              </li>
            </ol>
            <div v-else class="section-empty">当前档位无优化项(优档允许 0 条)</div>

            <div v-if="optMore.length" class="opt-more">
              <button type="button" class="opt-more-toggle" :aria-expanded="showMoreOpts" @click="showMoreOpts = !showMoreOpts">
                {{ showMoreOpts ? '收起低可信建议' : `更多建议(${optMore.length})` }}
              </button>
              <ol v-if="showMoreOpts" class="opt-list">
                <li v-for="(o, i) in optMore" :key="`m${i}`" class="opt-item">
                  <span class="opt-target">{{ o.domain || '全局' }}<template v-if="o.uri_prefix"> · {{ o.uri_prefix }}</template></span>
                  → {{ optimizationActionLabel(o.action) }}
                  <span class="opt-meta">(未命中流量占比 {{ formatRate(o.miss_traffic_ratio) }},{{ confidenceLabel(o.confidence) }})</span>
                  <div v-if="o.evidence" class="opt-evidence">证据:{{ o.evidence }}</div>
                </li>
              </ol>
            </div>
          </div>

          <!-- 来源分布(按云账号;当前窗跨维度合并状态) -->
          <div class="cache-sources">
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

          <!-- AI 解读(后置:后端占位字段,接入模型前恒空串,不渲染不占位) -->
          <div v-if="resp.summary" class="cache-summary-text">{{ resp.summary }}</div>
        </div>
      </template>

      <!-- 空闲提示 -->
      <div v-else class="cache-idle">
        点击「开始分析」对当前查询窗口执行缓存分析(当前窗 5 维度组 + 前窗 1 帧聚合,手动触发以控制扫描成本)
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * CDN 缓存分析卡:折叠卡 + 手动触发 + 结果展示/降级(镜像 WAF 诊断卡交互)。
 * - 请求体 = 当前查询上下文(时间窗/云/域名/检索式/字段筛选)+ log_type:cdn;
 *   无 dimension/metric(维度集由后端编排固定);窗口 >6h 被后端默认拦截,
 *   错误态提供"确认并继续分析"以 confirm:true 放行;
 * - 展示:健康档位徽标、双命中率总览(请求/字节 × 全请求/可缓存,口径标注)、
 *   域名命中率排行(双口径 + 档位角标,标注"已覆盖源命中率")、未命中 URI TOP
 *   (查询串归一,归属域名空 → 归属未知)、状态码分布(4xx/5xx 占比)、结构化
 *   优化项(可复制;低可信默认折叠在"更多建议"下;统一标注"建议,执行前请验证")、
 *   前窗对比(对比基期 + 基于 X/Y 源 + ↑↓)、AI 解读区(summary 非空才渲染);
 * - 降级不白屏:前窗缺失(prev 缺省/prev_error)、dimension_notes、缺失源均给
 *   提示,结论照常渲染;失败可重试;
 * - 独立于既有统计/明细区块,不改变其行为;不引入任何模型调用(AI 解读后置,
 *   summary 为后端占位)。
 */
import { ArrowDown, ArrowRight } from '@element-plus/icons-vue'
import type { CacheHitRateTier, CacheURIMissTop, LogCacheAnalyzeContext, LogCacheAnalyzeResponse } from '@/api/types/logs'
import { cacheAnalyzeApi } from '@/api/logs'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, ref } from 'vue'
import {
    cacheDirectionLabel,
    cacheGradeLabel,
    cacheGradeTagType,
    confidenceLabel,
    coveredSourceText,
    formatCacheBytes,
    formatPrevBase,
    formatRate,
    isScanConfirmError,
    missingSourceNames,
    optimizationActionLabel,
    optimizationCopyText,
    splitOptimizations,
} from '../cachecard'
import { formatCount } from '../diagnose'
import { cloudLabel, formatLogTime } from '../format'

const props = defineProps<{
    /** 分析上下文(父组件按当前查询组装;null = 时间窗未就绪) */
    context: LogCacheAnalyzeContext | null
}>()

/** 下钻事件:点击域名/URI 行 → 父组件追加字段筛选并重查(分析→定位闭环) */
const emit = defineEmits<{
    (e: 'drilldown', payload: { field: string; value: string }): void
}>()

/** 点击发射下钻;value 为空/占位时不下钻 */
function drill(field: string, value: string) {
    if (!value || value === '—' || value === '-') return
    emit('drilldown', { field, value })
}

const expanded = ref(false)
const loading = ref(false)
const error = ref('')
const resp = ref<LogCacheAnalyzeResponse | null>(null)

const hasResult = computed(() => resp.value !== null)
const result = computed(() => resp.value!.result)
/** 预估扫描量拦截(窗口 >6h):错误态提供人工确认放行 */
const scanConfirmNeeded = computed(() => isScanConfirmError(error.value))

const scopeTitle = computed(() => {
    if (!props.context) return ''
    return `${formatLogTime(props.context.start_time)} → ${formatLogTime(props.context.end_time)}`
})

/** 趋势覆盖范围("基于 X/Y 源";前窗源状态,空 = 不可知不渲染) */
const trendSources = computed(() => coveredSourceText(resp.value?.prev_sources ?? []))
/** 前窗缺失源展示名(部分覆盖时列出,避免误读为全量) */
const missingSources = computed(() => missingSourceNames(resp.value?.prev_sources ?? []))

/** 优化项分组(响应式):低可信折叠组默认收起 */
const optGroups = computed(() => splitOptimizations(result.value?.recommendations ?? []))
const optVisible = computed(() => optGroups.value.visible)
const optMore = computed(() => optGroups.value.more)
const showMoreOpts = ref(false)

// ---- 命中率格子辅助(不可用档位统一占位,不渲染误导性 0%) ----

function tierRateText(tier: CacheHitRateTier): string {
    return tier.available ? formatRate(tier.rate) : '—'
}

function tierPct(tier: CacheHitRateTier): string {
    if (!tier.available) return '0%'
    return `${Math.min(100, Math.max(0, tier.rate * 100))}%`
}

function tierFrac(tier: CacheHitRateTier, isByte: boolean): string {
    if (!tier.available) return '—'
    const num = isByte ? formatCacheBytes(tier.numerator) : formatCount(tier.numerator)
    const den = isByte ? formatCacheBytes(tier.denominator) : formatCount(tier.denominator)
    return `${num} / ${den}`
}

/** URI 行悬浮证据(归一查询串样例) */
function uriRowTitle(u: CacheURIMissTop): string {
    const host = u.host || '归属未知'
    const q = u.sample_query ? `,样例查询串:${u.sample_query}` : ''
    return `筛选 URL = ${u.uri}(归属:${host}${q})`
}

// ---- 分析进行中计时(与诊断卡同款文字化回馈) ----
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

async function runAnalyze(confirm = false) {
    if (loading.value || !props.context) return
    loading.value = true
    error.value = ''
    startTimer()
    try {
        resp.value = await cacheAnalyzeApi({ log_type: 'cdn', ...props.context, ...(confirm ? { confirm: true } : {}) })
    } catch (e) {
        resp.value = null
        error.value = e instanceof Error ? e.message : String(e)
    } finally {
        stopTimer()
        loading.value = false
    }
}

async function copyOptimizations() {
    if (!resp.value) return
    try {
        await navigator.clipboard.writeText(optimizationCopyText(resp.value.result.recommendations ?? []))
        ElMessage.success('优化项清单已复制')
    } catch {
        ElMessage.error('复制失败,请手动选择文本复制')
    }
}
</script>

<style scoped>
.cache-card {
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    padding: 8px;
}
.cache-toggle {
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
.cache-toggle:hover {
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
.cache-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 8px;
}
.cache-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}
.cache-scope {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.cache-progress {
    font-size: 13px;
    color: var(--el-text-color-primary);
}
.cache-error {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
}
.cache-error-actions {
    display: flex;
    gap: 8px;
}
.cache-result {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.cache-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.grade-note {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.window-meta {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-left: auto;
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
/* 双命中率总览:2×2 格子 + 口径标注 */
.rate-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
}
.rate-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
}
.rate-label {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.rate-value {
    font-weight: 600;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
}
.rate-bar {
    height: 4px;
    border-radius: 2px;
    background: var(--el-fill-color);
    overflow: hidden;
}
.rate-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: var(--el-color-success);
}
.rate-frac {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
}
.rate-notes {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.8;
}
/* 前窗对比 */
.trend-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
}
.trend-base,
.trend-sources {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.trend-row .direction-down {
    color: var(--el-color-danger);
}
.trend-row .direction-up {
    color: var(--el-color-success);
}
.trend-missing {
    color: var(--el-color-warning);
}
.trend-note {
    margin-top: 4px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
}
/* 域名排行 */
.domain-head {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    padding: 0 6px 2px;
}
.domain-head span:nth-child(1),
.domain-row .rank {
    width: 18px;
}
.domain-head span:nth-child(2) {
    flex: 1;
}
.domain-head span:nth-child(n + 3) {
    width: 108px;
    text-align: right;
}
.domain-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 6px;
    font-size: 13px;
}
.drillable {
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    cursor: pointer;
    font: inherit;
    border-radius: 4px;
    color: inherit;
}
.domain-row.drillable:hover {
    background: var(--el-fill-color-light);
}
.domain-row .domain-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
}
.domain-row .domain-requests,
.domain-row .domain-rate,
.domain-row .domain-miss {
    width: 96px;
    text-align: right;
    font-variant-numeric: tabular-nums;
}
/* URI TOP */
.source-list {
    display: flex;
    flex-direction: column;
}
.uri-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 6px;
    font-size: 13px;
}
.uri-row.drillable:hover {
    background: var(--el-fill-color-light);
}
.uri-row .rank {
    width: 18px;
    color: var(--el-text-color-secondary);
}
.uri-row .uri-name {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 45%;
}
.uri-row .uri-host {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    max-width: 20%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.uri-row .uri-count,
.uri-row .uri-share {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
}
.uri-row .uri-share {
    color: var(--el-text-color-secondary);
}
.uri-row .uri-variants {
    color: var(--el-color-warning);
    font-size: 12px;
}
/* 状态码分布 */
.status-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.status-tag {
    border: 1px solid var(--el-border-color-light);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    border-radius: 4px;
    padding: 1px 8px;
    font-size: 12px;
    line-height: 1.6;
}
.status-tag.status-4xx {
    color: var(--el-color-warning);
}
.status-tag.status-5xx {
    color: var(--el-color-danger);
}
/* 优化项 */
.opt-note {
    color: var(--el-color-warning);
    font-size: 12px;
    margin-bottom: 4px;
}
.opt-list {
    margin: 0;
    padding-left: 20px;
    font-size: 13px;
    line-height: 1.8;
}
.opt-item .opt-target {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
}
.opt-item .opt-meta {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}
.opt-item .opt-evidence {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    word-break: break-all;
}
.opt-more {
    margin-top: 6px;
}
.opt-more-toggle {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--el-color-primary);
    font-size: 12px;
    padding: 2px 0;
}
/* 来源分布 */
.geo-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.cache-summary-text {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}
</style>
