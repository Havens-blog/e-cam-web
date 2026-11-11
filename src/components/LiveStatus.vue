<!--
  供读屏播报的状态区（视觉不可见）。

  背景（iter347 实测）：CAM 的列表页普遍用 `v-loading` 指令 —— 它只渲染视觉遮罩与转圈图标，
  **没有 role="status" / aria-live**，读屏用户完全感知不到「正在加载」与「加载完成」。

  本仓并非完全没有机制：`components/StateBlock/index.vue` 在 loading 分支里有
  `role="status"`（第 11 行）。但它有两个限制：
    ① **只在 loading 时播报**，空态与「共 N 条」不播报 —— 加载结束后读屏仍然是静默的；
    ② 只有 3 个业务文件用它（`DataTable`、`DetailDrawer`、`dashboard`），
       绝大多数列表页**没有走 StateBlock**，而是各自写 table + v-loading。

  所以需要一个**独立、轻量、可嵌在任意页面顶部**的播报组件，与 `e-cmdb-web` 的
  `components/LiveStatus.vue` 同构（同一份语义、同一套视觉隐藏规则），
  让三站对「加载/空/条数播报」用同一个方式表达。

  用法：
    <LiveStatus :text="loading ? '正在加载资产列表…' : `共 ${total} 条`" />

  注意：
    · 文本必须由父组件传入，且**变化时才有播报**；空字符串即静默；
    · **「失败优先」** —— 有错误时先播错误，否则会说「没有数据」，
      与页面上同时显示的错误态自相矛盾（这是 cmdb `models` 页踩过并写进注释的坑）；
    · **非加载态也必须给结论** —— 若只在 loading 时给文本、其余时候返回空字符串，
      live region 就恒为空，读屏什么也听不到（cmdb `organizations` 与 `impact` 都踩过）。
-->
<template>
  <div class="live-status" role="status" aria-live="polite" aria-atomic="true">{{ text }}</div>
</template>

<script setup lang="ts">
defineProps<{
  /** 需要播报的文案；空字符串表示静默 */
  text: string
}>()
</script>

<style scoped>
/* 视觉隐藏但保留在无障碍树中。
   不要用 display:none / visibility:hidden —— 那会把播报一起从无障碍树里删掉。
   本组件自带这份样式，**不依赖全局 `.sr-only`**：实测本仓 `.sr-only` 并无全局定义，
   而 cert/changes 下几处 `class="sr-only"` 因此可能是失效的（各页 scoped 未定义时）。 */
.live-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
