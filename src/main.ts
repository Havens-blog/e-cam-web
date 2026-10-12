import { createApp } from 'vue'
import App from './App.vue'
import config from './config'
import errorHandler from './plugins/error-handler'
import router from './router'
import pinia from './stores'

// Inter Variable 字体（自托管，内网可用；Linear 规格要求 Inter Variable + cv01/ss03）
import '@fontsource-variable/inter'

// 导入全局样式
import './assets/styles/index.scss'

// 导入 iconfont 图标库（资源已移出 public/：字体图标走 iconfont.css，彩色图标走
// 精简后的 SVG sprite。彩色 sprite 由 scripts/trim-iconfont.mjs 从 scripts/iconfont-source
// 生成——只保留 caise-* 与 colorIcons 白名单 symbol；css/字体经 Vite 处理只发一份
// 带 hash 产物，demo_index.html/iconfont.json 不再上线）
import '@/assets/iconfont/iconfont.css'; // 字体图标样式（菜单/按钮等首屏必需，保持静态）

// SVG sprite 异步分包：iconfont.js（~430KB）不再打进首屏 entry（raw 510KB→~80KB）。
// 动态 import 放在最前，fetch 与应用启动并行。注入安全性：iconfont.js 的 IIFE 在
// document.readyState 为 interactive/complete 时走 setTimeout 立即注入（已在产物中
// 核实），动态加载后 <use xlink:href="#id"> 照常解析；空引用阶段仅图标短暂不可见，
// IconFont 组件 :style 定宽高，无布局抖动；彩色图标集中在数据列表区，API 返回前
// sprite 几乎必已注入。
void import('@/assets/iconfont/iconfont.js').catch((err) => {
  // 生产构建 drop console（vite.config esbuild.drop），此日志仅开发期可见
  console.warn('[iconfont] SVG sprite 异步加载失败，彩色图标暂不可用:', err)
})

// 导入全局组件
import IconFont from './components/IconFont/index.vue'

// 创建应用实例
const app = createApp(App)

// 注册全局组件
app.component('IconFont', IconFont)

// 全局配置
app.config.globalProperties.$config = config

// 性能监控（仅开发环境）
if (import.meta.env.DEV) {
    app.config.performance = true
}

// 使用插件
app.use(pinia)
app.use(router)
app.use(errorHandler)

// 初始化应用状态
import { useAppStore, useUserStore } from './stores'
const appStore = useAppStore()
const userStore = useUserStore()
appStore.initAppState()
userStore.initUserState()

// 设置应用标题
document.title = config.app.title

// 挂载应用
app.mount('#app')
