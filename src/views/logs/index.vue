<template>
  <div class="logs-page" aria-labelledby="logs-title">
    <!-- 常驻 live region：取消完成时向读屏播报（必须一开始就在 DOM 里，随后改文案才可靠） -->
    <p class="sr-only" role="status" aria-live="polite">{{ canceledAnnounce }}</p>
    <div class="page-header">
      <h1 id="logs-title" class="page-title">日志查询</h1>
      <span class="page-sub">多云日志统一视图(CDN / WAF / 负载均衡 / 源站 / 应用 / K8s 事件) · 联邦实时查询</span>
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
          v-model="selectedAccounts"
          class="filter-accounts"
          multiple
          filterable
          collapse-tags
          clearable
          placeholder="全部云账号"
          aria-label="按云账号筛选"
        >
          <el-option v-for="a in accountOptions" :key="a.value" :label="a.label" :value="a.value" />
        </el-select>
        <el-select
          v-model="selectedRegions"
          class="filter-regions"
          multiple
          collapse-tags
          clearable
          placeholder="全部区域"
          aria-label="按区域筛选"
        >
          <el-option v-for="r in regionOptions" :key="r" :label="r" :value="r" />
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
                <span v-else-if="s.stale" class="source-stale">停采</span>
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
        <el-select
          v-if="hasLevelField && levelOptions.length"
          :model-value="levelValue"
          class="filter-level"
          clearable
          placeholder="级别"
          aria-label="按级别筛选"
          @change="setLevelFilter"
        >
          <el-option v-for="lv in levelOptions" :key="lv" :label="lv" :value="lv" />
        </el-select>
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
        <el-button
          v-if="resp"
          size="small"
          text
          type="primary"
          aria-label="复制查询链接"
          @click="copyQueryLink"
        >复制链接</el-button>
        <el-button
          size="small"
          text
          type="primary"
          aria-label="保存当前查询条件"
          @click="handleSaveQuery"
        >保存查询</el-button>
        <el-dropdown trigger="click">
          <el-button size="small" text aria-label="已保存的查询">
            已存查询{{ savedQueries.length ? `(${savedQueries.length})` : '' }}<el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="!savedQueries.length" disabled>暂无保存的查询</el-dropdown-item>
              <el-dropdown-item v-for="q in savedQueries" :key="q.id" @click="handleLoadSaved(q)">
                <span class="saved-query-item">
                  <span class="saved-query-name">{{ q.name }}</span>
                  <el-icon class="saved-query-del" aria-label="删除该查询" @click.stop="removeQuery(q.id)"><Delete /></el-icon>
                </span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
          <span class="fields-hint">多条件叠加;字段取自当前类型的字段字典(域名/状态码/命名空间/原因等),与关键词 AND 生效</span>
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
      <el-tag v-if="resp.truncated" type="warning" size="small">结果已截断(可缩小时间范围或加筛选)</el-tag>
      <span class="strip-total">共 {{ resp.total }} 条</span>
      <el-button
        v-if="hasFailedSources"
        size="small"
        type="warning"
        plain
        :loading="retryingFailed"
        class="strip-retry"
        aria-label="重试失败源"
        @click="retryFailedSources"
      >重试失败源</el-button>
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
        v-if="canExport"
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

    <!-- CDN 缓存分析卡(手动触发;独立于统计/明细区块,不影响既有行为;仅 CDN Tab 显示) -->
    <CacheAnalyzeCard
      v-if="activeType === 'cdn'"
      :context="cacheAnalyzeContext"
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
          <div
            class="state-icon"
            :class="isCanceledState ? 'state-icon-canceled' : 'state-icon-error'"
            aria-hidden="true"
          >
            <span class="state-icon-glyph">{{ isCanceledState ? '⏹' : '⚠' }}</span>
          </div>
          <div class="state-title">{{ isCanceledState ? CANCELED_MESSAGE : '查询失败' }}</div>
          <div class="state-desc">{{ isCanceledState ? CANCELED_DESC : friendlySearchError(searchError) }}</div>
          <div v-if="!isCanceledState" class="state-raw">原始错误:{{ searchError }}</div>
          <el-button
            class="state-cta"
            type="primary"
            :aria-label="isCanceledState ? '重新查询' : '重试查询'"
            @click="doSearch"
          >
            {{ isCanceledState ? '重新查询' : '重试' }}
          </el-button>
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
              v-if="canExport"
              class="pager-export"
              size="small"
              text
              type="primary"
              :disabled="!timeRange || exporting"
              :loading="exporting"
              aria-label="全量导出 CSV"
              @click="exportAllDetail"
            >全量导出{{ exporting && exportTotal ? ` ${exportTotal} 条` : '' }}</el-button>
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
 *
 * 本文件是**编排层**:页面级状态、生命周期与跨模块接线在此。四类可独立推演的逻辑
 * 已分置同目录 composable ——
 *   useLogSearch(查询/翻页/取消/进度)、useLogFilters(筛选/下钻/聚合/导出)、
 *   useEntryGroups(明细分组)、useLogUrlSync(URL 水合与分享)、useLogSources(日志源)。
 * 纯计算(格式化/统计聚合/下钻行/CSV/URL 编解码)更早已抽到
 * format / stats / drilldown / csv / url-state,本次不再改动。
 *
 * 未外移的取舍:模板中的筛选卡与结果区**未**拆成子组件 —— 二者各自需要 20+ 个
 * 双向绑定与事件透传(几乎覆盖全页状态),抽出去只会把「一个长文件」换成
 * 「一个 35 项 props 的组件 + 一个长文件」,可读性反而下降。真正可复用的
 * 展示块(统计图/详情抽屉/WAF 诊断卡/CDN 缓存卡)此前已组件化。
 */
import { ArrowDown, ArrowRight, Delete, Refresh } from '@element-plus/icons-vue'
import { getLogTypesApi } from '@/api/logs'
import type { LogAggregateResponse, LogDiagnoseContext, LogEntry, LogType, LogTypeMeta } from '@/api/types/logs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import CacheAnalyzeCard from './components/CacheAnalyzeCard.vue'
import LogDetailDrawer from './components/LogDetailDrawer.vue'
import LogDiagnoseCard from './components/LogDiagnoseCard.vue'
import LogStats from './components/LogStats.vue'
// 模板直接使用的格式化函数(表格列渲染 / 状态码与动作标签配色)
import {
    actionTagType,
    cacheHitTagType,
    cellValue,
    cloudLabel,
    dashIfEmpty,
    defaultWindowMs,
    formatBytes,
    formatLogTime,
    severityTagType,
    statusTagType,
} from './format'
import { useEntryGroups } from './useEntryGroups'
import { DIM_TIP, FILTER_OPS, METRIC_OPTS, useLogFilters } from './useLogFilters'
import { CANCELED_DESC, CANCELED_MESSAGE, useLogSearch } from './useLogSearch'
import { useLogSources } from './useLogSources'
import { useLogUrlSync } from './useLogUrlSync'
import { useSavedQueries } from './useSavedQueries'
import type { SavedQuery } from './saved-queries'
import { clampWindow, hasQueryParams } from './url-state'
import { canExportLogs } from './export-permission'
import { useUserStore } from '@/stores/user'

/** 默认选中的云:阿里云(数据最全的源;用户手动改动后不再自动收敛) */
const DEFAULT_CLOUDS = ['aliyun']
/** 每日志源采样上限(后端单源硬顶 2000、联邦 3000;默认 1000 提高样本覆盖) */
const LIMIT_OPTIONS = [100, 500, 1000, 2000]

// ---- 导出权限:独立权限码 cam:logs:export;admin/只读默认拥有;默认放行 ----
const userStore = useUserStore()
const canExport = computed(() => canExportLogs(userStore.isAdmin, userStore.permissions))

// ---- 页面级状态:被两个及以上 composable 读写,故由页面持有并注入 ----
const typeMetas = ref<LogTypeMeta[]>([])
const activeType = ref<LogType>('cdn')
const timeRange = ref<[Date, Date] | null>(null)
const selectedClouds = ref<string[]>([...DEFAULT_CLOUDS])
/** 用户是否手动改过云选择(改过后不再自动收敛到默认) */
const cloudsTouched = ref(false)
/** 账号级筛选(平台内 ID;空 = 全部账号;随 search/aggregate/翻页/诊断/缓存请求下发) */
const selectedAccounts = ref<number[]>([])
/** 区域级筛选(空 = 全部区域;随 search/aggregate 请求下发,后端联邦层映射为资源过滤) */
const selectedRegions = ref<string[]>([])
const selectedResources = ref<string[]>([])
const keyword = ref('')
const limit = ref(1000)
/** 明细表格默认折叠(统计视图为主) */
const detailVisible = ref(false)
/**
 * 累积明细(跨页追加,时间倒序)。分页 = 时间游标翻页:下一页把窗口上界
 * 改为当前最旧一条 - 1 秒(覆盖秒级时间戳源如 WAF3,整批不丢不重),
 * 重新 search 并追加 —— 窗口严格前移天然无重复,不做逐条去重(曾用
 * ts:resource:source 做 key,把 WAF3 同秒数百条整批滤成 1 条)。
 */
const allEntries = ref<LogEntry[]>([])
/** 服务端聚合(真实总数/趋势/TopN;null=失败,统计图回退采样);doSearch 与「查分组」共用 */
const aggregate = ref<LogAggregateResponse | null>(null)

// ---- 派生:当前类型元数据与字段字典 ----
const currentMeta = computed(() => typeMetas.value.find((t) => t.type === activeType.value))
const currentFields = computed(() => currentMeta.value?.fields ?? [])

// ---- 日志级别快速筛选选项(app 为大写级别;K8s 事件归一为 warning/info) ----
const LEVEL_OPTIONS: Record<string, string[]> = {
    app: ['ERROR', 'WARN', 'INFO', 'DEBUG'],
    'k8s-event': ['warning', 'info'],
}
const levelOptions = computed(() => LEVEL_OPTIONS[activeType.value] ?? [])

// ================= composable 装配 =================
const {
    sources,
    sourcesLoading,
    filteredSources,
    sourceGroups,
    availableClouds,
    accountOptions,
    disabledSources,
    loadSources,
    refreshSources,
} = useLogSources({
    activeType,
    selectedClouds,
    selectedResources,
    cloudsTouched,
    defaultClouds: DEFAULT_CLOUDS,
})

/** 区域选项(来自当前类型源清单;按出现顺序去重) */
const regionOptions = computed(() => {
    const set: string[] = []
    for (const s of sources.value) {
        if (s.region && !set.includes(s.region)) set.push(s.region)
    }
    return set
})

/**
 * 查询引擎与筛选模块互为输入(查询要用筛选组装条件,筛选下钻后要重查)。
 * 以「先声明、后赋值」的转发引用打破构造期循环:该函数只在用户交互/查询触发时
 * 被调用,届时引用必然就绪;这样也避免了在 useLogSearch 里引用尚未构造的 filters。
 */
let runSearch: () => void = () => {}

const {
    fieldFilters,
    filterableFields,
    hasLevelField,
    levelValue,
    setLevelFilter,
    aggregatableFields,
    aggregatableDictFields,
    aggregatableRawFields,
    nonAggregatableDictFields,
    addFilterRow,
    quickValuesByField,
    fieldLabel,
    applyQuickValue,
    buildFilters,
    hasDrilldown,
    onBarDrilldown,
    onDiagDrilldown,
    exportStatsCsv,
    exporting,
    exportTotal,
    exportAllDetail,
    clearDrilldown,
    aggrDimension,
    aggrMetric,
    aggrLoading,
    doAggregate,
    resetFilters,
} = useLogFilters({
    activeType,
    currentFields,
    currentMeta,
    allEntries,
    aggregate,
    timeRange,
    keyword,
    selectedClouds,
    selectedAccounts,
    selectedRegions,
    selectedResources,
    triggerSearch: () => runSearch(),
})

const {
    searching,
    searchError,
    resp,
    pageLoading,
    pageInc,
    pageBottom,
    oldestTs,
    canLoadEarlier,
    searchElapsed,
    progressText,
    progressAria,
    friendlySearchError,
    isCanceledState,
    canceledAnnounce,
    cancelSearch,
    doSearch,
    loadEarlier,
    backToLatest,
    resetSearch,
    hasFailedSources,
    retryingFailed,
    retryFailedSources,
} = useLogSearch({
    activeType,
    timeRange,
    keyword,
    selectedClouds,
    selectedResources,
    selectedAccounts,
    selectedRegions,
    limit,
    aggrDimension,
    aggrMetric,
    filteredSources,
    buildFilters,
    allEntries,
    aggregate,
    detailVisible,
})

// 查询引擎就绪后回填转发引用(见上方说明)
runSearch = () => void doSearch()

const {
    entryGroups,
    groupOutcomes,
    groupErrorText,
    collapsedGroups,
    toggleGroup,
    allGroupsCollapsed,
    toggleAllGroups,
    resetCollapsed,
    detailSampleNote,
} = useEntryGroups({ allEntries, resp, timeRange, limit })

const { hydrateFromUrl, copyQueryLink } = useLogUrlSync({
    activeType,
    timeRange,
    selectedClouds,
    selectedResources,
    keyword,
    fieldFilters,
    aggrDimension,
    aggrMetric,
    limit,
    cloudsTouched,
    currentMeta,
    limitOptions: LIMIT_OPTIONS,
})

// ---- 查询条件保存与复用(localStorage 预设;账号筛选也纳入) ----
const { savedQueries, saveCurrent, applyQuery, removeQuery } = useSavedQueries({
    activeType,
    timeRange,
    selectedClouds,
    selectedAccounts,
    selectedRegions,
    selectedResources,
    keyword,
    fieldFilters,
    aggrDimension,
    aggrMetric,
    limit,
    cloudsTouched,
    currentMeta,
    limitOptions: LIMIT_OPTIONS,
})

function handleSaveQuery() {
    ElMessageBox.prompt('给当前查询条件起个名字(类型/时间/云/账号/源/关键词/字段筛选)', '保存查询', {
        confirmButtonText: '保存',
        cancelButtonText: '取消',
        inputPlaceholder: '例如:生产 WAF 攻击源排查',
        inputValidator: (v) => (v && v.trim() ? true : '名称不能为空'),
    })
        .then(({ value }) => {
            saveCurrent(value)
        })
        .catch(() => {})
}

function handleLoadSaved(q: SavedQuery) {
    const typeChanged = q.state.t !== activeType.value
    if (typeChanged) {
        // 复用保存条件时若类型变化:清理旧类型结果/折叠/筛选并刷新源清单,
        // 再由 applyQuery 回填保存条件(时间窗不回退到默认,保留保存值)
        resetSearch()
        aggregate.value = null
        resetCollapsed()
        resetFilters()
        void loadSources()
    }
    applyQuery(q.state)
    if (timeRange.value) void doSearch()
}

// ================= 详情抽屉 =================
const drawerVisible = ref(false)
const detailEntry = ref<LogEntry | null>(null)

function openDetail(row: LogEntry) {
    detailEntry.value = row
    drawerVisible.value = true
}

/** 详情抽屉字段(剔除 meta.* 固定列,统一字段平铺) */
const drawerFields = computed(() =>
    currentFields.value
        .filter((f) => !f.key.startsWith('meta.'))
        .map((f) => ({ key: f.key, label: f.label })),
)

// ---- WAF 流量诊断(手动触发):诊断请求上下文 = 当前查询字段(与聚合对齐,
// 无 dimension/metric;维度集由后端诊断编排固定)。独立于统计/明细,只读引用。 ----
const diagnoseContext = computed<LogDiagnoseContext | null>(() => {
    if (!timeRange.value) return null
    return {
        start_time: timeRange.value[0].getTime(),
        end_time: timeRange.value[1].getTime(),
        query: keyword.value || undefined,
        clouds: selectedClouds.value.length ? selectedClouds.value : undefined,
        account_ids: selectedAccounts.value.length ? selectedAccounts.value : undefined,
        resources: selectedResources.value.length ? selectedResources.value : undefined,
        filters: buildFilters(),
    }
})

/** 缓存分析上下文与诊断卡同构(当前查询字段,无 dimension/metric;仅 CDN Tab 使用) */
const cacheAnalyzeContext = diagnoseContext

/**
 * 账号选项随 源清单/云选择/类型 变化(源按类型缓存,账号集逐类型不同):
 * 失效的账号选择就地清理,避免查询范围被静默收窄("所见即所选"不变式)。
 */
watch(accountOptions, (opts) => {
    const valid = new Set(opts.map((a) => a.value))
    if (selectedAccounts.value.some((id) => !valid.has(id))) {
        selectedAccounts.value = selectedAccounts.value.filter((id) => valid.has(id))
    }
})

// ================= 时间窗口约束与快捷窗口 =================
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

// ================= 类型 / 云切换编排 =================
function onTypeChange() {
    // 清空查询结果与分页游标(游标由下一次 doSearch 彻底重置)
    resetSearch()
    aggregate.value = null
    selectedResources.value = []
    // 切类型:分组折叠态重置为全展开(组键跨类型语义不同)
    resetCollapsed()
    // 字段字典随类型变化,清理跨类型残留的筛选/分组条件
    resetFilters()
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
    // 同理清理跨云残留的账号选择(账号归属云;不清理会让查询静默变窄)
    selectedAccounts.value = selectedAccounts.value.filter((id) =>
        accountOptions.value.some((a) => a.value === id),
    )
    // 已有查询结果时按新云自动重查:保持"所见即所选"(doSearch 自带 searching
    // 防并发;查询有 SWR 结果缓存,代价低)
    if (resp.value) void doSearch()
}

// ================= 渲染辅助 =================
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

// ================= 生命周期 =================
onMounted(async () => {
    resetTimeRange()
    hydrateFromUrl()
    const urlHasQuery = hasQueryParams(new URLSearchParams(window.location.search))
    try {
        typeMetas.value = await getLogTypesApi()
    } catch {
        // 字段字典失败:给出可见报错(不静默)。类型 Tab 与动态列不可用,但时间窗约束与手输检索仍可用
        typeMetas.value = []
        ElMessage.error('日志字段字典加载失败,请刷新重试')
    }
    // 字典到位后复钳时间窗:水合时 meta 未加载按 7d 兜底,3d 类型(slb/access/app)
    // 的分享长窗链接打开即收紧到真实上限;复钳先于自动查询,查询用收紧后的窗口
    if (typeMetas.value.length && timeRange.value) {
        const [clampedStart, clampedEnd] = clampWindow(
            timeRange.value[0].getTime(),
            timeRange.value[1].getTime(),
            currentMeta.value?.max_window_days ?? 7,
        )
        timeRange.value = [new Date(clampedStart), new Date(clampedEnd)]
    }
    await loadSources()
    // 分享进入:URL 携带查询条件时自动跑一次,还原协作者看到的场景
    if (urlHasQuery && timeRange.value) void doSearch()
})
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
.filter-accounts {
    width: 200px;
}
.filter-regions {
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
.filter-level {
    width: 120px;
}
/* 已保存查询下拉项:名称 + 行内删除 */
.saved-query-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}
.saved-query-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.saved-query-del {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);

    &:hover {
        color: var(--el-color-danger);
    }
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
.source-stale {
    color: var(--el-text-color-tertiary);
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
.strip-retry {
    margin-left: auto;
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

/* 取消不是失败：用中性色，避免红图标暗示故障 */
.state-icon-canceled {
    color: var(--text-secondary);
}

/* U+23F9 默认是文本呈现，但字体回退可能给彩色 emoji；强制文本变体以保持中性灰表达 */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
.state-icon-glyph {
    font-variant-emoji: text;
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
