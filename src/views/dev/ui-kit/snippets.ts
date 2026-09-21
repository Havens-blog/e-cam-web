/**
 * /dev/ui-kit demo 页的示例源码常量（ui-unify-phase2-components 任务 8）。
 *
 * 每段代码即「照抄样板」：与页面上真实渲染的示例一一对应，业务页迁移时
 * 点「复制代码」直接粘贴。用字符串常量内嵌展示（Implementation Note 约定），
 * 避免运行时读文件；与组件解耦，仅作展示文本，不参与运行时逻辑。
 */

/** demo 区块元信息（锚点导航与区块渲染共用） */
export interface UiKitSection {
    /** 锚点 id（同时是区块根元素 id 与导航 href） */
    id: string
    /** 区块标题 */
    title: string
    /** 一句话说明（何时用这个组件） */
    description: string
    /** 展示并复制的源码片段 */
    code: string
}

export const STATE_BLOCK_SNIPPET = `<script setup lang="ts">
import StateBlock from '@/components/StateBlock/index.vue'
import { ref } from 'vue'

// 四态由 status 驱动：loading 骨架屏 / empty 空态 / error 错误+重试 / success 默认插槽
const status = ref<'loading' | 'empty' | 'error' | 'success'>('loading')

async function load() {
  status.value = 'loading'
  try {
    rows.value = await fetchRows()
    status.value = rows.value.length ? 'success' : 'empty'
  } catch {
    status.value = 'error'
  }
}
</script>

<template>
  <StateBlock
    :status="status"
    empty-text="暂无告警事件"
    error-text="告警列表加载失败"
    error-code="ECONNABORTED"
    error-detail="GET /api/alerts 请求超时"
    @retry="load"
  >
    <!-- status=success 时渲染默认插槽内容 -->
    <AlertTable :rows="rows" />
    <!-- 空态/错误态底部操作区（可选） -->
    <template #actions>
      <el-button type="primary">新建告警规则</el-button>
    </template>
  </StateBlock>
</template>`

export const FILTER_BAR_SNIPPET = `<script setup lang="ts">
import FilterBar from '@/components/FilterBar/index.vue'
import type { FilterField } from '@/components/FilterBar/types'
import { ref } from 'vue'

// 字段顺序即渲染顺序；字段一行放不下时自动折叠（无需任何配置）
const fields: FilterField[] = [
  { key: 'name', label: '资产名称', type: 'input' },
  { key: 'provider', label: '云厂商', type: 'select', options: CLOUD_PROVIDERS },
  { key: 'assetType', label: '资产类型', type: 'select', options: ASSET_TYPES },
  { key: 'region', label: '区域', type: 'select', options: REGIONS },
  { key: 'status', label: '状态', type: 'select', options: ASSET_STATUS },
  { key: 'updatedAt', label: '更新时间', type: 'date', range: true },
]
const filters = ref<Record<string, unknown>>({})

// 任一字段变化统一回调（含 v-model 回写后的最新全量值）
function handleFieldChange(field: FilterField, value: unknown) {
  load() // filters 已是最新
}
</script>

<template>
  <FilterBar v-model="filters" :fields="fields" @field-change="handleFieldChange">
    <template #actions>
      <el-button type="primary">查询</el-button>
      <el-button @click="filters = {}">重置</el-button>
    </template>
  </FilterBar>
</template>`

export const DATA_TABLE_SNIPPET = `<script setup lang="ts">
import DataTable from '@/components/DataTable/index.vue'
import type { DataTableColumn } from '@/components/DataTable/types'

interface AssetRow { name: string; ip: string; status: 'running' | 'stopped' }

const columns: DataTableColumn<AssetRow>[] = [
  { prop: 'name', label: '名称', minWidth: 140, showOverflowTooltip: true },
  { prop: 'ip', label: '内网 IP', width: 140 },
  { prop: 'status', label: '状态', slot: 'status', width: 100 },
  { label: '操作', slot: 'ops', width: 120, fixed: 'right' },
]

// fetch 模式：组件自管三态（挂载即加载 / 失败错误态+重试 / 空数据空态）
function fetchRows() {
  return listAssetsApi(params).then(({ data }) => data.items ?? [])
}

function handleBatchAction(key: string, rows: AssetRow[]) {
  ElMessage.success('已对 ' + rows.length + ' 行执行 ' + key)
}
</script>

<template>
  <DataTable
    :columns="columns"
    :fetch="fetchRows"
    selectable
    :batch-actions="[
      { key: 'sync', label: '批量同步' },
      { key: 'delete', label: '批量删除', type: 'danger' },
    ]"
    density="compact"
    max-height="calc(100vh - 24rem)"
    @batch-action="handleBatchAction"
  >
    <template #status="{ row }">
      <AssetStatusBadge :status="row.status" :labels="labels" />
    </template>
    <template #ops="{ row }">
      <el-button link type="primary" @click="openDetail(row)">详情</el-button>
    </template>
  </DataTable>
</template>`

export const PAGE_CONTAINER_SNIPPET = `<template>
  <PageContainer title="主机列表">
    <template #actions>
      <el-button type="primary">新建云主机</el-button>
    </template>

    <template #filters>
      <FilterBar v-model="filters" :fields="fields" />
    </template>

    <DataTable :columns="columns" :fetch="fetchRows" selectable />

    <template #footer>
      <el-pagination layout="total, prev, pager, next" :total="total" />
    </template>
  </PageContainer>
</template>

<!-- v1 老用法零改动兼容：只写默认插槽时不渲染任何骨架区块，DOM 与 v1 一致 -->`

export const DETAIL_DRAWER_SNIPPET = `<script setup lang="ts">
import DetailDrawer from '@/components/DetailDrawer/index.vue'
import type { DetailSection } from '@/components/DetailDrawer/index.vue'
import { ref } from 'vue'

const visible = ref(false)
const loading = ref(false)

// 分区块描述列表：label-value 两列网格；span 跨列、formatter 格式化、空值渲染 "-"
const sections: DetailSection[] = [
  {
    title: '基础信息',
    items: [
      { label: '主机名', value: 'web-prod-01' },
      { label: '内网 IP', value: '10.0.12.34' },
      { label: '创建时间', value: '2026-08-01 14:32', span: 2 },
    ],
  },
  {
    title: '运行状态',
    items: [
      { label: 'CPU 使用率', value: 38, formatter: (value) => value + '%' },
      { label: '备注', value: '' },
    ],
  },
]
</script>

<template>
  <el-button @click="visible = true">查看详情</el-button>

  <DetailDrawer
    v-model:visible="visible"
    title="资产详情"
    size="520px"
    show-footer
    :loading="loading"
    :sections="sections"
  >
    <template #header-actions>
      <el-button size="small">导出报告</el-button>
    </template>
    <template #footer>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </DetailDrawer>
</template>`

export const COMMAND_PALETTE_SNIPPET = `<script setup lang="ts">
import { onMounted, ref } from 'vue'

// MainLayout 已全局挂载 CommandPalette（⌘K / Ctrl+K 唤起、Esc 关闭、↑↓+Enter 导航）。
// 业务页如需注册本页专属动作，拿到组件实例调 registerActions：
const paletteRef = ref()

onMounted(() => {
  paletteRef.value?.registerActions([
    { id: 'biz:rebalance', title: '重新均衡当前集群', run: () => rebalance() },
  ])
})
</script>

<template>
  <CommandPalette ref="paletteRef" />
</template>`

/** 六个 demo 区块（顺序即页面与锚点导航顺序） */
export const UI_KIT_SECTIONS: UiKitSection[] = [
    {
        id: 'state-block',
        title: 'StateBlock · 统一三态块',
        description:
            'status 驱动的四态容器：loading 骨架屏 / empty 空态 / error 错误+重试 / success 默认插槽。业务页从此不再手写 v-if 加载分支。',
        code: STATE_BLOCK_SNIPPET,
    },
    {
        id: 'filter-bar',
        title: 'FilterBar · 配置化筛选栏',
        description:
            '声明字段数组自动渲染 input/select/date；下方示例容器限宽 720px，6 个字段一行放不下自动折叠——点「展开」查看全部。',
        code: FILTER_BAR_SNIPPET,
    },
    {
        id: 'data-table',
        title: 'DataTable · 表格封装',
        description:
            'columns 声明式列 + 内置三态 + 多选批量操作条 + 密度切换 + 冻结表头。上排三个小表展示 loading/empty/error 三态，下方为完整交互示例。',
        code: DATA_TABLE_SNIPPET,
    },
    {
        id: 'page-container',
        title: 'PageContainer · 标准页面骨架',
        description:
            '页头（title + #actions）/ #filters 筛选区 / 内容区 / #footer 分页区四段式骨架；本 demo 页本身即由它承载。',
        code: PAGE_CONTAINER_SNIPPET,
    },
    {
        id: 'detail-drawer',
        title: 'DetailDrawer · 统一详情抽屉',
        description:
            '分区块（sections）label-value 网格：formatter 格式化、span 跨列、空值渲染 "-"；loading 内置骨架屏。',
        code: DETAIL_DRAWER_SNIPPET,
    },
    {
        id: 'command-palette',
        title: 'CommandPalette · ⌘K 全局命令面板',
        description:
            '⌘K / Ctrl+K 唤起（本页已挂载实例，快捷键全局可用），路由跳转 + 动作执行 + 最近访问 + 资产搜索；业务页可注册专属动作。',
        code: COMMAND_PALETTE_SNIPPET,
    },
]
