import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import routes from '@/router/routes'
import { CERT_MENU_ITEMS } from './cert-nav'

/** 测试文件所在目录（vitest 下 __dirname 不可靠，经 import.meta.url 推导） */
const here = dirname(fileURLToPath(import.meta.url))

/**
 * 任务 6.7 AC#4：导航注册核对。
 * 证书台账/到期看板/变更管理 三一级菜单的顺序、目标路由与只读可见性
 * 按 prd-ui-functions Primary Navigation / Navigation Rules 落地为可回归的纯数据。
 */

/** 在 MainLayout 子路由中按 path 查找路由记录 */
function findRoute(path: string) {
    const main = routes.find((r) => r.path === '/')
    const child = main?.children?.find((c) => c.path === path)
    if (!child) throw new Error(`route not found: ${path}`)
    return child
}

describe('证书管理一级菜单注册（任务 6.7 AC#4）', () => {
    it('三项一级菜单按 prd-ui-functions 顺序：证书���账 → 到期看板 → 变更管理', () => {
        expect(CERT_MENU_ITEMS.map((i) => i.title)).toEqual(['证书台账', '到期看板', '探测结果', '变更管理'])
    })

    it('菜单目标路由与 Page Composition 表对齐（/certs · /certs/dashboard · /certs/probes · /certs/changes）', () => {
        expect(CERT_MENU_ITEMS.map((i) => i.path)).toEqual(['/certs', '/certs/dashboard', '/certs/probes', '/certs/changes'])
    })

    it('台账与变更管理 requireCertManage（只读查看者仅见"到期看板"菜单项）', () => {
        const byPath = Object.fromEntries(CERT_MENU_ITEMS.map((i) => [i.path, i.requireCertManage]))
        expect(byPath['/certs']).toBe(true)
        expect(byPath['/certs/changes']).toBe(true)
        expect(byPath['/certs/dashboard']).toBeFalsy()
        expect(byPath['/certs/probes']).toBeFalsy()
    })

    it('菜单 path 均为已注册且未 hideInMenu 的路由（菜单不指向次级/隐藏页）', () => {
        for (const item of CERT_MENU_ITEMS) {
            const r = findRoute(item.path)
            expect(r.meta?.hideInMenu ?? false, item.path).toBe(false)
        }
    })

    it('菜单图标类存在于 iconfont 样式表（图标可渲染）且互不重复', () => {
        const css = readFileSync(resolve(here, '../../public/iconfont/iconfont.css'), 'utf8')
        const icons = CERT_MENU_ITEMS.map((i) => i.icon)
        for (const icon of icons) {
            expect(css, `${icon} 应在 iconfont.css 中定义`).toContain(`.${icon}`)
        }
        expect(new Set(icons).size).toBe(icons.length)
    })
})
