import { describe, expect, it } from 'vitest'
import { buildCollectLogCsv, csvCell, exportFileName, EXPORT_MAX_ROWS } from './export'

describe('csvCell', () => {
    it('普通值原样输出', () => {
        expect(csvCell('aliyun')).toBe('aliyun')
        expect(csvCell(0)).toBe('0')
        expect(csvCell(null)).toBe('')
    })

    it('逗号/引号/换行时加引号并双写引号', () => {
        expect(csvCell('a,b')).toBe('"a,b"')
        expect(csvCell('say "hi"')).toBe('"say ""hi"""')
        expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    })
})

describe('buildCollectLogCsv', () => {
    const logs = [
        {
            account_id: 5,
            provider: 'volcengine',
            status: 'failed',
            bill_start: '2026-08-01T00:00:00Z',
            bill_end: '2026-08-31T00:00:00Z',
            record_count: 0,
            duration_ms: 3200,
            error_msg: 'fetch bill details: timeout, retry',
            start_time: '2026-10-27T03:19:19.240Z'
        },
        {
            account_id: 5,
            provider: 'volcengine',
            status: 'running',
            bill_start: '2026-09-01T00:00:00Z',
            bill_end: '2026-09-30T00:00:00Z',
            record_count: 0,
            duration_ms: 0,
            error_msg: '',
            start_time: '2026-10-27T04:00:00.032Z'
        }
    ] as any

    it('包含 BOM、表头与每条记录', () => {
        const csv = buildCollectLogCsv(logs, { accountNames: { 5: '集团-火山云' } })
        expect(csv.startsWith('\uFEFF')).toBe(true)
        const lines = csv.replace('\uFEFF', '').trim().split('\r\n')
        expect(lines).toHaveLength(3)
        expect(lines[0]).toBe('账号,云厂商,状态,账期开始,账期结束,记录数,耗时,错误信息,采集时间')
        expect(lines[1]).toContain('集团-火山云 #5')
        expect(lines[1]).toContain('失败')
        expect(lines[1]).toContain('3.2s')
        expect(lines[1]).toContain('"fetch bill details: timeout, retry"')
        expect(lines[2]).toContain('进行中')
    })

    it('支持自定义厂商名与缺失账号名', () => {
        const csv = buildCollectLogCsv([logs[0]], { providerLabel: (p) => (p === 'volcengine' ? '火山引擎' : p) })
        const row = csv.replace('\uFEFF', '').trim().split('\r\n')[1] ?? ''
        expect(row).toContain('火山引擎')
        expect(row.startsWith('#5')).toBe(true)
    })

    it('空列表只有表头', () => {
        const csv = buildCollectLogCsv([])
        expect(csv.replace('\uFEFF', '').trim().split('\r\n')).toHaveLength(1)
    })
})

describe('exportFileName', () => {
    it('按本地时间生成文件名', () => {
        const d = new Date(2026, 9, 27, 22, 5)
        expect(exportFileName(d)).toBe('collect-logs-20261027-2205.csv')
    })

    it('导出上限为 5000', () => {
        expect(EXPORT_MAX_ROWS).toBe(5000)
    })
})
