// @vitest-environment happy-dom
/**
 * 最近访问 store 单测（ui-unify-phase2-components 任务 6）：
 * 记录 upsert（同路径频次累加）、按频次/时间排序、容量上限淘汰、
 * 以及经 pinia-plugin-persistedstate 持久化后（新 pinia 实例读回）刷新不丢。
 */
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp, nextTick } from 'vue'
import { MAX_RECENT_VISITS } from '@/components/CommandPalette/types'
import { useRecentVisitsStore } from './recentVisits'

/**
 * 独立 pinia 实例（带持久化插件），模拟一次"应用会话"。
 * 注意：pinia.use() 注册的插件在 app.use(pinia) 时才真正挂载（toBeInstalled 队列），
 * 故必须创建 app 实例并安装 pinia，持久化插件才会生效。
 */
function createSession(): void {
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    createApp({ render: () => null }).use(pinia)
    setActivePinia(pinia)
}

describe('useRecentVisitsStore 记录与排序', () => {
    beforeEach(() => {
        localStorage.clear()
        createSession()
    })

    it('record 新路径插入条目，count 从 1 开始', () => {
        const store = useRecentVisitsStore()
        store.record('/dashboard', '仪表盘')
        expect(store.entries).toHaveLength(1)
        expect(store.entries[0]).toMatchObject({ path: '/dashboard', title: '仪表盘', count: 1 })
    })

    it('record 同路径 upsert：频次累加并刷新时间戳，不产生重复条目', () => {
        const store = useRecentVisitsStore()
        store.record('/dashboard', '仪表盘')
        store.record('/compute/ecs', '虚拟机')
        store.record('/dashboard', '仪表盘')
        expect(store.entries).toHaveLength(2)
        const dash = store.entries.find((e) => e.path === '/dashboard')
        expect(dash?.count).toBe(2)
    })

    it('sortedEntries 按频次降序，同频次按最近访问时间降序', () => {
        const store = useRecentVisitsStore()
        store.record('/a', 'A')
        store.record('/b', 'B')
        store.record('/b', 'B')
        store.record('/c', 'C')
        store.record('/c', 'C')
        // /c 比 /b 更晚访问且同为 2 次 → /c 应排在 /b 前
        expect(store.sortedEntries.map((e) => e.path)).toEqual(['/c', '/b', '/a'])
    })

    it('超过容量上限时淘汰排序末位（低频/久未访问）条目', () => {
        const store = useRecentVisitsStore()
        for (let i = 0; i < MAX_RECENT_VISITS; i++) {
            store.record(`/p${i}`, `P${i}`)
        }
        store.record('/fresh', '新页面')
        expect(store.entries).toHaveLength(MAX_RECENT_VISITS)
        expect(store.entries.some((e) => e.path === '/fresh')).toBe(true)
        // /p0 是最早访问且仅 1 次，应被淘汰
        expect(store.entries.some((e) => e.path === '/p0')).toBe(false)
    })

    it('clear 清空全部记录', () => {
        const store = useRecentVisitsStore()
        store.record('/dashboard', '仪表盘')
        store.clear()
        expect(store.entries).toHaveLength(0)
    })

    it('record 不记录空路径', () => {
        const store = useRecentVisitsStore()
        store.record('', '无效')
        expect(store.entries).toHaveLength(0)
    })
})

describe('useRecentVisitsStore 持久化（刷新不丢）', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('写入后新建 pinia 实例（模拟页面刷新）可从 localStorage 读回', async () => {
        createSession()
        const store = useRecentVisitsStore()
        store.record('/dashboard', '仪表盘')
        store.record('/dashboard', '仪表盘')
        // 持久化订阅在 watcher flush 时写入 localStorage，需等一拍
        await nextTick()

        // 模拟刷新：全新 pinia + 全新 store 实例
        createSession()
        const restored = useRecentVisitsStore()
        expect(restored.entries).toHaveLength(1)
        expect(restored.entries[0]).toMatchObject({ path: '/dashboard', count: 2 })
    })
})
