/**
 * DataTable 表格封装的对外类型定义（Phase 2 布局层组件）。
 *
 * 类型仅依赖 Element Plus 既有能力，不引入新运行时依赖；
 * 列配置锚定 src/views/assets 现有表格用法（AssetTable.vue）反推，
 * 保证既有列结构（fixed 操作列 / show-overflow-tooltip / 对齐 / 格式化）可无损表达。
 */

/** 列对齐方式（透传 el-table-column align） */
export type DataTableAlign = 'left' | 'center' | 'right'

/** 表格密度：default=默认行高；compact=紧凑行高（经 el-table size 透传，不重造样式） */
export type DataTableDensity = 'default' | 'compact'

/** 单个列的声明式配置（顺序即渲染顺序） */
export interface DataTableColumn<T = any> {
    /** 字段名（透传 el-table-column prop；纯自定义 slot 列可省略） */
    prop?: string
    /** 表头文案 */
    label: string
    /** 列宽 px（透传 el-table-column width） */
    width?: number | string
    /** 最小列宽 px（透传 el-table-column min-width，弹性列用） */
    minWidth?: number | string
    /** 对齐方式（透传 el-table-column align） */
    align?: DataTableAlign
    /** 固定列（透传 el-table-column fixed；操作列常用 'right'） */
    fixed?: boolean | 'left' | 'right'
    /** 是否可排序（透传 el-table-column sortable） */
    sortable?: boolean
    /** 溢出省略并悬浮提示（透传 el-table-column show-overflow-tooltip） */
    showOverflowTooltip?: boolean
    /** 单元格格式化函数（透传 el-table-column formatter；与 slot 并存时 slot 优先） */
    formatter?: (row: T, column: unknown, cellValue: unknown, index: number) => string
    /** 自定义单元格插槽名：声明后用 #<slot>="{ row }" 渲染该列单元格 */
    slot?: string
}

/** 底部批量操作条的动作按钮配置（selectable 且有选中行时展示） */
export interface DataTableBatchAction {
    /** 动作键（batch-action 事件第一个参数） */
    key: string
    /** 按钮文案 */
    label: string
    /** 按钮类型（透传 el-button type，如 danger 标记危险操作） */
    type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
    /** 是否禁用该动作 */
    disabled?: boolean
}

/** 数据注入函数（fetch 模式）：返回当前页行数组；抛错即进入错误态（重试时重新调用） */
export type DataTableFetcher<T = any> = () => Promise<T[]>
