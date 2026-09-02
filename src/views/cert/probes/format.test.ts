import { describe, expect, it } from 'vitest'
import type { CertProbeResult } from '@/api/cert'
import {
    groupProbeResults,
    groupSummary,
    isProbeFilterActive,
    linkedResourceLabel,
    matchDomain,
    probeBadgeClass,
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
        const [g] = groupProbeResults(rows)
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
