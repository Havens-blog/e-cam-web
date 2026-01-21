<template>
  <el-tag
    :type="tagType"
    :size="size"
    :effect="effect"
    :closable="closable"
    :disable-transitions="disableTransitions"
    :hit="hit"
    :color="customColor"
    :round="round"
    @close="$emit('close')"
    @click="$emit('click')"
  >
    <div class="cloud-platform-tag-content">
      <ProviderIcon
        v-if="showIcon"
        :provider="provider"
        :size="providerIconSize"
        class="tag-icon"
      />
      <span class="tag-text">{{ displayText }}</span>
    </div>
  </el-tag>
</template>

<script setup lang="ts">
import type { CloudProvider } from '@/api/types/iam'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { getProviderLabel } from '@/utils/constants'
import { computed } from 'vue'

interface Props {
  provider: CloudProvider
  size?: 'large' | 'default' | 'small'
  type?: 'success' | 'info' | 'warning' | 'danger' | ''
  effect?: 'dark' | 'light' | 'plain'
  closable?: boolean
  disableTransitions?: boolean
  hit?: boolean
  color?: string
  round?: boolean
  showIcon?: boolean
  showLabel?: boolean
  customText?: string
}

interface Emits {
  (e: 'close'): void
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  type: '',
  effect: 'light',
  closable: false,
  disableTransitions: false,
  hit: false,
  round: false,
  showIcon: true,
  showLabel: true
})

defineEmits<Emits>()

// 根据云平台自动设置标签类型
const tagType = computed(() => {
  if (props.type) return props.type
  
  const typeMap: Record<CloudProvider, 'success' | 'info' | 'warning' | 'danger'> = {
    aliyun: 'warning',
    aws: 'danger',
    azure: 'info',
    tencent: 'success',
    huawei: 'info'
  }
  
  return typeMap[props.provider] || 'info'
})

// 自定义颜色
const customColor = computed(() => {
  if (props.color) return props.color
  
  const colorMap: Record<CloudProvider, string> = {
    aliyun: '#FF6A00',
    aws: '#FF9900',
    azure: '#0078D4',
    tencent: '#006EFF',
    huawei: '#C00000'
  }
  
  return colorMap[props.provider] || ''
})

// 显示文本
const displayText = computed(() => {
  if (props.customText) return props.customText
  if (props.showLabel) return getProviderLabel(props.provider)
  return ''
})

// ProviderIcon 组件的 size 属性
const providerIconSize = computed((): 'small' | 'medium' | 'large' => {
  const sizeMap: Record<string, 'small' | 'medium' | 'large'> = {
    large: 'large',
    default: 'medium',
    small: 'small'
  }
  return sizeMap[props.size] || 'medium'
})
</script>

<style scoped lang="scss">
.cloud-platform-tag-content {
  display: flex;
  align-items: center;
  gap: 4px;
  
  .tag-icon {
    display: flex;
    align-items: center;
  }
  
  .tag-text {
    line-height: 1;
  }
}

:deep(.el-tag) {
  cursor: pointer;
  transition: all 0.3s;
  
  &:hover {
    opacity: 0.8;
  }
}
</style>
