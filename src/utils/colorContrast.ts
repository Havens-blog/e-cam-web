/**
 * 品牌色在深色底上的可读性处理（WCAG 1.4.3 AA）
 *
 * 背景：各云厂商的品牌色（如腾讯蓝 #0052d9、华为红 #cf000f）在深色界面上直接当**文字色**时
 * 对比度不足（实测 2.66 / 3.04，AA 要求 ≥4.5）。品牌色不宜整体替换，否则丢失品牌识别；
 * 折中做法是**保留色相、只提亮到刚好达标**。
 *
 * 这里用「与白混合 + 二分逼近」而不是固定百分比：不同品牌色的初始亮度差异很大，
 * 固定 35% 对某些颜色会过度失真，对另一些又不够。二分能找到**最小的**提亮量，
 * 让改动尽可能小、品牌观感尽可能接近原色。
 */

/** 相对亮度（WCAG 2.x 定义） */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 两色的对比度（1~21） */
export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** #rgb / #rrggbb → [r, g, b]；解析失败返回 null */
export function parseHexColor(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m || !m[1]) return null
  let hex: string = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}

/** 与白混合：amount=0 原色，amount=1 纯白 */
function mixWithWhite(rgb: [number, number, number], amount: number): [number, number, number] {
  return rgb.map((v) => v + (255 - v) * amount) as [number, number, number]
}

/**
 * 把品牌色提亮到在给定背景上满足 AA（默认 4.5:1）。
 *
 * - 已经达标 → 原样返回，**不产生任何视觉变化**
 * - 未达标 → 二分找出最小提亮量（精度 0.5%），返回提亮后的十六进制色值
 * - 无法解析或即使纯白也不达标（背景过亮）→ 返回白色兜底
 *
 * @param color 品牌色（#rgb / #rrggbb）
 * @param background 背景色（#rgb / #rrggbb），例如卡片底色
 * @param target 目标对比度，默认 4.5（AA 正文）
 */
export function ensureReadableOnDark(color: string, background: string, target = 4.5): string {
  const fg = parseHexColor(color)
  const bg = parseHexColor(background)
  if (!fg || !bg) return color

  if (contrastRatio(fg, bg) >= target) return color
  if (contrastRatio([255, 255, 255], bg) < target) return '#ffffff'

  let low = 0
  let high = 1
  // 二分：找最小提亮量使对比度 >= target
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    if (contrastRatio(mixWithWhite(fg, mid), bg) >= target) high = mid
    else low = mid
  }
  // 向上取一点余量，避免浮点边界导致刚好差 0.01
  return toHex(mixWithWhite(fg, Math.min(1, high + 0.005)))
}
