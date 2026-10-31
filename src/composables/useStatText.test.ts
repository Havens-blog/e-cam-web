import { describe, expect, it } from 'vitest'
import { STAT_UNKNOWN, useStatText } from './useStatText'

describe('useStatText（统计卡「失败即未知」）', () => {
    it('正常态：渲染原始数字', () => {
        const { statText } = useStatText()
        expect(statText(0)).toBe('0')
        expect(statText(963)).toBe('963')
    })

    it('0 与「未知」必须可区分：正常态的 0 仍是 0', () => {
        const { statText } = useStatText()
        // 真实为 0 时显示 0（例如某类资源确实为 0）
        expect(statText(0)).toBe('0')
        expect(statText(0)).not.toBe(STAT_UNKNOWN)
    })

    it('统计失败：全部显示「—」，而不是 0', () => {
        const { markFailed, statText } = useStatText()
        markFailed()
        expect(statText(0)).toBe('—')
        expect(statText(7206)).toBe('—')
    })

    it('失败后重新成功：复位为数字（重试恢复的关键语义）', () => {
        const { markFailed, markOk, statText } = useStatText()
        markFailed()
        expect(statText(7206)).toBe('—')

        markOk()
        expect(statText(7206)).toBe('7206')
    })

    it('markFailed / markOk 幂等', () => {
        const { markFailed, markOk, statText } = useStatText()
        markFailed()
        markFailed()
        expect(statText(1)).toBe('—')
        markOk()
        markOk()
        expect(statText(1)).toBe('1')
    })
})
