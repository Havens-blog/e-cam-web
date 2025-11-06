import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'

// 导入全局样式
import './assets/styles/index.scss'

// 创建应用实例
const app = createApp(App)

// 使用插件
app.use(router)
app.use(pinia)

// 挂载应用
app.mount('#app')
