import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import routes from '@/router/routes'
import { OPSAGENT_MENU_ITEMS, type OpsagentMenuItem } from './opsagent-nav'

/** 测试文件所在目录（vitest 下 __dirname 不可靠，经 import.meta.url 推导） */
const here = dirname(fileURLToPath(import.meta.url))

/** 在 MainLayout 子路由中按 path 查找路由记录 */
function findRoute(path: string) {
    const main = routes.find((r) => r.path === '/')
    const child = main?.children?.find((c) => c.path === path)
    if (!child) throw new Error(`route not found: ${path}`)
    return child
}

/** 展平分组菜单，取所有叶节点（含 path 的菜单项） */
function leaves(items: readonly OpsagentMenuItem[]): OpsagentMenuItem[] {
    return items.flatMap((i) => (i.children ? leaves(i.children) : [i]))
}

describe('运维 Agent 一级菜单注册（任务 5.1 AC#3）', () => {
    it('三个分组按 page-map 顺序：核心 → 数据视图 → 管理', () => {
        expect(OPSAGENT_MENU_ITEMS.map((i) => i.title)).toEqual(['核心', '数据视图', '管理'])
    })

    it('叶节点目标路由与 Page Overview 表对齐（5 个 P1 菜单可见页）', () => {
        expect(leaves(OPSAGENT_MENU_ITEMS).map((i) => i.path)).toEqual([
            '/opsagent/chat',
            '/opsagent/risk-center',
            '/opsagent/history',
            '/opsagent/agents',
            '/opsagent/settings',
        ])
    })

    it('菜单 path 均为已注册且未 hideInMenu 的路由', () => {
        for (const item of leaves(OPSAGENT_MENU_ITEMS)) {
            const r = findRoute(item.path!)
            expect(r.meta?.hideInMenu ?? false, item.path).toBe(false)
        }
    })

    it('诊断详情路由不挂载菜单（经风险中心/对话进入）', () => {
        const paths = leaves(OPSAGENT_MENU_ITEMS).map((i) => i.path)
        expect(paths).not.toContain('/opsagent/diagnosis/:id')
    })

    it('菜单图标类存在于 iconfont 样式表且互不重复', () => {
        const css = readFileSync(resolve(here, '../../public/iconfont/iconfont.css'), 'utf8')
        const all: OpsagentMenuItem[] = [...OPSAGENT_MENU_ITEMS, ...leaves(OPSAGENT_MENU_ITEMS)]
        const icons = all.map((i) => i.icon)
        for (const icon of icons) {
            expect(css, `${icon} 应在 iconfont.css 中定义`).toContain(`.${icon}`)
        }
        expect(new Set(icons).size).toBe(icons.length)
    })
})