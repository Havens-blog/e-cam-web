<template>
  <div class="stat-card" :class="{ clickable: clickable }" @click="handleClick">
    <div class="stat-icon" :style="{ background: iconTint, color: iconColor }">
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
</template>

<script setup lang="ts">
import { formatNumber } from '@/utils/formatters'
import { Box, Clock, Connection, CircleCheck, Coin, DataLine, Money, User } from '@element-plus/icons-vue'
import { computed, type Component } from 'vue'

interface Props {
    title: string
    value: string | number
    icon?: string
    /** 图标主色(十六进制),芯片底色自动取其 14% 透明度 */
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
    iconColor: '#3b82f6',
    clickable: false,
    formatValue: true,
})

const emit = defineEmits<Emits>()

const iconMap: Record<string, Component> = {
    Box,
    Money,
    User,
    Clock,
    Connection,
    CircleCheck,
    Coin,
    DataLine,
}

const iconComponent = computed(() => iconMap[props.icon] || Box)
const iconTint = computed(() => `${props.iconColor}24`)

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
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    gap: 14px;
    align-items: center;
    height: 100%;
    transition: all 200ms ease;

    &.clickable {
        cursor: pointer;

        &:hover {
            background: var(--glass-bg-hover);
            border-color: var(--border-strong);
            transform: translateY(-2px);
        }
    }

    .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 11px;
        font-size: 20px;
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
            font-weight: 650;
            color: var(--text-primary);
            line-height: 1.15;
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
            color: var(--text-tertiary);
            margin-top: 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }
}
</style>
