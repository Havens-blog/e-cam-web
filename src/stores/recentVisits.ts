/**
 * 最近访问记录 store（ui-unify-phase2-components 任务 6）。
 *
 * 记录 CommandPalette 执行的路由跳转，按"频次优先、同频次按最近访问时间"
 * 排序供面板展示；经 pinia-plugin-persistedstate 持久化到 localStorage，
 * 页面刷新后不丢（复用项目既有持久化机制，见 stores/index.ts 插件注册）。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { MAX_RECENT_VISITS } from '@/components/CommandPalette/types'

/** 单条最近访问记录 */
export interface RecentVisit {
    /** 跳转路径（唯一键） */
    path: string
    /** 展示标题（跳转时的条目标题） */
    title: string
    /** 累计访问频次 */
    count: number
    /** 最近一次访问时间戳（ms） */
    lastVisitedAt: number
}

/**
 * 最近访问记录 store。
 *
 * 容量上限 MAX_RECENT_VISITS：超出时按排序淘汰末位（低频且久未访问）条目。
 */
export const useRecentVisitsStore = defineStore(
    'recentVisits',
    () => {
        /** 原始记录（无序，upsert 语义） */
        const entries = ref<RecentVisit[]>([])

        /** 展示用排序：频次降序 → 同频次按最近访问时间降序 */
        const sortedEntries = computed<RecentVisit[]>(() =>
            [...entries.value].sort(
                (a, b) => b.count - a.count || b.lastVisitedAt - a.lastVisitedAt
            )
        )

        /**
         * 记录一次跳转：同路径 upsert（频次 +1、刷新时间戳），新路径头插。
         * 空路径忽略（防御无效调用）。
         *
         * @param path 跳转路径
         * @param title 展示标题
         */
        function record(path: string, title: string): void {
            if (!path) return
            const now = Date.now()
            const existing = entries.value.find((entry) => entry.path === path)
            if (existing) {
                existing.count += 1
                existing.lastVisitedAt = now
                return
            }
            entries.value.unshift({ path, title, count: 1, lastVisitedAt: now })
            if (entries.value.length > MAX_RECENT_VISITS) {
                // 按展示排序淘汰末位（低频/久未访问），保证留下的是最常用条目
                const survivors = new Set(
                    sortedEntries.value
                        .slice(0, MAX_RECENT_VISITS)
                        .map((entry) => entry.path)
                )
                entries.value = entries.value.filter((entry) => survivors.has(entry.path))
            }
        }

        /** 清空全部记录 */
        function clear(): void {
            entries.value = []
        }

        return { entries, sortedEntries, record, clear }
    },
    {
        persist: {
            key: 'cam-command-palette-recent',
            storage: localStorage
        }
    }
)
