import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue'

/**
 * 响应式媒体查询（SPA 安全）。
 *
 * 用于「窄屏真正移除表格列」等场景：CSS 隐藏仍会占用 el-table 的 colgroup 宽度，
 * 只有 v-if 才能真正释放。跨断点才触发，无需 debounce。
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
    const matches = ref(false)
    let media: MediaQueryList | null = null

    const apply = (value: boolean) => {
        matches.value = value
    }
    const onChange = (event: MediaQueryListEvent) => apply(event.matches)

    onMounted(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
        media = window.matchMedia(query)
        apply(media.matches)
        media.addEventListener('change', onChange)
    })

    onUnmounted(() => {
        media?.removeEventListener('change', onChange)
        media = null
    })

    return readonly(matches)
}
