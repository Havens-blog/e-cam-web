import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 契约测试：凡读取 route.query.search 的列表页，必须同时把关键字写到「用户可见」的位置。
 *
 * 背景：2026-10 曾出现 7 页修了、8 页漏了、ecs 又漏一处的复制粘贴漂移——
 * 数据被过滤但输入框/条件 chip 为空，用户看不到当前条件。happy-dom 无法断言这种
 * 源码级一致性，故用源码扫描锁住。
 */
const VIEWS_DIR = fileURLToPath(new URL('..', import.meta.url))

const DISPLAY_STATE_PATTERNS = [
    /searchKeyword\.value\s*=\s*[A-Za-z_$][\w$]*/, // 输入框 model（排除清零 searchKeyword.value = ''）
    /searchConditions\.value\.push/, // 条件 chip（vswitch/ecs）
    /conditions\.value\.push/, // 条件 chip（其它条件式页面）
    /v-model="filters\.(keyword|name)"/, // 输入框直接绑 filters
]

function listVueFiles(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir)) {
        if (entry === '__tests__' || entry === 'node_modules') continue
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) out.push(...listVueFiles(full))
        else if (entry.endsWith('.vue')) out.push(full)
    }
    return out
}

describe('搜索深链回显契约', () => {
    it('读取 route.query.search 的页面都设置了可见态', () => {
        const offenders: string[] = []
        for (const file of listVueFiles(VIEWS_DIR)) {
            const source = readFileSync(file, 'utf8')
            const queryIndex = source.indexOf('route.query.search')
            if (queryIndex < 0) continue
            // 只在「读取 ?search」附近判断：同名 ref 在别处（重置/提交）也会出现，不能全文件匹配
            const nearby = source.slice(queryIndex, queryIndex + 500)
            if (DISPLAY_STATE_PATTERNS.some((pattern) => pattern.test(nearby))) continue
            offenders.push(relative(VIEWS_DIR, file).replace(/\\/g, '/'))
        }
        expect(offenders, `以下页面读取了 ?search 但未回显到输入框/chip：${offenders.join(', ')}`).toEqual([])
    })
})
