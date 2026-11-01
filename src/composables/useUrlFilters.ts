import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 可同步到 URL 的筛选值：字符串 / 布尔 / 数字 / 空值 */
type FilterValue = string | number | boolean | undefined

type FilterRecord = Record<string, FilterValue>

/**
 * 单个字段的编解码器（iter140）。
 *
 * 默认按「字符串」处理；字段是 `boolean | ''` 或数字时，**必须**显式给 codec：
 * 否则 `'true'` 会被当作字符串塞进 boolean 字段，类型与运行时都会错。
 */
export interface FilterCodec {
  /** 值 → URL 上的字符串；返回 '' 表示不写入 URL */
  encode?: (v: FilterValue) => string
  /** URL 上的字符串 → 值 */
  decode?: (s: string) => FilterValue
}

export interface UseUrlFiltersOptions {
  /** 不参与同步的字段名 */
  omit?: string[]
  /** 逐字段编解码（非字符串字段必填）*/
  codec?: Record<string, FilterCodec>
}

/** 默认编码：undefined / '' → 不写；其余转字符串 */
const defaultEncode = (v: FilterValue): string =>
  v === undefined || v === '' ? '' : String(v)

/** 默认解码：原样返回字符串 */
const defaultDecode = (s: string): FilterValue => s

/**
 * 把列表页的「筛选条件」同步到 URL query（iter137，iter139 修多实例，iter140 加类型编解码）。
 *
 * 背景：CAM 多个列表页的筛选只存在组件内 ref 里，URL 不携带任何条件，
 * 于是「设筛选 → 进详情/切走 → 返回」或「刷新」后筛选被清空，必须重设。
 *
 * 用法：
 *   const filters = reactive({ type: '', keyword: '' })
 *   useUrlFilters(filters)
 *
 * 非字符串字段要传 codec：
 *   const filters = reactive<{ isBuiltIn: boolean | '' }>({ isBuiltIn: '' })
 *   useUrlFilters(filters, {
 *     codec: {
 *       isBuiltIn: {
 *         encode: (v) => (v === '' || v === undefined ? '' : String(v)),
 *         decode: (s) => (s === 'true' ? true : s === 'false' ? false : ''),
 *       },
 *     },
 *   })
 *
 * 约定：
 *  - 空值（''、undefined）不写进 URL，保持链接干净
 *  - 用 replace 而非 push，避免每次改筛选都往历史栈塞一条
 *  - **只增删自己这几个 key**，页面其它 query 参数原样保留（iter139 的教训，见 §五 S51）
 *  - 同页可安全放多个实例（各自只管自己的 key）
 *  - 在没有 router 注入的上下文（单元测试 mount、storybook）**静默降级**为不做 URL 同步
 *    —— 见 §五 S48：库级增强必须默认容错，否则会让所有不带 router 的单测崩掉
 */
export function useUrlFilters<T extends FilterRecord>(
  filters: T,
  options: UseUrlFiltersOptions = {},
): void {
  const omit = new Set(options.omit ?? [])
  const codec = options.codec ?? {}

  const route = useRoute() as ReturnType<typeof useRoute> | undefined
  const router = useRouter() as ReturnType<typeof useRouter> | undefined
  if (!route || !router) return

  const encode = (key: string, v: FilterValue): string =>
    (codec[key]?.encode ?? defaultEncode)(v)
  const decode = (key: string, s: string): FilterValue =>
    (codec[key]?.decode ?? defaultDecode)(s)

  // ① 挂载时从 URL 回填（组件重建 / 刷新 / 分享链接都能复现同一视图）
  for (const key of Object.keys(filters)) {
    if (omit.has(key)) continue
    const v = route.query[key]
    if (typeof v === 'string' && v !== '') {
      ;(filters as FilterRecord)[key] = decode(key, v)
    }
  }

  // ② 任一筛选变化即写回 URL
  watch(
    () => Object.keys(filters).map((k) => `${k}=${encode(k, filters[k])}`).join('&'),
    () => {
      // 只在**现有 query 上增删自己这几个 key**，不能从零重建：
      // ① 同页可能有多个 useUrlFilters 实例，各自重建会互相清空；
      // ② 页面可能还带别的参数（如 cert 页的 `?from=ledger`），重建会把它们丢掉。
      const query: Record<string, string> = {}
      for (const [k, v] of Object.entries(route.query)) {
        if (typeof v === 'string') query[k] = v
      }
      for (const key of Object.keys(filters)) {
        if (omit.has(key)) continue
        const v = encode(key, filters[key])
        if (v !== '') {
          query[key] = v
        } else {
          delete query[key]
        }
      }
      // 与现有 query 比对，避免无意义的 replace
      const cur = route.query as Record<string, unknown>
      const same =
        Object.keys(query).length === Object.keys(cur).length &&
        Object.entries(query).every(([k, v]) => String(cur[k] ?? '') === v)
      if (same) return
      void router.replace({ path: route.path, query })
    },
  )
}
