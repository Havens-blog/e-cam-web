<template>
  <div class="logs-page" aria-labelledby="logs-title">
    <div class="page-header">
      <h1 id="logs-title" class="page-title">日志查询</h1>
      <span class="page-sub">多云 CDN / WAF / 负载均衡统一视图 · 联邦实时查询</span>
    </div>

    <!-- 日志类型 + 筛选区 -->
    <div class="filter-card">
      <el-tabs v-model="activeType" class="type-tabs" @tab-change="onTypeChange">
        <el-tab-pane v-for="t in typeMetas" :key="t.type" :label="t.label" :name="t.type" />
      </el-tabs>

      <div class="filter-row">
        <el-date-picker
          v-model="timeRange"
          class="filter-time"
          type="datetimerange"
          range-separator="→"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          :disabled-date="disableOutsideWindow"
          @change="onTimeChange"
        />
        <!-- 快捷时间窗口:点击即设为最近 N 小时并重查(默认 1h) -->
        <div class="quick-windows" role="group" aria-label="快捷时间窗口">
          <button
            v-for="w in QUICK_WINDOWS"
            :key="w"
            type="button"
            class="qw-chip"
            :class="{ 'qw-active': isActiveQuickWindow(w) }"
            :aria-label="`最近 ${w} 小时`"
            :aria-pressed="isActiveQuickWindow(w)"
            @click="applyQuickWindow(w)"
          >
            {{ w }}h
          </button>
        </div>
        <el-select
          v-model="selectedClouds"
          class="filter-clouds"
          multiple
          collapse-tags
          clearable
          placeholder="全部云"
          aria-label="按云筛选"
          @change="onCloudsChange"
        >
          <el-option v-for="c in availableClouds" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
        <el-select
          v-model="selectedResources"
          class="filter-resources"
          multiple
          filterable
          collapse-tags
          clearable
          placeholder="全部日志源"
          aria-label="按日志源筛选"
          :loading="sourcesLoading"
        >
          <el-option-group v-for="g in sourceGroups" :key="g.key" :label="g.label">
            <el-option
              v-for="s in g.sources"
              :key="s.resource_id"
              :label="s.name"
              :value="s.resource_id"
              :disabled="!s.enabled"
            >
              <span class="source-option">
                <span>{{ s.name }}</span>
                <span v-if="!s.enabled" class="source-disabled">未投递</span>
              </span>
            </el-option>
          </el-option-group>
        </el-select>
        <el-tooltip content="源列表已按类型本地缓存;新增域名/源时点此强制刷新" placement="top">
          <el-button
            class="filter-refresh"
            size="default"
            :loading="sourcesLoading"
            aria-label="刷新日志源列表"
            @click="refreshSources"
          >
            <el-icon><Refresh /></el-icon>
          </el-button>
        </el-tooltip>
        <el-input
          v-model="keyword"
          class="filter-keyword"
          clearable
          placeholder="关键词 / 原生检索式(可选)"
          aria-label="检索关键词"
          @keyup.enter="doSearch"
        />
        <el-tooltip content="每日志源采样上限(窗口内实际日志可能更多,明细/统计均为采样视图)" placement="top">
          <el-select v-model="limit" class="filter-limit" aria-label="条数上限">
            <el-option v-for="n in LIMIT_OPTIONS" :key="n" :label="`${n} 条/源`" :value="n" />
          </el-select>
        </el-tooltip>
        <el-button type="primary" :loading="searching" :disabled="!timeRange" @click="doSearch">查询</el-button>
        <el-button
          v-if="searching"
          type="danger"
          plain
          aria-label="取消查询"
          @click="cancelSearch"
        >取消</el-button>
      </div>

      <!-- 结构化字段筛选(多条件 AND 叠加,语义在统一字段上): -->
      <div v-if="filterableFields.length" class="filter-fields" aria-label="字段筛选">
        <div v-for="(f, i) in fieldFilters" :key="i" class="field-filter-item">
          <div class="field-filter-row">
            <el-select v-model="f.field" class="ff-field" placeholder="字段" aria-label="筛选字段">
              <el-option v-for="fd in filterableFields" :key="fd.key" :label="fd.label" :value="fd.key" />
            </el-select>
            <el-select v-model="f.op" class="ff-op" aria-label="操作符">
              <el-option v-for="o in FILTER_OPS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input
              v-model="f.value"
              class="ff-value"
              placeholder="筛选值(回车查询)"
              clearable
              @keyup.enter="doSearch"
            />
            <el-button text type="danger" aria-label="删除条件" @click="fieldFilters.splice(i, 1)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <!-- 快捷值:仅来自已返回样本(零额外请求),样本/字段变化随 computed 自动重算 -->
          <div
            v-if="quickValuesByField.get(f.field)?.length"
            class="quick-values"
            role="group"
            :aria-label="`快捷值:${fieldLabel(f.field)}(来自当前样本)`"
          >
            <span class="qv-label">快捷值:</span>
            <button
              v-for="v in quickValuesByField.get(f.field)"
              :key="v"
              type="button"
              class="qv-chip"
              :class="{ 'qv-active': f.value.trim() === v }"
              :aria-label="`${f.value.trim() === v ? '取消' : '填入'}快捷值 ${v}`"
              @click="applyQuickValue(f, v)"
            >
              {{ v }}
            </button>
          </div>
        </div>
        <div class="filter-fields-actions">
          <el-button size="small" text type="primary" :disabled="fieldFilters.length >= 4" @click="addFilterRow">
            ＋ 添加字段筛选
          </el-button>
          <!-- 清除下钻:仅移除 TopN 图下钻产生的条件行,用户手动条件与关键词保留 -->
          <el-button v-if="hasDrilldown" size="small" text type="warning" @click="clearDrilldown">清除下钻</el-button>
          <el-button v-if="fieldFilters.length" size="small" text @click="fieldFilters = []">清空</el-button>
          <span class="fields-hint">多条件叠加;作用于 域名/状态码/IP/规则 等字段,与关键词 AND 生效</span>
        </div>
      </div>

      <!-- 未开启投递的源:引导卡片 -->
      <el-alert
        v-if="disabledSources.length"
        type="warning"
        :closable="false"
        class="delivery-alert"
      >
        <template #title>
          {{ disabledSources.length }} 个日志源未开启投递(已从可选列表禁用):
        </template>
        <div class="delivery-notes">
          <div v-for="s in disabledSources.slice(0, 4)" :key="s.resource_id" class="delivery-note">
            <b>{{ s.name }}</b> · {{ s.note }}
          </div>
          <div v-if="disabledSources.length > 4" class="delivery-note">…其余 {{ disabledSources.length - 4 }} 个见源列表</div>
        </div>
      </el-alert>
    </div>

    <!-- per-source 状态(失败不静默) -->
    <div v-if="resp" class="sources-strip">
      <span class="strip-label">查询源:</span>
      <el-tag
        v-for="s in resp.sources"
        :key="s.cloud + s.account_id"
        :type="s.error ? 'danger' : 'success'"
        size="small"
        class="source-tag"
      >
        {{ cloudLabel(s.cloud) }}·{{ s.account_name }}:{{ s.error ? '失败' : s.count + ' 条' }}
      </el-tag>
      <el-tag v-if="resp.truncated" type="warning" size="small">结果已���断(可缩小时间范围或加筛选)</el-tag>
      <span class="strip-total">共 {{ resp.total }} 条</span>
    </div>

    <!-- 分组聚合:自定义维度 + 指标,全窗真实下推(影响上方 TopN 图) -->
    <div v-if="resp" class="aggr-bar" aria-label="分组聚合">
      <span class="aggr-label">分组聚合</span>
      <el-tooltip placement="top" :content="DIM_TIP">
        <el-select
          v-model="aggrDimension"
          class="aggr-dim"
          placeholder="分组字段(默认按类型)"
          filterable
          allow-create
          default-first-option
          clearable
          aria-label="分组字段"
        >
          <!-- 可聚合白名单(后端索引探测):统一字段 + 原始列分组;探测失败回退全量字典 -->
          <template v-if="aggregatableFields.length">
            <el-option-group v-if="aggregatableDictFields.length" label="统一字段(可聚合)">
              <el-option v-for="fd in aggregatableDictFields" :key="fd.key" :label="fd.label" :value="fd.key" />
            </el-option-group>
            <el-option-group v-if="aggregatableRawFields.length" label="原始可聚合列(云上字段)">
              <el-option v-for="k in aggregatableRawFields" :key="k" :label="k" :value="k" />
            </el-option-group>
            <el-option-group v-if="nonAggregatableDictFields.length" label="暂不支持聚合(未收录字段映射)">
              <el-option v-for="fd in nonAggregatableDictFields" :key="fd.key" :label="fd.label" :value="fd.key" disabled />
            </el-option-group>
          </template>
          <template v-else>
            <el-option v-for="fd in filterableFields" :key="fd.key" :label="fd.label" :value="fd.key" />
          </template>
        </el-select>
      </el-tooltip>
      <el-select v-model="aggrMetric" class="aggr-metric" aria-label="聚合指标">
        <el-option v-for="m in METRIC_OPTS" :key="m.value" :label="m.label" :value="m.value" />
      </el-select>
      <el-button size="small" type="primary" plain :loading="aggrLoading" :disabled="!timeRange" @click="doAggregate">
        查分组
      </el-button>
      <span v-if="aggregate?.topn_skip" class="aggr-skip" :title="aggregate.topn_skip">
        ⚠ 部分源不支持该维度/指标,TopN 可能有缺失(趋势/总数仍全窗准确)
      </span>
      <el-button
        class="aggr-export"
        size="small"
        text
        type="primary"
        :disabled="!aggregate"
        aria-label="导出统计 CSV"
        @click="exportStatsCsv"
      >导出统计</el-button>
    </div>

    <!-- WAF 流量诊断卡(手动触发;独立于统计/明细区块,不影响既有行为) -->
    <LogDiagnoseCard
      v-if="activeType === 'waf'"
      :context="diagnoseContext"
      @drilldown="onDiagDrilldown"
    />

    <!-- 结果区:统计视图为主,明细默认折叠 -->
    <div v-if="searching || searchError || !resp || allEntries.length === 0" class="table-card">
      <template v-if="searching">
        <!-- 文字进度态(20s 级联邦查询不白屏:源数/已耗时文本化 + aria,骨架仅作背景) -->
        <div
          class="search-progress"
          role="status"
          aria-live="polite"
          :aria-label="progressAria"
        >
          <div class="table-skeleton" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="skeleton-row" />
          </div>
          <div class="search-progress-text">
            <span class="progress-main">{{ progressText }} · 已耗时 {{ searchElapsed }} 秒</span>
            <span class="progress-hint">多云联邦查询耗时较长,请稍候,无需重复点击</span>
          </div>
        </div>
      </template>
      <div v-else-if="searchError" class="state-card">
        <div class="error-state">
          <div class="state-icon state-icon-error" aria-hidden="true">⚠</div>
          <div class="state-title">查询失败</div>
          <div class="state-desc">{{ friendlySearchError(searchError) }}</div>
          <div class="state-raw">原始错误:{{ searchError }}</div>
          <el-button class="state-cta" type="primary" aria-label="重试查询" @click="doSearch">重试</el-button>
        </div>
      </div>
      <div v-else class="state-card">
        <div class="empty-state">
          <div class="state-icon" aria-hidden="true">🔍</div>
          <div class="state-title">暂无日志</div>
          <div class="state-desc">
            {{ resp && resp.sources.length === 0
              ? '当前租户没有活跃云账号或所选云未接入。'
              : '该时间窗口内无匹配日志,尝试放大时间范围或放宽筛选。' }}
          </div>
        </div>
      </div>
    </div>
    <template v-else>
      <LogStats
        :entries="allEntries"
        :log-type="activeType"
        :aggregate="aggregate"
        :metric="aggrMetric"
        @bar-click="onBarDrilldown"
      />

      <!-- 明细(默认折叠) -->
      <div class="table-card">
        <button
          type="button"
          class="detail-toggle"
          :aria-expanded="detailVisible"
          @click="detailVisible = !detailVisible"
        >
          <el-icon :size="14">
            <ArrowDown v-if="detailVisible" />
            <ArrowRight v-else />
          </el-icon>
          <span class="toggle-title">明细数据({{ allEntries.length }} 条)</span>
          <span class="toggle-hint">点击{{ detailVisible ? '收起' : '展开' }} · 点击行查看详情</span>
        </button>
        <div v-show="detailVisible" class="detail-body">
          <!-- 采样标注:高流量源明细只覆盖窗口尾部(最新 N 条),避免误读窗口数据量 -->
          <div v-if="detailSampleNote" class="detail-sample-note" role="note">
            {{ detailSampleNote }}
          </div>
          <!-- 组工具条:全部折叠/展开;组头用按钮(非表格行),与行点击开详情互不冲突 -->
          <div class="group-toolbar">
            <span class="group-toolbar-label">按 云 · 账号 分组</span>
            <el-button size="small" text type="primary" :disabled="!entryGroups.length" @click="toggleAllGroups">
              {{ allGroupsCollapsed ? '全部展开' : '全部折叠' }}
            </el-button>
          </div>
          <section v-for="g in entryGroups" :key="g.key" class="entry-group">
            <button
              type="button"
              class="group-header"
              :aria-expanded="!collapsedGroups.has(g.key)"
              :title="groupErrorText(g.key) || undefined"
              @click="toggleGroup(g.key)"
            >
              <el-icon :size="12">
                <ArrowDown v-if="!collapsedGroups.has(g.key)" />
                <ArrowRight v-else />
              </el-icon>
              <span class="group-name">{{ g.label }}</span>
              <span class="group-count">{{ g.entries.length }} 条</span>
              <!-- 该组源状态(resp.sources 派生):失败标注 + 错误可查;成功给耗时 -->
              <template v-for="o in groupOutcomes.get(g.key) ?? []" :key="o.account_id">
                <el-tag v-if="o.error" type="danger" size="small" class="group-failed" :title="o.error">失败</el-tag>
                <span v-else class="group-duration">{{ o.duration_ms }}ms</span>
              </template>
              <span class="group-hint">{{ collapsedGroups.has(g.key) ? '展开' : '收起' }}</span>
            </button>
            <el-table
              v-if="!collapsedGroups.has(g.key)"
              :data="g.entries"
              class="log-table"
              size="small"
              stripe
              @row-click="openDetail"
            >
            <el-table-column
              v-for="f in currentFields"
              :key="f.key"
              :label="f.label"
              :min-width="columnWidth(f.key)"
              :show-overflow-tooltip="true"
            >
              <template #default="{ row }">
                <template v-if="f.key === 'timestamp'">
                  <span class="cell-mono">{{ formatLogTime(row.timestamp) }}</span>
                </template>
                <template v-else-if="f.key === 'meta.cloud'">
                  {{ cloudLabel(row.meta.cloud) }}
                </template>
                <template v-else-if="f.key === 'status'">
                  <el-tag :type="statusTagType(row.status)" size="small" effect="plain">
                    {{ row.status || '—' }}
                  </el-tag>
                </template>
                <template v-else-if="f.key === 'action'">
                  <el-tag :type="actionTagType(row.action)" size="small" effect="plain">{{ row.action || '—' }}</el-tag>
                </template>
                <template v-else-if="f.key === 'severity'">
                  <el-tag :type="severityTagType(row.severity)" size="small" effect="plain">{{ row.severity || '—' }}</el-tag>
                </template>
                <template v-else-if="f.key === 'cache_hit'">
                  <el-tag :type="cacheHitTagType(row.cache_hit)" size="small" effect="plain">{{ row.cache_hit || '—' }}</el-tag>
                </template>
                <template v-else-if="f.key === 'bytes_sent'">
                  <span class="cell-mono">{{ formatBytes(row.bytes_sent) }}</span>
                </template>
                <template v-else-if="isMono(f.key)">
                  <span class="cell-mono">{{ dashIfEmpty(cellValue(row, f.key)) }}</span>
                </template>
                <template v-else>
                  {{ dashIfEmpty(cellValue(row, f.key)) }}
                </template>
              </template>
            </el-table-column>
          </el-table>
          </section>

          <!-- 时间游标翻页:窗口上界前移续拉更早日志并追加,无重复 -->
          <div class="pager-bar">
            <span class="pager-info">已加载 {{ allEntries.length }} 条</span>
            <span
              v-if="pageLoading"
              class="pager-progress"
              role="status"
              aria-live="polite"
              :aria-label="`加载更早日志进行中,已耗时 ${searchElapsed} 秒`"
            >
              正在加载更早日志 · 已耗时 {{ searchElapsed }} 秒
            </span>
            <span v-if="pageInc !== null" class="pager-oldest">本次 +{{ pageInc }} 条</span>
            <span v-if="pageBottom" class="pager-bottom">已到窗口起点,没有更早日志</span>
            <span v-else-if="allEntries.length" class="pager-oldest">最早 {{ formatLogTime(oldestTs) }}</span>
            <el-button
              size="small"
              type="primary"
              plain
              :loading="pageLoading"
              :disabled="!canLoadEarlier"
              @click="loadEarlier"
            >
              {{ pageBottom ? '没有更早' : '加载更早' }}
            </el-button>
            <el-button size="small" text :disabled="pageLoading" @click="backToLatest">回到最新</el-button>
            <el-button
              class="pager-export"
              size="small"
              text
              type="primary"
              :disabled="!allEntries.length || pageLoading"
              aria-label="导出明细 CSV"
              @click="exportDetailCsv"
            >导出明细</el-button>
            <el-tooltip placement="top">
              <template #content>
                按时间游标向前翻页(窗口上界 = 当前最旧一条 - 1ms),逐页追加,不会重复;<br />
                同毫秒批次可能在页边界被跳过;翻到窗口起点即止。
              </template>
              <span class="pager-note">ⓘ 翻页说明</span>
            </el-tooltip>
          </div>
        </div>
      </div>
    </template>

    <LogDetailDrawer v-model:visible="drawerVisible" :entry="detailEntry" :fields="drawerFields" />
  </div>
</template>

<script setup lang="ts">
/**
 * 多云统一日志查询页(Phase 5):
 * - 三类型 Tab(CDN/WAF/SLB),字段字典接口驱动动态列(后端加字段前端自动多列);
 * - 时间范围按类型上限约束(CDN 7d / SLB 3d,与后端一致);
 * - 日志源按云·账号分组,未开启投递的源禁用并给引导文案;
 * - 联邦查询 per-source 状态条(失败不静默)+ 截断提示;
 * - 结果区统计视图为主(KPI + 图表,前端聚合),明细默认折叠;
 * - 明细按 云·账号 折叠分组,组头含条数/源状态(失败不静默),组内仍统一时间倒序;
 * - 行点击开详情抽屉:统一字段 + Raw 原始字段 JSON(信息零丢失)。
 */
import { ArrowDown, ArrowRight, Delete, Refresh } from '@element-plus/icons-vue'
import { aggregateLogsApi, getLogSourcesApi, getLogTypesApi, searchLogsApi } from '@/api/logs'
import type {
    FieldFilter,
    LogAggregateResponse,
    LogDiagnoseContext,
    LogEntry,
    LogSearchResponse,
    LogSource,
    LogSourceOutcome,
    LogType,
    LogTypeMeta,
} from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LogDetailDrawer from './components/LogDetailDrawer.vue'
import LogDiagnoseCard from './components/LogDiagnoseCard.vue'
import LogStats from './components/LogStats.vue'
import { applyDrilldown, stripDrilldown, topnDrilldownField } from './drilldown'
import { csvSerialize, downloadCsv, entryRows } from './csv'
import type { FieldFilterRow } from './drilldown'
import {
    actionTagType,
    cacheHitTagType,
    cellValue,
    cloudLabel,
    dashIfEmpty,
    defaultWindowMs,
    formatBytes,
    formatLogTime,
    formatSpanMs,
    QUICK_VALUES_MAX,
    quickValuesFor,
    severityTagType,
    statusTagType,
} from './format'

const typeMetas = ref<LogTypeMeta[]>([])
const activeType = ref<LogType>('cdn')
const sources = ref<LogSource[]>([])
const sourcesLoading = ref(false)
/**
 * 各类型日志源本地缓存:源清单(CDN/WAF 域名、S3 前缀、LTS 流)变动频率
 * 远低于请求频率,切 Tab 复用缓存立即渲染(零请求);「刷新源列表」按钮
 * 强制重拉兜底。云选择过滤是本地 computed,不再触发重拉。
 */
const sourcesCache = ref<Record<string, LogSource[]>>({})

const timeRange = ref<[Date, Date] | null>(null)
/** 默认选中的云:阿里云(数据最全的源;用户手动改动后不再自动收敛) */
const DEFAULT_CLOUDS = ['aliyun']
const selectedClouds = ref<string[]>([...DEFAULT_CLOUDS])
/** 用户是否手动改过云选择(改过后不再自动收敛到默认) */
const cloudsTouched = ref(false)
const selectedResources = ref<string[]>([])
const keyword = ref('')
/** 每日志源采样上限(后端单源硬顶 2000、联邦 3000;默认 1000 提高样本覆盖) */
const LIMIT_OPTIONS = [100, 500, 1000, 2000]
const limit = ref(1000)

const searching = ref(false)
const searchError = ref('')
const resp = ref<LogSearchResponse | null>(null)
/**
 * 累积明细(跨页追加,时间倒序)。分页 = 时间游标翻页:下一页把窗口上界
 * 改为当前最旧一条 - 1 秒(覆盖秒级时间戳源如 WAF3,整批不丢不重),
 * 重新 search 并追加 —— 窗口严格前移天然无重复,不做逐条去重(曾用
 * ts:resource:source 做 key,把 WAF3 同秒数百条整批滤成 1 条)。
 */
const allEntries = ref<LogEntry[]>([])
const pageLoading = ref(false)
/** 上次翻页增量(条);null=尚未翻过页 */
const pageInc = ref<number | null>(null)
/** 已到底:窗口起点已无更早日志 */
const pageBottom = ref(false)
/** 累积明细最旧时间戳(时间倒序,末位即最旧);无数据时 0 */
const oldestTs = computed(() => (allEntries.value.length ? allEntries.value[allEntries.value.length - 1]!.timestamp : 0))
const canLoadEarlier = computed(() => {
    if (!resp.value || !timeRange.value || allEntries.value.length === 0) return false
    return oldestTs.value > timeRange.value[0].getTime() && !pageBottom.value
})
/** 服务端聚合(真实总数/趋势/TopN;null=失败,统计图回退采样) */
const aggregate = ref<LogAggregateResponse | null>(null)
/** 明细表格默认折叠(统计视图为主) */
const detailVisible = ref(false)

// ---- 明细按 云·账号 折叠分组(组头:账号名/条数/源状态;翻页追加 allEntries 后自动重排) ----
/**
 * 分组键 = meta.cloud + meta.account_name;组数据 = allEntries 过滤 —— allEntries
 * 本身时间倒序,过滤天然保持组内倒序不变;翻页追加后 computed 自动重算。
 * 组序按 cloudOrder 固定云序,与上方日志源下拉分组一致。
 */
const entryGroups = computed(() => {
    const map = new Map<string, { cloud: string; accountName: string; entries: LogEntry[] }>()
    for (const e of allEntries.value) {
        const key = `${e.meta.cloud}·${e.meta.account_name}`
        if (!map.has(key)) map.set(key, { cloud: e.meta.cloud, accountName: e.meta.account_name, entries: [] })
        map.get(key)!.entries.push(e)
    }
    // 失败且无样本的源也要有组头可标注(0 条 + 失败 tag),避免整组失败被隐藏
    for (const o of resp.value?.sources ?? []) {
        const key = `${o.cloud}·${o.account_name}`
        if (!map.has(key)) map.set(key, { cloud: o.cloud, accountName: o.account_name, entries: [] })
    }
    return Array.from(map.entries())
        .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
        .map(([key, g]) => ({ key, label: `${cloudLabel(g.cloud)}·${g.accountName}`, entries: g.entries }))
})

/** 组 → 单源状态(失败/耗时,来自 resp.sources;翻页后随当前页刷新) */
const groupOutcomes = computed<Map<string, LogSourceOutcome[]>>(() => {
    const map = new Map<string, LogSourceOutcome[]>()
    for (const o of resp.value?.sources ?? []) {
        const key = `${o.cloud}·${o.account_name}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(o)
    }
    return map
})

/** 组头 title:该组失败源错误原因(hover 可查) */
function groupErrorText(key: string): string {
    return (groupOutcomes.value.get(key) ?? [])
        .filter((o) => o.error)
        .map((o) => o.error)
        .join(';')
}

/** 折叠态(默认空 = 全展开);键随组稳定,翻页不重置,切类型重置 */
const collapsedGroups = ref<Set<string>>(new Set())

function toggleGroup(key: string) {
    const next = new Set(collapsedGroups.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsedGroups.value = next
}

const allGroupsCollapsed = computed(() =>
    entryGroups.value.length > 0 && entryGroups.value.every((g) => collapsedGroups.value.has(g.key)),
)

function toggleAllGroups() {
    collapsedGroups.value = allGroupsCollapsed.value ? new Set() : new Set(entryGroups.value.map((g) => g.key))
}

/**
 * 明细采样标注:表格只展示最新 limit 条/源,高流量源仅覆盖数秒~数分钟,远小于
 * 查询窗口时给出可见提示,避免被误读为「窗口内只有这么点数据」。明细已覆盖
 * 整窗或空表时不显示(allEntries 时间倒序:头=最新,尾=最旧)。
 */
const detailSampleNote = computed(() => {
    if (!timeRange.value || allEntries.value.length === 0) return ''
    const newest = allEntries.value[0]?.timestamp
    const oldest = allEntries.value[allEntries.value.length - 1]?.timestamp
    if (typeof newest !== 'number' || typeof oldest !== 'number') return ''
    const coveredMs = newest - oldest
    const windowMs = timeRange.value[1].getTime() - timeRange.value[0].getTime()
    if (coveredMs >= windowMs) return '' // 明细已覆盖整窗,无需标注
    const span = formatSpanMs(coveredMs) || '极短'
    return `明细为最新 ${allEntries.value.length} 条采样(每源上限 ${limit.value} 条),覆盖 ${formatLogTime(oldest)} → ${formatLogTime(newest)},约 ${span};完整窗口分布见上方统计,可点「加载更早日志」向前翻页`
})

// ---- 查询进行中进度态(文字化回馈:源数/已耗时;不必轮询真实进度) ----
const searchElapsed = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null
/** 联邦长查询取消控制器(查询/加载更早共用;取消后 axios 抛 ERR_CANCELED) */
const searchAbort = ref<AbortController | null>(null)

/** 取消进行中的查询/翻页:立即中止所有在飞请求,进度态随 finally 清理 */
function cancelSearch() {
    searchAbort.value?.abort()
}

/** 取消异常归一到「已取消」文案(axios CanceledError 的 code 即为 ERR_CANCELED) */
function isCanceled(e: unknown): boolean {
    return !!e && typeof e === 'object' && (e as { code?: string }).code === 'ERR_CANCELED'
}

function startProgress() {
    stopProgress()
    searchElapsed.value = 0
    progressTimer = setInterval(() => {
        searchElapsed.value += 1
    }, 1000)
}

function stopProgress() {
    if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
    }
}

onBeforeUnmount(stopProgress)

/** 预期查询源数:当前云/资源选择下已开启投递的源(与后端联邦范围一致的前端近似) */
const querySourceCount = computed(() => {
    const enabled = filteredSources.value.filter((s) => s.enabled)
    if (!selectedResources.value.length) return enabled.length
    const picked = new Set(selectedResources.value)
    return enabled.filter((s) => picked.has(s.resource_id)).length
})

const progressText = computed(() =>
    querySourceCount.value > 0 ? `正在查询 ${querySourceCount.value} 个云账号` : '正在查询所选日志源',
)
const progressAria = computed(() => `查询进行中:${progressText.value},已耗时 ${searchElapsed.value} 秒`)

/** 整页失败原因映射:裸错误串转可读中文降级说明(原始串仍附在下方供排查) */
function friendlySearchError(raw: string): string {
    const msg = raw.toLowerCase()
    if (msg.includes('timeout') || raw.includes('超时')) {
        return '查询超时:云端检索耗时过长,可缩小时间范围、减少所选源或降低条数上限后重试。'
    }
    if (msg.includes('truncat') || raw.includes('截断')) {
        return '结果被截断:命中数据超出单次查询上限,本次为采样视图;可缩小时间范围或加字段筛选后重试。'
    }
    if (msg.includes('network') || raw.includes('网络')) {
        return '网络异常:查询服务暂不可达,请检查网络连接后重试。'
    }
    return '查询失败:云端检索未正常返回,可缩小时间范围或放宽筛选条件后重试。'
}

// ---- 结构化字段筛选(多条件 AND;与 keyword 叠加) ----
const FIELD_FILTER_MAX = 4
const fieldFilters = ref<FieldFilterRow[]>([])
const FILTER_OPS = [
    { value: 'eq', label: '等于' },
    { value: 'neq', label: '不等于' },
    { value: 'contains', label: '包含' },
    { value: 'prefix', label: '前缀' },
]
/** 可筛选字段:字段字典中非固定列(剔除 meta.* / 时间) */
const filterableFields = computed(() =>
    currentFields.value.filter((f) => !f.key.startsWith('meta.') && f.key !== 'timestamp'),
)

// ---- 分组聚合维度白名单(后端索引探测:列必须开过 KV 分析索引才能 group by) ----
/** 当前类型可聚合字段清单(空 = 探测失败/无账号 → 维度下拉回退全量字典,不劣化) */
const aggregatableFields = computed(() => currentMeta.value?.aggregatable ?? [])
const aggregatableSet = computed(() => new Set(aggregatableFields.value))
/** 白名单内的统一字段(带中文标签,可直接选) */
const aggregatableDictFields = computed(() =>
    filterableFields.value.filter((f) => aggregatableSet.value.has(f.key)),
)
/** 白名单内的云上原始列(非统一字段,按列名展示;allow-create 亦可输) */
const aggregatableRawFields = computed(() =>
    aggregatableFields.value.filter((k) => !filterableFields.value.some((f) => f.key === k)),
)
/** 字典中不在白名单的字段(未开分析索引):禁用展示说明,不再盲选撞错 */
const nonAggregatableDictFields = computed(() => {
    if (!aggregatableFields.value.length) return []
    return filterableFields.value.filter((f) => !aggregatableSet.value.has(f.key))
})

function addFilterRow() {
    if (fieldFilters.value.length >= FIELD_FILTER_MAX) return
    fieldFilters.value.push({ field: filterableFields.value[0]?.key ?? '', op: 'eq', value: '' })
}

// ---- 字段快捷值(仅来自已返回样本 allEntries,零额外接口请求;不轮询/不预取) ----
/**
 * {field: quickValues} 映射:对每个可筛选字段从当前样本聚合高频值(频率降序去重,
 * 上限 QUICK_VALUES_MAX)。依赖 allEntries + filterableFields,样本/类型/字段变化
 * 自动重算,不残留旧值;未加载数据或字段无可抽取值时为空 → chips 区整行隐藏。
 */
const quickValuesByField = computed<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>()
    if (allEntries.value.length === 0) return map
    for (const f of filterableFields.value) {
        map.set(f.key, quickValuesFor(allEntries.value, f.key, QUICK_VALUES_MAX))
    }
    return map
})

function fieldLabel(fieldKey: string): string {
    return filterableFields.value.find((f) => f.key === fieldKey)?.label ?? fieldKey
}

/** 点选快捷值:已选中则取消(toggle 清空 value,该行退出筛选组合),随后按当前筛选组合重查 */
function applyQuickValue(f: FieldFilter, value: string) {
    f.value = f.value.trim() === value ? '' : value
    void doSearch()
}

/** 组装有效筛选(字段与值齐全的行;空值行不参与,避免误过滤;下钻标记为前端态,提交时剥除) */
function buildFilters(): FieldFilter[] | undefined {
    const valid = fieldFilters.value.filter((f) => f.field && f.value.trim() !== '')
    return valid.length
        ? valid.map((f) => ({ field: f.field, op: f.op, value: f.value.trim() }))
        : undefined
}

// ---- TopN 分组图下钻(LogStats bar-click → 字段筛选;维度映射在本组件,子组件不感知父级 state) ----
/** 是否存在下钻条件(「清除下钻」按钮可见性) */
const hasDrilldown = computed(() => fieldFilters.value.some((f) => f.drilldown))

/**
 * 点击 TopN 条形图项:映射到当前图维度的筛选字段,同字段 eq 行更新值、否则新增下钻行,
 * 随后按新筛选重查(doSearch 并行刷新明细 + 聚合,统计图同步)。
 */
function onBarDrilldown(payload: { name: string }) {
    if (!filterableFields.value.length) {
        ElMessage.warning('字段字典未加载,暂不支持图表下钻')
        return
    }
    // 以「聚合 topn 是否实际生效」判定维度:聚合失败/无 topn 时图回退采样默认 TopN,
    // 此刻即使选了自定义维度也应映射默认字段,否则筛选与图上分组对不上
    const hasTopn = !!aggregate.value && aggregate.value.topn.length > 0
    const field = topnDrilldownField(hasTopn, aggrDimension.value, activeType.value)
    const next = applyDrilldown(fieldFilters.value, field, payload.name, FIELD_FILTER_MAX)
    if (!next) {
        ElMessage.warning(`字段筛选已达上限(${FIELD_FILTER_MAX}),请先删除一条再加下钻条件`)
        return
    }
    fieldFilters.value = next
    void doSearch()
}

/**
 * 诊断卡下钻(Top 源/URI/状态码/动作 → 字段筛选):判定→定位闭环 —— 判定为
 * 高风险后点一下攻击源即可在明细里看它的流量构成。字段映射由卡内给出
 * (client_ip/uri/status/action,都是诊断维度的统一字段 key),此处复用图表
 * 下钻同一套追加/覆盖逻辑。
 */
function onDiagDrilldown(payload: { field: string; value: string }) {
    const known = filterableFields.value.some((f) => f.key === payload.field)
    if (!known) {
        ElMessage.warning(`字段 ${payload.field} 不在字段字典内,暂不支持下钻`)
        return
    }
    const next = applyDrilldown(fieldFilters.value, payload.field, payload.value, FIELD_FILTER_MAX)
    if (!next) {
        ElMessage.warning(`字段筛选已达上限(${FIELD_FILTER_MAX}),请先删除一条再加下钻条件`)
        return
    }
    fieldFilters.value = next
    void doSearch()
}

// ---- CSV 导出(明细/统计浏览器端生成,审计汇报用) ----
/** 明细导出:按当前字段字典列导出 allEntries,值口径与表格一致 */
function exportDetailCsv() {
    if (!allEntries.value.length) return
    const columns = currentFields.value.map((f) => ({ key: f.key, label: f.label }))
    if (!columns.length) {
        ElMessage.warning('字段字典未加载,暂无法导出')
        return
    }
    const csv = csvSerialize(columns.map((c) => c.label), entryRows(allEntries.value, columns))
    downloadCsv(`日志明细-${activeType.value}-${datetimeStamp()}.csv`, csv)
    ElMessage.success(`已导出明细 ${allEntries.value.length} 条`)
}

/** 统计导出:趋势(时间,请求数)+ TopN(名称,计数)两段单文件,首列类型区分 */
function exportStatsCsv() {
    const agg = aggregate.value
    if (!agg) {
        ElMessage.warning('暂无统计结果,先查询或查分组后再导出')
        return
    }
    const header = ['类型', '名称/时间', '数值']
    const rows: string[][] = []
    for (const b of agg.buckets ?? []) {
        rows.push(['趋势', formatLogTime(b.timestamp), String(b.count)])
    }
    for (const t of agg.topn ?? []) {
        rows.push(['TopN', t.name, String(t.count)])
    }
    downloadCsv(`日志统计-${activeType.value}-${datetimeStamp()}.csv`, csvSerialize(header, rows))
    ElMessage.success('已导出统计(趋势 + TopN)')
}

/** 导出文件名时间戳(本地 yyyyMMdd-HHmm) */
function datetimeStamp(): string {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** 清除下钻:仅移除带下钻标记的条件行(用户手动条件与 keyword 原样保留),并重查还原 */
function clearDrilldown() {
    const next = stripDrilldown(fieldFilters.value)
    if (!next) return
    fieldFilters.value = next
    void doSearch()
}

// ---- 自定义分组聚合(维度/指标;影响 TopN 图,趋势/总数不变) ----
const aggrDimension = ref('')
const aggrMetric = ref('count')
const aggrLoading = ref(false)
/** 维度可输入任意云上原始字段名(后端校验该列已建分析索引,未索引给出可用清单) */
const DIM_TIP =
    '分组维度(下拉按可聚合性分组):\n' +
    '· 统一字段:host/status/URL/耗时 等已映射,直接选;\n' +
    '· 原始列:可输入云上字段名(如 real_client_ip / UA)按原始列聚合;\n' +
    '· 置灰项:多列拼接/归一化字段(如后端 IP),暂不可下推聚合'
const METRIC_OPTS = [
    { value: 'count', label: '计数' },
    { value: 'sum_bytes', label: '下行字节' },
    { value: 'avg_latency', label: '平均耗时' },
    { value: 'p99_latency', label: 'P99 耗时' },
]

async function doAggregate() {
    if (aggrLoading.value || !timeRange.value) return
    aggrLoading.value = true
    try {
        const agg = await aggregateLogsApi({
            log_type: activeType.value,
            start_time: timeRange.value[0].getTime(),
            end_time: timeRange.value[1].getTime(),
            query: keyword.value || undefined,
            clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
            resources: selectedResources.value.length ? selectedResources.value : undefined,
            filters: buildFilters(),
            dimension: aggrDimension.value || undefined,
            metric: aggrMetric.value === 'count' ? undefined : aggrMetric.value,
        }).catch(() => null)
        aggregate.value = agg
        if (!agg) ElMessage.warning('分组聚合失败(可能不支持的维度/指标),TopN 已还原')
    } finally {
        aggrLoading.value = false
    }
}

const drawerVisible = ref(false)
const detailEntry = ref<LogEntry | null>(null)

// ---- WAF 流量诊断(手动触发):诊断请求上下文 = 当前查询字段(与聚合对齐,
// 无 dimension/metric;维度集由后端诊断编排固定)。独立于统计/明细,只读引用。 ----
const diagnoseContext = computed<LogDiagnoseContext | null>(() => {
    if (!timeRange.value) return null
    return {
        start_time: timeRange.value[0].getTime(),
        end_time: timeRange.value[1].getTime(),
        query: keyword.value || undefined,
        clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
        resources: selectedResources.value.length ? selectedResources.value : undefined,
        filters: buildFilters(),
    }
})

const currentMeta = computed(() => typeMetas.value.find((t) => t.type === activeType.value))
const currentFields = computed(() => currentMeta.value?.fields ?? [])

// ---- 日志源分组(云·账号 -> 源) ----
const cloudOrder = ['aliyun', 'huawei', 'aws', 'tencent', 'volcano']

const filteredSources = computed(() =>
    selectedClouds.value.length
        ? sources.value.filter((s) => selectedClouds.value.includes(s.cloud))
        : sources.value,
)

const sourceGroups = computed(() => {
    const map = new Map<string, LogSource[]>()
    for (const s of filteredSources.value) {
        const key = `${s.cloud}·${s.account_name}`
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(s)
    }
    return Array.from(map.entries())
        .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
        .map(([key, list]) => ({ key, label: key, sources: list }))
})

function groupRank(groupKey: string): number {
    const idx = cloudOrder.findIndex((c) => groupKey.startsWith(c))
    return idx < 0 ? cloudOrder.length : idx
}

const availableClouds = computed(() => {
    const seen = new Map<string, string>()
    for (const s of sources.value) {
        if (!seen.has(s.cloud)) seen.set(s.cloud, cloudLabel(s.cloud))
    }
    return Array.from(seen.entries())
        .sort((a, b) => cloudOrder.indexOf(a[0]) - cloudOrder.indexOf(b[0]))
        .map(([value, label]) => ({ value, label }))
})

const disabledSources = computed(() => filteredSources.value.filter((s) => !s.enabled))

// ---- 详情抽屉字段(剔除 meta.* 固定列,统一字段平铺) ----
const drawerFields = computed(() =>
    currentFields.value
        .filter((f) => !f.key.startsWith('meta.'))
        .map((f) => ({ key: f.key, label: f.label })),
)

// ---- 加载 ----
onMounted(async () => {
    resetTimeRange()
    try {
        typeMetas.value = await getLogTypesApi()
    } catch {
        // 字段字典失败:给出可见报错(不静默)。类型 Tab 与动态列不可用,但时间窗约束与手输检索仍可用
        typeMetas.value = []
        ElMessage.error('日志字段字典加载失败,请刷新重试')
    }
    await loadSources()
})

async function loadSources(force = false) {
    sourcesLoading.value = true
    try {
        // 源清单变动频率低(CDN/WAF 域名、S3 前缀、LTS 流):切 Tab 复用本地
        // 缓存立即渲染,零请求;force=true(手动「刷新源列表」)强制重拉。
        const cached = sourcesCache.value[activeType.value]
        if (cached && cached.length > 0 && !force) {
            sources.value = cached
        } else {
            const list = await getLogSourcesApi({ log_type: activeType.value })
            sources.value = list
            sourcesCache.value = { ...sourcesCache.value, [activeType.value]: list }
        }
        // 清除已失效的资源选择
        const valid = new Set(sources.value.map((s) => s.resource_id))
        selectedResources.value = selectedResources.value.filter((r) => valid.has(r))
        // 首次加载:云选择收敛到实际有源的默认云(避免空选导致"全部云"联邦扫)
        if (!cloudsTouched.value) {
            const available = new Set(sources.value.map((s) => s.cloud))
            selectedClouds.value = DEFAULT_CLOUDS.filter((c) => available.has(c))
        }
    } catch {
        // 加载失败:清空源列表并给出可见报错;云选择保持原值不动(上方云收敛只在成功路径执行),
        // 避免退化成全云联邦扫
        sources.value = []
        ElMessage.error('日志源列表加载失败,请刷新重试')
    } finally {
        sourcesLoading.value = false
    }
}

/** 手动强制刷新源列表(新增域名/源时兜底;平时缓存即可) */
function refreshSources() {
    void loadSources(true)
}

function onTypeChange() {
    resp.value = null
    aggregate.value = null
    selectedResources.value = []
    allEntries.value = []
    // 切类型:分组折叠态重置为全展开(组键跨类型语义不同)
    collapsedGroups.value = new Set()
    // 字段字典随类型变化,清理跨类型残留的筛选/分组条件
    fieldFilters.value = []
    aggrDimension.value = ''
    aggrMetric.value = 'count'
    resetTimeRange()
    // 切类型复用本地缓存(缓存有该类型即零请求);无缓存才拉一次
    void loadSources()
}

function onCloudsChange() {
    cloudsTouched.value = true
    // 跨云残留的已选源从选中移除:源归属云,切云后原选中的 AWS/华为源
    // 不再匹配(否则选中项残留 + 旧结果含其它云源,观感像"选阿里却有 AWS")
    const cloudSet = new Set(selectedClouds.value)
    selectedResources.value = selectedResources.value.filter((r) => {
        const owner = sources.value.find((s) => s.resource_id === r)
        return !owner || cloudSet.has(owner.cloud) // 无归属信息则保留
    })
    // 已有查询结果时按新云自动重查:保持"所见即所选"(doSearch 自带 searching
    // 防并发;查询有 SWR 结果缓存,代价低)
    if (resp.value) void doSearch()
}

// ---- 时间窗口约束与快捷窗口(默认最近 1 小时;快捷可切 2/4/6h) ----
/** 快捷时间窗口(小时)。点击即设为最近 N 小时并重查。 */
const QUICK_WINDOWS = [1, 2, 4, 6] as const
/** 快捷窗口判定容差(±1 分钟):手动微调过的时间不误标激活 */
const QUICK_WINDOW_TOL = 60_000

function resetTimeRange() {
    const end = Date.now()
    const window = defaultWindowMs(currentMeta.value?.max_window_days ?? 7)
    // 默认最近 1 小时(用户要求:诊断/查询聚焦近期);快捷可切 2/4/6h;
    // 仍受类型上限钳制(CDN 7d / SLB 3d)
    timeRange.value = [new Date(end - Math.min(window, 1 * 3600_000)), new Date(end)]
}

/** 快捷窗口按钮:点击设 timeRange=[now-Nh, now],已有结果自动重查(与云切换一致) */
function applyQuickWindow(hours: number) {
    const end = Date.now()
    timeRange.value = [new Date(end - hours * 3600_000), new Date(end)]
    if (resp.value) void doSearch()
}

/** 当前时间范围是否恰为最近 N 小时(容差内高亮对应按钮) */
function isActiveQuickWindow(hours: number): boolean {
    if (!timeRange.value) return false
    const end = Date.now()
    const wantEnd = end
    const wantStart = end - hours * 3600_000
    return (
        Math.abs(timeRange.value[0].getTime() - wantStart) <= QUICK_WINDOW_TOL &&
        Math.abs(timeRange.value[1].getTime() - wantEnd) <= QUICK_WINDOW_TOL
    )
}

function disableOutsideWindow(d: Date): boolean {
    const days = currentMeta.value?.max_window_days ?? 7
    const floor = Date.now() - days * 24 * 3600_000
    return d.getTime() < floor || d.getTime() > Date.now()
}

function onTimeChange() {
    // 超窗自动收紧到上限(与 disableOutsideWindow 双保险)
    const days = currentMeta.value?.max_window_days ?? 7
    const floor = Date.now() - days * 24 * 3600_000
    if (timeRange.value && timeRange.value[0].getTime() < floor) {
        timeRange.value = [new Date(floor), timeRange.value[1]]
    }
}

// ---- 查询 ----
async function doSearch() {
    // 按钮与回车共用入口:查询进行中(联邦跨多云,耗时可观)直接忽略再次触发,
    // 否则并发叠加请求且响应乱序时后返回的旧结果会覆盖新结果
    if (searching.value) return
    if (!timeRange.value) {
        // 时间范围被清空(datetimerange 默认可 clear)时给可见提示,而非静默无响应
        ElMessage.warning('请选择查询时间范围')
        return
    }
    searching.value = true
    searchError.value = ''
    startProgress()
    detailVisible.value = false // 新查询收敛到统计视图
    // 新查询重置分页游标(回到最新/首页)
    allEntries.value = []
    pageLoading.value = false
    pageInc.value = null
    pageBottom.value = false
    const filters = buildFilters()
    const params = {
        log_type: activeType.value,
        start_time: timeRange.value[0].getTime(),
        end_time: timeRange.value[1].getTime(),
        query: keyword.value || undefined,
        clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
        resources: selectedResources.value.length ? selectedResources.value : undefined,
        filters: filters as FieldFilter[] | undefined,
    }
    // 取消控制器:查询按钮旁出现「取消」,中止即停(见 cancelSearch)
    const ctrl = new AbortController()
    searchAbort.value = ctrl
    try {
        // search(采样明细)+ aggregate(全窗真实统计)并行;聚合失败降级采样视图
        const [searchRes, aggRes] = await Promise.all([
            searchLogsApi({ ...params, limit: limit.value }, { signal: ctrl.signal }),
            aggregateLogsApi({
                ...params,
                dimension: aggrDimension.value || undefined,
                metric: aggrMetric.value === 'count' ? undefined : aggrMetric.value,
            }, { signal: ctrl.signal }).catch(() => null),
        ])
        resp.value = searchRes
        aggregate.value = aggRes
        appendEntries(searchRes.entries)
    } catch (e) {
        resp.value = null
        aggregate.value = null
        searchError.value = isCanceled(e) ? '查询已取消' : e instanceof Error ? e.message : String(e)
    } finally {
        stopProgress()
        searching.value = false
        searchAbort.value = null
    }
}

// ---- 时间游标翻页(明细) ----
function appendEntries(rows: LogEntry[]) {
    // 上游窗口严格前移(end = 上一页最旧秒 - 1s),页间无重复,直接追加
    allEntries.value = [...allEntries.value, ...rows]
}

async function loadEarlier() {
    if (pageLoading.value || !timeRange.value) return
    if (!resp.value) {
        await doSearch()
        return
    }
    if (!canLoadEarlier.value) {
        ElMessage.info('已到窗口起点,没有更早的日志')
        return
    }
    pageLoading.value = true
    startProgress()
    const ctrl = new AbortController()
    searchAbort.value = ctrl
    try {
        const pageRes = await searchLogsApi({
            log_type: activeType.value,
            start_time: timeRange.value[0].getTime(),
            // 窗口上界前移当前最旧一条 - 1 秒:WAF3 等秒级时间戳源整批完整
            // 迁移(1ms 前移会把整个秒批次跳过;毫秒级源丢 1 秒无感知)
            end_time: oldestTs.value - 1000,
            query: keyword.value || undefined,
            clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
            resources: selectedResources.value.length ? selectedResources.value : undefined,
            filters: buildFilters(),
            limit: limit.value,
        }, { signal: ctrl.signal })
        const before = allEntries.value.length
        appendEntries(pageRes.entries)
        pageInc.value = allEntries.value.length - before
        // per-source 状态条随当前页刷新(统计图仍整窗,不受影响)
        resp.value = pageRes
        // 该源剩余窗口已无数据(42 条即该源真实量的末页迹象):扣一次到底
        if (pageRes.entries.length === 0 || oldestTs.value <= timeRange.value[0].getTime()) {
            pageBottom.value = true
            if (pageRes.entries.length === 0) ElMessage.info('没有更早的日志,已到窗口起点')
        }
    } catch (e) {
        if (!isCanceled(e)) {
            ElMessage.error(e instanceof Error ? `加载更早失败: ${e.message}` : '加载更早失败')
        }
    } finally {
        stopProgress()
        pageLoading.value = false
        searchAbort.value = null
    }
}

/** 回到窗口起点重置为最新一批 */
function backToLatest() {
    if (searching.value) return
    void doSearch()
}

// ---- 详情 ----
function openDetail(row: LogEntry) {
    detailEntry.value = row
    drawerVisible.value = true
}

// ---- 渲染辅助 ----
function isMono(key: string): boolean {
    return ['client_ip', 'target_ip', 'request_id', 'edge_node', 'meta.region',
        'meta.resource_id', 'meta.account_name', 'tls_protocol', 'rule_id', 'geo'].includes(key)
}

function columnWidth(key: string): number {
    if (key === 'timestamp') return 140
    if (key === 'url' || key === 'uri') return 280
    if (key === 'user_agent' || key === 'referer') return 220
    if (key === 'meta.resource_id') return 160
    if (key === 'status' || key === 'method' || key === 'action' || key === 'severity' || key === 'cache_hit') return 88
    return 130
}
</script>

<style scoped>
.logs-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
}
.page-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
}
.page-title {
    margin: 0;
    font-size: 20px;
}
.page-sub {
    color: var(--el-text-color-secondary);
    font-size: 13px;
}
.filter-card {
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 4px 16px 12px;
    border: 1px solid var(--el-border-color-lighter);
}
.type-tabs :deep(.el-tabs__header) {
    margin-bottom: 8px;
}
.filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.filter-time {
    width: 360px;
}
/* 快捷时间窗口 chips */
.quick-windows {
    display: flex;
    gap: 4px;
}
.qw-chip {
    padding: 4px 10px;
    font-size: 12px;
    line-height: 1.2;
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    background: transparent;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    transition: all 0.15s;
}
.qw-chip:hover {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
}
.qw-chip.qw-active {
    background: var(--el-color-primary);
    border-color: var(--el-color-primary);
    color: #fff;
}
.filter-clouds {
    width: 180px;
}
.filter-resources {
    width: 280px;
}
.filter-keyword {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
}
/* 结构化字段筛选 */
.filter-fields {
    margin-top: 10px;
    padding: 10px 12px 6px;
    border: 1px dashed var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
}
.field-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}
.ff-field { width: 160px; }
.ff-op { width: 110px; }
.ff-value { flex: 1; min-width: 160px; max-width: 300px; }
/* 字段快捷值 chips(样本回填) */
.field-filter-item {
    margin-bottom: 8px;
}
.quick-values {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: -2px 0 6px;
    padding-left: 2px;
}
.qv-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
}
.qv-chip {
    max-width: 220px;
    padding: 1px 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-regular);
    font-size: 12px;
    line-height: 18px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
        border-color: var(--el-color-primary-light-5);
        color: var(--el-color-primary);
    }
}
.qv-chip.qv-active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
}
.filter-fields-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    .fields-hint { font-size: 12px; color: var(--text-tertiary); margin-left: 4px; }
}
.filter-limit {
    width: 110px;
}
.source-option {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}
.source-disabled {
    color: var(--el-color-warning);
    font-size: 12px;
}
.delivery-alert {
    margin-top: 8px;
}
.delivery-notes {
    font-size: 12px;
    line-height: 1.8;
}
.delivery-note {
    color: var(--el-text-color-regular);
}
/* 明细翻页条 */
.pager-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed var(--el-border-color-lighter);
    font-size: 12px;
}
.pager-info {
    color: var(--el-text-color-primary);
    font-weight: 600;
}
.pager-oldest {
    color: var(--el-text-color-secondary);
}
.pager-note {
    color: var(--el-text-color-secondary);
    cursor: help;
}
/* 分组聚合条 */
.aggr-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 8px 14px;
    font-size: 12px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
}
.aggr-label {
    color: var(--el-text-color-primary);
    font-weight: 600;
}
.aggr-dim { width: 190px; }
.aggr-metric { width: 130px; }
.aggr-skip {
    color: var(--el-color-warning);
    cursor: help;
}
.sources-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}
.strip-label,
.strip-total {
    color: var(--el-text-color-secondary);
}
.source-tag {
    font-size: 12px;
}
.table-card {
    background: var(--el-bg-color);
    border-radius: 8px;
    padding: 8px;
    border: 1px solid var(--el-border-color-lighter);
}
.detail-toggle {
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

    &:hover {
        background: var(--el-fill-color-light);
    }
}
.toggle-title {
    font-weight: 600;
}
.toggle-hint {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: normal;
}
/* 明细区外层滚动容器:内容超过一屏高时区内滚动(明细分屏),表头吸顶依赖此滚动上下文 */
.detail-body {
    margin-top: 4px;
    max-height: 72vh;
    overflow: auto;
}
/* 明细 云·账号 分组 */
.group-toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
}
/* 明细采样标注:高流量源明细仅覆盖窗口尾部,黄底弱提示,不打断主视觉 */
.detail-sample-note {
    margin-bottom: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-color-warning-text, #b88230);
    background: var(--el-color-warning-light-9, #fdf6ec);
    word-break: break-all;
}
.group-toolbar-label {
    color: var(--el-text-color-secondary);
}
.entry-group {
    margin-bottom: 8px;
}
.group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    cursor: pointer;
    color: var(--el-text-color-primary);
    font-size: 12px;
    text-align: left;

    &:hover {
        background: var(--el-fill-color);
    }
}
.group-name {
    font-weight: 600;
}
.group-count,
.group-duration {
    color: var(--el-text-color-secondary);
}
.group-failed {
    font-size: 12px;
    cursor: help;
}
.group-hint {
    margin-left: auto;
    color: var(--el-text-color-secondary);
    font-weight: normal;
}
.log-table {
    width: 100%;
    cursor: pointer;
    /* 放开 el-table 根节点的 overflow:hidden 裁剪,否则 header-wrapper 的
       position:sticky 只能相对表格自身(不滚动),吸顶相对 detail-body 失效;
       横向滚动仍由表格内部 body-wrapper 的 scrollbar 承担,不外溢 */
    overflow: visible;
}
/* 表头吸顶:行随 .detail-body 滚动,各分组表头钉在其所属表格顶部,
   滚出表格范围即随表格带走,分组结构互不干扰 */
.detail-body :deep(.log-table .el-table__header-wrapper) {
    position: sticky;
    top: 0;
    z-index: 5;
}
.cell-mono {
    font-family: var(--el-font-family-mono, 'JetBrains Mono', Consolas, monospace);
    font-size: 12px;
}
.state-card {
    padding: 48px 0;
    text-align: center;
}
.state-icon {
    font-size: 32px;
    margin-bottom: 8px;
}
.state-icon-error {
    color: var(--el-color-danger);
}
.state-title {
    font-weight: 600;
    margin-bottom: 4px;
}
.state-desc {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-bottom: 12px;
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
}
.state-raw {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin: -8px 0 12px;
    word-break: break-all;
}
.table-skeleton {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
}
.search-progress-text {
    padding: 0 12px 12px;
    font-size: 13px;
}
.progress-main {
    font-weight: 600;
    color: var(--el-text-color-primary);
}
.progress-hint {
    margin-left: 8px;
    font-size: 12px;
    font-weight: normal;
    color: var(--el-text-color-secondary);
}
.pager-progress {
    color: var(--el-text-color-primary);
    font-weight: 600;
}
.skeleton-row {
    height: 28px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--el-fill-color-light) 25%, var(--el-fill-color) 37%, var(--el-fill-color-light) 63%);
    background-size: 400% 100%;
    animation: skeleton-loading 1.4s ease infinite;
}
@keyframes skeleton-loading {
    0% {
        background-position: 100% 50%;
    }
    100% {
        background-position: 0 50%;
    }
}
</style>
