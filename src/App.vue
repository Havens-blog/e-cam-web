<script setup lang="ts">
// CAM Web 根组件
// Element Plus 默认英文（分页 Total / Go to、日期面板等），统一为中文
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
    <router-view />
    <!-- 错误监控组件（仅开发环境） -->
      <!-- <ErrorMonitor v-if="isDev" /> -->
    </div>
  </el-config-provider>
</template>

<style lang="scss">
// 全局样式重置
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

#app {
  width: 100%;
  height: 100%;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-primary);
  background-color: var(--bg-base);
  transition: color 0.2s ease, background-color 0.2s ease;
}

// 滚动条样式
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 9999px;

  &:hover {
    background: var(--scrollbar-thumb-hover);
  }
}

// Element Plus 全局样式调整
.el-message {
  min-width: 300px;
  z-index: 9999 !important;
  position: fixed !important;
  top: 20px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
}

.el-notification {
  min-width: 330px;
  z-index: 9999 !important;
}

// Element Plus MessageBox 样式修复
.el-message-box {
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  margin: 0 !important;
  z-index: 3000 !important;
}

.el-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 2000 !important;
}
</style>
