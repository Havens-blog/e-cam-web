<script setup lang="ts">
/**
 * 顶部导航栏（自 src/layouts/MainLayout.vue 抽出）。
 *
 * 【拆分来源与边界】
 * 覆盖原 MainLayout.vue 的模板「顶部导航栏」区块（原 663-761 行，即 <header class="navbar">
 * 整个元素）与其全部 scoped 样式（原 1164-1389 行：.navbar / .navbar-left / .navbar-right /
 * .navbar-search / .platform-nav-trigger / .tenant-selector / .navbar-btn / .user-avatar /
 * .user-name），以及原 script 中只服务于本区块的逻辑：
 * isDarkTheme / toggleTheme / toggleFullscreen / displayName / avatarText / loggingOut /
 * handleUserCommand / breadcrumbs。
 *
 * 【状态归属与 v-model 的由来（关键）】
 * 原模板里本区块有两处**直接写父组件状态**：
 *   @click="showPlatformNav = !showPlatformNav"   （父组件的 PlatformNav 面板要读它）
 *   @click="commandPaletteVisible = true"          （父组件的 CommandPalette 要读它）
 * 一旦本区块成为子组件，直接赋值就是对 prop 赋值，会触发 eslint 的
 * vue/no-mutating-props，破坏本仓 0/0 lint 基线。故二者改为 defineModel 双向绑定，
 * 状态仍由 MainLayout 持有（它才是渲染那两个面板的一方）。
 * model 名刻意沿用原变量名（showPlatformNav / commandPaletteVisible），使模板逐字不变。
 *
 * isCollapsed 是侧边栏与顶部导航栏**共同**读取的状态（侧边栏宽度 + 本处的折叠图标），
 * 故仍归父组件所有，此处只读 + 经 'toggle-collapse' 上报点击。为保持模板逐字一致，
 * 本组件保留同名的本地 toggleSidebar 薄委托。
 */
import TenantSelector from '@/components/TenantSelector.vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import {
  ArrowDown,
  Bell,
  Expand,
  Fold,
  FullScreen,
  Grid,
  Moon,
  Search,
  Sunny
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { menuGroups } from '../menu-config'

// 折叠态：父组件持有（侧边栏也要读），本组件只读
defineProps<{ isCollapsed: boolean }>()

const emit = defineEmits<{ 'toggle-collapse': [] }>()

// 由父组件持有的两个面板开关（见文件头说明：原为直接写父数据，现走 v-model）
const showPlatformNav = defineModel<boolean>('showPlatformNav', { required: true })
const commandPaletteVisible = defineModel<boolean>('commandPaletteVisible', { required: true })

const route = useRoute()
const appStore = useAppStore()
const userStore = useUserStore()

// 折叠按钮：状态在父组件，这里只上报（保留原函数名使模板逐字一致）
const toggleSidebar = () => emit('toggle-collapse')

// 当前登录用户：数据来自 eiam 的 /api/user/profile，经 stores/user-mapper 映射
// （此前 header 里的 "Admin" 与头像 "A" 是硬编码，与实际登录者无关）
const displayName = computed(() => {
  const info = userStore.userInfo
  return info?.displayName || info?.username || '未登录'
})
const avatarText = computed(() => displayName.value.charAt(0).toUpperCase())

// 退出登录进行中，用于防抖与反馈
const loggingOut = ref(false)

/**
 * 用户下拉菜单命令分发。
 *
 * 现有两项都显式带 command（profile / logout）。若未来新增未声明 command 的项，
 * 注意 Element Plus 的 dropdownItemProps 对 command 声明了 `default: () => ({})`，
 * 点击时发出的是一个空对象（{}）而非 undefined——下面用严格相等判断，这类项会被
 * 忽略。注意不要"简化"成 `if (command)`：空对象是 truthy，会误入分支。
 */
async function handleUserCommand(command: string | number | object) {
  // 个人设置：e-cam-web 无个人页，跳转 ecmdb-web 的「个人中心」(/profile/index)。
  // 基址读 VITE_ECMDB_WEB_BASE（ecmdb-web 站点根，过渡期值不变、不受旧登录入口
  // 301 波及），新标签页打开以保留当前 e-cam-web 上下文。注意不得改读登录目标
  // 变量——否则会拼出 /console/login/profile/index 死链（RC#2 拆分旧变量双语义
  // 即为此耦合）。
  if (command === 'profile') {
    const base = (import.meta.env.VITE_ECMDB_WEB_BASE || window.location.origin).replace(/\/$/, '')
    window.open(`${base}/profile/index`, '_blank')
    return
  }
  if (command !== 'logout') return
  // logout() 会 await 一次 POST /api/iam/user/logout，而 eiamAxios 的 timeout 是
  // 15s。若 eiam 响应慢，用户看到的就是"菜单关闭、页面不动"—— 与本次修复前那个
  // "点了没反应"的症状无法区分。故给出即时反馈，并防止重复点击。
  if (loggingOut.value) return
  loggingOut.value = true
  // duration: 0 表示不自动关闭（element-plus 的 startTimer 对 duration === 0 直接
  // return）。默认 3s 会在上述 15s 超时窗口内提前消失，使页面再度陷入静默；该提示
  // 应当一直留到页面跳转把它连同整个文档一起卸载。
  ElMessage.info({ message: '正在退出登录…', duration: 0 })
  // logout() 内部无论接口成功与否都会清理本地状态并跳转，故无需复位 loggingOut
  await userStore.logout()
}

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

// 切换主题
const toggleTheme = () => {
  appStore.toggleTheme()
}

// 全屏切换
const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

// 面包屑数据
// （与拆分前逐字一致：result 以「首页」为前缀种子，首页不做提前 return，
//  未匹配路由靠 result.length === 1 的 meta.title 分支兜底。）
const breadcrumbs = computed(() => {
  const result: { title: string; path?: string }[] = [
    { title: '首页', path: '/dashboard' }
  ]
  
  const path = route.path
  
  // 查找当前菜单组和菜单项
  for (const group of menuGroups) {
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
</script>

<template>
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

      <!-- 平台导航 -->
      <div 
        class="platform-nav-trigger" 
        :class="{ active: showPlatformNav }"
        @click="showPlatformNav = !showPlatformNav"
      >
        <el-icon :size="14"><Grid /></el-icon>
        <span>平台导航</span>
        <el-icon :size="12" class="trigger-arrow"><ArrowDown /></el-icon>
      </div>

      <!-- 全局搜索入口（打开 ⌘K 命令面板，恢复原 header 搜索框的可见入口） -->
      <div
        class="navbar-search"
        title="全局搜索 (Ctrl+K)"
        @click="commandPaletteVisible = true"
      >
        <el-icon :size="16"><Search /></el-icon>
        <span>搜索</span>
        <kbd class="navbar-search__kbd">Ctrl K</kbd>
      </div>
    </div>

    <div class="navbar-right">
      <!-- 租户选择 -->
      <div class="tenant-selector">
        <TenantSelector />
      </div>

      <!-- 主题切换 -->
      <div 
        class="navbar-btn" 
        :style="{ color: isDarkTheme ? 'var(--text-tertiary)' : 'var(--text-regular)' }"
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
        :style="{ color: isDarkTheme ? 'var(--text-tertiary)' : 'var(--text-regular)' }"
        title="全屏" 
        @click="toggleFullscreen"
      >
        <el-icon :size="18"><FullScreen /></el-icon>
      </div>
      
      <!-- 通知 -->
      <div 
        class="navbar-btn has-badge" 
        :style="{ color: isDarkTheme ? 'var(--text-tertiary)' : 'var(--text-regular)' }"
        title="通知"
      >
        <el-icon :size="18"><Bell /></el-icon>
        <span class="badge">3</span>
      </div>
      
      <!-- 用户 -->
      <el-dropdown trigger="click" @command="handleUserCommand">
        <div class="user-avatar" title="用户菜单" aria-label="用户菜单">
          <span aria-hidden="true">{{ avatarText }}</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">个人设置</el-dropdown-item>
            <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <span class="user-name">{{ displayName }}</span>
    </div>
  </header>
</template>

<style lang="scss" scoped>
// SCSS 变量原在 MainLayout.vue 的 scoped 块顶部统一声明；拆分后本组件只用
// $navbar-height，故就地声明，避免为一个常量引入跨文件 SCSS 依赖。
$navbar-height: 56px;

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
        /* 原用 --text-muted，在导航底上仅 2.46:1（AA 需 4.5）→ 改次文字色，实测 5.86:1 */
        color: var(--text-secondary);
        font-weight: 400;
        font-size: 13px;
        
        &:hover {
          color: var(--text-primary);
        }

        &.is-link {
          /* 原用 --text-tertiary，仅 3.30:1 → 改次文字色，实测 5.86:1 */
          color: var(--text-secondary);
          
          &:hover {
            color: var(--text-primary);
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

.navbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.navbar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 240px;
  height: 34px;
  padding: 0 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 150ms ease;
  user-select: none;
  flex-shrink: 0;

  &:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
    background: var(--bg-hover);
  }

  .navbar-search__kbd {
    margin-left: auto;
    padding: 2px 6px;
    border: 1px solid var(--border-base);
    border-radius: 4px;
    font-size: 11px;
    line-height: 1.4;
    /* --text-tertiary 仅 3.30:1（AA 需 4.5）→ 次文字色 */
    color: var(--text-secondary);
    font-family: inherit;
  }
}

.platform-nav-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  height: 30px;
  background: color-mix(in srgb, var(--accent-primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-blue);
  cursor: pointer;
  transition: all 150ms ease;
  user-select: none;
  flex-shrink: 0;

  &:hover,
  &.active {
    background: color-mix(in srgb, var(--accent-primary) 14%, transparent);
    border-color: color-mix(in srgb, var(--accent-primary) 35%, transparent);
  }

  .trigger-arrow {
    transition: transform 200ms ease;
  }

  &.active .trigger-arrow {
    transform: rotate(180deg);
  }
}

.tenant-selector {
  margin-right: 8px;

  :deep(.el-select) {
    .el-input__wrapper {
      background: var(--bg-hover);
      border: 1px solid var(--border-subtle);
      box-shadow: none;

      &:hover {
        border-color: var(--border-base);
      }
    }

    .el-input__inner {
      color: var(--text-secondary);
    }
  }
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
</style>
