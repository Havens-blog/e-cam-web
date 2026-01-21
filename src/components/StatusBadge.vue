<template>
  <el-tag
    :type="tagType"
    :effect="effect"
    :size="size"
    :round="round"
  >
    <div class="status-badge-content">
      <el-icon v-if="showIcon" class="status-icon">
        <component :is="iconComponent" />
      </el-icon>
      <span class="status-text">{{ displayText }}</span>
    </div>
  </el-tag>
</template>

<script setup lang="ts">
import {
    CircleCheck,
    CircleClose,
    Clock,
    Loading,
    Lock,
    Unlock,
    Warning
} from '@element-plus/icons-vue'
import { computed, type Component } from 'vue'

type StatusType = 'user' | 'task' | 'account' | 'tenant' | 'sync'

interface Props {
  status: string
  type?: StatusType
  size?: 'large' | 'default' | 'small'
  effect?: 'dark' | 'light' | 'plain'
  round?: boolean
  showIcon?: boolean
  customText?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'user',
  size: 'default',
  effect: 'light',
  round: false,
  showIcon: true
})

// 状态配置映射
const statusConfig = computed(() => {
  const configs: Record<StatusType, Record<string, { text: string; type: any; icon: Component }>> = {
    user: {
      active: { text: '正常', type: 'success', icon: CircleCheck },
      inactive: { text: '禁用', type: 'danger', icon: CircleClose },
      locked: { text: '锁定', type: 'warning', icon: Lock },
      pending: { text: '待激活', type: 'info', icon: Clock }
    },
    task: {
      pending: { text: '等待中', type: 'info', icon: Clock },
      running: { text: '执行中', type: 'warning', icon: Loading },
      success: { text: '成功', type: 'success', icon: CircleCheck },
      failed: { text: '失败', type: 'danger', icon: CircleClose },
      cancelled: { text: '已取消', type: 'info', icon: Warning }
    },
    account: {
      active: { text: '正常', type: 'success', icon: CircleCheck },
      inactive: { text: '停用', type: 'danger', icon: CircleClose },
      expired: { text: '已过期', type: 'warning', icon: Warning },
      syncing: { text: '同步中', type: 'warning', icon: Loading }
    },
    tenant: {
      active: { text: '正常', type: 'success', icon: CircleCheck },
      inactive: { text: '停用', type: 'danger', icon: CircleClose },
      suspended: { text: '暂停', type: 'warning', icon: Warning }
    },
    sync: {
      enabled: { text: '已启用', type: 'success', icon: Unlock },
      disabled: { text: '已禁用', type: 'info', icon: Lock }
    }
  }

  return configs[props.type] || configs.user
})

// 当前状态配置
const currentConfig = computed(() => {
  return statusConfig.value[props.status] || {
    text: props.status,
    type: 'info',
    icon: Warning
  }
})

// 标签类型
const tagType = computed(() => currentConfig.value.type)

// 图标组件
const iconComponent = computed(() => currentConfig.value.icon)

// 显示文本
const displayText = computed(() => {
  return props.customText || currentConfig.value.text
})
</script>

<style scoped lang="scss">
.status-badge-content {
  display: flex;
  align-items: center;
  gap: 4px;

  .status-icon {
    display: flex;
    align-items: center;
    font-size: 14px;
  }

  .status-text {
    line-height: 1;
  }
}
</style>
