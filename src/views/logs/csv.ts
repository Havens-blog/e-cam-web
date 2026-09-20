/**
 * 日志数据 CSV 导出(浏览器端生成,不依赖后端):
 * - RFC 4180 转义(含逗号/引号/换行的单元格加引号并翻倍引号);
 * - 明细按当前字段字典列导出,值统一走归一化口径(cellValue/dashIfEmpty),
 *   时间戳与云名同表格口径;
 * - 下载带 UTF-8 BOM,Excel 直接打开中文不乱码。
 */
import type { LogEntry } from '@/api/types/logs'
import { cellValue, cloudLabel, dashIfEmpty, formatLogTime } from './format'

/** 导出列(字段字典 key + 表头文案) */
export interface CsvColumn {
    key: string
    label: string
}

/** 单一单元格转义(RFC 4180:含分隔符/引号/换行时加引号,引号翻倍) */
export function csvCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

/** 表头 + 行 → CSV 文本(CRLF 行尾;无列无行返回空串) */
export function csvSerialize(header: string[], rows: string[][]): string {
    if (header.length === 0 && rows.length === 0) return ''
    const lines = [header.map(csvCell).join(',')]
    for (const r of rows) {
        lines.push(r.map((cell) => csvCell(cell ?? '')).join(','))
    }
    return lines.join('\r\n') + '\r\n'
}

/** 明细条目 → 行:统一归一化口径(与表格列一致,缺失值显 —) */
export function entryRows(entries: LogEntry[], columns: CsvColumn[]): string[][] {
    return entries.map((e) =>
        columns.map((c) => {
            if (c.key === 'timestamp') return formatLogTime(e.timestamp)
            if (c.key === 'meta.cloud') return cloudLabel(e.meta.cloud)
            // 缺值统一转为空串再走 dashIfEmpty(直接 String(undefined) 会得到 "undefined")
            return dashIfEmpty(String(cellValue(e, c.key) ?? ''))
        }),
    )
}

/** 触发浏览器下载(UTF-8 BOM,Excel 兼容;用完释放 Blob URL) */
export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}