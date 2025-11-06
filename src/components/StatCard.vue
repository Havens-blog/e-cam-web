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
  transition: all 0.3s ease;

  &.clickable {
    cursor: pointer;

    &:hover {
      box-shadow:
        0 10px 15px -3px rgba(0, 0, 0, 0.1),
        0 4px 6px -2px rgba(0, 0, 0, 0.05);
      transform: translateY(-2px);
    }
  }

  .stat-content {
    display: flex;
    gap: calc(1rem + 0.2vw);
    align-items: center;

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(3rem + 0.5vw);
      height: calc(3rem + 0.5vw);
      border-radius: calc(0.5rem + 0.1vw);
      color: white;
      font-size: calc(1.5rem + 0.3vw);
      flex-shrink: 0;
    }

    .stat-info {
      flex: 1;
      min-width: 0;

      .stat-title {
        font-size: calc(0.7rem + 0.1vw);
        color: #6b7280;
        margin-bottom: calc(0.3rem + 0.05vw);
        font-weight: 500;
      }

      .stat-value {
        font-size: calc(1.5rem + 0.4vw);
        font-weight: 700;
        color: #1f2937;
        line-height: 1.2;

        .stat-suffix {
          font-size: calc(0.8rem + 0.15vw);
          font-weight: 400;
          color: #6b7280;
          margin-left: calc(0.2rem + 0.05vw);
        }
      }

      .stat-subtitle {
        font-size: calc(0.65rem + 0.1vw);
        color: #9ca3af;
        margin-top: calc(0.2rem + 0.05vw);
      }
    }
  }
}
</style>
