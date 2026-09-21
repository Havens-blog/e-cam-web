<template>
  <div ref="rootRef" class="filter-bar">
    <el-form class="filter-bar__form" :inline="true" :model="modelValue" @submit.prevent>
      <el-form-item
        v-for="(field, index) in fields"
        :key="field.key"
        v-show="measuring || expanded || index < visibleCount"
        class="filter-bar__item"
        :label="field.label"
      >
        <el-input
          v-if="field.type === 'input'"
          :model-value="getFieldValue(field.key)"
          :placeholder="placeholderOf(field)"
          :clearable="field.clearable ?? true"
          :disabled="field.disabled ?? false"
          :style="controlStyleOf(field)"
          @update:model-value="(value) => setFieldValue(field, value)"
          @change="(value) => emitFieldChange(field, value)"
        />
        <el-select
          v-else-if="field.type === 'select'"
          :model-value="getFieldValue(field.key)"
          :placeholder="placeholderOf(field)"
          :clearable="field.clearable ?? true"
          :disabled="field.disabled ?? false"
          :filterable="field.filterable ?? field.remote ?? false"
          :remote="field.remote ?? false"
          :remote-method="field.remoteMethod"
          :loading="field.loading ?? false"
          :style="controlStyleOf(field)"
          @update:model-value="(value) => setFieldValue(field, value)"
          @change="(value) => emitFieldChange(field, value)"
        >
          <el-option
            v-for="option in field.options ?? []"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
            :disabled="option.disabled ?? false"
          />
        </el-select>
        <el-date-picker
          v-else
          :model-value="getFieldValue(field.key)"
          :type="dateTypeOf(field)"
          :placeholder="placeholderOf(field)"
          :start-placeholder="field.startPlaceholder ?? '开始日期'"
          :end-placeholder="field.endPlaceholder ?? '结束日期'"
          :range-separator="field.rangeSeparator ?? '至'"
          :value-format="valueFormatOf(field)"
          :clearable="field.clearable ?? true"
          :disabled="field.disabled ?? false"
          :style="controlStyleOf(field)"
          @update:model-value="(value: unknown) => setFieldValue(field, value)"
          @change="(value: unknown) => emitFieldChange(field, value)"
        />
      </el-form-item>

      <div v-if="slots.actions" class="filter-bar__item filter-bar__item--actions">
        <slot name="actions" />
      </div>

      <el-button
        v-if="needToggle"
        class="filter-bar__toggle"
        text
        type="primary"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? '收起' : '展开' }}
        <el-icon class="filter-bar__toggle-icon">
          <ArrowUp v-if="expanded" />
          <ArrowDown v-else />
        </el-icon>
      </el-button>
    </el-form>
  </div>
</template>

<script setup lang="ts">
/**
 * FilterBar 配置化筛选栏（Phase 2 布局层组件）。
 *
 * 以声明式字段数组自动渲染 input/select/date 筛选控件，消灭各页面手写的
 * `xxx-filters` 结构；通过 v-model 双向绑定筛选值对象，字段 change 事件经
 * `field-change` 统一透传。select 支持本地 options 与 remote 远程搜索，
 * date 支持单值与范围。字段一行放不下时基于容器宽度测量（ResizeObserver，
 * 而非固定条数）自动折叠，并提供「展开/收起」切换。仅消费 Phase 1 Linear
 * CSS 变量令牌（零硬编码色）。API 反推锚点：src/views/assets 现有筛选字段
 * （云厂商/资产类型/区域/状态/资产名称）。
 *
 * 典型用法（列表页骨架）：
 * ```vue
 * <FilterBar v-model="filters" :fields="fields" @field-change="handleSearch">
 *   <template #actions>
 *     <el-button @click="handleReset">重置</el-button>
 *   </template>
 * </FilterBar>
 * ```
 */
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { computeFitLayout, FILTER_BAR_GAP, FILTER_BAR_TOGGLE_WIDTH } from './fit'
import type { FilterDateType, FilterField, FilterFieldType } from './types'

interface Props {
  /** 字段配置数组（顺序即渲染顺序），见 {@link FilterField} */
  fields: FilterField[]
  /** 筛选值对象（v-model）；FilterBar 不原地修改，更新时以新对象 emit */
  modelValue: Record<string, unknown>
  /** 是否启用「一行放不下时折叠」；false 时始终全部展示（缺省 true） */
  collapsible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  collapsible: true,
})

const emit = defineEmits<{
  /** 任一字段值变化时触发，携带以新对象承载全部筛选值的记录（v-model 双向绑定） */
  (e: 'update:modelValue', value: Record<string, unknown>): void
  /** 任一字段控件 change 事件透传，携带字段配置与新值 */
  (e: 'field-change', field: FilterField, value: unknown): void
}>()

const slots = defineSlots<{
  /** 字段行尾操作区（如「查询」「重置」按钮）；始终展示、不参与折叠，折叠测算时计入其占位 */
  actions?: () => unknown
}>()

/** 控件缺省宽度 px（field.width 可覆盖） */
const DEFAULT_CONTROL_WIDTH: Record<FilterFieldType, number> = { input: 200, select: 200, date: 220 }
/** 日期范围控件缺省宽度 px */
const DATE_RANGE_WIDTH = 360

const rootRef = ref<HTMLElement | null>(null)
/** 折叠态一行展示的字段数（初值全量，测量后收敛） */
const visibleCount = ref(props.fields.length)
/** 是否需要「展开/收起」切换按钮 */
const needToggle = ref(false)
/** 是否展开全部字段 */
const expanded = ref(false)
/** 两遍测量标记：临时显示全部条目以获取固有宽度，避免 display:none 条目测出 0 */
const measuring = ref(false)
let resizeObserver: ResizeObserver | null = null
/** 测量序号：丢弃并发/过期测量结果（ResizeObserver 风暴下防止旧结果覆盖新结果） */
let measureSeq = 0

/** 是否为范围型日期字段（显式 range 或 dateType 为 *range） */
const isRangeField = (field: FilterField): boolean =>
  field.range === true || (field.dateType?.endsWith('range') ?? false)

/**
 * 读取字段当前筛选值。
 * @returns 值以 any 桥接：modelValue 是开放记录（Record<string, unknown>），
 * 具体形状由使用方与对应 EP 控件类型消化
 */
const getFieldValue = (key: string): any => props.modelValue?.[key]

/** 值更新：以新对象 emit（不可变更新，不原地修改入参） */
const setFieldValue = (field: FilterField, value: unknown): void => {
  emit('update:modelValue', { ...props.modelValue, [field.key]: value })
}

/**
 * 字段 change 事件透传。
 * EP 组件（el-input/el-date-picker 等）会把 attrs（含 onChange）落到原生输入
 * 元素上，同一原生 change 会先触发 EP 语义 change（携带真实值）再触发原生
 * 透传（携带 Event）；此处跳过 Event 形态，保证一次变更只透传一次。
 */
const emitFieldChange = (field: FilterField, value: unknown): void => {
  if (value instanceof Event) {
    return
  }
  emit('field-change', field, value)
}

/** 占位提示：显式配置优先，缺省按类型从 label 推导 */
const placeholderOf = (field: FilterField): string =>
  field.placeholder ?? (field.type === 'input' ? `请输入${field.label}` : `请选择${field.label}`)

/** 控件宽度：显式配置优先，范围日期用宽档，其余按类型取缺省 */
const controlStyleOf = (field: FilterField): { width: string } => ({
  width: `${field.width ?? (isRangeField(field) ? DATE_RANGE_WIDTH : DEFAULT_CONTROL_WIDTH[field.type])}px`,
})

/** el-date-picker 的 type：显式 dateType 优先，其次按 range 推导 */
const dateTypeOf = (field: FilterField): FilterDateType =>
  field.dateType ?? (isRangeField(field) ? 'daterange' : 'date')

/** 值格式：显式 valueFormat 优先；datetime 系缺省带时分秒，其余缺省日粒度 */
const valueFormatOf = (field: FilterField): string =>
  field.valueFormat ?? (field.dateType?.includes('datetime') ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')

/**
 * 依据容器宽度重新测量折叠布局（异步，两遍测量）。
 * 不可测量（宽度 0）或未启用折叠时退化为全部展示。
 */
const measure = async (): Promise<void> => {
  const seq = ++measureSeq
  const root = rootRef.value
  if (!props.collapsible || !root) {
    return
  }
  const containerWidth = root.getBoundingClientRect().width
  if (containerWidth <= 0) {
    visibleCount.value = props.fields.length
    needToggle.value = false
    measuring.value = false
    return
  }

  measuring.value = true
  await nextTick()
  const rootEl = rootRef.value
  if (seq !== measureSeq || !rootEl) {
    return
  }

  const itemEls = Array.from(
    rootEl.querySelectorAll<HTMLElement>('.filter-bar__item:not(.filter-bar__item--actions)'),
  )
  const widths = itemEls.map((el) => el.getBoundingClientRect().width)
  const actionsWidth =
    rootEl.querySelector<HTMLElement>('.filter-bar__item--actions')?.getBoundingClientRect().width ?? 0
  const toggleWidth =
    rootEl.querySelector<HTMLElement>('.filter-bar__toggle')?.getBoundingClientRect().width ??
    FILTER_BAR_TOGGLE_WIDTH
  // 预留 = 切换按钮 + 操作区 + 一个尾间距（折叠行 [字段..., 操作区, 切换按钮]）
  const reserveWidth = actionsWidth + toggleWidth + FILTER_BAR_GAP

  const layout = computeFitLayout(widths, containerWidth, FILTER_BAR_GAP, reserveWidth)
  visibleCount.value = layout.visibleCount
  needToggle.value = layout.needToggle
  measuring.value = false
}

watch(
  () => props.fields,
  () => {
    void measure()
  },
  { deep: true },
)

onMounted(() => {
  void measure()
  const root = rootRef.value
  if (root && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      void measure()
    })
    resizeObserver.observe(root)
  }
})

onBeforeUnmount(() => {
  measureSeq += 1
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped lang="scss">
.filter-bar {
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  &__form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    // 列向间距与 fit.ts 的 FILTER_BAR_GAP 保持一致
    gap: 12px 16px;

    :deep(.el-form-item) {
      margin: 0;
      margin-right: 0;
    }

    :deep(.el-form-item__label) {
      color: var(--text-secondary);
    }
  }

  &__toggle {
    flex-shrink: 0;
  }

  &__toggle-icon {
    margin-left: 4px;
  }
}
</style>
