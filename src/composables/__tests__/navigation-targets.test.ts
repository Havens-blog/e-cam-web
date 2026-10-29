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
    const dynamics = paths
        .filter((p) => p.includes(':'))
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
                /router\.(?:push|replace)\(\s*['"]([^'"]+)['"]/g,
                /\b(?:push|replace)\(\s*['"]([^'"]+)['"]/g,
                /to="([^"]+)"/g,
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
    it('静态内部跳转路径必须存在于路由表（防止指向已移除路由的死链）', () => {
        const targets = findStaticTargets()
        // 扫描有效性自检：应能扫到大量合法跳转，否则说明正则/路径失效（避免"假绿"）
        expect(targets.length).toBeGreaterThan(30)

        const dangling = targets.filter((t) => !isKnownTarget(t.path))
        const detail = dangling.map((t) => `${t.file}:${t.line} → ${t.path}`).join('\n')
        expect(dangling, `发现指向不存在路由的跳转:\n${detail}`).toEqual([])
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
