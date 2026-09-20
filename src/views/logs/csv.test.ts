// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import type { LogEntry, WAFLogEntry } from '@/api/types/logs'
import { csvCell, csvSerialize, downloadCsv, entryRows } from './csv'

describe('csvCell(RFC 4180 转义)', () => {
    it('普通值原样', () => {
        expect(csvCell('a')).toBe('a')
        expect(csvCell('GET /x')).toBe('GET /x')
    })
    it('含逗号/引号/换行加引号,引号翻倍', () => {
        expect(csvCell('a,b')).toBe('"a,b"')
        expect(csvCell('he said "hi"')).toBe('"he said ""hi"""')
        expect(csvCell('多行\n文本')).toBe('"多行\n文本"')
    })
})

describe('csvSerialize', () => {
    it('表头 + 行 → CRLF 文本', () => {
        expect(csvSerialize(['a', 'b'], [['1', 'x,y'], ['2', 'z']])).toBe('a,b\r\n1,"x,y"\r\n2,z\r\n')
    })
    it('空输入返回空串', () => {
        expect(csvSerialize([], [])).toBe('')
    })
})

describe('entryRows(统一归一化口径)', () => {
    const entry: Partial<LogEntry> & { raw?: object } = {
        meta: { cloud: 'aliyun', account_id: '1', account_name: 'a', region: 'r', resource_id: 'd', source: 's' },
        timestamp: 1787824562000,
        client_ip: '1.2.3.4',
        host: 'a.com',
        status: 404,
    }
    const columns = [
        { key: 'timestamp', label: '时间' },
        { key: 'meta.cloud', label: '云' },
        { key: 'client_ip', label: '来源IP' },
        { key: 'host', label: '域名' },
        { key: 'rule_name', label: '规则' },
    ]
    it('mapped 列:时间/云/字段值正常', () => {
        const rows = entryRows([entry as unknown as WAFLogEntry], columns)
        expect(rows[0]![0]).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
        expect(rows[0]![1]).toBe('阿里云')
        expect(rows[0]![2]).toBe('1.2.3.4')
        expect(rows[0]![3]).toBe('a.com')
    })
    it('缺失字段显 —(不崩)', () => {
        const rows = entryRows([entry as unknown as WAFLogEntry], columns)
        expect(rows[0]![4]).toBe('—')
    })
})

describe('downloadCsv(触发浏览器下载)', () => {
    it('创建带 BOM 的 Blob 并模拟点击,完成后释放 URL', () => {
        const create = vi.fn(() => 'blob:mock')
        const revoke = vi.fn()
        vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
        const click = vi.fn()
        const el = { href: '', download: '', click } as unknown as HTMLAnchorElement
        vi.spyOn(document, 'createElement').mockReturnValue(el)
        const append = vi.spyOn(document.body, 'appendChild').mockImplementation(() => el)
        const remove = vi.spyOn(document.body, 'removeChild').mockImplementation(() => el)
        const BlobCtor = vi.fn().mockImplementation(function BlobStub() { return {} })
        vi.stubGlobal('Blob', BlobCtor as unknown as typeof Blob)

        downloadCsv('x.csv', 'a,b\r\n')

        expect(BlobCtor).toHaveBeenCalledWith(['﻿a,b\r\n'], { type: 'text/csv;charset=utf-8' })
        expect(create).toHaveBeenCalledTimes(1)
        expect(el.download).toBe('x.csv')
        expect(click).toHaveBeenCalledTimes(1)
        expect(revoke).toHaveBeenCalledWith('blob:mock')
        expect(append).toHaveBeenCalledTimes(1)
        expect(remove).toHaveBeenCalledTimes(1)
    })
})