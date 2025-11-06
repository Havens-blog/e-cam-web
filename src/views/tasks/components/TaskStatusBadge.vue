<template>
  <el-tag :type="(statusType as any)" :effect="effect" class="task-status-badge">
    <el-icon v-if="showIcon" class="status-icon">
      <component :is="statusIcon" />
    </el-icon>
    {{ statusLabel }}
  </el-tag>
</template>

<script setup lang="ts">
import type { TaskStatus } from '@/api/types/task'
import {
    CircleCloseFilled,
    Loading,
    RemoveFilled,
    SuccessFilled,
    WarningFilled,
} from '@element-plus/icons-vue'
import { computed } from 'vue'

interface Props {
  status: TaskStatus
  showIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: true,
})

const statusConfig = {
  pending: { type: 'info', label: '等待中', icon: WarningFilled, effect: 'plain' },
  running: { type: 'warning', label: '运行中', icon: Loading, effect: 'dark' },
  completed: { type: 'success', label: '已完成', icon: SuccessFilled, effect: 'dark' },
  failed: { type: 'danger', label: '失败', icon: CircleCloseFilled, effect: 'dark' },
  cancelled: { type: 'info', label: '已取消', icon: RemoveFilled, effect: 'plain' },
} as const

const statusType = computed(() => statusConfig[props.status]?.type || 'info')
const statusLabel = computed(() => statusConfig[props.status]?.label || props.status)
const statusIcon = computed(() => statusConfig[props.status]?.icon)
const effect = computed(() => statusConfig[props.status]?.effect || 'plain')
</script>

<style scoped lang="scss">
.task-status-badge {
  .status-icon {
    margin-right: 4px;
    vertical-align: middle;
  }
}
</style>
