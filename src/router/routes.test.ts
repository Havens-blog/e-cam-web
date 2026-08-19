import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import routes from './routes'

/** 测试文件所在目录（vitest 下 __dirname 不可靠，经 import.meta.url 推导） */
const here = dirname(fileURLToPath(import.meta.url))

/** 在 MainLayout 子路由中按 path 查找路由记录 */
function findRoute(path: string) {
    const main = routes.find((r) => r.path === '/')
    const child = main?.children?.find((c) => c.path === path)
    if (!child) throw new Error(`route not found: ${path}`)
    return child
}

describe('证书管理路由注册（任务 6.1 AC#1）', () => {
    const expected: { path: string; title: string; hideInMenu: boolean }[] = [
        { path: '/certs', title: '证书台账', hideInMenu: false },
        { path: '/certs/dashboard', title: '到期看板', hideInMenu: false },
        { path: '/certs/changes', title: '变更管理', hideInMenu: false },
        { path: '/certs/changes/new', title: '新建变更', hideInMenu: true },
        { path: '/certs/changes/:id', title: '变更报告', hideInMenu: true },
        { path: '/certs/:id', title: '证书详情', hideInMenu: true },
        { path: '/certs/settings', title: '证书配置', hideInMenu: true },
    ]

    it('注册全部 7 条路由（懒加载 + meta.title/icon）', () => {
        for (const e of expected) {
            const r = findRoute(e.path)
            expect(r.meta?.title).toBe(e.title)
            expect(typeof r.meta?.icon).toBe('string')
            expect(r.component).toBeTypeOf('function')
            expect(r.meta?.hideInMenu ?? false).toBe(e.hideInMenu)
        }
    })

    it('一级页路由 name 全局唯一（Cert* 前缀不与既有路由冲突）', () => {
        const names = routes
            .flatMap((r) => r.children ?? [])
            .map((c) => c.name)
            .filter(Boolean)
        const dup = names.filter((n, i) => names.indexOf(n) !== i)
        expect(dup).toEqual([])
    })
})

describe('只读角色路由拦截标记（任务 6.1 AC#3）', () => {
    it('台账/变更管理（含子路由）/配置标记 certManageOnly，直接访问被前端拦截', () => {
        const blocked = ['/certs', '/certs/changes', '/certs/changes/new', '/certs/changes/:id', '/certs/settings']
        for (const p of blocked) {
            expect(findRoute(p).meta?.certManageOnly, p).toBe(true)
        }
    })

    it('到期看板与证书详情对只读角色开放（无 certManageOnly 标记）', () => {
        for (const p of ['/certs/dashboard', '/certs/:id']) {
            expect(findRoute(p).meta?.certManageOnly, p).toBeUndefined()
        }
    })
})

describe('Page Composition 全页落地（任务 6.7 AC#1）', () => {
    it('7 条路由的懒加载组件均指向磁盘上真实存在的页面文件（非占位页）', () => {
        const pages = [
            '/certs',
            '/certs/dashboard',
            '/certs/changes',
            '/certs/changes/new',
            '/certs/changes/:id',
            '/certs/:id',
            '/certs/settings',
        ]
        for (const p of pages) {
            const component = findRoute(p).component
            expect(component, `${p} 应有懒加载组件`).toBeTypeOf('function')
            // 懒加载函数字符串形如 () => import("@/views/cert/.../index.vue")
            // （vitest 转换后可能是 "/src/views/..." 的 vite 根路径形式）
            const src = String(component)
            const match = src.match(/['"]([^'"]*\/views\/cert\/[^'"]+\.vue)['"]/)
            expect(match, `${p} 组件应指向 views/cert 下页面（实际：${src}）`).toBeTruthy()
            const captured = match?.[1]
            expect(captured, `${p} 应捕获组件路径`).toBeTruthy()
            const rel = (captured ?? '').replace(/^@\//, 'src/').replace(/^\/?src\//, 'src/')
            const file = resolve(here, '../..', rel)
            expect(existsSync(file), `${p} 组件文件应存在：${file}`).toBe(true)
        }
    })

    it('不注册 Page Composition 表之外的证书页面（Hard Rule：无表外路由）', () => {
        const certPaths = (routes.find((r) => r.path === '/')?.children ?? [])
            .map((c) => c.path)
            .filter((p) => p === '/certs' || p.startsWith('/certs/'))
        expect(certPaths.sort()).toEqual(
            [
                '/certs',
                '/certs/:id',
                '/certs/changes',
                '/certs/changes/:id',
                '/certs/changes/new',
                '/certs/dashboard',
                '/certs/settings',
            ].sort(),
        )
    })
})
