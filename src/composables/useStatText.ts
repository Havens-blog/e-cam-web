import { ref } from 'vue'

/** 统计未知时的占位符（不是 0 —— 0 是一个具体结论，未知不是） */
export const STAT_UNKNOWN = '—'

/**
 * 统计卡片的「失败即未知」渲染。
 *
 * 背景（真实缺陷，已在 3 个页面复现）：列表页的统计卡由「全量扫描」或独立统计接口算出，
 * 当该请求失败时，卡片会保留初始值 0，而下方表格仍正常显示 N 行 ——
 * 用户看到「总数 0」却有 20 条记录，同一屏两个数字互相矛盾；且提示只有 5 秒的 toast。
 *
 * 语义：统计请求失败 ⇒ 这个数字是**未知**，不是 0。用「—」表达未知，
 * 正常时仍渲染原数字，不改变任何成功路径的行为。
 */
export function useStatText() {
    const statsFailed = ref(false)

    /** 失败时置位（调用方在统计请求的 catch 里调用） */
    function markFailed() {
        statsFailed.value = true
    }

    /** 成功时复位（调用方在统计请求成功分支里调用） */
    function markOk() {
        statsFailed.value = false
    }

    /** 渲染用：失败 → 「—」；正常 → 数字字符串 */
    function statText(n: number): string {
        return statsFailed.value ? STAT_UNKNOWN : String(n)
    }

    return { statsFailed, markFailed, markOk, statText }
}
