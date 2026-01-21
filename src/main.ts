import { createApp } from 'vue'
import App from './App.vue'
import config from './config'
import errorHandler from './plugins/error-handler'
import router from './router'
import pinia from './stores'

// 导入全局样式
import './assets/styles/index.scss'

// 导入 iconfont 图标库
import '../public/iconfont/iconfont.css'; // 字体图标样式
import '../public/iconfont/iconfont.js'; // SVG symbol 定义（彩色图标）

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

// 开发环境日志
if (import.meta.env.DEV) {
    console.log('🚀 CAM Application Started')
    console.log('📦 Version:', config.app.version)
    console.log('🌍 Environment:', import.meta.env.MODE)
    console.log('🔗 API Base URL:', config.api.baseURL)
}

// 挂载应用
app.mount('#app')
