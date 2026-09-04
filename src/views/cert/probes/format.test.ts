import { describe, expect, it } from 'vitest'
import type { CertProbeResult } from '@/api/cert'
import {
    certExpiryDate,
    daysUntil,
    groupProbeResults,
    groupSummary,
    isProbeFilterActive,
    linkedResourceLabel,
    matchDomain,
    probeBadgeClass,
    recordTypeLabel,
    recordValueText,
    rootDomainOf,
} from './format'

describe('linkedResourceLabel（链路层标签）', () => {
    it('cdn/waf/external 映射中文标签', () => {
        expect(linkedResourceLabel('cdn')).toBe('CDN 边缘')
        expect(linkedResourceLabel('waf')).toBe('WAF')
        expect(linkedResourceLabel('external')).toBe('源站/外部')
    })

    it('空/缺省 → —（SAN 探测无链路层）', () => {
        expect(linkedResourceLabel('')).toBe('—')
        expect(linkedResourceLabel(undefined)).toBe('—')
    })

    it('未知值原样返回', () => {
        expect(linkedResourceLabel('elb')).toBe('elb')
    })
})

describe('matchDomain（域名子串搜索，大小写不敏感）', () => {
    it('子串命中', () => {
        expect(matchDomain('www.example.com', 'example')).toBe(true)
        expect(matchDomain('WWW.Example.COM', 'example')).toBe(true)
    })

    it('空关键词全通过', () => {
        expect(matchDomain('www.example.com', '')).toBe(true)
    })

    it('不命中', () => {
        expect(matchDomain('www.example.com', 'other')).toBe(false)
    })

    it('null/undefined 域名不 throw（脏数据防御，与 rootDomainOf 同类）', () => {
        expect(() => matchDomain(null as never, 'x')).not.toThrow()
        expect(matchDomain(null as never, 'x')).toBe(false)
        expect(matchDomain(undefined as never, 'x')).toBe(false)
    })
})

describe('probeBadgeClass（探测徽章 class）', () => {
    it('六态 + 未探测 → tone-* class', () => {
        expect(probeBadgeClass('consistent')).toBe('tone-success')
        expect(probeBadgeClass('diff')).toBe('tone-error')
        expect(probeBadgeClass('change_linked_diff')).toBe('tone-warning')
        expect(probeBadgeClass('unreachable')).toBe('tone-secondary')
        expect(probeBadgeClass('exempt')).toBe('tone-secondary')
        expect(probeBadgeClass('wildcard_skipped')).toBe('tone-secondary')
        expect(probeBadgeClass('')).toBe('tone-secondary')
    })
})

describe('rootDomainOf（根域提取）', () => {
    it('子域名取 eTLD+1', () => {
        expect(rootDomainOf('www.easyeda.com')).toBe('easyeda.com')
        expect(rootDomainOf('a.b.easyeda.com')).toBe('easyeda.com')
    })

    it('通配符行归入根域组', () => {
        expect(rootDomainOf('*.jlcerp.com')).toBe('jlcerp.com')
    })

    it('裸根域原样返回', () => {
        expect(rootDomainOf('jlcerp.com')).toBe('jlcerp.com')
        expect(rootDomainOf('localhost')).toBe('localhost')
    })

    it('二段式后缀取末三段', () => {
        expect(rootDomainOf('www.example.com.cn')).toBe('example.com.cn')
        expect(rootDomainOf('a.b.example.co.uk')).toBe('example.co.uk')
    })

    it('大小写与空白归一', () => {
        expect(rootDomainOf(' WWW.EasyEDA.COM ')).toBe('easyeda.com')
    })
})

describe('groupProbeResults（根域分组与排序）', () => {
    it('组内排序：根域 -> 通配符 -> 子域名字典序', () => {
        const rows = [
            { domain: 'api.jlcerp.com' } as CertProbeResult,
            { domain: '*.jlcerp.com' } as CertProbeResult,
            { domain: 'jlcerp.com' } as CertProbeResult,
            { domain: 'www.jlcerp.com' } as CertProbeResult,
        ]
        const g = groupProbeResults(rows)[0]!
        expect(g.root).toBe('jlcerp.com')
        expect(g.rows.map((r) => r.domain)).toEqual([
            'jlcerp.com',
            '*.jlcerp.com',
            'api.jlcerp.com',
            'www.jlcerp.com',
        ])
    })

    it('组间按根域字典序', () => {
        const rows = [
            { domain: 'www.zoo.com' } as CertProbeResult,
            { domain: 'www.abc.com' } as CertProbeResult,
        ]
        const groups = groupProbeResults(rows)
        expect(groups.map((g) => g.root)).toEqual(['abc.com', 'zoo.com'])
    })
})

describe('groupSummary（组头状态摘要）', () => {
    it('计数拼接，零值省略', () => {
        const rows = [
            { status: 'consistent' },
            { status: 'consistent' },
            { status: 'diff' },
            { status: 'unreachable' },
            { status: 'exempt' },
        ] as CertProbeResult[]
        expect(groupSummary(rows)).toBe('5 项 · 2 一致 · 1 差异 · 1 不可达')
    })

    it('全一致只列项数与一致数', () => {
        const rows = [{ status: 'consistent' }] as CertProbeResult[]
        expect(groupSummary(rows)).toBe('1 项 · 1 一致')
    })
})

describe('isProbeFilterActive（筛选激活判定）', () => {
    it('任一非空即激活', () => {
        expect(isProbeFilterActive('', '', '')).toBe(false)
        expect(isProbeFilterActive('www', '', '')).toBe(true)
        expect(isProbeFilterActive('', 'diff', '')).toBe(true)
        expect(isProbeFilterActive('', '', 'cdn')).toBe(true)
        expect(isProbeFilterActive('   ', '', '')).toBe(false)
    })
})

describe('certExpiryDate（证书到期实际日期）', () => {
    it('RFC3339 → UTC 日期', () => {
        expect(certExpiryDate('2027-01-01T00:00:00Z')).toBe('2027-01-01')
    })

    it('空/非法 → 空串', () => {
        expect(certExpiryDate(undefined)).toBe('')
        expect(certExpiryDate('')).toBe('')
        expect(certExpiryDate('not-a-date')).toBe('')
    })
})

describe('daysUntil（距到期天数）', () => {
    it('未来日期正数，过去负数', () => {
        const now = new Date('2026-09-02T00:00:00Z')
        expect(daysUntil('2026-09-12T00:00:00Z', now)).toBe(10)
        expect(daysUntil('2026-09-01T00:00:00Z', now)).toBe(-1)
    })

    it('空/非法 → null', () => {
        expect(daysUntil(undefined)).toBeNull()
        expect(daysUntil('bad')).toBeNull()
    })
})

describe('recordTypeLabel / recordValueText', () => {
    it('缺省 → —，类型原样', () => {
        expect(recordTypeLabel(undefined)).toBe('—')
        expect(recordTypeLabel('')).toBe('—')
        expect(recordTypeLabel('CNAME')).toBe('CNAME')
    })

    it('长解析地址截断', () => {
        expect(recordValueText(undefined)).toBe('—')
        expect(recordValueText('1.2.3.4')).toBe('1.2.3.4')
        const long = 'a'.repeat(60) + '.edgesuite.net'
        expect(recordValueText(long)).toHaveLength(48)
        expect(recordValueText(long).endsWith('…')).toBe(true)
    })
})

describe('rootDomainOf 脏数据防御（白屏回归）', () => {
    it('null/undefined/非字符串域名不 throw，返回空串', () => {
        expect(() => rootDomainOf(null as never)).not.toThrow()
        expect(rootDomainOf(null as never)).toBe('')
        expect(rootDomainOf(undefined as never)).toBe('')
    })

    it('含脏行的列表分组不崩，脏行归入未知组', () => {
        const rows = [
            { domain: 'www.ok.com' },
            { domain: null },
        ] as unknown as CertProbeResult[]
        const groups = groupProbeResults(rows)
        expect(groups.map((g) => g.root)).toEqual(['(未知域名)', 'ok.com'])
    })
})
