<script lang="ts">
/**
 * DetailDrawer 统一详情抽屉（Phase 2 交互层，ui-unify-phase2-components 任务 5 的 2.0 增强）。
 *
 * v1 对外 API（props/slots/events）逐项保留，现有调用方零改动；2.0 新增：
 * - 描述列表模式：items（扁平）/ sections（分区块）配置渲染 label-value 网格，
 *   支持 formatter 值格式化、span 跨列、columns 栅格列数；
 * - 内置加载态：loading prop 由 v1 的 v-loading 遮罩升级为 StateBlock 骨架屏
 *   （语义仍为"显示加载态"，加载期间内容区被骨架屏替代）。
 *
 * 内容区渲染优先级：loading > tabs（v1 标签页模式）> 描述列表（sections 优先于
 * items）+ 默认插槽。仅消费 Phase 1 Linear CSS 变量令牌（零硬编码色）。
 */
/** 描述列表默认栅格列数（对齐存量详情页 info-grid 的两列布局） */
const DEFAULT_DETAIL_COLUMNS = 2

/** 描述列表单个标签页配置（tabs prop 的元素类型） */
export interface DetailTab {
  /** 标签页标识（唯一；对应内容插槽名 `tab-${name}`） */
  name: string
  /** 标签页显示文案 */
  label: string
}

/** 描述列表单项配置（label-value 网格的一个单元格） */
export interface DetailItem {
  /** 标签文案 */
  label: string
  /** 值：null/undefined/空串渲染 "-" 占位，其余按 String(value) 渲染 */
  value?: unknown
  /** 值格式化函数：提供时渲染其返回值（替代默认占位/字符串化逻辑） */
  formatter?: (value: unknown, item: DetailItem) => string
  /** 跨列数（≥2 生效，占 columns 列网格中的 span 列；默认 1） */
  span?: number
}

/** 描述列表分区块配置（sections prop 的元素类型） */
export interface DetailSection {
  /** 区块标题（可选；不传则该区块不渲染标题） */
  title?: string
  /** 区块内的描述项列表 */
  items: DetailItem[]
}
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    :title="title"
    :size="size"
    :direction="direction"
    :before-close="handleClose"
    :close-on-click-modal="closeOnClickModal"
    class="detail-drawer"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-left">
          <el-button
            v-if="showBackButton"
            link
            @click="handleClose"
          >
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <span class="drawer-title">{{ title }}</span>
        </div>
        <div class="header-actions">
          <slot name="header-actions" />
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <!-- 内置加载态：StateBlock 骨架屏替代 v1 的 v-loading 遮罩（语义不变） -->
      <StateBlock
        v-if="loading"
        status="loading"
        class="drawer-loading"
      />
      <template v-else>
        <el-tabs
          v-if="tabs && tabs.length > 0"
          v-model="activeTab"
          class="detail-tabs"
        >
          <el-tab-pane
            v-for="tab in tabs"
            :key="tab.name"
            :label="tab.label"
            :name="tab.name"
          >
            <slot :name="`tab-${tab.name}`" />
          </el-tab-pane>
        </el-tabs>
        <template v-else>
          <!-- 描述列表：sections 分区块优先，扁平 items 归一为单个无标题区块 -->
          <div
            v-if="descriptionGroups.length > 0"
            class="detail-descriptions"
          >
            <section
              v-for="(group, groupIndex) in descriptionGroups"
              :key="groupIndex"
              class="detail-section"
            >
              <h3
                v-if="group.title"
                class="detail-section__title"
              >
                {{ group.title }}
              </h3>
              <div
                class="detail-grid"
                :style="gridStyle"
              >
                <div
                  v-for="(item, itemIndex) in group.items"
                  :key="itemIndex"
                  class="detail-item"
                  :style="itemSpanStyle(item)"
                >
                  <span class="detail-item__label">{{ item.label }}</span>
                  <span class="detail-item__value">{{ displayValue(item) }}</span>
                </div>
              </div>
            </section>
          </div>
          <slot />
        </template>
      </template>
    </div>

    <template v-if="showFooter" #footer>
      <div class="drawer-footer">
        <slot name="footer">
          <el-button @click="handleClose">关闭</el-button>
        </slot>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import StateBlock from '@/components/StateBlock/index.vue'

interface Props {
  /** 抽屉显示状态（v-model:visible） */
  visible: boolean
  /** 抽屉标题（header 左侧，返回按钮之后） */
  title: string
  /** 抽屉尺寸：宽度百分比或像素（透传 el-drawer size） */
  size?: string | number
  /** 打开方向（透传 el-drawer direction） */
  direction?: 'rtl' | 'ltr' | 'ttb' | 'btt'
  /** 加载态：true 时内容区渲染 StateBlock 骨架屏（2.0 由 v-loading 遮罩升级，语义不变） */
  loading?: boolean
  /** 标签页配置；提供后进入 tabs 模式，每个标签页内容由 `tab-${name}` 插槽承载（优先于描述列表） */
  tabs?: DetailTab[]
  /** 当前激活标签页（v-model:active-tab-name）；未传时默认第一个标签页 */
  activeTabName?: string
  /** 是否显示 header 返回按钮 */
  showBackButton?: boolean
  /** 是否渲染 footer 区（默认「关闭」按钮，可被 #footer 插槽覆盖） */
  showFooter?: boolean
  /** 点击遮罩是否关闭抽屉 */
  closeOnClickModal?: boolean
  /** 描述列表（扁平模式）：label-value 网格渲染；与 sections 同时提供时 sections 优先 */
  items?: DetailItem[]
  /** 分区块描述列表：每个区块可带标题与独立 items；与 tabs 同时提供时 tabs 优先 */
  sections?: DetailSection[]
  /** 描述列表栅格列数（≥1，非法值回退默认；默认 2 列） */
  columns?: number
}

interface Emits {
  /** 抽屉显示状态变化（v-model:visible） */
  (e: 'update:visible', value: boolean): void
  /** 激活标签页变化（v-model:active-tab-name） */
  (e: 'update:activeTabName', value: string): void
  /** 点击返回按钮或默认关闭按钮时触发（先于 update:visible(false)） */
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  size: '60%',
  direction: 'rtl',
  loading: false,
  showBackButton: true,
  showFooter: false,
  closeOnClickModal: false,
  columns: DEFAULT_DETAIL_COLUMNS,
})

const emit = defineEmits<Emits>()

defineSlots<{
  /** 非 tabs 模式内容（渲染在描述列表之后；v1 默认插槽行为不变） */
  default?: () => unknown
  /** 头部操作按钮区（编辑/删除等动作） */
  'header-actions'?: () => unknown
  /** 标签页内容区：每个标签页一个插槽，插槽名为 `tab-${tab.name}` */
  [name: `tab-${string}`]: () => unknown
  /** 底部操作区（覆盖默认「关闭」按钮） */
  footer?: () => unknown
}>()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const activeTab = computed({
  get: () => props.activeTabName || (props.tabs?.[0]?.name || ''),
  set: (value) => emit('update:activeTabName', value)
})

/** 描述列表渲染分组：sections 直接作为分组，扁平 items 归一为单个无标题分组 */
const descriptionGroups = computed<DetailSection[]>(() => {
  if (props.sections && props.sections.length > 0) return props.sections
  if (props.items && props.items.length > 0) return [{ items: props.items }]
  return []
})

/** 描述列表网格样式：列数经 CSS 自定义属性下发给栅格 */
const gridStyle = computed<CSSProperties>(() => {
  const columnCount = props.columns >= 1 ? Math.floor(props.columns) : DEFAULT_DETAIL_COLUMNS
  return { '--detail-columns': columnCount } as CSSProperties
})

/** 单项跨列样式：span ≥2 时占多列，否则不输出样式 */
const itemSpanStyle = (item: DetailItem): CSSProperties | undefined => {
  if (item.span === undefined || item.span < 2) return undefined
  return { gridColumn: `span ${item.span}` }
}

/** 单项展示值：formatter 优先，null/undefined/空串渲染占位符，其余字符串化 */
const displayValue = (item: DetailItem): string => {
  if (item.formatter) return item.formatter(item.value, item)
  if (item.value === null || item.value === undefined || item.value === '') return '-'
  return String(item.value)
}

const handleClose = () => {
  emit('close')
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.detail-drawer {
  :deep(.el-drawer) {
    background: var(--bg-surface);
  }

  :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
  }

  :deep(.el-drawer__body) {
    padding: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-base);
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .drawer-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
  }

  .drawer-loading {
    padding: 20px;
  }

  .detail-descriptions {
    padding: 20px;
  }

  .detail-section {
    & + .detail-section {
      margin-top: 24px;
    }

    &__title {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(var(--detail-columns), 1fr);
    gap: 16px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;

    &__label {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    &__value {
      font-size: 14px;
      color: var(--text-primary);
      word-break: break-all;
    }
  }

  .detail-tabs {
    height: 100%;

    :deep(.el-tabs__header) {
      margin: 0;
      padding: 0 20px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-subtle);
    }

    :deep(.el-tabs__item) {
      color: var(--text-secondary);

      &.is-active {
        color: var(--text-primary);
      }

      &:hover {
        color: var(--text-primary);
      }
    }

    :deep(.el-tabs__content) {
      padding: 20px;
    }

    :deep(.el-tab-pane) {
      height: 100%;
    }
  }

  .drawer-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>
