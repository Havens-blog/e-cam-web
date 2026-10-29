import { describe, expect, it } from 'vitest'
import { contrastRatio, ensureReadableOnDark, parseHexColor } from './colorContrast'

const CARD_BG = '#191a1b' // 统计卡/面板底色

describe('colorContrast', () => {
  describe('parseHexColor', () => {
    it('支持 #rrggbb / #rgb / 不带 #', () => {
      expect(parseHexColor('#0052d9')).toEqual([0, 82, 217])
      expect(parseHexColor('0052d9')).toEqual([0, 82, 217])
      expect(parseHexColor('#fff')).toEqual([255, 255, 255])
    })

    it('非法值返回 null', () => {
      expect(parseHexColor('rgb(0,0,0)')).toBeNull()
      expect(parseHexColor('#12345')).toBeNull()
      expect(parseHexColor('')).toBeNull()
    })
  })

  describe('contrastRatio', () => {
    it('黑白为 21:1', () => {
      expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
    })

    it('同色为 1:1', () => {
      expect(contrastRatio([100, 100, 100], [100, 100, 100])).toBeCloseTo(1, 5)
    })
  })

  describe('ensureReadableOnDark', () => {
    it('已达标时不改动颜色（避免无谓的视觉变化）', () => {
      // 阿里云橙在卡片底上本来就有 6.07
      expect(ensureReadableOnDark('#ff6a00', CARD_BG)).toBe('#ff6a00')
      expect(ensureReadableOnDark('#ff9900', CARD_BG)).toBe('#ff9900')
    })

    it('腾讯云蓝提亮后达到 AA（原始 2.66）', () => {
      const fixed = ensureReadableOnDark('#0052d9', CARD_BG)
      const fg = parseHexColor(fixed)!
      const bg = parseHexColor(CARD_BG)!
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(fg, bg)).toBeLessThan(7) // 只是提亮到刚好，不是直接变白
    })

    it('华为云红提亮后达到 AA（原始 3.04）', () => {
      const fixed = ensureReadableOnDark('#cf000f', CARD_BG)
      const fg = parseHexColor(fixed)!
      const bg = parseHexColor(CARD_BG)!
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(fg, bg)).toBeLessThan(7)
    })

    it('保留色相：提亮后仍是同一色系（蓝分量最大/红分量最大）', () => {
      const tencent = parseHexColor(ensureReadableOnDark('#0052d9', CARD_BG))!
      expect(tencent[2]).toBeGreaterThan(tencent[0]) // 蓝 > 红
      const huawei = parseHexColor(ensureReadableOnDark('#cf000f', CARD_BG))!
      expect(huawei[0]).toBeGreaterThan(huawei[1]) // 红 > 绿
    })

    it('提亮是「最小必要」，不是一律变白', () => {
      const fixed = ensureReadableOnDark('#0052d9', CARD_BG)
      expect(fixed.toLowerCase()).not.toBe('#ffffff')
    })

    it('非法输入原样返回', () => {
      expect(ensureReadableOnDark('not-a-color', CARD_BG)).toBe('not-a-color')
      expect(ensureReadableOnDark('#0052d9', 'nope')).toBe('#0052d9')
    })
  })
})
