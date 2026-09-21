<template>
  <PageContainer title="UI Kit 组件示例" class="ui-kit-page">
    <template #actions>
      <div class="ui-kit-theme-toggle" role="group" aria-label="深浅主题切换预览">
        <el-button
          size="small"
          :type="appStore.theme === 'dark' ? 'primary' : undefined"
          @click="applyTheme('dark')"
        >
          深色
        </el-button>
        <el-button
          size="small"
          :type="appStore.theme === 'light' ? 'primary' : undefined"
          @click="applyTheme('light')"
        >
          浅色
        </el-button>
      </div>
    </template>

    <template #filters>
      <nav class="ui-kit-anchor-nav" aria-label="组件锚点导航">
        <a
          v-for="section in UI_KIT_SECTIONS"
          :key="section.id"
          class="ui-kit-anchor"
          :href="`#${section.id}`"
        >
          {{ section.title }}
        </a>
      </nav>
    </template>

    <div class="ui-kit-intro">
      <p>
        Phase 2 六个 ui-kit 组件的典型用法与状态组合集中页：每个示例的源码可一键复制进业务页，
        作为 Phase 3 迁移 220+ 页的「照抄样板」；右上角切换深/浅主题做双主题视觉验收（含 hover 态）。
      </p>
      <p>
        所有示例只消费 CSS 变量令牌，本页自身也零硬编码颜色字面量——它同时是「零 scoped 色值」的页面样板。
      </p>
    </div>

    <!-- ==================== 1. StateBlock 统一三态块 ==================== -->
    <DemoSection
      :section-id="stateBlockSection.id"
      :title="stateBlockSection.title"
      :description="stateBlockSection.description"
      :code="stateBlockSection.code"
    >
      <div class="ui-kit-state-grid">
        <div class="ui-kit-panel">
          <div class="ui-kit-panel__label">loading（骨架屏）</div>
          <StateBlock status="loading" :skeleton-rows="3" />
        </div>
        <div class="ui-kit-panel">
          <div class="ui-kit-panel__label">success（默认插槽）</div>
          <StateBlock status="success">
            <div class="ui-kit-mini-content">
              <p>成功态渲染默认插槽：真实业务内容直接放这里。</p>
              <p>例如表格、图表、描述列表……</p>
            </div>
          </StateBlock>
        </div>
        <div class="ui-kit-panel">
          <div class="ui-kit-panel__label">empty（空态 + 操作）</div>
          <StateBlock status="empty" empty-text="暂无告警事件">
            <template #actions>
              <el-button size="small" type="primary">新建告警规则</el-button>
            </template>
          </StateBlock>
        </div>
        <div class="ui-kit-panel">
          <div class="ui-kit-panel__label">error（错误码 + 重试）</div>
          <StateBlock
            status="error"
            error-text="告警列表加载失败"
            error-code="ECONNABORTED"
            error-detail="GET /api/alerts 请求超时"
            @retry="stateRetryCount++"
          />
          <div class="ui-kit-panel__foot">已重试 {{ stateRetryCount }} 次</div>
        </div>
      </div>
    </DemoSection>

    <!-- ==================== 2. FilterBar 配置化筛选栏 ==================== -->
    <DemoSection
      :section-id="filterBarSection.id"
      :title="filterBarSection.title"
      :description="filterBarSection.description"
      :code="filterBarSection.code"
    >
      <div class="ui-kit-filterbar-demo">
        <div class="ui-kit-filterbar-shell">
          <FilterBar
            v-model="filters"
            :fields="filterFields"
            @field-change="handleFilterChange"
          >
            <template #actions>
              <el-button size="small" @click="resetFilters">重置</el-button>
            </template>
          </FilterBar>
        </div>
        <div class="ui-kit-filterbar-status">
          <span>当前筛选值：<code>{{ filterJson }}</code></span>
          <span v-if="lastFilterChange">最近变更：{{ lastFilterChange }}</span>
        </div>
      </div>
    </DemoSection>

    <!-- ==================== 3. DataTable 表格封装 ==================== -->
    <DemoSection
      :section-id="dataTableSection.id"
      :title="dataTableSection.title"
      :description="dataTableSection.description"
      :code="dataTableSection.code"
    >
      <div class="ui-kit-table-states">
        <div class="ui-kit-table-state">
          <div class="ui-kit-table-state__label">loading（骨架屏）</div>
          <div class="ui-kit-table-loading">
            <DataTable :columns="miniColumns" :data="[]" loading />
          </div>
        </div>
        <div class="ui-kit-table-state">
          <div class="ui-kit-table-state__label">empty（空数据）</div>
          <div class="ui-kit-table-empty">
            <DataTable :columns="miniColumns" :data="[]" empty-text="暂无资产" />
          </div>
        </div>
        <div class="ui-kit-table-state">
          <div class="ui-kit-table-state__label">error（失败 + 重试）</div>
          <div class="ui-kit-table-error">
            <DataTable :columns="miniColumns" :fetch="demoFetch" />
          </div>
          <el-button size="small" class="ui-kit-recover" @click="serviceUp = !serviceUp">
            {{ serviceUp ? '模拟接口故障' : '模拟接口恢复' }}
          </el-button>
        </div>
      </div>

      <div class="ui-kit-table-toolbar">
        <span class="ui-kit-table-state__label">密度切换</span>
        <el-button
          size="small"
          :type="tableDensity === 'default' ? 'primary' : undefined"
          @click="tableDensity = 'default'"
        >
          默认
        </el-button>
        <el-button
          size="small"
          :type="tableDensity === 'compact' ? 'primary' : undefined"
          @click="tableDensity = 'compact'"
        >
          紧凑
        </el-button>
      </div>
      <div class="ui-kit-table-main">
        <DataTable
          :columns="mainColumns"
          :data="demoRows"
          :density="tableDensity"
          selectable
          :batch-actions="[
            { key: 'sync', label: '批量同步' },
            { key: 'delete', label: '批量删除', type: 'danger' },
          ]"
          max-height="320"
          @batch-action="handleBatchAction"
        >
          <template #status="{ row }">
            <span
              class="ui-kit-status"
              :class="row.status === 'running' ? 'ui-kit-status--ok' : 'ui-kit-status--off'"
            >
              <span class="ui-kit-status__dot" />
              {{ row.status === 'running' ? '运行中' : '已停止' }}
            </span>
          </template>
          <template #ops>
            <el-button link type="primary" size="small" @click="openDrawer(false)">
              详情
            </el-button>
          </template>
        </DataTable>
        <div class="ui-kit-batch-status">
          最近批量动作：{{ lastBatchAction ?? '（勾选行后点批量按钮）' }}
        </div>
      </div>
    </DemoSection>

    <!-- ==================== 4. PageContainer 标准页面骨架 ==================== -->
    <DemoSection
      :section-id="pageContainerSection.id"
      :title="pageContainerSection.title"
      :description="pageContainerSection.description"
      :code="pageContainerSection.code"
    >
      <div class="ui-kit-page-shell">
        <PageContainer title="主机列表（示例页）">
          <template #actions>
            <el-button size="small" type="primary">新建云主机</el-button>
          </template>
          <template #filters>
            <FilterBar v-model="nestedFilters" :fields="nestedFields" :collapsible="false" />
          </template>
          <DataTable :columns="miniColumns" :data="demoRows" density="compact" />
          <template #footer>
            <el-pagination layout="total, prev, pager, next" :total="42" :page-size="10" />
          </template>
        </PageContainer>
      </div>
    </DemoSection>

    <!-- ==================== 5. DetailDrawer 统一详情抽屉 ==================== -->
    <DemoSection
      :section-id="detailDrawerSection.id"
      :title="detailDrawerSection.title"
      :description="detailDrawerSection.description"
      :code="detailDrawerSection.code"
    >
      <div class="ui-kit-drawer-demo">
        <el-button type="primary" @click="openDrawer(false)">打开详情抽屉</el-button>
        <el-button @click="openDrawer(true)">加载态示例（骨架屏）</el-button>

        <DetailDrawer
          v-model:visible="drawerVisible"
          title="资产详情（示例）"
          size="520px"
          show-footer
          :loading="drawerLoading"
          :sections="detailSections"
        >
          <template #header-actions>
            <el-button size="small">导出报告</el-button>
          </template>
          <template #footer>
            <el-button type="primary" @click="drawerVisible = false">关闭</el-button>
          </template>
        </DetailDrawer>
      </div>
    </DemoSection>

    <!-- ==================== 6. CommandPalette ⌘K 命令面板 ==================== -->
    <DemoSection
      :section-id="commandPaletteSection.id"
      :title="commandPaletteSection.title"
      :description="commandPaletteSection.description"
      :code="commandPaletteSection.code"
    >
      <div class="ui-kit-palette-demo">
        <el-button type="primary" @click="paletteVisible = true">打开命令面板</el-button>
        <span class="ui-kit-palette-hint">或按 ⌘K / Ctrl+K（本页已挂载实例，快捷键全局可用）</span>
        <CommandPalette v-model:visible="paletteVisible" />
      </div>
    </DemoSection>
  </PageContainer>
</template>

<script setup lang="ts">
/**
 * /dev/ui-kit 内部组件 demo 页（ui-unify-phase2-components 任务 8）。
 *
 * 集中展示 Phase 2 六个 ui-kit 组件的典型用法与状态组合：每个示例代码可一键
 * 复制进业务页（照抄样板定位），作为 Phase 3 迁移 220+ 页的样板与双主题可视化
 * 验收靶场。路由 hideInMenu（不进侧栏菜单），直接输 URL 访问。
 *
 * Hard Rules：
 * - 本页自身零硬编码颜色字面量（只消费 Phase 1 CSS 变量令牌，index.test.ts 有守卫）；
 * - 不修改 Task 1-6 的组件源码，只按其公开 API 消费。
 */
import CommandPalette from '@/components/CommandPalette/index.vue'
import DataTable from '@/components/DataTable/index.vue'
import type { DataTableColumn, DataTableDensity } from '@/components/DataTable/types'
import DetailDrawer from '@/components/DetailDrawer/index.vue'
import type { DetailSection } from '@/components/DetailDrawer/index.vue'
import FilterBar from '@/components/FilterBar/index.vue'
import type { FilterField } from '@/components/FilterBar/types'
import PageContainer from '@/components/PageContainer/index.vue'
import StateBlock from '@/components/StateBlock/index.vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import DemoSection from './DemoSection.vue'
import { UI_KIT_SECTIONS } from './snippets'
import type { UiKitSection } from './snippets'

// ==================== 区块元信息（单一来源：snippets.ts） ====================

/** 按 id 取区块元信息（模板显式引用，防与 snippets 漂移） */
function sectionOf(id: string): UiKitSection {
  const found = UI_KIT_SECTIONS.find((section) => section.id === id)
  if (!found) {
    throw new Error(`Unknown ui-kit section: ${id}`)
  }
  return found
}

const stateBlockSection = sectionOf('state-block')
const filterBarSection = sectionOf('filter-bar')
const dataTableSection = sectionOf('data-table')
const pageContainerSection = sectionOf('page-container')
const detailDrawerSection = sectionOf('detail-drawer')
const commandPaletteSection = sectionOf('command-palette')

// ==================== 深/浅主题切换预览 ====================

const appStore = useAppStore()

/** 切换全局主题（深/浅双主题验收；经 appStore 持久化） */
function applyTheme(theme: 'dark' | 'light'): void {
  appStore.setTheme(theme)
}

// ==================== 1. StateBlock 四态 ====================

/** error 面板的重试计数（展示 @retry 回调通路） */
const stateRetryCount = ref(0)

// ==================== 2. FilterBar 折叠态 ====================

/** 示例字段：与 assets 页真实筛选锚点同构（6 字段在限宽容器内必然折叠） */
const filterFields: FilterField[] = [
  { key: 'name', label: '资产名称', type: 'input' },
  {
    key: 'provider',
    label: '云厂商',
    type: 'select',
    options: [
      { label: '阿里云', value: 'aliyun' },
      { label: '腾讯云', value: 'tencent' },
      { label: '华为云', value: 'huawei' },
    ],
  },
  {
    key: 'assetType',
    label: '资产类型',
    type: 'select',
    options: [
      { label: '云主机', value: 'ecs' },
      { label: '云数据库', value: 'rds' },
      { label: '负载均衡', value: 'lb' },
    ],
  },
  {
    key: 'region',
    label: '区域',
    type: 'select',
    options: [
      { label: '华东 1（杭州）', value: 'cn-hangzhou' },
      { label: '华北 2（北京）', value: 'cn-beijing' },
      { label: '华南 1（深圳）', value: 'cn-shenzhen' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '运行中', value: 'running' },
      { label: '已停止', value: 'stopped' },
    ],
  },
  { key: 'updatedAt', label: '更新时间', type: 'date', range: true },
]

const filters = ref<Record<string, unknown>>({})
const lastFilterChange = ref('')

const filterJson = computed(() => JSON.stringify(filters.value))

/** 字段 change 统一回调（真实业务页在此触发检索） */
function handleFilterChange(field: FilterField, value: unknown): void {
  lastFilterChange.value = `${field.label} → ${String(value)}`
}

function resetFilters(): void {
  filters.value = {}
  lastFilterChange.value = ''
}

// ==================== 3. DataTable 三态 + 批量操作 ====================

interface DemoAsset {
  name: string
  ip: string
  status: 'running' | 'stopped'
  updatedAt: string
}

const demoRows: DemoAsset[] = [
  { name: 'web-prod-01', ip: '10.0.12.34', status: 'running', updatedAt: '2026-09-20 10:12' },
  { name: 'web-prod-02', ip: '10.0.12.35', status: 'stopped', updatedAt: '2026-09-19 18:40' },
  { name: 'db-replica-01', ip: '10.0.20.11', status: 'running', updatedAt: '2026-09-21 08:03' },
]

const miniColumns: DataTableColumn<DemoAsset>[] = [
  { prop: 'name', label: '名称', width: 140 },
  { prop: 'ip', label: '内网 IP', width: 130 },
]

const mainColumns: DataTableColumn<DemoAsset>[] = [
  { prop: 'name', label: '名称', minWidth: 140, showOverflowTooltip: true },
  { prop: 'ip', label: '内网 IP', width: 130 },
  { prop: 'status', label: '状态', slot: 'status', width: 110 },
  { prop: 'updatedAt', label: '更新时间', width: 170, formatter: formatUpdatedAt },
  { label: '操作', slot: 'ops', width: 90, fixed: 'right' },
]

/** 单元格格式化示例（el-table-column formatter 透传） */
function formatUpdatedAt(_row: DemoAsset, _column: unknown, cellValue: unknown): string {
  return String(cellValue)
}

/** 三态演示的故障开关（false 时 fetch 拒绝 → 错误态；重试走组件内部重新拉取） */
const serviceUp = ref(false)

/** fetch 模式演示：组件自管三态；稳定引用，重试时读取最新开关值 */
const demoFetch = async (): Promise<DemoAsset[]> => {
  if (serviceUp.value) {
    return demoRows
  }
  throw new Error('503 Service Unavailable（演示故障）')
}

const tableDensity = ref<DataTableDensity>('default')
const lastBatchAction = ref<string | null>(null)

/** 批量操作条动作回调（真实业务页在此调批量接口） */
function handleBatchAction(key: string, rows: DemoAsset[]): void {
  lastBatchAction.value = `${key} × ${rows.length}`
  ElMessage.success(`已对 ${rows.length} 行执行 ${key}`)
}

// ==================== 4. PageContainer 完整骨架 ====================

const nestedFilters = ref<Record<string, unknown>>({})

const nestedFields: FilterField[] = [
  { key: 'keyword', label: '关键词', type: 'input' },
  {
    key: 'env',
    label: '环境',
    type: 'select',
    options: [
      { label: '生产', value: 'prod' },
      { label: '预发', value: 'staging' },
    ],
  },
]

// ==================== 5. DetailDrawer 分区块 ====================

const drawerVisible = ref(false)
const drawerLoading = ref(false)

const detailSections: DetailSection[] = [
  {
    title: '基础信息',
    items: [
      { label: '主机名', value: 'web-prod-01' },
      { label: '内网 IP', value: '10.0.12.34' },
      { label: '云厂商', value: '阿里云' },
      { label: '实例规格', value: 'ecs.g7.xlarge' },
      { label: '创建时间', value: '2026-08-01 14:32', span: 2 },
    ],
  },
  {
    title: '运行状态',
    items: [
      { label: 'CPU 使用率', value: 38, formatter: (value) => `${String(value)}%` },
      { label: '内存使用率', value: 61, formatter: (value) => `${String(value)}%` },
      { label: '备注', value: '' },
    ],
  },
]

/** 打开示例抽屉（loading=true 时展示内置骨架屏） */
function openDrawer(loading: boolean): void {
  drawerLoading.value = loading
  drawerVisible.value = true
}

// ==================== 6. CommandPalette 唤起入口 ====================

/** 受控模式开关（页面提供显式唤起入口；⌘K 全局快捷键仍由组件自持） */
const paletteVisible = ref(false)
</script>

<style scoped lang="scss">
.ui-kit-intro {
  margin-bottom: 8px;

  p {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--text-secondary);
  }
}

// ---- 锚点导航（含 hover 态，双主题验收点）----

.ui-kit-anchor-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ui-kit-anchor {
  padding: 4px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 999px;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--accent-blue);
  }
}

.ui-kit-theme-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

// ---- StateBlock 四态面板 ----

.ui-kit-state-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(200px, 1fr));
  gap: 12px;
}

.ui-kit-panel {
  padding: 12px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;

  &__label {
    margin-bottom: 8px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-tertiary);
  }

  &__foot {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.ui-kit-mini-content {
  p {
    margin: 4px 0;
    font-size: 13px;
    color: var(--text-regular);
  }
}

// ---- FilterBar 折叠演示（限宽容器制造一行放不下的场景）----

.ui-kit-filterbar-shell {
  max-width: 720px;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  margin-bottom: 8px;
}

.ui-kit-filterbar-status {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);

  code {
    padding: 2px 6px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: var(--bg-surface);
    border-radius: 4px;
  }
}

// ---- DataTable 三态 + 批量 ----

.ui-kit-table-states {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.ui-kit-table-state__label {
  margin-bottom: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-tertiary);
}

.ui-kit-table-state {
  .ui-kit-recover {
    margin-top: 8px;
  }
}

.ui-kit-table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ui-kit-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &--ok .ui-kit-status__dot {
    background: var(--accent-green);
  }

  &--off .ui-kit-status__dot {
    background: var(--text-muted);
  }
}

.ui-kit-batch-status {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

// ---- PageContainer 完整骨架（限高容器展示内部滚动与贴底 footer）----

.ui-kit-page-shell {
  height: 480px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;
}

// ---- 其它 ----

.ui-kit-palette-demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ui-kit-palette-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 1200px) {
  .ui-kit-state-grid {
    grid-template-columns: repeat(2, minmax(200px, 1fr));
  }

  .ui-kit-table-states {
    grid-template-columns: 1fr;
  }
}
</style>
