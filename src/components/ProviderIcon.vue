<template>
  <div class="provider-icon" :class="sizeClass">
    <IconFont v-if="iconName" :type="iconName" :size="iconSize" />
    <span v-else class="provider-text">{{ displayName.charAt(0) }}</span>
  </div>
</template>

<script setup lang="ts">
import IconFont from '@/components/IconFont/index.vue'
import { getProviderConfig } from '@/utils/constants'
import { getProviderIcon } from '@/utils/icon-mapping'
import { computed } from 'vue'

interface Props {
  provider: string
  size?: 'small' | 'medium' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium'
})

const config = computed(() => getProviderConfig(props.provider))
const displayName = computed(() => config.value?.displayName || props.provider || '?')
const sizeClass = computed(() => `provider-icon--${props.size}`)
const iconName = computed(() => {
  if (!props.provider) return ''
  return getProviderIcon(props.provider)
})
const iconSize = computed(() => {
  switch (props.size) {
    case 'small':
      return 16
    case 'large':
      return 24
    default:
      return 20
  }
})


</script>

<style scoped lang="scss">
.provider-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.04);

  &--small {
    width: 20px;
    height: 20px;
    font-size: 12px;
  }

  &--medium {
    width: 24px;
    height: 24px;
    font-size: 14px;
  }

  &--large {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }

  .provider-text {
    font-weight: 600;
    text-transform: uppercase;
  }

  .iconfont {
    font-size: inherit;
  }
}
</style>
