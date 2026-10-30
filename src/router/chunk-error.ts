/**
 * 路由懒加载（动态 import）失败识别。
 *
 * 真实场景：发版后旧 chunk 哈希失效、CDN 抖动、或用户长时间挂着页面后点击别的菜单——
 * 浏览器取不到对应 chunk 时，vue-router 会抛 `Failed to fetch dynamically imported module`，
 * 页面停在上一个路由或直接白屏，用户既不知道发生了什么、也没有恢复入口。
 *
 * 各家浏览器/打包器的原始文案不一致，这里集中一份判定，避免散落在路由与全局错误处理里。
 */
const CHUNK_LOAD_PATTERNS = [
    // Chromium / Firefox：动态 import 取不到模块
    /failed to fetch dynamically imported module/i,
    // Safari：模块脚本加载失败
    /importing a module script failed/i,
    // Webpack 风格（本项目用 Vite，保留兼容）
    /loading chunk [\w.-]+ failed/i,
    /error loading dynamically imported module/i,
]

/** 是否为「懒加载 chunk 取不到」类错误（值得提示用户刷新，而不是当成普通 JS 异常） */
export function isChunkLoadError(error: unknown): boolean {
    const message =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : ((error as { message?: unknown } | null | undefined)?.message ?? '')
    if (typeof message !== 'string' || message === '') return false
    return CHUNK_LOAD_PATTERNS.some((re) => re.test(message))
}
