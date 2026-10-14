<script setup lang="ts">
/**
 * 应用左侧边栏（自 src/layouts/MainLayout.vue 抽出）。
 *
 * 【拆分来源与边界】
 * 覆盖原 MainLayout.vue 的模板「左侧边栏」区块（原 478-658 行）与其全部 scoped 样式
 * （原 792-1153 行：.sidebar / .sidebar-logo / .sidebar-nav / .menu-group / .menu-item /
 * .submenu / flyout 与 submenu 两组过渡 / .sidebar-footer），以及原文件的**非 scoped
 * 全局样式块**（原 1402-1475 行：.flyout-menu-portal 与 .flyout-* 过渡）。
 *
 * 【为什么全局样式块也搬进来】
 * 三级菜单是 `<Teleport to="body">` 渲染的，scoped 选择器匹配不到，故原文件用一个
 * 非 scoped 块承载它。既然该标记现在归本组件所有，样式随标记走可避免「标记在这里、
 * 样式在别的文件」的隐式跨文件耦合。Vue SFC 允许多个 style 块，本文件保留两个：
 * 一个 scoped（侧边栏自身）、一个全局（Teleport 出去的 flyout）。行为与拆分前一致。
 *
 * 【状态归属】
 * isCollapsed 由父组件 MainLayout 持有（顶部导航栏的折叠按钮与侧边栏宽度都要读它），
 * 以 prop 传入。prop 名刻意沿用原变量名 isCollapsed，使下方模板与拆分前逐字一致。
 *
 * 【菜单数据】
 * menuGroups 已抽到 ../menu-config.ts —— 本组件与 TopNavBar 都要用它（后者据路由
 * 反查面包屑），留在父组件会让父组件无法变薄。
 */
import { IconFont } from '@haven/ui/IconFont'
import { useUserStore } from '@/stores/user'
import { hasCertManageAccess } from '@/utils/cert-permission'
import { ArrowDown, ArrowRight, Setting } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { menuGroups, type MenuGroup, type MenuItem } from '../menu-config'

// 折叠态：父组件持有，本组件只读（折叠按钮在顶部导航栏，不在这里）
defineProps<{ isCollapsed: boolean }>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 展开的子菜单 - 默认展开资产列表
const expandedMenus = ref<string[]>(['assets', 'service-tree'])

// 当前悬停的三级菜单父项
const hoveredFlyout = ref<string | null>(null)
const flyoutPosition = ref({ top: 0, left: 0 })
let flyoutCloseTimer: number | null = null

// 悬停事件处理
const handleFlyoutEnter = (key: string, event: MouseEvent) => {
  // 清除关闭定时器
  if (flyoutCloseTimer) {
    clearTimeout(flyoutCloseTimer)
    flyoutCloseTimer = null
  }
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  flyoutPosition.value = {
    top: rect.top,
    left: rect.right + 4
  }
  hoveredFlyout.value = key
}

const handleFlyoutLeave = () => {
  // 延迟关闭，给用户移动到弹出菜单的时间
  flyoutCloseTimer = window.setTimeout(() => {
    hoveredFlyout.value = null
  }, 150)
}

// 弹出菜单的鼠标事件
const handleFlyoutMenuEnter = (key: string) => {
  if (flyoutCloseTimer) {
    clearTimeout(flyoutCloseTimer)
    flyoutCloseTimer = null
  }
  hoveredFlyout.value = key
}

const handleFlyoutMenuLeave = () => {
  flyoutCloseTimer = window.setTimeout(() => {
    hoveredFlyout.value = null
  }, 100)
}

// 切换子菜单展开状态
const toggleSubMenu = (key: string) => {
  const index = expandedMenus.value.indexOf(key)
  if (index > -1) {
    expandedMenus.value.splice(index, 1)
  } else {
    expandedMenus.value.push(key)
  }
}

// 检查子菜单是否展开
const isMenuExpanded = (key: string) => expandedMenus.value.includes(key)

// 仅渲染层使用：按 requireAdmin && !isAdmin 与 requireCertManage && !certManageAccess 过滤。
// activeMenuKey / 搜索仍用完整 menuGroups（与 requireAdmin 同策略）。
const certManageAccess = computed(() =>
    hasCertManageAccess({ isAdmin: userStore.isAdmin, permissions: userStore.permissions })
)
const visibleMenuGroups = computed<MenuGroup[]>(() => {
    if (userStore.isAdmin) return menuGroups
    const filterItems = (items: MenuItem[]): MenuItem[] =>
        items
            .filter((it) => !it.requireAdmin && (!it.requireCertManage || certManageAccess.value))
            .map((it) =>
                it.children
                    ? { ...it, children: filterItems(it.children) }
                    : it,
            )
    return menuGroups.map((g) => ({ ...g, items: filterItems(g.items) }))
})

// 当前激活的菜单
const activeMenuKey = computed(() => {
  const path = route.path

  // 收集所有菜单项并按路径长度排序（更长的路径优先匹配）
  const allItems: { key: string; path: string }[] = []

  for (const group of menuGroups) {
    for (const item of group.items) {
      if (item.path) {
        allItems.push({ key: item.key, path: item.path })
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.path) {
            allItems.push({ key: child.key, path: child.path })
          }
          if (child.children) {
            for (const grandChild of child.children) {
              if (grandChild.path) {
                allItems.push({ key: grandChild.key, path: grandChild.path })
              }
            }
          }
        }
      }
    }
  }

  // 按路径长度降序排序，确保更具体的路径优先匹配
  allItems.sort((a, b) => b.path.length - a.path.length)

  for (const item of allItems) {
    if (path === item.path || path.startsWith(item.path + '/')) {
      return item.key
    }
  }

  return 'dashboard'
})

// 跨应用菜单前缀：CMDB 已拆分为独立应用 e-cmdb-web（nginx /cmdb/），
// SPA 内 router.push 会命中 404，统一新窗口打开。
const EXTERNAL_APP_PREFIXES = ['/cmdb/']

// 菜单点击
const handleMenuClick = (item: MenuItem) => {
  if (!item.path) return
  if (EXTERNAL_APP_PREFIXES.some((p) => item.path!.startsWith(p))) {
    window.open(item.path, '_blank')
    return
  }
  router.push(item.path)
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed: isCollapsed }">
    <!-- Logo：折叠态显示方块 mark，展开态显示横版 wordmark（息壤 XIRANG CLOUD） -->
    <div class="sidebar-logo" @click="router.push('/dashboard')">
      <div v-if="isCollapsed" class="logo-icon" role="img" aria-label="息壤 Xirang">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <title>息壤 Xirang</title>
          <defs>
            <linearGradient id="xrm-top" x1="8" y1="22" x2="56" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#7170ff"/>
              <stop offset="1" stop-color="#5e6ad2"/>
            </linearGradient>
            <linearGradient id="xrm-sprout" x1="32" y1="34" x2="32" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#7170ff"/>
              <stop offset="1" stop-color="#a5b4fc"/>
            </linearGradient>
          </defs>
          <path d="M8 46 L32 58 L56 46" fill="none" stroke="#5e6ad2" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 40 L32 52 L56 40" fill="none" stroke="#5e6ad2" stroke-opacity="0.75" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M32 22 L56 34 L32 46 L8 34 Z" fill="url(#xrm-top)"/>
          <g stroke="url(#xrm-sprout)" stroke-width="3" stroke-linecap="round" fill="none">
            <path d="M32 34 V14"/>
            <path d="M32 24 L22 17"/>
            <path d="M32 24 L42 17"/>
          </g>
          <circle cx="32" cy="34" r="3.2" fill="#ffffff"/>
          <circle cx="32" cy="11" r="3.6" fill="#a5b4fc"/>
          <circle cx="20" cy="15.5" r="3" fill="#8b93ff"/>
          <circle cx="44" cy="15.5" r="3" fill="#8b93ff"/>
        </svg>
      </div>
      <div v-else class="logo-horizontal" role="img" aria-label="息壤 Xirang">
        <svg viewBox="0 0 260 64" xmlns="http://www.w3.org/2000/svg">
          <title>息壤 Xirang</title>
          <defs>
            <linearGradient id="xrh-top" x1="8" y1="22" x2="56" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#7170ff"/>
              <stop offset="1" stop-color="#5e6ad2"/>
            </linearGradient>
            <linearGradient id="xrh-sprout" x1="32" y1="34" x2="32" y2="6" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#7170ff"/>
              <stop offset="1" stop-color="#a5b4fc"/>
            </linearGradient>
          </defs>
          <path d="M8 46 L32 58 L56 46" fill="none" stroke="#5e6ad2" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 40 L32 52 L56 40" fill="none" stroke="#5e6ad2" stroke-opacity="0.75" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M32 22 L56 34 L32 46 L8 34 Z" fill="url(#xrh-top)"/>
          <g stroke="url(#xrh-sprout)" stroke-width="3" stroke-linecap="round" fill="none">
            <path d="M32 34 V14"/>
            <path d="M32 24 L22 17"/>
            <path d="M32 24 L42 17"/>
          </g>
          <circle cx="32" cy="34" r="3.2" fill="#ffffff"/>
          <circle cx="32" cy="11" r="3.6" fill="#a5b4fc"/>
          <circle cx="20" cy="15.5" r="3" fill="#8b93ff"/>
          <circle cx="44" cy="15.5" r="3" fill="#8b93ff"/>
          <text x="74" y="36" fill="currentColor" font-family="'PingFang SC','Microsoft YaHei','Noto Sans SC','Source Han Sans SC',sans-serif" font-size="28" font-weight="700" letter-spacing="4">息壤</text>
          <text x="75" y="54" fill="#7170ff" font-family="'Inter Variable',Inter,'Segoe UI',Roboto,Arial,sans-serif" font-size="11.5" font-weight="600" letter-spacing="5.2">XIRANG CLOUD</text>
        </svg>
      </div>
    </div>

    <!-- 菜单 -->
    <nav class="sidebar-nav">
      <div v-for="group in visibleMenuGroups" :key="group.title" class="menu-group">
        <div v-if="!isCollapsed" class="group-title">{{ group.title }}</div>
        <template v-for="item in group.items" :key="item.key">
          <!-- 有子菜单的项 -->
          <template v-if="item.children && item.children.length > 0">
            <el-tooltip
              :content="item.title"
              placement="right"
              :disabled="!isCollapsed"
            >
              <div
                class="menu-item has-children"
                :class="{ expanded: isMenuExpanded(item.key) }"
                @click="toggleSubMenu(item.key)"
              >
                <IconFont v-if="item.icon" :type="item.icon" :size="18" class="menu-icon" />
                <span v-if="!isCollapsed" class="menu-title">{{ item.title }}</span>
                <el-icon v-if="!isCollapsed" class="arrow-icon">
                  <ArrowDown v-if="isMenuExpanded(item.key)" />
                  <ArrowRight v-else />
                </el-icon>
              </div>
            </el-tooltip>
            <!-- 子菜单 (二级) -->
            <Transition name="submenu">
              <div v-if="isMenuExpanded(item.key) && !isCollapsed" class="submenu">
                <template v-for="child in item.children" :key="child.key">
                  <!-- 有三级菜单的项 - 悬停弹出 -->
                  <template v-if="child.children && child.children.length > 0">
                    <div
                      class="submenu-item-wrapper"
                      @mouseenter="handleFlyoutEnter(child.key, $event)"
                      @mouseleave="handleFlyoutLeave"
                    >
                      <div
                        class="submenu-item has-flyout"
                        :class="{
                          active: child.children.some((gc: MenuItem) => activeMenuKey === gc.key),
                          'is-hovered': hoveredFlyout === child.key
                        }"
                      >
                        <IconFont v-if="child.icon" :type="child.icon" :size="16" class="submenu-icon" />
                        <span v-else class="submenu-dot"></span>
                        <span class="submenu-title">{{ child.title }}</span>
                        <el-icon class="submenu-arrow"><ArrowRight /></el-icon>
                      </div>
                      <!-- 悬停弹出的三级菜单 - 使用 Teleport 渲染到 body -->
                      <Teleport to="body">
                        <Transition name="flyout">
                          <div
                            v-if="hoveredFlyout === child.key"
                            class="flyout-menu-portal"
                            :style="{ top: flyoutPosition.top + 'px', left: flyoutPosition.left + 'px' }"
                            @mouseenter="handleFlyoutMenuEnter(child.key)"
                            @mouseleave="handleFlyoutMenuLeave"
                          >
                            <div class="flyout-header">{{ child.title }}</div>
                            <div
                              v-for="grandChild in child.children"
                              :key="grandChild.key"
                              class="flyout-item"
                              :class="{ active: activeMenuKey === grandChild.key }"
                              @click.stop="handleMenuClick(grandChild)"
                            >
                              <span class="flyout-title">{{ grandChild.title }}</span>
                            </div>
                          </div>
                        </Transition>
                      </Teleport>
                    </div>
                  </template>
                  <!-- 二级菜单项（无子菜单） -->
                  <template v-else>
                    <div
                      class="submenu-item"
                      :class="{ active: activeMenuKey === child.key }"
                      @click.stop="handleMenuClick(child)"
                    >
                      <IconFont v-if="child.icon" :type="child.icon" :size="16" class="submenu-icon" />
                      <span v-else class="submenu-dot"></span>
                      <span class="submenu-title">{{ child.title }}</span>
                    </div>
                  </template>
                </template>
              </div>
            </Transition>
          </template>
          <!-- 普通菜单项 -->
          <template v-else>
            <el-tooltip
              :content="item.title"
              placement="right"
              :disabled="!isCollapsed"
            >
              <div
                class="menu-item"
                :class="{ active: activeMenuKey === item.key }"
                @click="handleMenuClick(item)"
              >
                <IconFont v-if="item.icon" :type="item.icon" :size="18" class="menu-icon" />
                <span v-if="!isCollapsed" class="menu-title">{{ item.title }}</span>
              </div>
            </el-tooltip>
          </template>
        </template>
      </div>
    </nav>

    <!-- 底部设置 -->
    <div class="sidebar-footer">
      <el-tooltip content="设置" placement="right" :disabled="!isCollapsed">
        <div class="footer-item">
          <el-icon :size="18"><Setting /></el-icon>
        </div>
      </el-tooltip>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
// SCSS 变量原在 MainLayout.vue 的 scoped 块顶部统一声明（$sidebar-width /
// $sidebar-collapsed-width / $navbar-height）。拆分后本组件只用前两个，第三个归
// TopNavBar.vue，故此处按需就地声明，避免为一个常量引入跨文件 SCSS 依赖。
$sidebar-width: 220px;
$sidebar-collapsed-width: 64px;

// 侧边栏
.sidebar {
  width: $sidebar-width;
  height: 100%;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 300ms ease, background-color 0.3s ease, border-color 0.3s ease;
  overflow: visible;
  position: relative;
  z-index: 100;

  &.collapsed {
    width: $sidebar-collapsed-width;

    .sidebar-logo {
      justify-content: center;
      padding: 0;
    }

    .menu-group {
      .group-title {
        display: none;
      }
    }

    .menu-item {
      justify-content: center;
      padding: 0;
      margin: 2px 8px;
    }

    .sidebar-footer {
      justify-content: center;
    }
  }
}

.sidebar-logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-subtle);
  transition: all 200ms ease;

  .logo-icon {
    width: 28px;
    height: 28px;
    flex-shrink: 0;

    svg {
      width: 100%;
      height: 100%;
    }
  }

  // 展开态：横版 wordmark（息壤 XIRANG CLOUD），受 .sidebar-logo 220px 宽约束；
  // 折叠态由 .logo-icon 的方块 mark 承担，此 wrapper 不渲染（v-else）。
  .logo-horizontal {
    max-width: 180px;
    height: auto;
    flex-shrink: 0;
    // 息壤文字 fill=currentColor 跟随此值；XIRANG CLOUD 副标为固定品牌色
    color: var(--text-primary);

    svg {
      width: 100%;
      height: auto;
      display: block;
    }
  }
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: visible;
  padding: 12px 0;
  position: relative;

  // 当有 flyout 时禁用滚动裁剪
  &:has(.flyout-menu) {
    overflow: visible;
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 2px;
  }
}

.menu-group {
  margin-bottom: 8px;
  overflow: visible;

  .group-title {
    padding: 8px 20px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 20px;
  margin: 2px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  color: var(--text-secondary);

  .menu-icon {
    opacity: 0.85;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
  }

  .menu-title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--text-regular);
    flex: 1;
    line-height: 1;
  }

  .arrow-icon {
    font-size: 12px;
    color: var(--text-tertiary);
    transition: transform 200ms ease;
  }

  &.has-children {
    &.expanded .arrow-icon {
      transform: rotate(0deg);
    }
  }

  &:hover {
    background: var(--bg-hover);

    .menu-icon {
      opacity: 1;
      color: var(--text-primary);
    }

    .menu-title {
      color: var(--text-primary);
    }
  }

  &.active {
    background: color-mix(in srgb, var(--accent-primary) 15%, transparent);

    .menu-icon {
      opacity: 1;
      color: var(--accent-blue);
    }

    .menu-title {
      color: var(--accent-blue);
      font-weight: 600;
    }
  }
}

// 子菜单
.submenu {
  overflow: visible !important;
  position: relative;

  .submenu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 20px 0 48px;
    margin: 2px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;

    .submenu-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      opacity: 0.85;
      transition: all 150ms ease;
    }

    .submenu-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--text-tertiary);
      flex-shrink: 0;
      margin: 0 6px;
      transition: all 150ms ease;
    }

    .submenu-title {
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
      flex: 1;
      line-height: 1;
    }

    .submenu-arrow {
      font-size: 10px;
      color: var(--text-muted);
      transition: transform 200ms ease;
    }

    &.has-children {
      .submenu-title {
        color: var(--text-secondary);
      }
    }

    &:hover {
      background: var(--bg-hover);

      .submenu-icon {
        color: var(--text-primary);
        opacity: 1;
      }

      .submenu-dot {
        background: var(--text-primary);
      }

      .submenu-title {
        color: var(--text-primary);
      }
    }

    &.active {
      background: color-mix(in srgb, var(--accent-primary) 10%, transparent);

      .submenu-icon {
        color: var(--accent-blue);
        opacity: 1;
      }

      .submenu-dot {
        background: var(--accent-blue);
        width: 6px;
        height: 6px;
      }

      .submenu-title {
        color: var(--accent-blue);
        font-weight: 500;
      }
    }
  }

  // 悬停弹出菜单容器
  .submenu-item-wrapper {
    position: relative;

    .submenu-item.has-flyout {
      margin: 2px 8px;
      padding: 0 20px 0 48px;

      &.is-hovered {
        background: var(--bg-hover);

        .submenu-icon {
          color: var(--text-primary);
          opacity: 1;
        }

        .submenu-title {
          color: var(--text-primary);
        }
      }
    }
  }
}

// flyout 动画
.flyout-enter-active,
.flyout-leave-active {
  transition: all 200ms ease;
}

.flyout-enter-from,
.flyout-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.flyout-enter-to,
.flyout-leave-from {
  opacity: 1;
  transform: translateX(0);
}

// 子菜单动画 - 不使用 max-height 避免 overflow 问题
.submenu-enter-active,
.submenu-leave-active {
  transition: opacity 200ms ease;
}

.submenu-enter-from,
.submenu-leave-to {
  opacity: 0;
}

.submenu-enter-to,
.submenu-leave-from {
  opacity: 1;
}

.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-subtle);
  display: flex;

  .footer-item {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-secondary);
    }
  }
}
</style>

<style lang="scss">
// 全局样式 - flyout 弹出菜单 (Teleport 到 body)
// 注意：本块**故意不加 scoped**——flyout 被 Teleport 到 body，scoped 选择器匹配不到。
// 原位于 MainLayout.vue 文件末尾的全局块（原 1402-1475 行），随 flyout 标记一并迁入。
.flyout-menu-portal {
  position: fixed;
  min-width: 160px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  padding: 8px 0;
  z-index: 9999;

  .flyout-header {
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 4px;
  }

  .flyout-item {
    display: flex;
    align-items: center;
    height: 36px;
    padding: 0 16px;
    cursor: pointer;
    transition: all 150ms ease;

    .flyout-title {
      font-size: 13px;
      color: var(--text-secondary);
    }

    &:hover {
      background: var(--bg-hover);

      .flyout-title {
        color: var(--text-primary);
      }
    }

    &.active {
      background: color-mix(in srgb, var(--accent-primary) 10%, transparent);

      .flyout-title {
        color: var(--accent-blue);
        font-weight: 500;
      }
    }
  }
}

// flyout 动画
.flyout-enter-active,
.flyout-leave-active {
  transition: all 200ms ease;
}

.flyout-enter-from,
.flyout-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.flyout-enter-to,
.flyout-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style>
