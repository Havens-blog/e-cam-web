import { URL as NodeURL } from 'node:url'

/**
 * 测试专用 window.location 替身（RC#2 登录跳转用例引入）。
 *
 * 为什么不用真实 location：happy-dom 原生 location 的 href 赋值会触发真实导航。
 * 为什么不用裸 URL 实例：happy-dom 环境替换了全局 URL，且 Node 的 URL.href
 * setter 不接受相对地址（浏览器会按当前 URL 解析相对值）。生产代码的默认登录
 * 目标 /console/login 恰是相对路径，故替身按浏览器语义实现：相对地址以当前
 * URL 为 base 解析，最终 href 可读回断言。
 */
export function stubLocation(initialHref: string): { href: string; origin: string; toString(): string } {
    let current = new NodeURL(initialHref)
    const fake = {
        get href() {
            return current.href
        },
        set href(value: string) {
            current = new NodeURL(value, current)
        },
        get origin() {
            return current.origin
        },
        toString() {
            return current.href
        }
    }
    Object.defineProperty(window, 'location', { value: fake, configurable: true, writable: true })
    return fake
}

/** afterEach 里还原被 stubLocation 替换的 window.location */
export function restoreLocation(original: Location): void {
    Object.defineProperty(window, 'location', { value: original, configurable: true, writable: true })
}
