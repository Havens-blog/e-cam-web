/**
 * 判断一条错误 message 是否属于「不该给终端用户看的技术细节」（iter219）。
 *
 * 背景：`DataTable` 的错误态会展示 `error.message`。iter103 只翻译了
 * axios/fetch 的英文传输层文案（`Network Error`、`Request failed with status code 500`），
 * 其余一律原样展示 —— 于是**后端返回的技术错误会直接漏到界面上**。
 * 实测（`route.fulfill` 造三类后端错误）：
 *   · `pq: relation "ecam_instance" does not exist`        → 暴露数据库表名
 *   · `dial tcp 10.0.12.34:8002: connect: connection refused` → 暴露内网 IP 与端口
 *   · `runtime error: index out of range\n\ngoroutine 1 ...\n\t/app/main.go:42` → 暴露堆栈与源码路径
 *
 * 这类信息对运维用户没有价值（他改变不了后端），却可能泄露内部结构。
 *
 * 注意：**不能改成「只显示白名单」** —— 既有契约是「显示错误自身的 message」
 * （`DataTable.test.ts` 明确断言 `new Error('网络超时')` 原样展示，中文消息对用户友好）。
 * 因此这里采用**黑名单**：只把「明显是技术细节」的替换成友好文案，其余保持原样。
 */

/** 技术细节特征：数据库 / 网络地址 / 堆栈 / 运行时 */
const TECHNICAL_PATTERNS: RegExp[] = [
  // 数据库驱动错误
  /\bpq:\s/i,
  /\bsql:\s/i,
  /\b(relation|column|table|constraint|index)\s+"?[\w."]+\s+does not exist/i,
  /\bsyntax error at or near\b/i,
  /\bduplicate key value violates unique constraint\b/i,
  /\b(ORA|PLS)-\d{4,5}\b/,
  /\bDeadlock found\b/i,
  /\bconnection pool\b.*\bexhausted\b/i,
  // 网络 / 连接（含内网地址与端口）
  /\bdial tcp\b/i,
  /\bconnect(ion)? (refused|reset|timed out)\b/i,
  /\bno such host\b/i,
  /\b(?:10|127|172|192)\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{2,5})?/,
  /\blocalhost:\d{2,5}\b/i,
  // 堆栈 / 运行时（Go / Node / Python）
  /\bgoroutine \d+\b/i,
  /\bpanic:\s/i,
  /\.go:\d+/,
  /\bat\s+\S+\s+\([^)]*:\d+:\d+\)/,
  /\bTraceback \(most recent call last\)/i,
  /\bTypeError:|\bReferenceError:|\bCannot read propert/,
  /\bnode_modules[\\/]/,
  // 其他内部信息
  /\bstack trace\b/i,
  /\binternal server error\b/i,
]

/** 命中技术细节时展示的友好文案（与 DataTable 的 errorText 风格一致） */
export const TECHNICAL_ERROR_FALLBACK =
  '服务端处理失败，请稍后重试；若持续出现请联系平台管理员'

/**
 * 该 message 是否属于技术细节。
 * @param raw 已经过传输层翻译的 message
 */
export function looksTechnical(raw: string): boolean {
  if (!raw) return false
  const s = raw.trim()
  // 纯中文消息（含常见中文标点）一定不是技术细节，直接放行 —— 避免误伤
  if (!/[a-zA-Z]/.test(s)) return false
  return TECHNICAL_PATTERNS.some((re) => re.test(s))
}
