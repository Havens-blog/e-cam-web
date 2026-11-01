import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

type FilterRecord = Record<string, string | undefined>

/**
 * 把列表页的「筛选条件」同步到 URL query（iter137）。
 *
 * 背景：CAM 多个列表页的筛选只存在组件内 ref 里，URL 不携带任何条件，
 * 于是「设筛选 → 进详情/切走 → 返回」或「刷新」后筛选被清空，必须重设。
 * 已知 CAM 的 `cert/ledger`、`tasks` 等页面已各自实现过（页面内），
 * 本 composable 收敛成一处，避免继续复制。
 *
 * 用法（枚举/关键词混合都可以）：
 *   const filters = reactive({ type: '', keyword: '' })
 *   useUrlFilters(filters)      // 挂载即从 URL 回填，变化即写回
 *
 * 约定：
 *  - 空值（''、undefined）不写进 URL，保持链接干净
 *  - 用 replace 而非 push，避免每次改筛选都往历史栈塞一条
 *  - 在没有 router 注入的上下文（单元测试 mount、storybook）**静默降级**为不做 URL 同步
 *    —— 见 §五 S48：库级增强必须默认容错，否则会让所有不带 router 的单测崩掉
 */
export function useUrlFilters<T extends FilterRecord>(
  filters: T,
  options: { omit?: string[] } = {},
): void {
  const omit = new Set(options.omit ?? [])

  const route = useRoute() as ReturnType<typeof useRoute> | undefined
  const router = useRouter() as ReturnType<typeof useRouter> | undefined
  if (!route || !router) return

  // ① 挂载时从 URL 回填（组件重建 / 刷新 / 分享链接都能复现同一视图）
  for (const key of Object.keys(filters)) {
    if (omit.has(key)) continue
    const v = route.query[key]
    if (typeof v === 'string' && v !== '') {
      ;(filters as FilterRecord)[key] = v
    }
  }

  // ② 任一筛选变化即写回 URL（不重建对象，避免把 undefined 塞进 query）
  watch(
    () => Object.keys(filters).map((k) => `${k}=${filters[k] ?? ''}`).join('&'),
    () => {
      const query: Record<string, string> = {}
      for (const key of Object.keys(filters)) {
        if (omit.has(key)) continue
        const raw = filters[key]
        const v = raw === undefined ? '' : String(raw)
        if (v !== '') query[key] = v
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
