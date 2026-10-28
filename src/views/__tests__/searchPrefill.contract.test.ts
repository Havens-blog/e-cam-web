import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 契约测试：凡读取 route.query.search 的列表页，必须把关键字写到「用户可见」的位置。
 *
 * 背景：2026-10 曾三次漂移（7 页修了、8 页漏了、ecs 又漏一处）——数据被过滤但
 * 输入框/条件 chip 为空。happy-dom 无法断言源码级一致性，故用源码扫描锁住。
 *
 * 约束：
 * - 每个读取点都要检查（同页可能既有 onMounted 又有 watch 的二次读取）；
 * - 读取点数量有下限，避免重构（如改成 route.query['search']）后没有 reader、
 *   断言空转变绿。
 */
const VIEWS_DIR = fileURLToPath(new URL('..', import.meta.url))

/** 当前 20 个页面读取 ?search；接近真实值的下限可在写法变更时及时报警 */
const MIN_READERS = 20
const WINDOW = 500

const DISPLAY_STATE_PATTERNS = [
    /searchKeyword\.value\s*=\s*[A-Za-z_$][\w$]*/, // 输入框 model（排除清零 searchKeyword.value = ''）
    /searchConditions\.value\.push/, // 条件 chip（vswitch/ecs）
    /conditions\.value\.push/, // 条件 chip（其它条件式页面）
]

function listVueFiles(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir).sort()) {
        if (entry === '__tests__' || entry === 'node_modules') continue
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...listVueFiles(full))
        else if (entry.endsWith('.vue')) out.push(full)
    }
    return out
}

function lineOf(source: string, index: number): number {
    return source.slice(0, index).split('\n').length
}

describe('搜索深链回显契约', () => {
    it('每个 ?search 读取点附近都有可见态写入', () => {
        const offenders: string[] = []
        let readers = 0

        for (const file of listVueFiles(VIEWS_DIR)) {
            const source = readFileSync(file, 'utf8')
            const rel = relative(VIEWS_DIR, file).replace(/\\/g, '/')
            let index = -1
            while ((index = source.indexOf('route.query.search', index + 1)) >= 0) {
                readers += 1
                // 只看读取点附近：同名 ref 在别处（重置/提交）也会出现，不能全文件匹配
                const nearby = source.slice(index, index + WINDOW)
                if (DISPLAY_STATE_PATTERNS.some((pattern) => pattern.test(nearby))) continue
                offenders.push(`${rel}:${lineOf(source, index)}`)
            }
        }

        // 先保证扫描面没有因重构而消失，否则下面的空数组断言没有意义
        expect(
            readers,
            `只扫描到 ${readers} 个 ?search 读取点，疑似读取写法已变更（如 route.query['search']）`,
        ).toBeGreaterThanOrEqual(MIN_READERS)
        expect(offenders, `以下读取点未把关键字回显到输入框/chip：${offenders.join(', ')}`).toEqual([])
    })
})
