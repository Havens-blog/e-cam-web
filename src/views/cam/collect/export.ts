/**
 * 采集日志 CSV 导出（纯函数，便于单测）
 *
 * 规则：导出「当前筛选」下的日志（账号/状态），字段与页面表格一致；
 * 带 UTF-8 BOM 方便 Excel 正确识别中文。
 */
import type { CollectLog } from '@/api/types/finops'
import { collectStartedAt, formatDateTime } from './format'

/** 单次导出行数上限，避免一次拉取过多 */
export const EXPORT_MAX_ROWS = 5000

/** CSV 单元格转义：含逗号/引号/换行时加引号并双写引号 */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return ''
    const text = String(value)
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
}

export interface CollectLogCsvOptions {
    accountNames?: Record<number, string>
    providerLabel?: (provider: string) => string
}

function statusText(status: string): string {
    if (status === 'success') return '成功'
    if (status === 'failed') return '失败'
    if (status === 'running') return '运行中'
    return status
}

function durationText(log: CollectLog): string {
    if (typeof log.duration_ms === 'number' && log.duration_ms > 0) {
        return `${(log.duration_ms / 1000).toFixed(1)}s`
    }
    return log.status === 'running' ? '进行中' : ''
}

function timeText(log: CollectLog): string {
    const ms = collectStartedAt(log)
    return ms > 0 ? formatDateTime(ms) : ''
}

/** 生成 CSV 文本（含 BOM） */
export function buildCollectLogCsv(
    logs: Array<Partial<CollectLog>>,
    options: CollectLogCsvOptions = {}
): string {
    const header = ['账号', '云厂商', '状态', '账期开始', '账期结束', '记录数', '耗时', '错误信息', '采集时间']
    const lines = [header.map(csvCell).join(',')]
    for (const log of logs) {
        const accountId = typeof log.account_id === 'number' ? log.account_id : 0
        const accountName = options.accountNames?.[accountId]
        const provider = String(log.provider || '')
        lines.push(
            [
                accountName ? `${accountName} #${accountId}` : `#${accountId}`,
                options.providerLabel ? options.providerLabel(provider) : provider,
                statusText(String(log.status || '')),
                String(log.bill_start || ''),
                String(log.bill_end || ''),
                log.record_count ?? '',
                durationText(log as CollectLog),
                String(log.error_msg || ''),
                timeText(log as CollectLog)
            ]
                .map(csvCell)
                .join(',')
        )
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`
}

/** 导出文件名：collect-logs-YYYYMMDD-HHmm.csv（本地时间） */
export function exportFileName(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
    return `collect-logs-${stamp}.csv`
}
