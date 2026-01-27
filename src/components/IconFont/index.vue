<template>
  <!-- 使用 SVG symbol 方式显示彩色图标 -->
  <svg v-if="useColorIcon" :class="['icon-svg', iconClass]" :style="svgStyle" aria-hidden="true">
    <use :xlink:href="`#${iconClass}`"></use>
  </svg>
  <!-- 使用字体图标方式显示单色图标 -->
  <i v-else :class="['iconfont', iconClass]" :style="iconStyle"></i>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  type: string
  size?: number | string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  color: 'currentColor'
})

// 彩色图标列表（使用 SVG symbol 方式）
const colorIcons = [
  'Alibaba_Cloud',
  'AWS',
  'Azure',
  'Tencent_Cloud',
  'Huawei_Cloud',
  'Google_Cloud_Platform',
  'UCloud',
  'JDCloud',
  'ECloud',
  'Bytecloud',
  'Nutanix',
  'OpenStack',
  'ZStack',
  'Ctyun',
  // 操作系统彩色图标
  'caise-Linux',
  'caise-Windows',
  'caise-Ubuntu',
  'caise-centos'
]

// 判断是否使用彩色图标
const useColorIcon = computed(() => {
  return colorIcons.includes(props.type)
})

// 不添加 icon- 前缀，因为有些图标类名本身就没有这个前缀
// 例如：Alibaba_Cloud, Azure, Tencent_Cloud 等
const iconClass = computed(() => {
  // 如果已经有 icon- 前缀，直接使用
  if (props.type.startsWith('icon-')) {
    return props.type
  }
  // 如果是特殊的云平台图标（没有 icon- 前缀），直接使用
  if (
    props.type.startsWith('caise-') ||
    props.type.startsWith('ops-') ||
    props.type.startsWith('veops-') ||
    props.type.startsWith('monitor-') ||
    props.type.startsWith('oneterm-') ||
    props.type.startsWith('itsm-') ||
    props.type.startsWith('cmdb-') ||
    props.type.startsWith('ai-') ||
    props.type.startsWith('a-') ||
    props.type.startsWith('Alibaba_') ||
    props.type.startsWith('Tencent_') ||
    props.type.startsWith('Huawei_') ||
    props.type.startsWith('Google_') ||
    colorIcons.includes(props.type)
  ) {
    return props.type
  }
  // 其他图标添加 icon- 前缀
  return `icon-${props.type}`
})

// 字体图标样式
const iconStyle = computed(() => ({
  fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size,
  color: props.color
}))

// SVG 图标样式
const svgStyle = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
  fill: props.color === 'currentColor' ? undefined : props.color
}))
</script>

<style scoped>
.iconfont {
  display: inline-block;
  font-style: normal;
  vertical-align: baseline;
  text-align: center;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.icon-svg {
  display: inline-block;
  vertical-align: -0.15em;
  fill: currentColor;
  overflow: hidden;
}
</style>
