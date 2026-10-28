import { onMounted, onUnmounted, readonly, ref, type Ref } from 'vue'

/**
 * 响应式媒体查询（SPA 安全）。
 *
 * 用于「窄屏真正移除表格列」等场景：CSS 隐藏仍会占用 el-table 的 colgroup 宽度，
 * 只有 v-if 才能真正释放。跨断点才触发，无需 debounce。
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
    // 同步取初值：避免首帧按宽屏建列、挂载后再删（多一次全量布局）
    const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    const matches = ref(supported ? window.matchMedia(query).matches : false)
    let media: MediaQueryList | null = null

    const onChange = (event: MediaQueryListEvent) => {
        matches.value = event.matches
    }

    onMounted(() => {
        if (!supported) return
        media = window.matchMedia(query)
        matches.value = media.matches
        // Safari <= 13 只有旧的 addListener
        if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange)
        else media.addListener(onChange)
    })

    onUnmounted(() => {
        if (!media) return
        if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onChange)
        else media.removeListener(onChange)
        media = null
    })

    return readonly(matches)
}
