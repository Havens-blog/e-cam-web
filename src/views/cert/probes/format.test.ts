import { describe, expect, it } from 'vitest'
import { linkedResourceLabel, matchDomain, probeBadgeClass } from './format'

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
