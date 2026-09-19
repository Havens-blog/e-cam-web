/**
 * WAF 流量诊断卡展示辅助单测(纯函数;对应后端 diagnose 包标签/枚举约定):
 * - 风险等级徽标色映射(高=danger/中=warning/低=primary/无=success);
 * - 风险等级与疑似攻击类型中文标签(与后端 LevelLabel/AttackTypeLabel 对齐);
 * - 占比/突增倍数/大数计数格式化(确定性,无 locale 依赖)。
 */
import { describe, expect, it } from 'vitest'
import {
    attackTypeLabel,
    attackTypeTagType,
    formatCount,
    formatShare,
    formatSurge,
    isAttackType,
    riskLevelLabel,
    riskLevelTagType,
} from './diagnose'

describe('riskLevelTagType(风险等级徽标色)', () => {
    it('高/中/低/无 映射 danger/warning/primary/success', () => {
        expect([
            ['high', 'danger'],
            ['medium', 'warning'],
            ['low', 'primary'],
            ['none', 'success'],
        ]).toEqual([
            ['high', riskLevelTagType('high')],
            ['medium', riskLevelTagType('medium')],
            ['low', riskLevelTagType('low')],
            ['none', riskLevelTagType('none')],
        ])
    })

    it('未知等级兜底 success(不白屏)', () => {
        expect(riskLevelTagType('')).toBe('success')
        expect(riskLevelTagType('unknown')).toBe('success')
    })
})

describe('riskLevelLabel(风险等级中文标签)', () => {
    it('none/low/medium/high → 无/低/中/高风险', () => {
        expect(riskLevelLabel('none')).toBe('无风险')
        expect(riskLevelLabel('low')).toBe('低风险')
        expect(riskLevelLabel('medium')).toBe('中风险')
        expect(riskLevelLabel('high')).toBe('高风险')
    })

    it('未知等级原样透出(后端新增枚举前端不吞)', () => {
        expect(riskLevelLabel('critical')).toBe('critical')
    })
})

describe('attackTypeLabel/isAttackType(疑似攻击类型)', () => {
    it('五类判定中文标签与后端 AttackTypeLabel 对齐', () => {
        expect(attackTypeLabel('normal')).toBe('正常流量')
        expect(attackTypeLabel('cc_flood')).toBe('CC 刷量')
        expect(attackTypeLabel('crawler')).toBe('恶意爬虫')
        expect(attackTypeLabel('brute_force')).toBe('接口爆破')
        expect(attackTypeLabel('normal_burst')).toBe('正常高流量')
    })

    it('攻击类判定:三类攻击为真,正常两态为假;未知兜底正常流量', () => {
        expect(isAttackType('cc_flood')).toBe(true)
        expect(isAttackType('crawler')).toBe(true)
        expect(isAttackType('brute_force')).toBe(true)
        expect(isAttackType('normal')).toBe(false)
        expect(isAttackType('normal_burst')).toBe(false)
        expect(attackTypeLabel('other')).toBe('正常流量')
    })
})

describe('attackTypeTagType(攻击类型徽标色)', () => {
    it('攻击类 danger / 正常高流量 warning(需关注)/ 正常 success', () => {
        expect(attackTypeTagType('cc_flood')).toBe('danger')
        expect(attackTypeTagType('crawler')).toBe('danger')
        expect(attackTypeTagType('brute_force')).toBe('danger')
        expect(attackTypeTagType('normal_burst')).toBe('warning')
        expect(attackTypeTagType('normal')).toBe('success')
    })
})

describe('formatShare/formatSurge/formatCount(数值格式化)', () => {
    it('占比 0-1 → 百分比一位小数', () => {
        expect(formatShare(0)).toBe('0.0%')
        expect(formatShare(0.625)).toBe('62.5%')
        expect(formatShare(1)).toBe('100.0%')
    })

    it('突增倍数:0/缺失 = 前窗无数据 → 占位;>0 → 一位小数 + 倍', () => {
        expect(formatSurge(0)).toBe('—')
        expect(formatSurge(undefined)).toBe('—')
        expect(formatSurge(1)).toBe('1.0 倍')
        expect(formatSurge(12.34)).toBe('12.3 倍')
    })

    it('大数计数千分位分组(确定性,无 locale 依赖)', () => {
        expect(formatCount(0)).toBe('0')
        expect(formatCount(999)).toBe('999')
        expect(formatCount(1000)).toBe('1,000')
        expect(formatCount(80000000)).toBe('80,000,000')
    })
})
