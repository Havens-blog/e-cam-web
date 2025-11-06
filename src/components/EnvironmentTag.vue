<template>
  <el-tag
    :type="tagType"
    :size="size"
    :effect="effect"
    class="environment-tag"
    :style="{
      backgroundColor: config?.color + '20',
      borderColor: config?.color,
      color: config?.color
    }"
  >
    <i v-if="showIcon && config?.icon" :class="config.icon" class="iconfont tag-icon" />
    <span>{{ config?.displayName || environment }}</span>
  </el-tag>
</template>

<script setup lang="ts">
import { getEnvironmentConfig } from '@/utils/constants'
import { computed } from 'vue'

interface Props {
  environment: string
  size?: 'large' | 'default' | 'small'
  effect?: 'dark' | 'light' | 'plain'
  showIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  effect: 'light',
  showIcon: false
})

const config = computed(() => getEnvironmentConfig(props.environment))

const tagType = computed(() => {
  switch (props.environment) {
    case 'production':
    case 'prod':
      return 'danger'
    case 'staging':
    case 'test':
      return 'warning'
    case 'development':
    case 'dev':
      return 'success'
    default:
      return 'info'
  }
})
</script>

<style scoped lang="scss">
.environment-tag {
  .tag-icon {
    margin-right: 4px;
    font-size: 12px;
  }
}
</style>
