/**
 * 导航目标契约：源码里**静态**的内部跳转路径必须存在于路由表。
 *
 * 背景（本测试的由来）：`/accounts/create`、`/accounts/:id/edit` 两条独立路由随
 * ui-audit(A-H1/A-H2) 移除后，`useNavigation` 里仍对外暴露 `goAccountCreate/goAccountEdit`
 * 指向它们 —— 一旦被调用就是点击即 404 的死链，且没有任何编译期报错。
 * 同类问题还包括迁移到 e-cmdb 后残留的 `/topology`、`/service-tree*` 等菜单/跳转。
 *
 * 豁免规则：
 * - `EXTERNAL_APP_PREFIXES`（跨应用外开，如 `/cmdb/...` 由目标应用承载）；
 * - 含 `${}` 的模板拼接路径（动态域名/ID 等，运行时才成型，静态无法判定）；
 * - 以非 `/` 开头的相对路径。
 *
 * 采用"读源码 + 正则"的静态扫描（与 api/request/index.test.ts 的既有做法一致），
 * 因为要覆盖 .vue 模板里的 @click 跳转，运行期挂载无法穷尽。
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { EXTERNAL_APP_PREFIXES } from '@/layouts/external-app'

const SRC = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p, out)
        else if (/\.(ts|vue)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
    }
    return out
}

/** 路由表里的静态路径与动态路径（`:id` → 任意非 / 段） */
function collectRoutes() {
    const src = readFileSync(join(SRC, 'router', 'routes.ts'), 'utf8')
    const paths = [...src.matchAll(/path:\s*'([^']+)'/g)]
        .map((m) => m[1])
        .filter((p): p is string => !!p)
    // 通配/catch-all（如 `/:pathMatch(.*)*`，即 404 兜底）必须排除：
    // 否则 `:[^/]+` 会被替换成"任意单段"，使匹配器**匹配一切单段路径**，
    // 单段死链（如已移除的 /topology）将被静默放过（实测踩到该假绿，2026-10-29）。
    const dynamics = paths
        .filter((p) => p.includes(':') && !p.includes('*') && !p.includes('pathMatch'))
        .map((p) => new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+').replace(/\//g, '\\/') + '$'))
    return { paths, dynamics }
}

const { paths: ROUTE_PATHS, dynamics: DYNAMIC } = collectRoutes()

function isKnownTarget(raw: string): boolean {
    const clean = (raw.split('?')[0] ?? '').split('#')[0] ?? ''
    if (ROUTE_PATHS.includes(clean)) return true
    return DYNAMIC.some((re) => re.test(clean))
}

function findStaticTargets(): { file: string; line: number; path: string }[] {
    const out: { file: string; line: number; path: string }[] = []
    for (const file of walk(SRC)) {
        const lines = readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, idx) => {
            const patterns = [
                // 字符串式
                /router\.(?:push|replace)\(\s*['"]([^'"]+)['"]/g,
                /\b(?:push|replace)\(\s*['"]([^'"]+)['"]/g,
                /to="([^"]+)"/g,
                // 对象式：push({ path: '/x' }) / :to="{ path: '/x' }"
                /(?:push|replace)\(\s*\{\s*path:\s*['"]([^'"]+)['"]/g,
                /:to="\{\s*path:\s*'([^']+)'/g,
                // 原生跳转：href="/x" / window.open('/x') / location.href = '/x'
                /href="(\/[^"]*)"/g,
                /window\.open\(\s*['"](\/[^'"]*)['"]/g,
                /location\.href\s*=\s*['"](\/[^'"]*)['"]/g,
            ]
            for (const re of patterns) {
                for (const m of line.matchAll(re)) {
                    const p = m[1]
                    if (!p) continue
                    if (!p.startsWith('/')) continue
                    if (p.includes('${')) continue
                    if (EXTERNAL_APP_PREFIXES.some((x) => p.startsWith(x))) continue
                    out.push({ file: relative(SRC, file), line: idx + 1, path: p })
                }
            }
        })
    }
    return out
}

describe('导航目标契约', () => {
    it('匹配器不得"空转"：任意不存在的路径都必须判为未知', () => {
        // 关键自检（2026-10-29 实测踩过假绿）：若把路由表的 404 兜底 `/:pathMatch(.*)*`
        // 误当动态段，`:[^/]+` 会膨胀成"任意单段"，匹配器将匹配一切单段路径 ——
        // 于是单段死链（如已移除的 /topology）被静默放过。此处用几个必然不存在的路径
        // 锁死该行为，含**单段**与**多段**两种形态。
        for (const p of ['/definitely-not-a-route', '/definitely/not/a/route', '/topology-absent']) {
            expect(isKnownTarget(p), `${p} 被判为已知路由，说明匹配器空转`).toBe(false)
        }
        // 合法目标仍必须判为已知（含动态段）
        expect(isKnownTarget('/dashboard')).toBe(true)
        expect(isKnownTarget('/assets/123')).toBe(true)
    })

    it('静态内部跳转路径必须存在于路由表（防止指向已移除路由的死链）', () => {
        const targets = findStaticTargets()
        // 扫描有效性自检：应能扫到大量合法跳转，否则说明正则/路径失效（避免"假绿"）
        expect(targets.length).toBeGreaterThan(30)

        const dangling = targets.filter((t) => !isKnownTarget(t.path))
        const detail = dangling.map((t) => `${t.file}:${t.line} → ${t.path}`).join('\n')
        expect(dangling, `发现指向不存在路由的跳转:\n${detail}`).toEqual([])
    })

    it('路由表自身的 redirect 目标必须存在（否则进入该路由即被重定向到空处）', () => {
        const src = readFileSync(join(SRC, 'router', 'routes.ts'), 'utf8')
        const redirects = [...src.matchAll(/redirect:\s*'([^']+)'/g)]
            .map((m) => m[1])
            .filter((t): t is string => !!t && t.startsWith('/'))
        // 非空转自检：路由表确实存在字符串形式 redirect（当前 7 条），否则说明正则或写法变了
        expect(redirects.length, '未扫到任何字符串形式的 redirect，检查扫描正则').toBeGreaterThan(0)
        const dangling = redirects.filter((t) => !isKnownTarget(t))
        expect(dangling, `以下 redirect 指向不存在路由: ${dangling.join(', ')}`).toEqual([])
    })

    it('按路由名跳转（push/replace/to 的 name）必须存在于路由表 name 集合', () => {
        const routesSrc = readFileSync(join(SRC, 'router', 'routes.ts'), 'utf8')
        const names = new Set([...routesSrc.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]).filter((n): n is string => !!n))
        expect(names.size, '未扫到路由 name，检查扫描正则').toBeGreaterThan(10)

        const bad: string[] = []
        for (const file of walk(SRC)) {
            const lines = readFileSync(file, 'utf8').split(/\r?\n/)
            lines.forEach((line, idx) => {
                // 仅在"跳转上下文"里取 name，避免把路由定义/组件 props 误判为跳转
                if (!/(?:push|replace)\(|:to=|\bto:/.test(line)) return
                for (const m of line.matchAll(/name:\s*['"]([^'"]+)['"]/g)) {
                    const n = m[1]
                    if (!n || n.includes('${')) continue
                    if (!names.has(n)) bad.push(`${relative(SRC, file)}:${idx + 1} name=${n}`)
                }
            })
        }
        expect(bad, `以下按名跳转引用了不存在的路由名:\n${bad.join('\n')}`).toEqual([])
    })

    it('已移除的账号独立路由不得再被引用（本次修复的回归点）', () => {
        const targets = findStaticTargets().map((t) => t.path)
        for (const p of ['/accounts/create', '/accounts/1/edit']) {
            expect(targets, `仍存在指向已移除路由的跳转: ${p}`).not.toContain(p)
        }
        // 助手本身也不得再对外暴露：按**代码形态**断言（注释里允许提及名字以说明来龙去脉）
        const nav = readFileSync(join(SRC, 'composables', 'useNavigation.ts'), 'utf8')
        expect(nav, '仍有 const goAccountCreate 定义').not.toMatch(/const\s+goAccountCreate\b/)
        expect(nav, '仍有 const goAccountEdit 定义').not.toMatch(/const\s+goAccountEdit\b/)
        expect(nav, '仍导出 goAccountCreate').not.toMatch(/^\s*goAccountCreate,\s*$/m)
        expect(nav, '仍导出 goAccountEdit').not.toMatch(/^\s*goAccountEdit,\s*$/m)
    })
})
