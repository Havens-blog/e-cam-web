/**
 * 列表请求的「只认最后一次」守卫（iter270）。
 *
 * 背景（真实缺陷，已在 `alert/rules` 上端到端复现）：
 *   翻页时第 2 页请求慢（3s）、第 3 页请求快 —— 第 3 页先渲染，
 *   第 2 页的响应后到，把列表覆盖回第 2 页的数据，
 *   于是**页码显示 3、列表却是第 2 页的内容**（实测时间线：
 *   `OK pg3 @11.9s` → `OK pg2 @14.7s` → 列表 `P2_1@3`）。
 *
 *   用户会据此误判「第 3 页的数据就是这样」，运维场景下代价很高。
 *
 * 用法：
 *   const latest = useLatestRequest()
 *
 *   const fetchData = async () => {
 *     const seq = latest.begin()            // ① 发请求前领号
 *     const res = await listApi(params)
 *     if (!latest.isCurrent(seq)) return    // ② 回来时确认自己仍是最新
 *     list.value = res.items                // ③ 只有最新那次才允许写状态
 *   }
 *
 * 与 `tasks/index.vue` 里已有的 `listSeq` 写法同构，只是抽出来避免第 N 次复制粘贴
 * （同 `useListError` 当初的收敛理由）。`reset()` 供组件卸载时调用，语义等价于 `disposed = true`。
 */
export function useLatestRequest() {
  let seq = 0

  /** 领一个新的序号；比之前所有序号都大，代表「我现在是最新的」 */
  function begin(): number {
    seq += 1
    return seq
  }

  /** 该序号是否仍是最新（异步返回后用它决定要不要写状态） */
  function isCurrent(token: number): boolean {
    return token === seq
  }

  /** 作废所有在途请求（组件卸载时调用，防止卸载后写状态） */
  function reset(): void {
    seq += 1
  }

  return { begin, isCurrent, reset }
}
