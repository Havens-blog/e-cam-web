/**
 * 应用外壳的响应式判定（纯函数，便于单测）
 *
 * 背景：窄屏（<= 1024）下侧边栏若保持展开态（220px），390px 视口内容区仅 122px，
 * 表格与金额被裁切。窄屏自动折叠为图标态（64px）可把内容区释放到约 300px。
 */
export const NARROW_BREAKPOINT = 1024

/** 是否窄屏（含等于断点） */
export function isNarrowViewport(width: number, breakpoint: number = NARROW_BREAKPOINT): boolean {
    if (typeof width !== 'number' || !Number.isFinite(width)) return false
    if (typeof breakpoint !== 'number' || !Number.isFinite(breakpoint)) return false
    return width <= breakpoint
}
