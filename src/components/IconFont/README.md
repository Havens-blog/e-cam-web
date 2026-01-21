# IconFont 图标组件

从 cmdb-ui 项目集成的图标库，支持字体图标和彩色 SVG 图标两种渲染方式。

## 使用方法

```vue
<template>
  <div>
    <!-- 基础使用（字体图标） -->
    <IconFont type="file" />

    <!-- 自定义大小 -->
    <IconFont type="folder1" :size="24" />

    <!-- 自定义颜色 -->
    <IconFont type="auto" color="#1890ff" />

    <!-- 云平台彩色图标（SVG） -->
    <IconFont type="Alibaba_Cloud" :size="32" />
    <IconFont type="AWS" :size="32" />
    <IconFont type="Azure" :size="32" />
  </div>
</template>

<script setup lang="ts">
import IconFont from "@/components/IconFont/index.vue";
</script>
```

## 可用图标

图标列表请查看 `/public/iconfont/demo_index.html`

## Props

| 参数  | 说明                            | 类型             | 默认值         |
| ----- | ------------------------------- | ---------------- | -------------- |
| type  | 图标类型（不需要 `icon-` 前缀） | string           | -              |
| size  | 图标大小                        | number \| string | 16             |
| color | 图标颜色                        | string           | 'currentColor' |

## 彩色图标

以下云平台图标会自动使用彩色 SVG 渲染，保留原始的彩色设计：

- `Alibaba_Cloud` - 阿里云（橙色）
- `AWS` - 亚马逊云（橙色）
- `Azure` - 微软云（蓝色）
- `Tencent_Cloud` - 腾讯云（蓝色）
- `Huawei_Cloud` - 华为云（红色）
- `Google_Cloud_Platform` - 谷歌云（多色）
- `UCloud` - UCloud
- `JDCloud` - 京东云
- `ECloud` - 天翼云
- `Bytecloud` - 火山引擎
- `Nutanix` - Nutanix
- `OpenStack` - OpenStack
- `ZStack` - ZStack
- `Ctyun` - 天翼云

**注意**：彩色图标不受 `color` 属性影响，会保持原始颜色。

## 注意事项

1. **图标渲染方式**：

   - 云平台图标：使用 SVG symbol 方式渲染（彩色）
   - 其他图标：使用字体图标方式渲染（单色，可自定义颜色）

2. **type 属性**：

   - 云平台图标直接使用名称（如 `Alibaba_Cloud`, `AWS`）
   - 其他图标会自动添加 `icon-` 前缀

3. **文件位置**：

   - 图标文件位于 `/public/iconfont/` 目录
   - `iconfont.css` - 字体图标样式
   - `iconfont.js` - SVG symbol 定义（彩色图标）

4. **更新图标库**：
   - 替换 `/public/iconfont/` 目录下的文件
   - 确保同时更新 `.css` 和 `.js` 文件
