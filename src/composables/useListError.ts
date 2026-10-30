/**
 * 列表请求的「持久错误态」组合式函数。
 *
 * 背景（真实缺陷，已被连续 5 个页面验证）：列表接口失败时，页面只弹一次 toast 然后清空数据，
 * 表格随即渲染「暂无数据」—— 用户会以为「资源真的不存在」，而真相是「查询失败」。
 * 这两种含义对运维决策完全相反：前者可以不管，后者必须立刻处理。
 *
 * 本项目已确立的模式（#141/#144/#146/#148/#150，逐页迁移了 5 次）是：
 *   失败 → 持久错误态（<ErrorDisplay>）+ 重试；成功 → 清空错误态。
 *
 * 由于同一模式已被复制 5 遍，这里把它收敛成一个组合式函数，让第 6 页不再复制粘贴。
 * 刻意只封装「错误态」这一件事：不接管 loading、分页、数据列表本身，
 * 使已有页面可以逐行迁移，而不必重写 fetchData。
 */
import { ref } from 'vue'
import { handleApiError, type ErrorInfo } from '@/utils/error-handler'

export function useListError() {
    const errorInfo = ref<ErrorInfo | null>(null)

    /** 清空错误态（成功路径 / 手动重试前） */
    function reset() {
        errorInfo.value = null
    }

    /**
     * 执行一次列表请求：
     * - 成功：清空错误态，返回结果
     * - 失败：置 ErrorInfo（供 <ErrorDisplay> 渲染），返回 undefined
     *
     * 调用方用 `if (result === undefined)` 决定是否清空列表与分页，
     * 这样「失败清空数据」的语义仍是显式的，不会藏在封装里。
     */
    async function run<T>(fn: () => Promise<T>, fallbackMessage: string): Promise<T | undefined> {
        try {
            const result = await fn()
            errorInfo.value = null
            return result
        } catch (e) {
            errorInfo.value = handleApiError(e, fallbackMessage)
            return undefined
        }
    }

    return { errorInfo, run, reset }
}
