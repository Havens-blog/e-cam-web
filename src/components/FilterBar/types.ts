/**
 * FilterBar 配置化筛选栏的对外类型定义（Phase 2 布局层组件）。
 *
 * 类型仅依赖 Element Plus 既有能力，不引入新运行时依赖；
 * options 形状与业务常量（CLOUD_PROVIDERS / ASSET_TYPES / ASSET_STATUS 等
 * `{ value, label, ... }` 记录）直接兼容，扩展字段会被原样忽略。
 */

/** 筛选控件类型：input=文本输入；select=下拉选择；date=日期选择（可配为范围） */
export type FilterFieldType = 'input' | 'select' | 'date'

/** date 字段可指定的 el-date-picker type（与 Element Plus DatePickerType 对齐） */
export type FilterDateType =
    | 'date'
    | 'datetime'
    | 'year'
    | 'years'
    | 'month'
    | 'months'
    | 'dates'
    | 'week'
    | 'daterange'
    | 'datetimerange'
    | 'monthrange'
    | 'yearrange'

/** 下拉选项（label/value 对；disabled 可选禁用单项） */
export interface FilterOption {
    /** 选项展示文案 */
    label: string
    /** 选项值（写入筛选值对象） */
    value: string | number | boolean
    /** 是否禁用该选项 */
    disabled?: boolean
}

/** 单个筛选字段的声明式配置（顺序即渲染顺序） */
export interface FilterField {
    /** 字段键：筛选值对象 modelValue 中的属性名，同时用作渲染 key */
    key: string
    /** 显示标签（也是 placeholder 缺省文案的来源） */
    label: string
    /** 控件类型：input / select / date */
    type: FilterFieldType
    /** 占位提示；缺省时 input 为「请输入{label}」，select/date 为「请选择{label}」 */
    placeholder?: string
    /** select 本地选项数组（与 remote 二选一或并存） */
    options?: FilterOption[]
    /** select 是否可搜索过滤（remote 为 true 时自动启用） */
    filterable?: boolean
    /** select 是否启用远程搜索（配合 remoteMethod） */
    remote?: boolean
    /** select 远程搜索方法（输入关键词时回调） */
    remoteMethod?: (query: string) => void
    /** select 远程加载中状态 */
    loading?: boolean
    /** 是否可清空（缺省 true，与现有筛选栏习惯一致） */
    clearable?: boolean
    /** 是否禁用该字段控件 */
    disabled?: boolean
    /** 控件宽度 px；缺省 input/select 200、date 220、日期范围 360 */
    width?: number
    /** date 类型：是否为范围选择（缺省单值）；为 true 时控件类型缺省 daterange */
    range?: boolean
    /** date 类型：显式指定 el-date-picker 的 type（如 datetime / month / daterange），优先于 range 推导 */
    dateType?: FilterDateType
    /** date 类型：值格式（dayjs 格式）；缺省 date 系 YYYY-MM-DD、datetime 系 YYYY-MM-DD HH:mm:ss */
    valueFormat?: string
    /** date 范围：开始占位提示（缺省「开始日期」） */
    startPlaceholder?: string
    /** date 范围：结束占位提示（缺省「结束日期」） */
    endPlaceholder?: string
    /** date 范围：分隔符（缺省「至」） */
    rangeSeparator?: string
}
