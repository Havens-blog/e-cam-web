<template>
  <div class="page-container">
    <slot />
  </div>
</template>

<script lang="ts" setup>
// 通用页面容器组件
// 提供统一的页面布局样式和高度处理
</script>

<style lang="scss" scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-base);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
}
</style>
