import { describe, expect, it } from 'vitest'
import routes from './routes'

/** 在 MainLayout 子路由中按 path 查找路由记录 */
function findRoute(path: string) {
    const main = routes.find((r) => r.path === '/')
    const child = main?.children?.find((c) => c.path === path)
    if (!child) throw new Error(`route not found: ${path}`)
    return child
}

describe('运维 Agent 路由注册（任务 5.1 AC#2）', () => {
    const expected: { path: string; title: string; hideInMenu: boolean }[] = [
        { path: '/opsagent/chat', title: '对话排障', hideInMenu: false },
        { path: '/opsagent/risk-center', title: '风险中心', hideInMenu: false },
        { path: '/opsagent/diagnosis/:id', title: '诊断详情', hideInMenu: true },
        { path: '/opsagent/history', title: '历史回溯', hideInMenu: false },
        { path: '/opsagent/settings', title: '系统配置', hideInMenu: false },
        { path: '/opsagent/agents', title: 'Agent 管理', hideInMenu: false },
    ]

    it('注册全部 6 条路由（懒加载 + meta.title/icon/hideInMenu）', () => {
        for (const e of expected) {
            const r = findRoute(e.path)
            expect(r.meta?.title).toBe(e.title)
            expect(typeof r.meta?.icon).toBe('string')
            expect(r.component).toBeTypeOf('function')
            expect(r.meta?.hideInMenu ?? false).toBe(e.hideInMenu)
        }
    })

    it('一级页路由 name 全局唯一（Opsagent* 前缀不与既有路由冲突）', () => {
        const names = routes
            .flatMap((r) => r.children ?? [])
            .map((c) => c.name)
            .filter(Boolean)
        const dup = names.filter((n, i) => names.indexOf(n) !== i)
        expect(dup).toEqual([])
    })
})