<script setup lang="ts">
import IconFont from '@/components/IconFont/index.vue'
import { useAppStore } from '@/stores/app'
import {
  ArrowDown,
  ArrowRight,
  Bell,
  Expand,
  Fold,
  FullScreen,
  Moon,
  Search,
  Sunny
} from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()

// 搜索关键词
const searchKeyword = ref('')

// 侧边栏折叠状态
const isCollapsed = ref(false)

// 当前主题 - 使用 store 的 theme 值判断
const isDarkTheme = computed(() => {
  const currentTheme = appStore.theme
  if (currentTheme === 'auto') {
    // 检测系统主题
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return true
  }
  return currentTheme === 'dark'
})

// 切换侧边栏
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

// 切换主题
const toggleTheme = () => {
  console.log('Theme button clicked, current theme:', appStore.theme)
  appStore.toggleTheme()
  console.log('After toggle, theme:', appStore.theme)
}

// 菜单项接口
interface MenuItem {
  key: string
  title: string
  icon?: string
  path?: string
  children?: MenuItem[]
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

// 展开的子菜单 - 默认展开资产列表
const expandedMenus = ref<string[]>(['assets'])

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

// 菜单配置
const menuGroups = ref<MenuGroup[]>([
  {
    title: '概览',
    items: [
      { key: 'dashboard', path: '/dashboard', title: '仪表盘', icon: 'ops-oneterm-dashboard' },
    ]
  },
  {
    title: '资源管理',
    items: [
      { 
        key: 'assets', 
        title: '资产列表', 
        icon: 'caise-public_cloud',
        children: [
          { 
            key: 'assets-host', 
            title: '主机',
            icon: 'caise-computer',
            children: [
              { key: 'assets-vm', path: '/assets/instances/cloud_vm', title: '虚拟机' },
            ]
          },
          { 
            key: 'assets-storage', 
            title: '存储',
            icon: 'caise-storage_device',
          },
          { 
            key: 'assets-network', 
            title: '网络',
            icon: 'caise-network_devices',
          },
          { 
            key: 'assets-database', 
            title: '数据库',
            icon: 'caise-database',
          },
          { 
            key: 'assets-middleware', 
            title: '中间件',
            icon: 'caise-middleware',
          },
          { 
            key: 'assets-service', 
            title: '容器服务',
            icon: 'caise-service',
          },
        ]
      },
    ]
  },
  {
    title: '运维',
    items: [
      { key: 'tasks', path: '/tasks', title: '任务管理', icon: 'quick_commands' },
      { key: 'cost', path: '/cost', title: '成本分析', icon: 'monitor-healing' },
    ]
  },
  {
    title: 'CMDB',
    items: [
      { key: 'cmdb-models', path: '/cmdb/models', title: '资源模型', icon: 'caise-database' },
      { key: 'cmdb-instances', path: '/cmdb/instances', title: '资源实例', icon: 'caise-computer' },
      { key: 'cmdb-relations', path: '/cmdb/relations', title: '模型关系', icon: 'veops-switch' },
      { key: 'cmdb-topology', path: '/cmdb/topology', title: '拓扑视图', icon: 'caise-network_devices' },
    ]
  },
  {
    title: '服务树',
    items: [
      { key: 'service-tree', path: '/service-tree', title: '服务树', icon: 'veops-switch' },
      { key: 'service-tree-envs', path: '/service-tree/environments', title: '环境管理', icon: 'ops-setting-security' },
      { key: 'service-tree-rules', path: '/service-tree/rules', title: '绑定规则', icon: 'file' },
    ]
  },
  {
    title: '安全',
    items: [
      { 
        key: 'security', 
        title: '认证与安全', 
        icon: 'ops-setting-security',
        children: [
          { key: 'users', path: '/iam/users', title: '用户管理', icon: 'ops-oneterm-authorization' },
          { key: 'groups', path: '/iam/groups', title: '用户组管理', icon: 'veops-group' },
          { key: 'templates', path: '/iam/templates', title: '策略模板', icon: 'file' },
          { key: 'accounts', path: '/accounts', title: '云账号管理', icon: 'caise-public_cloud' },
          { key: 'tenants', path: '/iam/tenants', title: '租户管理', icon: 'veops-company' },
          { key: 'sync', path: '/iam/sync', title: '同步任务', icon: 'veops-switch' },
          { key: 'audit', path: '/iam/audit', title: '审计日志', icon: 'ops-itsm-logs' },
        ]
      },
    ]
  },
])

// 当前激活的菜单
const activeMenuKey = computed(() => {
  const path = route.path
  
  // 收集所有菜单项并按路径长度排序（更长的路径优先匹配）
  const allItems: { key: string; path: string }[] = []
  
  for (const group of menuGroups.value) {
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

// 面包屑数据
const breadcrumbs = computed(() => {
  const result: { title: string; path?: string }[] = [
    { title: '首页', path: '/dashboard' }
  ]
  
  const path = route.path
  
  // 查找当前菜单组和菜单项
  for (const group of menuGroups.value) {
    for (const item of group.items) {
      // 检查子菜单
      if (item.children) {
        for (const child of item.children) {
          // 检查三级菜单
          if (child.children) {
            for (const grandChild of child.children) {
              if (grandChild.path && (path === grandChild.path || path.startsWith(grandChild.path + '/'))) {
                if (group.title !== '概览') {
                  result.push({ title: group.title })
                }
                result.push({ title: item.title })
                result.push({ title: child.title })
                result.push({ title: grandChild.title, path: grandChild.path })
                return result
              }
            }
          }
          // 二级菜单
          if (child.path && (path === child.path || path.startsWith(child.path + '/'))) {
            if (group.title !== '概览') {
              result.push({ title: group.title })
            }
            result.push({ title: item.title })
            result.push({ title: child.title, path: child.path })
            return result
          }
        }
      }
      // 检查普通菜单项
      if (item.path && (path === item.path || path.startsWith(item.path + '/'))) {
        if (group.title !== '概览') {
          result.push({ title: group.title })
        }
        result.push({ title: item.title, path: item.path })
        return result
      }
    }
  }
  
  // 如果有路由 meta.title，使用它
  if (route.meta?.title && result.length === 1) {
    result.push({ title: route.meta.title as string })
  }
  
  return result
})

// 菜单点击
const handleMenuClick = (item: MenuItem) => {
  if (item.path) {
    router.push(item.path)
  }
}

// 全屏切换
const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}
</script>

<template>
  <div class="layout-wrapper">
    <!-- 左侧边栏 -->
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <!-- Logo -->
      <div class="sidebar-logo" @click="router.push('/dashboard')">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3b82f6"/>
            <path d="M2 17L12 22L22 17" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span v-if="!isCollapsed" class="logo-text">CloudMux</span>
      </div>

      <!-- 菜单 -->
      <nav class="sidebar-nav">
        <div v-for="group in menuGroups" :key="group.title" class="menu-group">
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

    <!-- 主内容区 -->
    <div class="main-area">
      <!-- 顶部导航栏 -->
      <header class="navbar">
        <div class="navbar-left">
          <!-- 折叠按钮 -->
          <div class="toggle-btn" @click="toggleSidebar">
            <el-icon :size="20">
              <Fold v-if="!isCollapsed" />
              <Expand v-else />
            </el-icon>
          </div>
          
          <!-- 面包屑 -->
          <el-breadcrumb separator="/">
            <el-breadcrumb-item 
              v-for="(item, index) in breadcrumbs" 
              :key="index"
              :to="item.path ? { path: item.path } : undefined"
            >
              {{ item.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>

          <!-- 搜索框 -->
          <div class="search-box">
            <el-icon class="search-icon"><Search /></el-icon>
            <input 
              v-model="searchKeyword" 
              type="text" 
              placeholder="请输入关键词..." 
              class="search-input"
            />
            <div class="search-shortcut">⌘ K</div>
          </div>
        </div>

        <div class="navbar-right">
          <!-- 主题切换 -->
          <div 
            class="navbar-btn" 
            :style="{ color: isDarkTheme ? 'var(--text-tertiary)' : '#333333' }"
            :title="isDarkTheme ? '切换到浅色模式' : '切换到深色模式'" 
            @click="toggleTheme"
          >
            <el-icon :size="18">
              <Moon v-if="isDarkTheme" />
              <Sunny v-else />
            </el-icon>
          </div>
          
          <!-- 全屏 -->
          <div 
            class="navbar-btn" 
            :style="{ color: isDarkTheme ? 'var(--text-tertiary)' : '#333333' }"
            title="全屏" 
            @click="toggleFullscreen"
          >
            <el-icon :size="18"><FullScreen /></el-icon>
          </div>
          
          <!-- 通知 -->
          <div 
            class="navbar-btn has-badge" 
            :style="{ color: isDarkTheme ? 'var(--text-tertiary)' : '#333333' }"
            title="通知"
          >
            <el-icon :size="18"><Bell /></el-icon>
            <span class="badge">3</span>
          </div>
          
          <!-- 用户 -->
          <el-dropdown trigger="click">
            <div class="user-avatar">
              <span>A</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>个人设置</el-dropdown-item>
                <el-dropdown-item divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          
          <span class="user-name">Admin</span>
        </div>
      </header>

      <!-- 页面内容 -->
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>


<style lang="scss" scoped>
$sidebar-width: 220px;
$sidebar-collapsed-width: 64px;
$navbar-height: 56px;

.layout-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: var(--bg-base);
  transition: background-color 0.3s ease;
}

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

  .logo-text {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  &:hover {
    .logo-text {
      color: var(--accent-blue);
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
    color: var(--text-secondary);
  }

  .menu-title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--text-regular);
    flex: 1;
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
    background: rgba(59, 130, 246, 0.15);

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
      transition: all 150ms ease;
    }

    .submenu-title {
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
      flex: 1;
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
      background: rgba(59, 130, 246, 0.1);

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

// 三级子菜单
.submenu-level3 {
  overflow: hidden;

  .submenu-item.level3 {
    padding-left: 62px;
    height: 32px;

    .submenu-line {
      width: 12px;
      height: 1px;
      background: var(--border-base);
      flex-shrink: 0;
    }

    .submenu-title {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    &:hover {
      background: var(--bg-hover);

      .submenu-line {
        background: var(--text-secondary);
      }

      .submenu-title {
        color: var(--text-secondary);
      }
    }

    &.active {
      background: rgba(59, 130, 246, 0.08);

      .submenu-line {
        background: var(--accent-blue);
        width: 16px;
      }

      .submenu-title {
        color: var(--accent-blue);
        font-weight: 500;
      }
    }
  }
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

// 主内容区
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

// 顶部导航栏
.navbar {
  height: $navbar-height;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  gap: 20px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;

  .toggle-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-secondary);
    }
  }

  :deep(.el-breadcrumb) {
    flex-shrink: 0;
    
    .el-breadcrumb__item {
      .el-breadcrumb__inner {
        color: var(--text-muted);
        font-weight: 400;
        font-size: 13px;
        
        &:hover {
          color: var(--text-secondary);
        }

        &.is-link {
          color: var(--text-tertiary);
          
          &:hover {
            color: var(--text-secondary);
          }
        }
      }

      &:last-child {
        .el-breadcrumb__inner {
          color: var(--text-secondary);
          font-weight: 500;
        }
      }
    }

    .el-breadcrumb__separator {
      color: var(--text-muted);
    }
  }
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  height: 36px;
  padding: 0 12px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  transition: all 200ms ease;
  flex-shrink: 0;
  margin-left: 8px;

  &:focus-within {
    border-color: var(--border-strong);
    background: var(--bg-surface);
  }

  .search-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--text-primary);

    &::placeholder {
      color: var(--text-muted);
    }
  }

  .search-shortcut {
    padding: 2px 6px;
    background: var(--bg-hover);
    border-radius: 4px;
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.navbar-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 150ms ease;
  position: relative;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.has-badge {
    .badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      background: var(--accent-red);
      border-radius: 8px;
      font-size: 10px;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}

.user-avatar {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  margin-left: 8px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-left: 8px;
}

// 主内容
.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
  background: var(--bg-base);
  transition: background-color 0.3s ease;
}
</style>

<style lang="scss">
// 全局样式 - flyout 弹出菜单 (Teleport 到 body)
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
      background: rgba(59, 130, 246, 0.1);

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
