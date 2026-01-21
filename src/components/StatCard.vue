<template>
  <el-card class="stat-card" :class="{ clickable: clickable }" @click="handleClick">
    <div class="stat-content">
      <div class="stat-icon" :style="{ background: iconColor }">
        <component :is="iconComponent" />
      </div>
      <div class="stat-info">
        <div class="stat-title">{{ title }}</div>
        <div class="stat-value">
          {{ displayValue }}
          <span v-if="suffix" class="stat-suffix">{{ suffix }}</span>
        </div>
        <div v-if="subtitle" class="stat-subtitle">{{ subtitle }}</div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { formatNumber } from '@/utils/formatters'
import { Box, Clock, Money, User } from '@element-plus/icons-vue'
import { computed } from 'vue'

interface Props {
  title: string
  value: string | number
  icon?: string
  iconColor?: string
  suffix?: string
  subtitle?: string
  clickable?: boolean
  formatValue?: boolean
}

interface Emits {
  (e: 'click'): void
}

const props = withDefaults(defineProps<Props>(), {
  icon: 'Box',
  iconColor: '#3B82F6',
  clickable: false,
  formatValue: true
})

const emit = defineEmits<Emits>()

const iconMap: Record<string, any> = {
  Box,
  Money,
  User,
  Clock
}

const iconComponent = computed(() => iconMap[props.icon] || Box)

const displayValue = computed(() => {
  if (typeof props.value === 'number' && props.formatValue) {
    return formatNumber(props.value)
  }
  return props.value
})

const handleClick = () => {
  if (props.clickable) {
    emit('click')
  }
}
</script>

<style scoped lang="scss">
.stat-card {
  height: 100%;
  transition: all 200ms ease;
  background: var(--glass-bg) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border) !important;
  border-radius: 12px !important;
  box-shadow: var(--shadow-base) !important;

  &.clickable {
    cursor: pointer;

    &:hover {
      background: var(--glass-bg-hover) !important;
      border-color: var(--border-strong) !important;
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg) !important;
    }
  }

  .stat-content {
    display: flex;
    gap: 16px;
    align-items: center;

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      color: white;
      font-size: 24px;
      flex-shrink: 0;
    }

    .stat-info {
      flex: 1;
      min-width: 0;

      .stat-title {
        font-size: 13px;
        color: var(--text-tertiary);
        margin-bottom: 4px;
        font-weight: 500;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: var(--text-primary);
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;

        .stat-suffix {
          font-size: 14px;
          font-weight: 400;
          color: var(--text-tertiary);
          margin-left: 4px;
        }
      }

      .stat-subtitle {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 4px;
      }
    }
  }
}
</style>
