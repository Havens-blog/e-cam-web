/**
 * 审计日志时间格式化。
 *
 * 归一逻辑已抽到 `@/utils/epoch`（多处页面共用），此处只保留审计页的命名，
 * 避免与 `src/views/logs/format.ts` 的同名函数混淆。
 */
import { formatEpochDateTime } from '@/utils/epoch'

export { normalizeEpochMs } from '@/utils/epoch'

export function formatAuditTime(value: number | string | null | undefined): string {
    return formatEpochDateTime(value)
}
