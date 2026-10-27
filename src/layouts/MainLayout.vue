<script setup lang="ts">
/**
 * 应用外壳（App Shell）。
 *
 * 【大文件拆分后的职责】
 * 原 1475 行的巨型 SFC 已拆为三个文件：
 *   - ./components/AppSidebar.vue  左侧边栏（Logo / 菜单树 / 三级 flyout / 底部设置）+ 其样式
 *                                   （含 Teleport 到 body 的 flyout 所需的**非 scoped** 全局块）
 *   - ./components/TopNavBar.vue   顶部导航栏（折叠按钮 / 面包屑 / 平台导航入口 / 搜索入口 /
 *                                   租户 / 主题 / 全屏 / 通知 / 用户下拉）+ 其样式
 *   - ./menu-config.ts             菜单树数据与类型（侧边栏与顶部导航栏共用）
 * 本文件只保留：外壳骨架（.layout-wrapper / .main-area / .main-content）、两个面板的
 * 挂载与编排（PlatformNav / CommandPalette）、router-view，以及三者共享的少量状态。
 *
 * 【为什么用显式 import 而不是依赖自动注册】
 * 本仓 unplugin-vue-components 未配置 dirs，其默认目录是 src/components ——本目录
 * （src/layouts/components）不在其内。且 vitest 只挂了 @vitejs/plugin-vue、没有
 * unplugin，自动注册在测试中不存在。故新组件必须显式 import，否则测试里会渲染成
 * 未知元素、侧边栏与导航栏直接消失。
 *
 * 【状态归属】
 * - isCollapsed：侧边栏（宽度）与顶部导航栏（折叠图标）共同读取，故归外壳持有；
 *   折叠按钮在 TopNavBar 内，经 @toggle-collapse 上报。
 * - showPlatformNav / commandPaletteVisible：由 TopNavBar 的触发器写入，但真正的
 *   消费者是本文件下面的 PlatformNav / CommandPalette 两个面板，故状态留在外壳，
 *   以 v-model 下发给 TopNavBar（原先是子模板直接写父数据）。
 */
import CommandPalette from '@/components/CommandPalette/index.vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isNarrowViewport } from './responsive'
import AppSidebar from './components/AppSidebar.vue'
import TopNavBar from './components/TopNavBar.vue'

const route = useRoute()

// 首帧即按视口决定折叠态，避免窄屏先渲染 220px 再收缩
const isNarrow = ref(
  isNarrowViewport(typeof window !== 'undefined' ? window.innerWidth : 1440)
)
// 侧边栏折叠状态（窄屏初始折叠）
const isCollapsed = ref(isNarrow.value)

// 切换侧边栏（由 TopNavBar 的折叠按钮上报；断点内尊重用户手动选择）
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

// 跨断点时自动折叠/展开：<=768px 折叠为 64px 图标栏，避免 390px 下内容区只剩 122px；
// 769~1024 保持展开，保证图标态下不可达的二级菜单仍可用
const applyViewport = () => {
  const narrow = isNarrowViewport(window.innerWidth)
  if (narrow === isNarrow.value) return
  isNarrow.value = narrow
  isCollapsed.value = narrow
}

onMounted(() => {
  applyViewport()
  window.addEventListener('resize', applyViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', applyViewport)
})

// 平台导航面板开关
const showPlatformNav = ref(false)

// ⌘K 命令面板开关（顶部导航栏的「搜索」入口写它；目标键 Ctrl+K/⌘K 仍可直接唤起）
const commandPaletteVisible = ref(false)
</script>

<template>
  <div class="layout-wrapper">
    <!-- 左侧边栏 -->
    <AppSidebar :is-collapsed="isCollapsed" />

    <!-- 主内容区 -->
    <div class="main-area">
      <!-- 顶部导航栏 -->
      <TopNavBar
        :is-collapsed="isCollapsed"
        v-model:show-platform-nav="showPlatformNav"
        v-model:command-palette-visible="commandPaletteVisible"
        @toggle-collapse="toggleSidebar"
      />

      <!-- 平台导航面板 -->
      <PlatformNav v-model:visible="showPlatformNav" />

      <!-- ⌘K 全局命令面板（替代原 header 简易搜索，Phase 2 任务 7；⌘K/Esc 自管） -->
      <CommandPalette v-model:visible="commandPaletteVisible" />

      <!-- 页面内容 -->
      <main class="main-content">
        <router-view :key="route.fullPath" />
      </main>
    </div>
  </div>
</template>


<style lang="scss" scoped>
// 说明：原文件此处的 $sidebar-width / $sidebar-collapsed-width / $navbar-height 三个
// SCSS 变量已随各自消费者拆走（前两个归 AppSidebar.vue，第三个归 TopNavBar.vue）。
// 本文件剩余的三条规则均不使用它们，故不再声明。

.layout-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: var(--bg-base);
  transition: background-color 0.3s ease;
}

// 主内容区
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

// 主内容
.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
  background: var(--bg-base);
  transition: background-color 0.3s ease;
}

// 窄屏：收紧页面边距，把空间让给内容（配合侧边栏自动折叠）
@media (max-width: 768px) {
  .main-content {
    padding: 12px;
  }
}

</style>
