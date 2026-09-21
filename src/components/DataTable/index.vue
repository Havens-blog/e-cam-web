<template>
  <div class="data-table">
    <StateBlock
      :status="status"
      :empty-text="emptyText"
      :skeleton-rows="skeletonRows"
      :error-text="resolvedErrorText"
      @retry="handleRetry"
    >
      <el-table
        ref="tableRef"
        :data="displayRows"
        :size="tableSize"
        :max-height="maxHeight"
        v-bind="$attrs"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="expandable" type="expand">
          <template #default="scope">
            <slot name="expand" v-bind="scope" />
          </template>
        </el-table-column>
        <el-table-column v-if="selectable" type="selection" width="44" />
        <el-table-column
          v-for="(column, index) in columns"
          :key="column.prop ?? column.slot ?? index"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :min-width="column.minWidth"
          :align="column.align"
          :fixed="column.fixed"
          :sortable="column.sortable"
          :show-overflow-tooltip="column.showOverflowTooltip"
          :formatter="column.formatter"
        >
          <template v-if="column.slot" #default="scope">
            <slot :name="column.slot" v-bind="scope" />
          </template>
        </el-table-column>
      </el-table>
    </StateBlock>

    <div v-if="showBatchBar" class="data-table__batch-bar">
      <span class="data-table__batch-count">已选 {{ selectedRows.length }} 项</span>
      <div class="data-table__batch-actions">
        <el-button
          v-for="action in batchActions"
          :key="action.key"
          size="small"
          :type="action.type"
          :disabled="action.disabled"
          @click="handleBatchAction(action)"
        >
          {{ action.label }}
        </el-button>
        <el-button size="small" text class="data-table__batch-clear" @click="clearSelection">
          取消选择
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T = any">
/**
 * DataTable 表格封装（Phase 2 布局层组件）。
 *
 * 基于 el-table 封装：columns 声明式列配置（prop/label/width/formatter/自定义
 * 单元格 slot，锚定 assets 页既有列结构可无损表达）、内置三态（loading 自动
 * 骨架屏 / 空数据空态 / fetch 失败错误态 + 重试，复用 StateBlock——业务页从此
 * 不再手写 v-if 加载分支）、可选多选列 + 底部批量操作条（batchActions 配置 +
 * selection-change 透传）、密度切换（default/compact，经 el-table size 透传）
 * 与冻结表头（max-height 透传）；可选行内展开列（expandable + #expand 插槽，
 * type=expand 首列透传，承载 alert/events 旧页 expand 详情行）。分页不内置
 * （由 PageContainer 底部区承载
 * el-pagination，保持单一职责）；行内编辑/列拖拽排序等明确缓期（防 scope
 * creep）。除 el-table 声明式 props 外，$attrs 原样透传（stripe/row-key 等既有
 * 能力零包装成本）。仅消费 Phase 1 Linear CSS 变量令牌（零硬编码色）。
 *
 * 数据注入二选一：data props（页面自管加载，loading 态由 loading prop 表达）
 * 或 fetch 函数（组件自管三态：挂载即加载；函数标识变化——如筛选条件闭包更新
 * ——会触发重新加载；失败进入错误态，retry 时组件内部重新调用；fetch 优先于
 * data）。
 *
 * 典型用法（列表页骨架）：
 * ```vue
 * <DataTable
 *   :columns="columns"
 *   :fetch="() => listAssetsApi(params).then(({ data }) => data.items ?? [])"
 *   selectable
 *   :batch-actions="[{ key: 'sync', label: '批量同步' }]"
 *   density="compact"
 *   max-height="calc(100vh - 24rem)"
 *   @selection-change="onSelect"
 *   @batch-action="handleBatch"
 * >
 *   <template #status="{ row }">
 *     <AssetStatusBadge :status="row.status" :labels="labels" />
 *   </template>
 * </DataTable>
 * ```
 */
import StateBlock from '@/components/StateBlock/index.vue'
import type { StateBlockStatus } from '@/components/StateBlock/index.vue'
import type { TableInstance } from 'element-plus'
import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { DataTableBatchAction, DataTableColumn, DataTableDensity, DataTableFetcher } from './types'

defineOptions({ name: 'DataTable', inheritAttrs: false })

interface Props {
  /** 列配置数组（顺序即渲染顺序），见 {@link DataTableColumn} */
  columns: DataTableColumn<T>[]
  /** 行数据（props 注入模式，页面自管加载）；与 fetch 二选一，fetch 优先 */
  data?: T[]
  /** 数据注入函数（fetch 模式，组件自管三态），见 {@link DataTableFetcher} */
  fetch?: DataTableFetcher<T>
  /** 加载态（仅 data 注入模式生效；fetch 模式由组件自管） */
  loading?: boolean
  /** 是否开启多选列（选中行经 selection-change 透出并聚合底部批量操作条） */
  selectable?: boolean
  /** 是否开启行内展开列（type=expand 首列；展开内容由 #expand 作用域插槽渲染） */
  expandable?: boolean
  /** 底部批量操作条的动作按钮配置（selectable 且有选中行时展示） */
  batchActions?: DataTableBatchAction[]
  /** 表格密度：default=默认行高；compact=紧凑（el-table size=small） */
  density?: DataTableDensity
  /** 表格最大高度（透传 el-table max-height，超出滚动并冻结表头） */
  maxHeight?: string | number
  /** 空态文案（透传 StateBlock emptyText，缺省「暂无数据」） */
  emptyText?: string
  /** loading 骨架屏段落数（透传 StateBlock skeletonRows） */
  skeletonRows?: number
  /** 错误态兜底文案（fetch 抛非 Error 时展示；抛 Error 时展示其 message） */
  errorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  selectable: false,
  expandable: false,
  batchActions: () => [],
  density: 'default',
  skeletonRows: 4,
  errorText: '加载失败',
})

const emit = defineEmits<{
  /** 多选变化透传（el-table selection-change），携带当前选中行数组 */
  (e: 'selection-change', rows: T[]): void
  /** 批量操作条动作按钮点击，携带动作 key 与当前选中行数组 */
  (e: 'batch-action', key: string, rows: T[]): void
  /** fetch 失败后用户点击重试时触发（重试拉取由组件内部执行） */
  (e: 'retry'): void
}>()

defineSlots<{
  /**
   * 动态插槽统一签名：单元格插槽（插槽名由 column.slot 声明）与行内展开插槽
   * （expandable 开启时用 #expand，作用域 { row, column, $index }）均走此签名
   */
  [name: string]: (scope: { row: T; column: unknown; $index: number }) => unknown
}>()

/** fetch 模式内部加载态（初值即 loading：挂载即拉取，首屏不闪空态） */
const fetchLoading = ref(props.fetch !== undefined)
/** fetch 模式错误信息（null=未出错） */
const fetchError = ref<string | null>(null)
/** fetch 模式拉取到的行数据 */
const fetchRows = ref<T[]>([]) as Ref<T[]>
/** 当前选中行（随 el-table selection-change 同步） */
const selectedRows = ref<T[]>([]) as Ref<T[]>
/** el-table 实例（expose 方法转发的基础） */
const tableRef = ref<TableInstance | null>(null)

/** 展示行数据：fetch 模式取内部拉取结果，否则取 data prop */
const displayRows = computed<T[]>(() => (props.fetch ? fetchRows.value : props.data) ?? [])

/** 当前状态：加载中（fetch 内部/loading prop）优先，其次错误，空数据空态 */
const status = computed<StateBlockStatus>(() => {
  if (props.fetch ? fetchLoading.value : props.loading) {
    return 'loading'
  }
  if (props.fetch && fetchError.value !== null) {
    return 'error'
  }
  return displayRows.value.length === 0 ? 'empty' : 'success'
})

/** 错误态文案：fetch 抛出的错误信息优先，兜底 errorText prop */
const resolvedErrorText = computed<string>(() => fetchError.value ?? props.errorText)

/** 密度 → el-table size 透传映射（不重造样式） */
const tableSize = computed<'default' | 'small'>(() =>
  props.density === 'compact' ? 'small' : 'default',
)

/** 批量操作条展示条件：多选已开启、配置了动作且有选中行 */
const showBatchBar = computed<boolean>(
  () => props.selectable && props.batchActions.length > 0 && selectedRows.value.length > 0,
)

/** 执行 fetch 拉取（仅 fetch 模式）：成功落数据，失败落错误信息并清空数据 */
const load = async (): Promise<void> => {
  if (!props.fetch) {
    return
  }
  fetchLoading.value = true
  fetchError.value = null
  try {
    const rows = await props.fetch()
    fetchRows.value = rows ?? []
  } catch (error) {
    fetchError.value = error instanceof Error ? error.message : (props.errorText ?? '加载失败')
    fetchRows.value = []
  } finally {
    fetchLoading.value = false
  }
}

// 挂载即加载；fetch 函数标识变化（筛选条件闭包更新）时重新加载
watch(
  () => props.fetch,
  () => {
    void load()
  },
  { immediate: true },
)

/** StateBlock retry：向父级透出事件并内部重新拉��� */
const handleRetry = (): void => {
  emit('retry')
  void load()
}

/** el-table selection-change 同步：记录选中行并透传父级 */
const handleSelectionChange = (rows: T[]): void => {
  selectedRows.value = rows
  emit('selection-change', rows)
}

/** 批量动作按钮点击：以 key + 当前选中行快照（不可变拷贝）透传父级 */
const handleBatchAction = (action: DataTableBatchAction): void => {
  emit('batch-action', action.key, [...selectedRows.value])
}

/** 重新触发 fetch 加载（fetch 模式）；返回加载完成的 Promise */
const refresh = async (): Promise<void> => {
  await load()
}

/** 清空多选选中行（批量操作完成后调用；批量条随之隐藏） */
const clearSelection = (): void => {
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

defineExpose({
  /** 重新触发 fetch 加载（fetch 模式），见 {@link refresh} */
  refresh,
  /** 清空多选选中行，见 {@link clearSelection} */
  clearSelection,
})
</script>

<style scoped lang="scss">
.data-table {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  &__batch-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border-subtle);
  }

  &__batch-count {
    font-size: 13px;
    color: var(--text-secondary);
  }

  &__batch-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
