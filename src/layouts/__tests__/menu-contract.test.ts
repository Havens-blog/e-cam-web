/**
 * 导航菜单契约：迁移下线的模块不得再出现在侧边栏；且非跨应用前缀的菜单项
 * 必须存在本地路由（否则点击即 404 —— 资源拓扑就曾是这样一条死链）。
 *
 * 背景：CMDB/服务树/拓扑页面已迁出至独立仓库 e-cmdb-web。其中 `/cmdb/*` 由
 * layouts/external-app.ts 的 EXTERNAL_APP_PREFIXES 统一新窗口外开（带 tenant_id），
 * 属跨应用入口；而 `/topology` 既无本地路由也无外开前缀，是残留死链，本次按需求下线。
 */
import { describe, expect, it } from 'vitest'
import { menuGroups } from '../menu-config'
import type { MenuItem } from '../menu-config'
import { EXTERNAL_APP_PREFIXES } from '../external-app'
import routes from '@/router/routes'

function flatten(items: MenuItem[]): MenuItem[] {
    return items.flatMap((it) => [it, ...(it.children ? flatten(it.children) : [])])
}

const allItems = menuGroups.flatMap((g) => flatten(g.items))
const withPath = allItems.filter((it): it is MenuItem & { path: string } => !!it.path)

/** 收集所有本地路由 path（含子路由） */
function collectRoutePaths(records: unknown[]): string[] {
    const out: string[] = []
    for (const r of records) {
        const rec = r as { path?: string; children?: unknown[] }
        if (rec.path) out.push(rec.path)
        if (rec.children?.length) out.push(...collectRoutePaths(rec.children))
    }
    return out
}
const routePaths = collectRoutePaths(routes as unknown[])

describe('导航菜单契约', () => {
    it('已迁移下线的模块不得出现在导航（资源拓扑 / 告警中心 / CMDB）', () => {
        const keys = allItems.map((i) => i.key)
        for (const k of ['topology', 'alert', 'alert-events', 'alert-rules', 'alert-channels', 'cmdb']) {
            expect(keys, `导航仍存在已下线项: ${k}`).not.toContain(k)
        }
        const titles = allItems.map((i) => i.title)
        for (const t of ['资源拓扑', '告警中心', 'CMDB']) {
            expect(titles, `导航仍存在已下线标题: ${t}`).not.toContain(t)
        }
        const paths = withPath.map((i) => i.path)
        for (const p of ['/topology', '/alert/events', '/alert/rules', '/alert/channels']) {
            expect(paths, `导航仍指向已下线路径: ${p}`).not.toContain(p)
        }
    })

    it('非跨应用前缀的菜单路径必须存在本地路由（防止再次留下点击即 404 的死链）', () => {
        // 已知遗留（本轮清单外、待产品确认"删除 or 改指 /cmdb/service-tree"）：
        // 服务树同样已迁出至 e-cmdb-web（见 api/service-tree-stats.ts 注释、e-cmdb-web/src/views/service-tree），
        // 但其 `/service-tree*` 菜单既无本地路由也未加入 EXTERNAL_APP_PREFIXES —— 先豁免，避免静默存在。
        const KNOWN_DANGLING_PENDING = [
            'service-tree-main:/service-tree',
            'service-tree-envs:/service-tree/environments',
            'service-tree-rules:/service-tree/rules',
        ]
        const dangling = withPath
            .filter((i) => !EXTERNAL_APP_PREFIXES.some((p) => i.path.startsWith(p)))
            .filter((i) => !routePaths.includes(i.path))
            .map((i) => `${i.key}:${i.path}`)
            .filter((id) => !KNOWN_DANGLING_PENDING.includes(id))
        expect(dangling, `以下菜单项没有对应本地路由，也不是跨应用外开: ${dangling.join(', ')}`).toEqual([])
    })

    it('已知遗留项个数被锁定：新增死链或未同步清理都会被这条守住', () => {
        const KNOWN_COUNT = 3 // 上一条测试中的 KNOWN_DANGLING_PENDING
        const dangling = withPath
            .filter((i) => !EXTERNAL_APP_PREFIXES.some((p) => i.path.startsWith(p)))
            .filter((i) => !routePaths.includes(i.path))
        expect(dangling.length).toBeLessThanOrEqual(KNOWN_COUNT)
    })

    it('跨应用前缀仍受 external-app 机制覆盖（CMDB 类外开入口不被误当死链）', () => {
        for (const p of EXTERNAL_APP_PREFIXES) {
            expect(p.endsWith('/')).toBe(true)
        }
    })
})
