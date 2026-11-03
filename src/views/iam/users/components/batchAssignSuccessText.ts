/**
 * 批量分配用户组的「成功」提示文案（iter165）。
 *
 * 背景：原来是固定文案「批量分配成功」——用户看不出**这一批动了多少人、加到几个组**，
 * 事后无法从提示里核对自己选的是不是那一批。
 *
 * 为什么只报「人数 × 组数」而不报「成功/失败条数」：
 *   `batchAssignGroupsApi` 的返回类型是 `void`，后端**不返回逐条结果**（全成功或全失败），
 *   客户端若要报「成功 N 条、失败 M 条」只能**编造**。宁可少说，不可造假。
 */
export function buildBatchAssignSuccessText(userCount: number, groupCount: number): string {
  if (userCount <= 0 || groupCount <= 0) return '批量分配成功'
  return `已为 ${userCount} 个用户分配 ${groupCount} 个用户组`
}
