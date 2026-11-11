<template>
  <main class="error-page" role="alert" aria-live="polite" aria-labelledby="error-title">
    <div class="error-content">
      <p class="error-code" aria-hidden="true">404</p>
      <h1 id="error-title" class="error-message">页面不存在</h1>
      <p class="error-description">抱歉，您访问的页面不存在或已被删除</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </main>
</template>

<script setup lang="ts">
/**
 * 404 页（未匹配路由的兜底目标，`routes.ts` 的 `path: '/:pathMatch(.*)*'`）。
 *
 * iter340 修复四类问题（均为实测确认，非推测）：
 *
 * ① **无 `<h1>`**（原页面三个块全是 `<div>`）—— WCAG 1.3.1（信息与关系）与 2.4.1（绕过块）：
 *    读屏用户按标题导航时**找不到这一页的结构**。现改为语义 `h1`（标题即「页面不存在」），
 *    外层用 `<main>` 提供地标。
 *
 * ② **无 `role="alert"` / `aria-live`** —— 路由跳转到本页时读屏**不会主动播报**，
 *    用户不知道发生了什么。现加 `role="alert" aria-live="polite"`。
 *
 * ③ **脱离主题设计体系**（这条最隐蔽）：原样式写死
 *    `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)` + `color: #fff`。
 *    详情页/列表页都跟 `@haven/ui` 令牌随深浅主题切换，**只有这个页面永远是一块紫**。
 *    现改用 `var(--bg-base)` / `var(--text-primary)` / `var(--text-secondary)`，
 *    与 `haven-console`、`e-cmdb-web` 的 404 页一致（三站同一套 token）。
 *
 * ④ **大号 404 数字被读屏重复播报** —— 它只是视觉装饰，正文已有「页面不存在」。
 *    现给 `.error-code` 加 `aria-hidden="true"`，避免读屏先念「四零四」再念标题。
 *
 * **保留的原设计特征**：大号 404 数字、居中版式、返回首页按钮 —— 只换语义与配色来源，
 * 视觉重心不变（本页是路由级整页渲染，仍需 `min-height: 100vh` 铺满）。
 *
 * 另一个值得记的点：本仓 `router/index.ts` 已用 `to.meta.title` 维护 `document.title`，
 * 且 404 路由的 `meta.title` 就是「页面不存在」→ 浏览器标签页显示
 * 「页面不存在 - CAM 多云资产管理」，**这是本仓做得比另外两站好的地方**
 * （另两站标签页只显示「息壤 · 控制台 / CMDB」，从标签页看不出是 404）。此处保留不动。
 */
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/dashboard')
}
</script>

<style scoped lang="scss">
/* 与 haven-console / e-cmdb-web 的 404 页同一套 token（原为写死紫色渐变 + #fff） */
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg-base);
  color: var(--text-primary);
  padding: 16px;
  box-sizing: border-box;
}

.error-content {
  text-align: center;
}

.error-code {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 120px;
  font-weight: 700;
  line-height: 1;
  margin: 0 0 20px;
  color: var(--text-secondary);
  letter-spacing: 4px;
}

.error-message {
  margin: 0 0 16px;
  font-size: 32px;
  font-weight: 600;
  line-height: 1.3;
}

.error-description {
  margin: 0 0 32px;
  font-size: 16px;
  color: var(--text-secondary);
}
</style>
